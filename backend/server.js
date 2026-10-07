import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);

// Correct path to frontend folder (tara folder structure mujab backend thi ek step bahar frontend che)
const FRONTEND = path.join(__dirname, '../frontend');

const db = new Database(path.join(__dirname, 'loanleads.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS leads (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, mobile TEXT NOT NULL, email TEXT,
 city TEXT NOT NULL, loan_type TEXT NOT NULL, loan_amount INTEGER NOT NULL, monthly_income INTEGER NOT NULL,
 employment_type TEXT NOT NULL, existing_emi INTEGER DEFAULT 0, cibil_range TEXT, consent INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'New', notes TEXT DEFAULT '', dsa_id INTEGER, follow_up_date TEXT, disbursed_amount INTEGER DEFAULT 0,
 payout_percent REAL DEFAULT 0, expected_payout REAL DEFAULT 0, actual_payout REAL DEFAULT 0, payout_status TEXT DEFAULT 'Unpaid',
 payout_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS dsas (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company TEXT NOT NULL, contact_person TEXT NOT NULL, mobile TEXT, email TEXT,
 loan_types TEXT DEFAULT '', active INTEGER NOT NULL DEFAULT 1, notes TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payouts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL, dsa_id INTEGER, loan_amount INTEGER DEFAULT 0, disbursed_amount INTEGER DEFAULT 0,
 payout_percent REAL DEFAULT 0, expected_payout REAL DEFAULT 0, actual_payout REAL DEFAULT 0, status TEXT DEFAULT 'Unpaid', payment_date TEXT,
 notes TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS tickets (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, mobile TEXT, email TEXT, subject TEXT NOT NULL, message TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'New', assigned_staff TEXT DEFAULT '', follow_up_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS activity_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER, action TEXT NOT NULL, details TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admin_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, ip TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

// Lightweight migration for databases created by the older database build.
for (const sql of [
 "ALTER TABLE leads ADD COLUMN dsa_id INTEGER", "ALTER TABLE leads ADD COLUMN follow_up_date TEXT",
 "ALTER TABLE leads ADD COLUMN disbursed_amount INTEGER DEFAULT 0", "ALTER TABLE leads ADD COLUMN payout_percent REAL DEFAULT 0",
 "ALTER TABLE leads ADD COLUMN expected_payout REAL DEFAULT 0", "ALTER TABLE leads ADD COLUMN actual_payout REAL DEFAULT 0",
 "ALTER TABLE leads ADD COLUMN payout_status TEXT DEFAULT 'Unpaid'", "ALTER TABLE leads ADD COLUMN payout_date TEXT",
 "ALTER TABLE leads ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP"
]) { try { db.exec(sql); } catch {} }

const loanTypes = [
 'Personal Loan','Business Loan','Home Loan','Car Loan','Two-Wheeler Loan','Commercial Vehicle Loan','Education Loan',
 'Loan Against Property (LAP)','Working Capital','Cash Credit (CC)','Overdraft (OD)','Machinery Loan','Balance Transfer',
 'Construction Finance','Professional Loan','Other Loan Requirement'
];
const statuses = ['New','Contacted','Processing','Approved','Rejected','Disbursed','Closed'];
const ticketStatuses = ['New','Open','In Progress','Resolved'];
const payoutStatuses = ['Unpaid','Paid'];
const employmentTypes = ['Salaried','Self-employed','Business owner','Professional','Other'];
const cibilRanges = ['Below 650','650–699','700–749','750+','Not sure'];
const sessions = new Map();
const loginAttempts = new Map();
const rateBuckets = new Map();

function cleanText(v, max=500){ return String(v ?? '').trim().slice(0,max); }
function cleanNumber(v){ const n=Number(v); return Number.isFinite(n) ? Math.round(n) : 0; }
function validMobile(v){ return /^[6-9]\d{9}$/.test(String(v||'')); }
function adminCredentials(){ return { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'ChangeMe123!' }; }
function audit(action, req){ db.prepare('INSERT INTO admin_audit(action,ip) VALUES(?,?)').run(action, req.ip || ''); }
function activity(leadId, action, details=''){ db.prepare('INSERT INTO activity_logs(lead_id,action,details) VALUES(?,?,?)').run(leadId,action,details); }
function createSession(user, role='admin'){ const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,{user,role,expires:Date.now()+8*60*60*1000}); return token; }
function getCookie(req,name){ const h=req.headers.cookie||''; const found=h.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'=')); return found ? decodeURIComponent(found.slice(name.length+1)) : ''; }
function requireAdmin(req,res,next){ const token=getCookie(req,'loansmeet_admin'); const s=sessions.get(token); if(!token||!s||s.expires<Date.now()) return res.status(401).json({error:'Admin authentication required.'}); req.admin=s; next(); }
function rateLimit(req,res,next){ const key=req.ip||'unknown',now=Date.now(); const b=rateBuckets.get(key)||{start:now,count:0}; if(now-b.start>60000){b.start=now;b.count=0} b.count++; rateBuckets.set(key,b); if(b.count>180)return res.status(429).json({error:'Too many requests. Please try again shortly.'}); next(); }
setInterval(()=>{ const c=Date.now()-90000; for(const [k,v] of rateBuckets)if(v.start<c)rateBuckets.delete(k); for(const [k,v] of sessions)if(v.expires<Date.now())sessions.delete(k); },90000).unref();

// Security Headers & Static Files Middleware (Crucial for CSS/JS loading)
app.use((req,res,next)=>{ res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('X-Frame-Options','SAMEORIGIN'); res.setHeader('Referrer-Policy','strict-origin-when-cross-origin'); res.setHeader('Permissions-Policy','camera=(),microphone=(),geolocation=()'); res.setHeader('Cross-Origin-Opener-Policy','same-origin'); res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self';"); next(); });
app.use(rateLimit); 
app.use(express.json({limit:'100kb'})); 
app.use(express.urlencoded({extended:false})); 

// MUST HAVE: This serves your frontend folder (CSS, JS, Images) correctly
app.use(express.static(FRONTEND));

app.get('/api/health',(_req,res)=>res.json({ok:true,service:'loansmeet'}));
app.get('/api/loan-types',(_req,res)=>res.json(loanTypes));
app.post('/api/calculate-emi',(req,res)=>{
 const b=req.body||{};
 const principal=cleanNumber(b.amount);
 const annualRate=Number(b.rate);
 const months=cleanNumber(b.tenure);

 if(!principal || !Number.isFinite(annualRate) || !months || principal<=0 || annualRate<0 || months<=0){
   return res.status(400).json({error:'Please provide valid EMI details.'});
 }

 const monthlyRate=annualRate/12/100;
 const emi=monthlyRate===0
   ? principal/months
   : principal*monthlyRate*Math.pow(1+monthlyRate,months)/(Math.pow(1+monthlyRate,months)-1);

 const totalPayment=emi*months;
 const totalInterest=totalPayment-principal;

 res.json({
   ok:true,
   emi:Math.round(emi),
   totalPayment:Math.round(totalPayment),
   totalInterest:Math.round(totalInterest)
 });
});
app.post('/api/leads',(req,res)=>{
 const b=req.body||{}, name=cleanText(b.name,120), mobile=cleanText(b.mobile,15), email=cleanText(b.email,180), city=cleanText(b.city,120), loanType=cleanText(b.loanType,80);
 const loanAmount=cleanNumber(b.loanAmount), income=cleanNumber(b.monthlyIncome), employment=cleanText(b.employmentType,50), emi=Math.max(0,cleanNumber(b.existingEmi)), cibil=cleanText(b.cibilRange,30), consent=b.consent===true;
 const validEmail=!email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
 if(!name||!validMobile(mobile)||!validEmail||!city||!loanTypes.includes(loanType)||loanAmount<10000||loanAmount>100000000||income<=0||income>100000000||!employmentTypes.includes(employment)||emi>100000000||!cibilRanges.includes(cibil)||!consent) return res.status(400).json({error:'Please provide valid required details and consent.'});
 const r=db.prepare(`INSERT INTO leads(name,mobile,email,city,loan_type,loan_amount,monthly_income,employment_type,existing_emi,cibil_range,consent) VALUES(?,?,?,?,?,?,?,?,?,?,1)`).run(name,mobile,email,city,loanType,loanAmount,income,employment,emi,cibil);
 activity(r.lastInsertRowid,'Lead created','Customer application submitted'); res.status(201).json({ok:true,leadId:r.lastInsertRowid});
});

app.post('/api/support',(req,res)=>{ const b=req.body||{},name=cleanText(b.name,120),mobile=cleanText(b.mobile,15),email=cleanText(b.email,180),subject=cleanText(b.subject,160),message=cleanText(b.message,2000); if(!name||!subject||!message)return res.status(400).json({error:'Please complete the required support details.'}); const r=db.prepare('INSERT INTO tickets(name,mobile,email,subject,message) VALUES(?,?,?,?,?)').run(name,mobile,email,subject,message); res.status(201).json({ok:true,ticketId:r.lastInsertRowid}); });

app.post('/api/ai',(req,res)=>{
 const q=cleanText(req.body?.message,1000), lang=cleanText(req.body?.language,'en');
 const l=lang==='gu'?'gu':lang==='hi'?'hi':/[અ-હ]/.test(q)?'gu':/[\u0900-\u097F]/.test(q)?'hi':'en';
 const lower=q.toLowerCase(); let answer;
 const en={greet:'Hello! I am the LOANSMEET virtual assistant. I can explain loan types, documents, eligibility basics, EMI concepts and how to apply.',apply:'You can apply using the Apply Now form. Enter your requirement, income, employment type, city, CIBIL range and consent. Our team can review the enquiry and guide you to a suitable partner.',docs:'Documents vary by loan and partner. Commonly requested items can include identity/address proof, income or business proof and bank statements. The final partner decides what is required.',elig:'Eligibility depends on the lender, income, existing obligations, credit profile and other criteria. I cannot guarantee approval.',emi:'EMI depends on loan amount, interest rate and tenure. I can explain the basics, but LOANSMEET does not promise a specific rate or approval.',process:'Our process is: Requirement → LOANSMEET Team Review → Suitable Partner → Customer Contact → Further Process.',safe:'LOANSMEET does not guarantee approval, invent rates or make RBI claims. Final approval and terms are decided by the lending partner.'};
 const hi={greet:'नमस्ते! मैं LOANSMEET का virtual assistant हूँ। मैं loan types, documents, basic eligibility, EMI और apply करने की प्रक्रिया समझा सकता हूँ।',apply:'Apply Now form से आवेदन करें। अपनी requirement, income, employment type, city, CIBIL range और consent भरें। हमारी team enquiry review करके suitable partner के बारे में guide कर सकती है।',docs:'Documents loan और partner के अनुसार अलग हो सकते हैं। आम तौर पर identity/address proof, income या business proof और bank statements मांगे जा सकते हैं।',elig:'Eligibility lender, income, existing obligations और credit profile पर निर्भर करती है। Approval की guarantee नहीं दी जा सकती।',emi:'EMI loan amount, interest rate और tenure पर निर्भर करती है। मैं basics समझा सकता हूँ, लेकिन LOANSMEET कोई specific rate या approval promise नहीं करता।',process:'Process: Requirement → LOANSMEET Team Review → Suitable Partner → Customer Contact → Further Process.',safe:'LOANSMEET approval guarantee, fake rates या unsupported RBI claims नहीं करता। Final approval और terms lending partner तय करता है।'};
 const gu={greet:'નમસ્તે! હું LOANSMEET virtual assistant છું. હું loan types, documents, basic eligibility, EMI અને apply કરવાની process સમજાવી શકું છું.',apply:'Apply Now form થી અરજી કરો. Requirement, income, employment type, city, CIBIL range અને consent ભરો. અમારી team enquiry review કરીને suitable partner માટે guide કરી શકે છે.',docs:'Documents loan અને partner પ્રમાણે અલગ હોઈ શકે છે. સામાન્ય રીતે identity/address proof, income અથવા business proof અને bank statements માંગવામાં આવી શકે છે.',elig:'Eligibility lender, income, existing obligations અને credit profile પર આધારિત હોય છે. Approval ની guarantee આપી શકાતી નથી.',emi:'EMI loan amount, interest rate અને tenure પર આધારિત હોય છે. હું basics સમજાવી શકું છું, પરંતુ LOANSMEET કોઈ specific rate કે approval promise કરતું નથી.',process:'Process: Requirement → LOANSMEET Team Review → Suitable Partner → Customer Contact → Further Process.',safe:'LOANSMEET approval guarantee, fake rates અથવા unsupported RBI claims કરતું નથી. Final approval અને terms lending partner નક્કી કરે છે.'};
 const t=l==='gu'?gu:l==='hi'?hi:en;
 if(/apply|અરજી|आवेदन|form|apply ky/.test(lower)||/apply/.test(q))answer=t.apply; else if(/document|docs|દસ્તાવેજ|दस्तावेज/.test(lower))answer=t.docs; else if(/eligib|eligible|પાત્ર|पात्र/.test(lower))answer=t.elig; else if(/emi|installment|હપ્ત|किस्त/.test(lower))answer=t.emi; else if(/process|કેમ|कैसे|how/.test(lower))answer=t.process; else if(/guarantee|100%|rbi|guaranteed|ગેરંટી|गारंटी/.test(lower))answer=t.safe; else if(/hello|hi|hey|નમસ્તે|નમસ્કાર|नमस्ते/.test(lower))answer=t.greet; else answer=t.greet+' '+t.process;
 res.json({ok:true,language:l,answer});
});

app.post('/api/admin/login',(req,res)=>{ const {username,password,secondFactor=''}=req.body||{}, creds=adminCredentials(); const key=req.ip||'unknown', now=Date.now(), a=loginAttempts.get(key)||{start:now,count:0}; if(now-a.start>600000){a.start=now;a.count=0} if(a.count>=10)return res.status(429).json({error:'Too many login attempts. Try again later.'}); if(String(username)!==creds.username||String(password)!==creds.password){a.count++;loginAttempts.set(key,a);return res.status(401).json({error:'Invalid username or password.'});} if(process.env.ADMIN_2FA_CODE && String(secondFactor)!==String(process.env.ADMIN_2FA_CODE)) return res.status(401).json({error:'Second-factor code required.'}); a.count=0;loginAttempts.set(key,a); const token=createSession(username); res.setHeader('Set-Cookie',`loansmeet_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.NODE_ENV==='production'?'; Secure':''}`); audit('Admin login',req); res.json({ok:true,twoFactor:!!process.env.ADMIN_2FA_CODE}); });
app.post('/api/admin/logout',(req,res)=>{const t=getCookie(req,'loansmeet_admin');sessions.delete(t);res.setHeader('Set-Cookie','loansmeet_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');res.json({ok:true});});
app.get('/api/admin/me',requireAdmin,(req,res)=>res.json({ok:true,user:req.admin.user,role:req.admin.role,twoFactor:!!process.env.ADMIN_2FA_CODE}));

app.get('/api/admin/stats',requireAdmin,(_req,res)=>{ const count=s=>db.prepare('SELECT COUNT(*) n FROM leads WHERE status=?').get(s).n; const total=db.prepare('SELECT COUNT(*) n FROM leads').get().n; const expected=db.prepare('SELECT COALESCE(SUM(expected_payout),0) n FROM leads').get().n; const received=db.prepare("SELECT COALESCE(SUM(actual_payout),0) n FROM leads WHERE payout_status='Paid'").get().n; res.json({total,today:db.prepare("SELECT COUNT(*) n FROM leads WHERE date(created_at,'localtime')=date('now','localtime')").get().n,newLeads:count('New'),contacted:count('Contacted'),processing:count('Processing'),approved:count('Approved'),rejected:count('Rejected'),disbursed:count('Disbursed'),closed:count('Closed'),expected,received,pending:expected-received}); });
app.get('/api/admin/leads',requireAdmin,(req,res)=>{ const search=cleanText(req.query.search,100),status=cleanText(req.query.status,30),loanType=cleanText(req.query.loanType,80),limit=Math.min(Math.max(cleanNumber(req.query.limit||500),1),1000);const where=[],p={};if(search){where.push('(l.name LIKE @search OR l.mobile LIKE @search OR l.city LIKE @search OR l.email LIKE @search)');p.search=`%${search}%`}if(status&&statuses.includes(status)){where.push('l.status=@status');p.status=status}if(loanType&&loanTypes.includes(loanType)){where.push('l.loan_type=@loanType');p.loanType=loanType}const sql=`SELECT l.*,d.company dsa_company FROM leads l LEFT JOIN dsas d ON d.id=l.dsa_id ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY l.id DESC LIMIT ${limit}`;res.json(db.prepare(sql).all(p));});
app.get('/api/admin/leads/:id',requireAdmin,(req,res)=>{const id=Number(req.params.id),row=db.prepare('SELECT l.*,d.company dsa_company FROM leads l LEFT JOIN dsas d ON d.id=l.dsa_id WHERE l.id=?').get(id);if(!row)return res.status(404).json({error:'Lead not found.'});res.json({...row,activity:db.prepare('SELECT * FROM activity_logs WHERE lead_id=? ORDER BY id DESC').all(id)});});
app.patch('/api/admin/leads/:id',requireAdmin,(req,res)=>{const id=Number(req.params.id),b=req.body||{},status=cleanText(b.status,30),notes=cleanText(b.notes,2000),dsaId=b.dsaId?Number(b.dsaId):null,follow=cleanText(b.followUpDate,30),disbursed=Math.max(0,cleanNumber(b.disbursedAmount)),pct=Math.max(0,Number(b.payoutPercent)||0),actual=Math.max(0,Number(b.actualPayout)||0),payoutStatus=payoutStatuses.includes(b.payoutStatus)?b.payoutStatus:'Unpaid';if(!Number.isInteger(id)||!statuses.includes(status))return res.status(400).json({error:'Invalid update.'});const expected=Math.round(disbursed*pct)/100;const r=db.prepare(`UPDATE leads SET status=?,notes=?,dsa_id=?,follow_up_date=?,disbursed_amount=?,payout_percent=?,expected_payout=?,actual_payout=?,payout_status=?,payout_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(status,notes,dsaId,follow,disbursed,pct,expected,actual,payoutStatus,cleanText(b.payoutDate,30)||null,id);if(!r.changes)return res.status(404).json({error:'Lead not found.'});activity(id,'Lead updated',`Status: ${status}`); db.prepare('INSERT INTO payouts(lead_id,dsa_id,loan_amount,disbursed_amount,payout_percent,expected_payout,actual_payout,status,payment_date,notes) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,dsaId,cleanNumber(b.loanAmount||0),disbursed,pct,expected,actual,payoutStatus,cleanText(b.payoutDate,30)||null,cleanText(b.notes,500)); res.json({ok:true,expectedPayout:expected});});

app.get('/api/admin/dsas',requireAdmin,(_req,res)=>res.json(db.prepare(`SELECT d.*,COUNT(l.id) lead_count,COALESCE(SUM(CASE WHEN l.status='Disbursed' THEN 1 ELSE 0 END),0) disbursed_count,COALESCE(SUM(l.actual_payout),0) received_payout FROM dsas d LEFT JOIN leads l ON l.dsa_id=d.id GROUP BY d.id ORDER BY d.id DESC`).all()));
app.post('/api/admin/dsas',requireAdmin,(req,res)=>{const b=req.body||{},company=cleanText(b.company,160),contact=cleanText(b.contactPerson,120);if(!company||!contact)return res.status(400).json({error:'Company and contact person are required.'});const r=db.prepare('INSERT INTO dsas(company,contact_person,mobile,email,loan_types,active,notes) VALUES(?,?,?,?,?,?,?)').run(company,contact,cleanText(b.mobile,15),cleanText(b.email,180),cleanText(b.loanTypes,1000),b.active===false?0:1,cleanText(b.notes,1000));res.json({ok:true,id:r.lastInsertRowid});});
app.patch('/api/admin/dsas/:id',requireAdmin,(req,res)=>{const b=req.body||{},id=Number(req.params.id);const r=db.prepare('UPDATE dsas SET company=?,contact_person=?,mobile=?,email=?,loan_types=?,active=?,notes=? WHERE id=?').run(cleanText(b.company,160),cleanText(b.contactPerson,120),cleanText(b.mobile,15),cleanText(b.email,180),cleanText(b.loanTypes,1000),b.active?1:0,cleanText(b.notes,1000),id);if(!r.changes)return res.status(404).json({error:'DSA not found.'});res.json({ok:true});});

app.get('/api/admin/payouts',requireAdmin,(_req,res)=>res.json(db.prepare('SELECT l.id lead_id,l.name,l.loan_type,l.loan_amount,l.disbursed_amount,l.payout_percent,l.expected_payout,l.actual_payout,l.payout_status,l.payout_date,d.company dsa_company FROM leads l LEFT JOIN dsas d ON d.id=l.dsa_id WHERE l.disbursed_amount>0 OR l.expected_payout>0 ORDER BY l.id DESC').all()));
app.get('/api/admin/tickets',requireAdmin,(_req,res)=>res.json(db.prepare('SELECT * FROM tickets ORDER BY id DESC').all()));
app.patch('/api/admin/tickets/:id',requireAdmin,(req,res)=>{const b=req.body||{},id=Number(req.params.id),status=cleanText(b.status,30);if(!ticketStatuses.includes(status))return res.status(400).json({error:'Invalid ticket status.'});const r=db.prepare('UPDATE tickets SET status=?,assigned_staff=?,follow_up_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,cleanText(b.assignedStaff,120),cleanText(b.followUpDate,30)||null,id);if(!r.changes)return res.status(404).json({error:'Ticket not found.'});res.json({ok:true});});
app.get('/api/admin/audit',requireAdmin,(_req,res)=>res.json(db.prepare('SELECT * FROM admin_audit ORDER BY id DESC LIMIT 200').all()));

app.get('/api/admin/export.csv',requireAdmin,(_req,res)=>{const rows=db.prepare('SELECT * FROM leads ORDER BY id DESC').all();const headers=['id','name','mobile','email','city','loan_type','loan_amount','monthly_income','employment_type','existing_emi','cibil_range','consent','status','dsa_id','follow_up_date','disbursed_amount','payout_percent','expected_payout','actual_payout','payout_status','payout_date','notes','created_at'];const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;const csv=[headers.join(','),...rows.map(r=>headers.map(h=>esc(r[h])).join(','))].join('\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="loansmeet-leads.csv"');res.send(csv);});

app.get('/admin',(_req,res)=>res.sendFile(path.join(FRONTEND,'admin.html')));
app.get('/privacy',(_req,res)=>res.sendFile(path.join(FRONTEND,'privacy.html')));
app.get('/terms',(_req,res)=>res.sendFile(path.join(FRONTEND,'terms.html')));
app.get('*',(_req,res)=>res.sendFile(path.join(FRONTEND,'index.html')));

app.listen(PORT,()=>console.log(`LOANSMEET running at http://localhost:${PORT}`));
