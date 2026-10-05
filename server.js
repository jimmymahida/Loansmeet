import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
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
CREATE TABLE IF NOT EXISTS applications (
 id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL UNIQUE, application_code TEXT NOT NULL UNIQUE, access_token_hash TEXT NOT NULL, priority TEXT DEFAULT 'Normal', expires_at TEXT, cancelled_at TEXT, reopened_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS application_status_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT, application_id INTEGER NOT NULL, status TEXT NOT NULL, note TEXT DEFAULT '', actor TEXT DEFAULT 'system', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS followups (
 id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL, due_at TEXT NOT NULL, note TEXT DEFAULT '', status TEXT DEFAULT 'Pending', assigned_to TEXT DEFAULT '', completed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS documents (
 id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL, application_id INTEGER, document_type TEXT NOT NULL, file_name TEXT NOT NULL, storage_path TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, version INTEGER DEFAULT 1, verification_status TEXT DEFAULT 'Pending', rejection_reason TEXT DEFAULT '', expires_at TEXT, uploaded_by TEXT DEFAULT 'customer', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notification_outbox (
 id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER, recipient TEXT, channel TEXT NOT NULL, event_type TEXT NOT NULL, subject TEXT DEFAULT '', message TEXT NOT NULL, status TEXT DEFAULT 'Queued', provider_ref TEXT DEFAULT '', sent_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS loan_products (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL, description TEXT DEFAULT '', min_amount INTEGER DEFAULT 0, max_amount INTEGER DEFAULT 0, min_tenure INTEGER DEFAULT 0, max_tenure INTEGER DEFAULT 0, interest_info TEXT DEFAULT '', fee_info TEXT DEFAULT '', eligibility TEXT DEFAULT '', documents TEXT DEFAULT '', benefits TEXT DEFAULT '', conditions TEXT DEFAULT '', partner_mapping TEXT DEFAULT '', city_availability TEXT DEFAULT '', employment_eligibility TEXT DEFAULT '', income_criteria TEXT DEFAULT '', cibil_criteria TEXT DEFAULT '', active INTEGER DEFAULT 1, version INTEGER DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS cms_content (
 id INTEGER PRIMARY KEY AUTOINCREMENT, content_key TEXT NOT NULL, language TEXT DEFAULT 'en', title TEXT DEFAULT '', body TEXT DEFAULT '', seo_title TEXT DEFAULT '', seo_description TEXT DEFAULT '', social_image TEXT DEFAULT '', status TEXT DEFAULT 'Draft', scheduled_at TEXT, version INTEGER DEFAULT 1, updated_by TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(content_key,language,version)
);
CREATE TABLE IF NOT EXISTS partner_accounts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, dsa_id INTEGER NOT NULL UNIQUE, email TEXT UNIQUE, password_hash TEXT, status TEXT DEFAULT 'Pending', verified_at TEXT, agreement_status TEXT DEFAULT 'Pending', referral_code TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(dsa_id) REFERENCES dsas(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS partner_leads (
 id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL, dsa_id INTEGER NOT NULL, status TEXT DEFAULT 'Offered', response_note TEXT DEFAULT '', responded_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(lead_id,dsa_id), FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE, FOREIGN KEY(dsa_id) REFERENCES dsas(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS partner_documents (
 id INTEGER PRIMARY KEY AUTOINCREMENT, dsa_id INTEGER NOT NULL, document_type TEXT NOT NULL, file_name TEXT NOT NULL, storage_path TEXT NOT NULL, verification_status TEXT DEFAULT 'Pending', rejection_reason TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(dsa_id) REFERENCES dsas(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS referrals (
 id INTEGER PRIMARY KEY AUTOINCREMENT, referrer_dsa_id INTEGER, referral_code TEXT NOT NULL, lead_id INTEGER, status TEXT DEFAULT 'Created', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS feedback (
 id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER, dsa_id INTEGER, rating INTEGER, comment TEXT DEFAULT '', source TEXT DEFAULT 'customer', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS communication_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER, channel TEXT NOT NULL, direction TEXT DEFAULT 'outbound', message TEXT NOT NULL, provider_ref TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS analytics_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, event_name TEXT NOT NULL, path TEXT DEFAULT '', referrer TEXT DEFAULT '', user_agent TEXT DEFAULT '', ip TEXT DEFAULT '', metadata TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS customer_accounts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, status TEXT DEFAULT 'Active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS customer_sessions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(customer_id) REFERENCES customer_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_leads_mobile ON leads(mobile);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_history_application ON application_status_history(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_lead ON documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_followups_due ON followups(due_at,status);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notification_outbox(status,created_at);
`);

// Lightweight migration for databases created by the older database build.
for (const sql of [
 "ALTER TABLE leads ADD COLUMN dsa_id INTEGER", "ALTER TABLE leads ADD COLUMN follow_up_date TEXT",
 "ALTER TABLE leads ADD COLUMN disbursed_amount INTEGER DEFAULT 0", "ALTER TABLE leads ADD COLUMN payout_percent REAL DEFAULT 0",
 "ALTER TABLE leads ADD COLUMN expected_payout REAL DEFAULT 0", "ALTER TABLE leads ADD COLUMN actual_payout REAL DEFAULT 0",
 "ALTER TABLE leads ADD COLUMN payout_status TEXT DEFAULT 'Unpaid'", "ALTER TABLE leads ADD COLUMN payout_date TEXT",
 "ALTER TABLE leads ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP"
]) { try { db.exec(sql); } catch {} }

const UPLOAD_DIR = process.env.DOCUMENT_STORAGE_DIR ? path.resolve(process.env.DOCUMENT_STORAGE_DIR) : path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const allowedDocumentMimes = new Set(['application/pdf','image/jpeg','image/png']);
const documentTypes = ['PAN','Aadhaar','Address Proof','Bank Statement','Salary Slip','ITR','GST','Business Proof','Property Document','Other'];
const applicationPriorities = ['Low','Normal','High','Urgent'];
const applicationPublicStatuses = ['New','Contacted','Processing','Approved','Rejected','Disbursed','Closed','Cancelled'];
function sha256(v){ return crypto.createHash('sha256').update(String(v)).digest('hex'); }
function passwordHash(password){ const salt=crypto.randomBytes(16).toString('hex'); const key=crypto.scryptSync(String(password),salt,64).toString('hex'); return `scrypt$${salt}$${key}`; }
function passwordVerify(password,stored){ try { const [alg,salt,key]=String(stored).split('$'); if(alg!=='scrypt'||!salt||!key)return false; const actual=crypto.scryptSync(String(password),salt,64).toString('hex'); return crypto.timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(key,'hex')); } catch { return false; } }
function issueSessionToken(){ return crypto.randomBytes(32).toString('hex'); }
function passwordValid(v){ return typeof v==='string' && v.length>=10 && v.length<=200; }
function makeApplicationCode(id){ return `LM-${new Date().getFullYear()}-${String(id).padStart(7,'0')}`; }
function issueTrackingToken(){ return crypto.randomBytes(24).toString('base64url'); }
function queueNotification(leadId, recipient, channel, eventType, message, subject=''){ if(!recipient)return; db.prepare('INSERT INTO notification_outbox(lead_id,recipient,channel,event_type,subject,message) VALUES(?,?,?,?,?,?)').run(leadId,recipient,channel,eventType,subject,message); }
async function deliverNotification(row){
  const channel=String(row.channel||'').toLowerCase();
  const to=String(row.recipient||'');
  const body=String(row.message||'');
  try {
    let response;
    if(channel==='email' && process.env.SENDGRID_API_KEY && process.env.NOTIFY_FROM_EMAIL){
      response=await fetch('https://api.sendgrid.com/v3/mail/send',{method:'POST',headers:{Authorization:`Bearer ${process.env.SENDGRID_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({personalizations:[{to:[{email:to}]}],from:{email:process.env.NOTIFY_FROM_EMAIL},subject:row.subject||'LOANSMEET notification',content:[{type:'text/plain',value:body}]})});
    } else if(channel==='sms' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER){
      const auth=Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(process.env.TWILIO_ACCOUNT_SID)}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({To:to,From:process.env.TWILIO_FROM_NUMBER,Body:body})});
    } else if(channel==='whatsapp' && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID){
      response=await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID)}/messages`,{method:'POST',headers:{Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:to.replace(/^\+/,'').replace(/\D/g,''),type:'text',text:{body}})});
    } else return {skipped:true,reason:'provider_not_configured'};
    const ok=response.ok; const data=await response.text();
    if(!ok) throw new Error(`provider_${response.status}`);
    return {ok:true,providerRef:data.slice(0,500)};
  } catch(error){ return {ok:false,error:error.message}; }
}
async function drainNotifications(){
  const rows=db.prepare("SELECT * FROM notification_outbox WHERE status='Queued' ORDER BY id LIMIT 20").all();
  for(const row of rows){
    const result=await deliverNotification(row);
    if(result.skipped) continue;
    db.prepare("UPDATE notification_outbox SET status=?,provider_ref=?,sent_at=CASE WHEN ?='Sent' THEN CURRENT_TIMESTAMP ELSE sent_at END WHERE id=?").run(result.ok?'Sent':'Failed',result.providerRef||result.error||'',result.ok?'Sent':'Failed',row.id);
    if(row.lead_id) db.prepare('INSERT INTO communication_logs(lead_id,channel,direction,message,provider_ref) VALUES(?,?,?,?,?)').run(row.lead_id,row.channel,'outbound',row.message,result.providerRef||result.error||'');
  }
}
function scoreLead(row){ let score=40; if(row.cibil_range==='750+')score+=30; else if(row.cibil_range==='700–749')score+=22; else if(row.cibil_range==='650–699')score+=10; if(row.monthly_income>=100000)score+=15; else if(row.monthly_income>=50000)score+=8; if(row.existing_emi>row.monthly_income*.5)score-=20; if(row.email)score+=5; if(row.consent)score+=5; return Math.max(0,Math.min(100,score)); }
function smartMatches(lead){ return db.prepare('SELECT * FROM dsas WHERE active=1 ORDER BY id ASC').all().map(d=>{ const types=(d.loan_types||'').toLowerCase(); const typeMatch=!types||types.includes(String(lead.loan_type).toLowerCase()); return {...d,match_score:(typeMatch?60:20)+(lead.cibil_range==='750+'?20:0)+(lead.monthly_income>=50000?10:0)} }).filter(x=>x.match_score>=40).sort((a,b)=>b.match_score-a.match_score); }
function ensureApplication(leadId){ const existing=db.prepare('SELECT * FROM applications WHERE lead_id=?').get(leadId); if(existing)return existing; const token=issueTrackingToken(); const code=makeApplicationCode(leadId); const expires=new Date(Date.now()+180*86400000).toISOString(); const r=db.prepare('INSERT INTO applications(lead_id,application_code,access_token_hash,expires_at) VALUES(?,?,?,?)').run(leadId,code,sha256(token),expires); db.prepare('INSERT INTO application_status_history(application_id,status,note,actor) VALUES(?,?,?,?)').run(r.lastInsertRowid,'New','Application created','system'); return {...db.prepare('SELECT * FROM applications WHERE id=?').get(r.lastInsertRowid), accessToken:token}; }


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
function adminCredentials(){ const username=process.env.ADMIN_USERNAME || 'admin'; const password=process.env.ADMIN_PASSWORD || ''; if(!password && process.env.NODE_ENV==='production') return {username,password:null}; return {username,password:password||'ChangeMe123!'}; }
function audit(action, req){ db.prepare('INSERT INTO admin_audit(action,ip) VALUES(?,?)').run(action, req.ip || ''); }
function activity(leadId, action, details=''){ db.prepare('INSERT INTO activity_logs(lead_id,action,details) VALUES(?,?,?)').run(leadId,action,details); }
function createSession(user, role='admin'){ const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,{user,role,expires:Date.now()+8*60*60*1000}); return token; }
function getCookie(req,name){ const h=req.headers.cookie||''; const found=h.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'=')); return found ? decodeURIComponent(found.slice(name.length+1)) : ''; }
function requireAdmin(req,res,next){ const token=getCookie(req,'loansmeet_admin'); const s=sessions.get(token); if(!token||!s||s.expires<Date.now()) return res.status(401).json({error:'Admin authentication required.'}); req.admin=s; next(); }
function getBearer(req){ return cleanText(req.headers.authorization?.replace(/^Bearer\s+/i,''),120); }
function requireCustomer(req,res,next){ const raw=getBearer(req); const s=db.prepare("SELECT cs.*,ca.lead_id,ca.email FROM customer_sessions cs JOIN customer_accounts ca ON ca.id=cs.customer_id WHERE cs.token_hash=? AND ca.status='Active'").get(sha256(raw)); if(!raw||!s||new Date(s.expires_at)<=new Date()) return res.status(401).json({error:'Customer authentication required.'}); req.customer=s; next(); }
function requirePartner(req,res,next){ const raw=getBearer(req); const s=db.prepare("SELECT ps.*,pa.dsa_id,pa.email,pa.status FROM partner_sessions ps JOIN partner_accounts pa ON pa.id=ps.partner_id WHERE ps.token_hash=?").get(sha256(raw)); if(!raw||!s||s.status!=='Active'||new Date(s.expires_at)<=new Date()) return res.status(401).json({error:'Partner authentication required.'}); req.partner=s; next(); }
function rateLimit(req,res,next){ const key=req.ip||'unknown',now=Date.now(); const b=rateBuckets.get(key)||{start:now,count:0}; if(now-b.start>60000){b.start=now;b.count=0} b.count++; rateBuckets.set(key,b); if(b.count>180)return res.status(429).json({error:'Too many requests. Please try again shortly.'}); next(); }
setInterval(()=>{ drainNotifications().catch(()=>{}); const c=Date.now()-90000; for(const [k,v] of rateBuckets)if(v.start<c)rateBuckets.delete(k); for(const [k,v] of sessions)if(v.expires<Date.now())sessions.delete(k); },90000).unref();

app.use((req,res,next)=>{ res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('X-Frame-Options','SAMEORIGIN'); res.setHeader('Referrer-Policy','strict-origin-when-cross-origin'); res.setHeader('Permissions-Policy','camera=(),microphone=(),geolocation=()'); res.setHeader('Cross-Origin-Opener-Policy','same-origin'); res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self';"); next(); });
app.use(rateLimit); app.use(express.json({limit:'7mb'})); app.use(express.urlencoded({extended:false})); app.use(express.static(FRONTEND));

app.get('/api/health',(_req,res)=>{ const storage=process.env.DOCUMENT_STORAGE_DIR?'persistent-mounted':'local'; const providers={email:!!process.env.SENDGRID_API_KEY,sms:!!process.env.TWILIO_ACCOUNT_SID,whatsapp:!!process.env.WHATSAPP_TOKEN}; res.json({ok:true,service:'loansmeet',database:'sqlite',documentStorage:storage,notificationProviders:providers,time:new Date().toISOString()}); });
app.get('/api/loan-types',(_req,res)=>res.json(loanTypes));
app.post('/api/leads',(req,res)=>{
 const b=req.body||{}, name=cleanText(b.name,120), mobile=cleanText(b.mobile,15), email=cleanText(b.email,180), city=cleanText(b.city,120), loanType=cleanText(b.loanType,80);
 const loanAmount=cleanNumber(b.loanAmount), income=cleanNumber(b.monthlyIncome), employment=cleanText(b.employmentType,50), emi=Math.max(0,cleanNumber(b.existingEmi)), cibil=cleanText(b.cibilRange,30), consent=b.consent===true;
 const validEmail=!email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
 if(!name||!validMobile(mobile)||!validEmail||!city||!loanTypes.includes(loanType)||loanAmount<10000||loanAmount>100000000||income<=0||income>100000000||!employmentTypes.includes(employment)||emi>100000000||!cibilRanges.includes(cibil)||!consent) return res.status(400).json({error:'Please provide valid required details and consent.'});
 const duplicate=db.prepare(`SELECT id FROM leads WHERE mobile=? AND loan_type=? AND created_at >= datetime('now','-1 day') ORDER BY id DESC LIMIT 1`).get(mobile,loanType);
 const r=db.prepare(`INSERT INTO leads(name,mobile,email,city,loan_type,loan_amount,monthly_income,employment_type,existing_emi,cibil_range,consent) VALUES(?,?,?,?,?,?,?,?,?,?,1)`).run(name,mobile,email,city,loanType,loanAmount,income,employment,emi,cibil);
 const appInfo=ensureApplication(r.lastInsertRowid);
 activity(r.lastInsertRowid,'Lead created',duplicate?`Customer application submitted; possible duplicate of #${duplicate.id}`:'Customer application submitted');
 if(email)queueNotification(r.lastInsertRowid,email,'email','application_created',`Your LOANSMEET application ${appInfo.application_code} has been received.`,'LOANSMEET application received');
 res.status(201).json({ok:true,leadId:r.lastInsertRowid,applicationId:appInfo.application_code,trackingToken:appInfo.accessToken||null,duplicate:!!duplicate,leadScore:scoreLead({monthly_income:income,cibil_range:cibil,existing_emi:emi,email,consent:true})});
});


app.post('/api/customer/account/register',(req,res)=>{
 const code=cleanText(req.body?.applicationCode,40), token=cleanText(req.body?.trackingToken,100), password=req.body?.password;
 if(!code||!token||!passwordValid(password)) return res.status(400).json({error:'Application code, tracking token and a password of at least 10 characters are required.'});
 const a=db.prepare('SELECT * FROM applications WHERE application_code=?').get(code); if(!a||sha256(token)!==a.access_token_hash)return res.status(404).json({error:'Application not found.'});
 const l=db.prepare('SELECT id,email FROM leads WHERE id=?').get(a.lead_id); if(!l?.email)return res.status(400).json({error:'A verified email is required for customer account access.'});
 const existing=db.prepare('SELECT id FROM customer_accounts WHERE email=? OR lead_id=?').get(l.email,l.id); if(existing)return res.status(409).json({error:'Customer account already exists.'});
 const r=db.prepare('INSERT INTO customer_accounts(lead_id,email,password_hash) VALUES(?,?,?)').run(l.id,l.email,passwordHash(password));
 res.status(201).json({ok:true,customerId:r.lastInsertRowid});
});
app.post('/api/customer/login',(req,res)=>{
 const email=cleanText(req.body?.email,180).toLowerCase(), password=req.body?.password; const a=db.prepare('SELECT * FROM customer_accounts WHERE email=? AND status=\'Active\'').get(email);
 if(!a||!passwordVerify(password,a.password_hash))return res.status(401).json({error:'Invalid customer credentials.'});
 const raw=issueSessionToken(), hash=sha256(raw), expires=new Date(Date.now()+7*86400000).toISOString(); db.prepare('INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(?,?,?)').run(a.id,hash,expires);
 res.json({ok:true,token:raw,expiresAt:expires});
});
app.get('/api/customer/me',requireCustomer,(req,res)=>{ const a=db.prepare('SELECT * FROM applications WHERE lead_id=?').get(req.customer.lead_id), l=db.prepare('SELECT id,name,mobile,email,city,loan_type,loan_amount,status,created_at,updated_at FROM leads WHERE id=?').get(req.customer.lead_id); res.json({ok:true,customer:{id:req.customer.customer_id,email:req.customer.email},application:a?{code:a.application_code,status:l.status,priority:a.priority,expiresAt:a.expires_at,createdAt:a.created_at,updatedAt:l.updated_at,timeline:db.prepare('SELECT status,note,actor,created_at FROM application_status_history WHERE application_id=? ORDER BY id').all(a.id),documents:db.prepare('SELECT id,document_type,file_name,size_bytes,version,verification_status,rejection_reason,expires_at,created_at FROM documents WHERE lead_id=? ORDER BY id DESC').all(req.customer.lead_id)}:null,lead:l}); });
app.get('/api/customer/documents/:id/download',requireCustomer,(req,res)=>{ const d=db.prepare('SELECT * FROM documents WHERE id=? AND lead_id=?').get(Number(req.params.id),req.customer.lead_id); if(!d||!fs.existsSync(d.storage_path))return res.status(404).json({error:'Document not found.'}); res.download(d.storage_path,d.file_name); });
app.get('/api/customer/application/timeline',requireCustomer,(req,res)=>{ const a=db.prepare('SELECT * FROM applications WHERE lead_id=?').get(req.customer.lead_id); if(!a)return res.status(404).json({error:'Application not found.'}); res.json(db.prepare('SELECT status,note,actor,created_at FROM application_status_history WHERE application_id=? ORDER BY id').all(a.id)); });
app.post('/api/customer/logout',(req,res)=>{const raw=cleanText(req.headers.authorization?.replace(/^Bearer\s+/i,''),100); if(raw)db.prepare('DELETE FROM customer_sessions WHERE token_hash=?').run(sha256(raw)); res.json({ok:true});});

app.post('/api/partner/register',(req,res)=>{ const b=req.body||{}, company=cleanText(b.company,160), contact=cleanText(b.contactPerson,120), email=cleanText(b.email,180).toLowerCase(), mobile=cleanText(b.mobile,15), password=b.password; if(!company||!contact||!email||!/^\S+@\S+\.\S+$/.test(email)||!validMobile(mobile)||!passwordValid(password))return res.status(400).json({error:'Company, contact, valid email/mobile and a strong password are required.'}); if(db.prepare('SELECT id FROM partner_accounts WHERE email=?').get(email))return res.status(409).json({error:'Partner account already exists.'}); const d=db.prepare('INSERT INTO dsas(company,contact_person,mobile,email,loan_types,active) VALUES(?,?,?,?,?,0)').run(company,contact,mobile,email,cleanText(b.loanTypes,1000)); const code=`LMREF-${crypto.randomBytes(5).toString('hex').toUpperCase()}`; const a=db.prepare('INSERT INTO partner_accounts(dsa_id,email,password_hash,status,referral_code) VALUES(?,?,?,?,?)').run(d.lastInsertRowid,email,passwordHash(password),'Pending',code); res.status(201).json({ok:true,partnerId:a.lastInsertRowid,status:'Pending',referralCode:code}); });
app.post('/api/partner/login',(req,res)=>{ const email=cleanText(req.body?.email,180).toLowerCase(), password=req.body?.password, a=db.prepare('SELECT * FROM partner_accounts WHERE email=?').get(email); if(!a||a.status!=='Active'||!passwordVerify(password,a.password_hash))return res.status(401).json({error:'Invalid partner credentials or account not active.'}); const raw=issueSessionToken(),expires=new Date(Date.now()+7*86400000).toISOString(); db.prepare('INSERT INTO partner_sessions(partner_id,token_hash,expires_at) VALUES(?,?,?)').run(a.id,sha256(raw),expires); res.json({ok:true,token:raw,expiresAt:expires}); });
app.post('/api/partner/logout',requirePartner,(req,res)=>{db.prepare('DELETE FROM partner_sessions WHERE token_hash=?').run(sha256(getBearer(req)));res.json({ok:true});});
app.get('/api/partner/me',requirePartner,(req,res)=>{ const d=db.prepare('SELECT id,company,contact_person,mobile,email,loan_types,active,notes FROM dsas WHERE id=?').get(req.partner.dsa_id); res.json({ok:true,partner:d}); });
app.get('/api/partner/leads',requirePartner,(req,res)=>res.json(db.prepare(`SELECT pl.id,pl.status,pl.response_note,pl.responded_at,a.application_code,l.name,l.city,l.loan_type,l.loan_amount,l.status lead_status,l.created_at FROM partner_leads pl JOIN leads l ON l.id=pl.lead_id LEFT JOIN applications a ON a.lead_id=l.id WHERE pl.dsa_id=? ORDER BY pl.id DESC LIMIT 500`).all(req.partner.dsa_id)));
app.patch('/api/partner/leads/:id',requirePartner,(req,res)=>{ const status=['Accepted','Rejected','Contacted','Processing','Approved','Disbursed','Closed'].includes(req.body?.status)?req.body.status:null; if(!status)return res.status(400).json({error:'Invalid partner lead status.'}); const pl=db.prepare('SELECT * FROM partner_leads WHERE id=? AND dsa_id=?').get(Number(req.params.id),req.partner.dsa_id); if(!pl)return res.status(404).json({error:'Partner lead not found.'}); db.prepare('UPDATE partner_leads SET status=?,response_note=?,responded_at=CURRENT_TIMESTAMP WHERE id=?').run(status,cleanText(req.body?.note,1000),pl.id); if(['Contacted','Processing','Approved','Disbursed','Closed'].includes(status))db.prepare('UPDATE leads SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,pl.lead_id); activity(pl.lead_id,'Partner lead update',status); res.json({ok:true}); });

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



app.post('/api/calculate-emi',(req,res)=>{ const p=Number(req.body?.principal), annual=Number(req.body?.annualInterestRate), n=Number(req.body?.tenureMonths); if(!Number.isFinite(p)||p<=0||p>100000000||!Number.isFinite(annual)||annual<0||annual>100||!Number.isInteger(n)||n<1||n>480)return res.status(400).json({error:'Invalid EMI inputs.'}); const r=annual/1200; const emi=r===0?p/n:p*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1); res.json({ok:true,principal:p,annualInterestRate:annual,tenureMonths:n,monthlyRate:r,emi:Number(emi.toFixed(2)),totalPayment:Number((emi*n).toFixed(2)),totalInterest:Number((emi*n-p).toFixed(2)),estimate:true}); });
app.get('/api/application/:code',(req,res)=>{ const code=cleanText(req.params.code,40),token=cleanText(req.query.token,100); const a=db.prepare('SELECT * FROM applications WHERE application_code=?').get(code); if(!a||!token||sha256(token)!==a.access_token_hash)return res.status(404).json({error:'Application not found.'}); const l=db.prepare('SELECT id,name,city,loan_type,loan_amount,status,created_at,updated_at FROM leads WHERE id=?').get(a.lead_id); if(!l)return res.status(404).json({error:'Application not found.'}); res.json({ok:true,application:{code:a.application_code,status:l.status,priority:a.priority,createdAt:a.created_at,updatedAt:l.updated_at,loanType:l.loan_type,loanAmount:l.loan_amount,city:l.city,expiresAt:a.expires_at,cancelledAt:a.cancelled_at},timeline:db.prepare('SELECT status,note,actor,created_at FROM application_status_history WHERE application_id=? ORDER BY id ASC').all(a.id)}); });
app.post('/api/application/:code/cancel',(req,res)=>{ const code=cleanText(req.params.code,40),token=cleanText(req.body?.trackingToken,100),a=db.prepare('SELECT * FROM applications WHERE application_code=?').get(code); if(!a||sha256(token)!==a.access_token_hash)return res.status(404).json({error:'Application not found.'}); db.prepare('UPDATE applications SET cancelled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(a.id); db.prepare('UPDATE leads SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run('Closed',a.lead_id); db.prepare('INSERT INTO application_status_history(application_id,status,note,actor) VALUES(?,?,?,?)').run(a.id,'Cancelled','Customer cancellation request','customer'); res.json({ok:true}); });
app.get('/api/loan-products',(req,res)=>{ const rows=db.prepare('SELECT * FROM loan_products WHERE active=1 ORDER BY category,name').all(); res.json(rows); });
app.post('/api/analytics/event',(req,res)=>{ const name=cleanText(req.body?.eventName,80); if(!name)return res.status(400).json({error:'Event name required.'}); db.prepare('INSERT INTO analytics_events(event_name,path,referrer,user_agent,ip,metadata) VALUES(?,?,?,?,?,?)').run(name,cleanText(req.body?.path,300),cleanText(req.headers.referer,500),cleanText(req.headers['user-agent'],500),req.ip||'',JSON.stringify(req.body?.metadata||{})); res.status(201).json({ok:true}); });

app.post('/api/partner/activate',(req,res)=>{ const code=cleanText(req.body?.referralCode,40), password=req.body?.password; if(!code||!passwordValid(password))return res.status(400).json({error:'Referral code and a password of at least 10 characters are required.'}); const p=db.prepare('SELECT * FROM partner_accounts WHERE referral_code=?').get(code); if(!p)return res.status(404).json({error:'Partner registration not found.'}); db.prepare('UPDATE partner_accounts SET password_hash=?,status=CASE WHEN status=\'Pending\' THEN \'Active\' ELSE status END,verified_at=COALESCE(verified_at,CURRENT_TIMESTAMP) WHERE id=?').run(passwordHash(password),p.id); res.json({ok:true,status:'Active'}); });
app.post('/api/partner/login',(req,res)=>{ const email=cleanText(req.body?.email,180).toLowerCase(),password=req.body?.password; const p=db.prepare('SELECT * FROM partner_accounts WHERE email=? AND status=\'Active\'').get(email); if(!p||!passwordVerify(password,p.password_hash))return res.status(401).json({error:'Invalid partner credentials.'}); const raw=issueSessionToken(); res.json({ok:true,token:raw,partnerId:p.dsa_id}); });

app.post('/api/partner/register',(req,res)=>{ const b=req.body||{},company=cleanText(b.company,160),contact=cleanText(b.contactPerson,120),email=cleanText(b.email,180),mobile=cleanText(b.mobile,15); if(!company||!contact||!email||!validMobile(mobile)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Please provide valid partner details.'}); const existing=db.prepare('SELECT id FROM partner_accounts WHERE email=?').get(email); if(existing)return res.status(409).json({error:'Partner registration already exists.'}); const d=db.prepare('INSERT INTO dsas(company,contact_person,mobile,email,loan_types,active,notes) VALUES(?,?,?,?,?,?,?)').run(company,contact,mobile,email,cleanText(b.loanTypes,1000),0,'Partner registration pending verification'); const code=`LMREF-${String(d.lastInsertRowid).padStart(6,'0')}`; db.prepare('INSERT INTO partner_accounts(dsa_id,email,status,referral_code) VALUES(?,?,?,?)').run(d.lastInsertRowid,email,'Pending',code); res.status(201).json({ok:true,partnerId:d.lastInsertRowid,referralCode:code,status:'Pending'}); });


app.post('/api/application/:code/documents',async(req,res)=>{ const code=cleanText(req.params.code,40),token=cleanText(req.body?.trackingToken,100),a=db.prepare('SELECT * FROM applications WHERE application_code=?').get(code); if(!a||sha256(token)!==a.access_token_hash)return res.status(404).json({error:'Application not found.'}); const type=cleanText(req.body?.documentType,60),name=cleanText(req.body?.fileName,180),mime=cleanText(req.body?.mimeType,100),data=String(req.body?.data||'').replace(/^data:[^;]+;base64,/,''); if(!documentTypes.includes(type)||!name||!allowedDocumentMimes.has(mime)||!data)return res.status(400).json({error:'Document details are invalid. PDF, JPG and PNG are supported.'}); let buf; try{buf=Buffer.from(data,'base64');}catch{return res.status(400).json({error:'Invalid document data.'});} if(!buf.length||buf.length>MAX_DOCUMENT_BYTES)return res.status(400).json({error:'Document must be smaller than 5 MB.'}); const safe=crypto.randomBytes(12).toString('hex')+'-'+name.replace(/[^a-zA-Z0-9._-]/g,'_'); const dest=path.join(UPLOAD_DIR,safe); fs.writeFileSync(dest,buf,{flag:'wx'}); const r=db.prepare('INSERT INTO documents(lead_id,application_id,document_type,file_name,storage_path,mime_type,size_bytes,uploaded_by) VALUES(?,?,?,?,?,?,?,?)').run(a.lead_id,a.id,type,name,dest,mime,buf.length,'customer'); activity(a.lead_id,'Document uploaded',type); res.status(201).json({ok:true,id:r.lastInsertRowid,verificationStatus:'Pending'}); });

app.post('/api/admin/login',(req,res)=>{ const {username,password,secondFactor=''}=req.body||{}, creds=adminCredentials(); const key=req.ip||'unknown', now=Date.now(), a=loginAttempts.get(key)||{start:now,count:0}; if(now-a.start>600000){a.start=now;a.count=0} if(a.count>=10)return res.status(429).json({error:'Too many login attempts. Try again later.'}); if(!creds.password||String(username)!==creds.username||String(password)!==creds.password){a.count++;loginAttempts.set(key,a);return res.status(401).json({error:'Invalid username or password.'});} if(process.env.ADMIN_2FA_CODE && String(secondFactor)!==String(process.env.ADMIN_2FA_CODE)) return res.status(401).json({error:'Second-factor code required.'}); a.count=0;loginAttempts.set(key,a); const token=createSession(username); res.setHeader('Set-Cookie',`loansmeet_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.NODE_ENV==='production'?'; Secure':''}`); audit('Admin login',req); res.json({ok:true,twoFactor:!!process.env.ADMIN_2FA_CODE}); });
app.post('/api/admin/logout',(req,res)=>{const t=getCookie(req,'loansmeet_admin');sessions.delete(t);res.setHeader('Set-Cookie','loansmeet_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');res.json({ok:true});});
app.get('/api/admin/me',requireAdmin,(req,res)=>res.json({ok:true,user:req.admin.user,role:req.admin.role,twoFactor:!!process.env.ADMIN_2FA_CODE}));

app.get('/api/admin/stats',requireAdmin,(_req,res)=>{ const count=s=>db.prepare('SELECT COUNT(*) n FROM leads WHERE status=?').get(s).n; const total=db.prepare('SELECT COUNT(*) n FROM leads').get().n; const expected=db.prepare('SELECT COALESCE(SUM(expected_payout),0) n FROM leads').get().n; const received=db.prepare("SELECT COALESCE(SUM(actual_payout),0) n FROM leads WHERE payout_status='Paid'").get().n; res.json({total,today:db.prepare("SELECT COUNT(*) n FROM leads WHERE date(created_at,'localtime')=date('now','localtime')").get().n,newLeads:count('New'),contacted:count('Contacted'),processing:count('Processing'),approved:count('Approved'),rejected:count('Rejected'),disbursed:count('Disbursed'),closed:count('Closed'),expected,received,pending:expected-received}); });
app.get('/api/admin/leads',requireAdmin,(req,res)=>{ const search=cleanText(req.query.search,100),status=cleanText(req.query.status,30),loanType=cleanText(req.query.loanType,80),limit=Math.min(Math.max(cleanNumber(req.query.limit||500),1),1000);const where=[],p={};if(search){where.push('(l.name LIKE @search OR l.mobile LIKE @search OR l.city LIKE @search OR l.email LIKE @search)');p.search=`%${search}%`}if(status&&statuses.includes(status)){where.push('l.status=@status');p.status=status}if(loanType&&loanTypes.includes(loanType)){where.push('l.loan_type=@loanType');p.loanType=loanType}const sql=`SELECT l.*,d.company dsa_company FROM leads l LEFT JOIN dsas d ON d.id=l.dsa_id ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY l.id DESC LIMIT ${limit}`;res.json(db.prepare(sql).all(p));});
app.get('/api/admin/leads/:id',requireAdmin,(req,res)=>{const id=Number(req.params.id),row=db.prepare('SELECT l.*,d.company dsa_company FROM leads l LEFT JOIN dsas d ON d.id=l.dsa_id WHERE l.id=?').get(id);if(!row)return res.status(404).json({error:'Lead not found.'});res.json({...row,activity:db.prepare('SELECT * FROM activity_logs WHERE lead_id=? ORDER BY id DESC').all(id)});});
app.patch('/api/admin/leads/:id',requireAdmin,(req,res)=>{const id=Number(req.params.id),b=req.body||{},status=cleanText(b.status,30),notes=cleanText(b.notes,2000),dsaId=b.dsaId?Number(b.dsaId):null,follow=cleanText(b.followUpDate,30),disbursed=Math.max(0,cleanNumber(b.disbursedAmount)),pct=Math.max(0,Number(b.payoutPercent)||0),actual=Math.max(0,Number(b.actualPayout)||0),payoutStatus=payoutStatuses.includes(b.payoutStatus)?b.payoutStatus:'Unpaid';if(!Number.isInteger(id)||!statuses.includes(status))return res.status(400).json({error:'Invalid update.'});const expected=Math.round(disbursed*pct)/100;const r=db.prepare(`UPDATE leads SET status=?,notes=?,dsa_id=?,follow_up_date=?,disbursed_amount=?,payout_percent=?,expected_payout=?,actual_payout=?,payout_status=?,payout_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(status,notes,dsaId,follow,disbursed,pct,expected,actual,payoutStatus,cleanText(b.payoutDate,30)||null,id);if(!r.changes)return res.status(404).json({error:'Lead not found.'});activity(id,'Lead updated',`Status: ${status}`); const existingPayout=db.prepare('SELECT id FROM payouts WHERE lead_id=? ORDER BY id DESC LIMIT 1').get(id);
 if(existingPayout) db.prepare('UPDATE payouts SET dsa_id=?,disbursed_amount=?,payout_percent=?,expected_payout=?,actual_payout=?,status=?,payment_date=?,notes=? WHERE id=?').run(dsaId,disbursed,pct,expected,actual,payoutStatus,cleanText(b.payoutDate,30)||null,cleanText(b.notes,500),existingPayout.id);
 else db.prepare('INSERT INTO payouts(lead_id,dsa_id,loan_amount,disbursed_amount,payout_percent,expected_payout,actual_payout,status,payment_date,notes) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,dsaId,cleanNumber(b.loanAmount||0),disbursed,pct,expected,actual,payoutStatus,cleanText(b.payoutDate,30)||null,cleanText(b.notes,500));
 const appRow=ensureApplication(id); db.prepare('INSERT INTO application_status_history(application_id,status,note,actor) VALUES(?,?,?,?)').run(appRow.id,status,'Admin status update',req.admin.user); res.json({ok:true,expectedPayout:expected});});

app.get('/api/admin/dsas',requireAdmin,(_req,res)=>res.json(db.prepare(`SELECT d.*,COUNT(l.id) lead_count,COALESCE(SUM(CASE WHEN l.status='Disbursed' THEN 1 ELSE 0 END),0) disbursed_count,COALESCE(SUM(l.actual_payout),0) received_payout FROM dsas d LEFT JOIN leads l ON l.dsa_id=d.id GROUP BY d.id ORDER BY d.id DESC`).all()));
app.post('/api/admin/dsas',requireAdmin,(req,res)=>{const b=req.body||{},company=cleanText(b.company,160),contact=cleanText(b.contactPerson,120);if(!company||!contact)return res.status(400).json({error:'Company and contact person are required.'});const r=db.prepare('INSERT INTO dsas(company,contact_person,mobile,email,loan_types,active,notes) VALUES(?,?,?,?,?,?,?)').run(company,contact,cleanText(b.mobile,15),cleanText(b.email,180),cleanText(b.loanTypes,1000),b.active===false?0:1,cleanText(b.notes,1000));res.json({ok:true,id:r.lastInsertRowid});});
app.patch('/api/admin/dsas/:id',requireAdmin,(req,res)=>{const b=req.body||{},id=Number(req.params.id);const r=db.prepare('UPDATE dsas SET company=?,contact_person=?,mobile=?,email=?,loan_types=?,active=?,notes=? WHERE id=?').run(cleanText(b.company,160),cleanText(b.contactPerson,120),cleanText(b.mobile,15),cleanText(b.email,180),cleanText(b.loanTypes,1000),b.active?1:0,cleanText(b.notes,1000),id);if(!r.changes)return res.status(404).json({error:'DSA not found.'});res.json({ok:true});});

app.get('/api/admin/payouts',requireAdmin,(_req,res)=>res.json(db.prepare('SELECT l.id lead_id,l.name,l.loan_type,l.loan_amount,l.disbursed_amount,l.payout_percent,l.expected_payout,l.actual_payout,l.payout_status,l.payout_date,d.company dsa_company FROM leads l LEFT JOIN dsas d ON d.id=l.dsa_id WHERE l.disbursed_amount>0 OR l.expected_payout>0 ORDER BY l.id DESC').all()));
app.get('/api/admin/tickets',requireAdmin,(_req,res)=>res.json(db.prepare('SELECT * FROM tickets ORDER BY id DESC').all()));
app.patch('/api/admin/tickets/:id',requireAdmin,(req,res)=>{const b=req.body||{},id=Number(req.params.id),status=cleanText(b.status,30);if(!ticketStatuses.includes(status))return res.status(400).json({error:'Invalid ticket status.'});const r=db.prepare('UPDATE tickets SET status=?,assigned_staff=?,follow_up_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,cleanText(b.assignedStaff,120),cleanText(b.followUpDate,30)||null,id);if(!r.changes)return res.status(404).json({error:'Ticket not found.'});res.json({ok:true});});
app.get('/api/admin/audit',requireAdmin,(_req,res)=>res.json(db.prepare('SELECT * FROM admin_audit ORDER BY id DESC LIMIT 200').all()));



app.get('/api/admin/applications',requireAdmin,(req,res)=>{ const search=cleanText(req.query.search,100), status=cleanText(req.query.status,30), where=[],p={}; if(search){where.push('(l.name LIKE @s OR l.mobile LIKE @s OR a.application_code LIKE @s)');p.s=`%${search}%`;} if(status&&applicationPublicStatuses.includes(status)){where.push('l.status=@status');p.status=status;} const sql=`SELECT a.application_code,a.priority,a.expires_at,l.* ,d.company dsa_company FROM applications a JOIN leads l ON l.id=a.lead_id LEFT JOIN dsas d ON d.id=l.dsa_id ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY a.id DESC LIMIT 1000`; res.json(db.prepare(sql).all(p)); });
app.get('/api/admin/applications/:code',requireAdmin,(req,res)=>{ const a=db.prepare('SELECT * FROM applications WHERE application_code=?').get(cleanText(req.params.code,40)); if(!a)return res.status(404).json({error:'Application not found.'}); const lead=db.prepare('SELECT l.*,d.company dsa_company FROM leads l LEFT JOIN dsas d ON d.id=l.dsa_id WHERE l.id=?').get(a.lead_id); res.json({...a,lead,timeline:db.prepare('SELECT * FROM application_status_history WHERE application_id=? ORDER BY id DESC').all(a.id),documents:db.prepare('SELECT id,document_type,file_name,size_bytes,version,verification_status,rejection_reason,expires_at,uploaded_by,created_at FROM documents WHERE lead_id=? ORDER BY id DESC').all(a.lead_id),followups:db.prepare('SELECT * FROM followups WHERE lead_id=? ORDER BY due_at').all(a.lead_id)}); });
app.post('/api/admin/applications/:code/followups',requireAdmin,(req,res)=>{ const a=db.prepare('SELECT * FROM applications WHERE application_code=?').get(cleanText(req.params.code,40)); if(!a)return res.status(404).json({error:'Application not found.'}); const due=cleanText(req.body?.dueAt,40); if(!due)return res.status(400).json({error:'Due date is required.'}); const r=db.prepare('INSERT INTO followups(lead_id,due_at,note,assigned_to) VALUES(?,?,?,?)').run(a.lead_id,due,cleanText(req.body?.note,1000),cleanText(req.body?.assignedTo,120)); activity(a.lead_id,'Follow-up scheduled',due); res.status(201).json({ok:true,id:r.lastInsertRowid}); });
app.get('/api/admin/followups',requireAdmin,(_req,res)=>res.json(db.prepare(`SELECT f.*,l.name,l.mobile,a.application_code FROM followups f JOIN leads l ON l.id=f.lead_id LEFT JOIN applications a ON a.lead_id=l.id WHERE f.status='Pending' ORDER BY f.due_at LIMIT 1000`).all()));
app.patch('/api/admin/followups/:id',requireAdmin,(req,res)=>{ const id=Number(req.params.id),status=['Pending','Completed','Cancelled'].includes(req.body?.status)?req.body.status:'Completed'; const r=db.prepare('UPDATE followups SET status=?,completed_at=CASE WHEN ?=\'Completed\' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id=?').run(status,status,id); if(!r.changes)return res.status(404).json({error:'Follow-up not found.'}); res.json({ok:true}); });
app.get('/api/admin/analytics',requireAdmin,(_req,res)=>{ const byStatus=db.prepare('SELECT status,COUNT(*) count FROM leads GROUP BY status ORDER BY count DESC').all(); const byLoan=db.prepare('SELECT loan_type,COUNT(*) count FROM leads GROUP BY loan_type ORDER BY count DESC').all(); const daily=db.prepare(`SELECT date(created_at) day,COUNT(*) count FROM leads WHERE created_at>=datetime('now','-30 day') GROUP BY date(created_at) ORDER BY day`).all(); res.json({byStatus,byLoan,daily}); });
app.get('/api/admin/smart-matches/:id',requireAdmin,(req,res)=>{ const l=db.prepare('SELECT * FROM leads WHERE id=?').get(Number(req.params.id)); if(!l)return res.status(404).json({error:'Lead not found.'}); res.json({leadScore:scoreLead(l),matches:smartMatches(l)}); });
app.post('/api/admin/leads/:id/auto-assign',requireAdmin,(req,res)=>{ const id=Number(req.params.id),l=db.prepare('SELECT * FROM leads WHERE id=?').get(id); if(!l)return res.status(404).json({error:'Lead not found.'}); const m=smartMatches(l)[0]; if(!m)return res.status(404).json({error:'No suitable active partner found.'}); db.prepare('UPDATE leads SET dsa_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(m.id,id); db.prepare('INSERT OR IGNORE INTO partner_leads(lead_id,dsa_id,status) VALUES(?,?,?)').run(id,m.id,'Offered'); activity(id,'Auto-assigned partner',m.company); res.json({ok:true,dsa:m,leadScore:scoreLead(l)}); });
app.get('/api/admin/notifications',requireAdmin,(_req,res)=>res.json(db.prepare('SELECT * FROM notification_outbox ORDER BY id DESC LIMIT 500').all()));
app.patch('/api/admin/notifications/:id',requireAdmin,(req,res)=>{ const status=['Queued','Sent','Failed','Cancelled'].includes(req.body?.status)?req.body.status:'Sent'; const r=db.prepare('UPDATE notification_outbox SET status=?,sent_at=CASE WHEN ?=\'Sent\' THEN CURRENT_TIMESTAMP ELSE sent_at END WHERE id=?').run(status,status,Number(req.params.id)); if(!r.changes)return res.status(404).json({error:'Notification not found.'}); res.json({ok:true}); });
app.get('/api/admin/loan-products',requireAdmin,(_req,res)=>res.json(db.prepare('SELECT * FROM loan_products ORDER BY id DESC').all()));
app.post('/api/admin/loan-products',requireAdmin,(req,res)=>{ const b=req.body||{},name=cleanText(b.name,160),category=cleanText(b.category,100); if(!name||!category)return res.status(400).json({error:'Product name and category are required.'}); const r=db.prepare(`INSERT INTO loan_products(name,category,description,min_amount,max_amount,min_tenure,max_tenure,interest_info,fee_info,eligibility,documents,benefits,conditions,partner_mapping,city_availability,employment_eligibility,income_criteria,cibil_criteria,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(name,category,cleanText(b.description,2000),Math.max(0,cleanNumber(b.minAmount)),Math.max(0,cleanNumber(b.maxAmount)),Math.max(0,cleanNumber(b.minTenure)),Math.max(0,cleanNumber(b.maxTenure)),cleanText(b.interestInfo,500),cleanText(b.feeInfo,500),cleanText(b.eligibility,1500),cleanText(b.documents,1500),cleanText(b.benefits,1500),cleanText(b.conditions,1500),cleanText(b.partnerMapping,1000),cleanText(b.cityAvailability,1000),cleanText(b.employmentEligibility,500),cleanText(b.incomeCriteria,500),cleanText(b.cibilCriteria,500),b.active===false?0:1); audit(`Loan product created #${r.lastInsertRowid}`,req); res.status(201).json({ok:true,id:r.lastInsertRowid}); });
app.patch('/api/admin/loan-products/:id',requireAdmin,(req,res)=>{ const b=req.body||{},id=Number(req.params.id); const r=db.prepare(`UPDATE loan_products SET name=?,category=?,description=?,min_amount=?,max_amount=?,min_tenure=?,max_tenure=?,interest_info=?,fee_info=?,eligibility=?,documents=?,benefits=?,conditions=?,partner_mapping=?,city_availability=?,employment_eligibility=?,income_criteria=?,cibil_criteria=?,active=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(cleanText(b.name,160),cleanText(b.category,100),cleanText(b.description,2000),Math.max(0,cleanNumber(b.minAmount)),Math.max(0,cleanNumber(b.maxAmount)),Math.max(0,cleanNumber(b.minTenure)),Math.max(0,cleanNumber(b.maxTenure)),cleanText(b.interestInfo,500),cleanText(b.feeInfo,500),cleanText(b.eligibility,1500),cleanText(b.documents,1500),cleanText(b.benefits,1500),cleanText(b.conditions,1500),cleanText(b.partnerMapping,1000),cleanText(b.cityAvailability,1000),cleanText(b.employmentEligibility,500),cleanText(b.incomeCriteria,500),cleanText(b.cibilCriteria,500),b.active?1:0,id); if(!r.changes)return res.status(404).json({error:'Product not found.'}); res.json({ok:true}); });
app.get('/api/admin/cms',requireAdmin,(_req,res)=>res.json(db.prepare('SELECT * FROM cms_content ORDER BY content_key,language,version DESC').all()));
app.post('/api/admin/cms',requireAdmin,(req,res)=>{ const b=req.body||{},key=cleanText(b.contentKey,100),lang=['en','hi','gu'].includes(b.language)?b.language:'en'; if(!key)return res.status(400).json({error:'Content key required.'}); const v=(db.prepare('SELECT COALESCE(MAX(version),0) v FROM cms_content WHERE content_key=? AND language=?').get(key,lang).v||0)+1; const r=db.prepare('INSERT INTO cms_content(content_key,language,title,body,seo_title,seo_description,social_image,status,scheduled_at,version,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(key,lang,cleanText(b.title,300),cleanText(b.body,10000),cleanText(b.seoTitle,300),cleanText(b.seoDescription,500),cleanText(b.socialImage,500),['Draft','Published','Scheduled'].includes(b.status)?b.status:'Draft',cleanText(b.scheduledAt,40)||null,v,req.admin.user); audit(`CMS content saved ${key}/${lang} v${v}`,req); res.status(201).json({ok:true,id:r.lastInsertRowid,version:v}); });
app.get('/api/cms/:key',(req,res)=>{ const lang=['en','hi','gu'].includes(req.query.lang)?req.query.lang:'en'; const r=db.prepare(`SELECT * FROM cms_content WHERE content_key=? AND language=? AND status='Published' ORDER BY version DESC LIMIT 1`).get(cleanText(req.params.key,100),lang); if(!r)return res.status(404).json({error:'Content not found.'}); res.json(r); });
app.get('/api/admin/documents/:id/download',requireAdmin,(req,res)=>{ const d=db.prepare('SELECT * FROM documents WHERE id=?').get(Number(req.params.id)); if(!d||!fs.existsSync(d.storage_path))return res.status(404).json({error:'Document not found.'}); audit(`Document download #${d.id}`,req); res.download(d.storage_path,d.file_name); });
app.post('/api/admin/documents/:id/verify',requireAdmin,(req,res)=>{ const status=['Pending','Verified','Rejected'].includes(req.body?.status)?req.body.status:'Pending'; const r=db.prepare('UPDATE documents SET verification_status=?,rejection_reason=? WHERE id=?').run(status,cleanText(req.body?.reason,500),Number(req.params.id)); if(!r.changes)return res.status(404).json({error:'Document not found.'}); res.json({ok:true}); });
app.get('/api/admin/reports/revenue',requireAdmin,(_req,res)=>{ const r=db.prepare(`SELECT strftime('%Y-%m',COALESCE(payout_date,created_at)) month,COALESCE(SUM(actual_payout),0) revenue,COALESCE(SUM(expected_payout),0) expected,COUNT(*) records FROM leads GROUP BY month ORDER BY month DESC`).all(); res.json(r); });
app.get('/api/admin/partners/ranking',requireAdmin,(_req,res)=>res.json(db.prepare(`SELECT d.id,d.company,COUNT(l.id) leads,COALESCE(SUM(CASE WHEN l.status='Disbursed' THEN 1 ELSE 0 END),0) disbursed,COALESCE(SUM(l.actual_payout),0) earnings FROM dsas d LEFT JOIN leads l ON l.dsa_id=d.id GROUP BY d.id ORDER BY disbursed DESC,earnings DESC`).all()));

app.get('/api/admin/export.csv',requireAdmin,(_req,res)=>{const rows=db.prepare('SELECT * FROM leads ORDER BY id DESC').all();const headers=['id','name','mobile','email','city','loan_type','loan_amount','monthly_income','employment_type','existing_emi','cibil_range','consent','status','dsa_id','follow_up_date','disbursed_amount','payout_percent','expected_payout','actual_payout','payout_status','payout_date','notes','created_at'];const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;const csv=[headers.join(','),...rows.map(r=>headers.map(h=>esc(r[h])).join(','))].join('\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="loansmeet-leads.csv"');res.send(csv);});

app.get('/admin',(_req,res)=>res.sendFile(path.join(FRONTEND,'admin.html')));
app.get('/customer',(_req,res)=>res.sendFile(path.join(FRONTEND,'customer.html')));
app.get('/partner',(_req,res)=>res.sendFile(path.join(FRONTEND,'partner.html')));
app.get('/privacy',(_req,res)=>res.sendFile(path.join(FRONTEND,'privacy.html')));
app.get('/terms',(_req,res)=>res.sendFile(path.join(FRONTEND,'terms.html')));
app.get('/robots.txt',(_req,res)=>{const base=(process.env.SITE_URL||'').replace(/\/$/,''); return res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);});
app.get('/sitemap.xml',(req,res)=>{const base=(process.env.SITE_URL||`${req.protocol}://${req.get('host')}`).replace(/\/$/,''); return res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url><url><loc>${base}/privacy</loc></url><url><loc>${base}/terms</loc></url></urlset>`);});
app.get('*',(_req,res)=>res.sendFile(path.join(FRONTEND,'index.html')));
app.use((err,req,res,next)=>{ console.error(err); if(res.headersSent)return next(err); res.status(500).json({error:'Unexpected server error.'}); });
if(process.env.NODE_ENV==='production'){
  const required=['ADMIN_USERNAME','ADMIN_PASSWORD','DOCUMENT_STORAGE_DIR'];
  const missing=required.filter(k=>!process.env[k]);
  if(missing.length) console.warn(`PRODUCTION PREFLIGHT: missing ${missing.join(', ')}`);
  if(!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length<16) console.warn('WARNING: set a strong ADMIN_PASSWORD (16+ characters) before production launch.');
  if(!process.env.SITE_URL) console.warn('PRODUCTION PREFLIGHT: set SITE_URL for canonical sitemap/robots URLs.');
}
app.listen(PORT,()=>console.log(`LOANSMEET running at http://localhost:${PORT}`));
