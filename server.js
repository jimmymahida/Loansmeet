import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const FRONTEND = __dirname;
const db = new Database(path.join(__dirname, 'loanleads.db'));

db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT,
  city TEXT NOT NULL,
  loan_type TEXT NOT NULL,
  loan_amount INTEGER NOT NULL,
  monthly_income INTEGER NOT NULL,
  employment_type TEXT NOT NULL,
  existing_emi INTEGER DEFAULT 0,
  cibil_range TEXT,
  consent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'New',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const loanTypes = [
  'Personal Loan','Business Loan','Home Loan','Car Loan','Education Loan',
  'Two-Wheeler Loan','Loan Against Property','Balance Transfer','Consumer Loan','Other'
];
const statuses = ['New','Contacted','Processing','Approved','Rejected','Closed'];
const sessions = new Map();
const rateBuckets = new Map();
function rateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start > 60_000) { bucket.start = now; bucket.count = 0; }
  bucket.count += 1; rateBuckets.set(key, bucket);
  if (bucket.count > 120) return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  next();
}
setInterval(() => { const cutoff = Date.now() - 70_000; for (const [k,v] of rateBuckets) if (v.start < cutoff) rateBuckets.delete(k); }, 90_000).unref();

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});
app.use(rateLimit);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(FRONTEND));

function cleanText(v, max = 500) { return String(v ?? '').trim().slice(0, max); }
function cleanNumber(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : 0; }
function validMobile(mobile) { return /^[6-9]\d{9}$/.test(String(mobile || '')); }
function adminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'ChangeMe123!'
  };
}
function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
  return token;
}
function getCookie(req, name) {
  const header = req.headers.cookie || '';
  const found = header.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : '';
}
function requireAdmin(req, res, next) {
  const token = getCookie(req, 'credora_admin');
  const expires = sessions.get(token);
  if (!token || !expires || expires < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'Admin authentication required.' });
  }
  next();
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'credora' }));
app.get('/api/loan-types', (_req, res) => res.json(loanTypes));

app.post('/api/leads', (req, res) => {
  const body = req.body || {};
  const name = cleanText(body.name, 120);
  const mobile = cleanText(body.mobile, 15);
  const email = cleanText(body.email, 180);
  const city = cleanText(body.city, 120);
  const loanType = cleanText(body.loanType, 80);
  const loanAmount = cleanNumber(body.loanAmount);
  const monthlyIncome = cleanNumber(body.monthlyIncome);
  const employmentType = cleanText(body.employmentType, 50);
  const existingEmi = Math.max(0, cleanNumber(body.existingEmi));
  const cibilRange = cleanText(body.cibilRange, 30);
  const consent = body.consent === true;
  const validEmail = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validEmployment = ['Salaried','Self-employed','Business owner','Professional','Other'].includes(employmentType);
  const validCibil = !cibilRange || ['Below 650','650–699','700–749','750+','Not sure'].includes(cibilRange);

  if (!name || !validMobile(mobile) || !validEmail || !city || !loanTypes.includes(loanType) || loanAmount < 10000 || loanAmount > 100000000 || monthlyIncome <= 0 || monthlyIncome > 100000000 || !validEmployment || existingEmi > 100000000 || !validCibil || !consent) {
    return res.status(400).json({ error: 'Please provide valid required details and consent.' });
  }

  const stmt = db.prepare(`INSERT INTO leads
    (name,mobile,email,city,loan_type,loan_amount,monthly_income,employment_type,existing_emi,cibil_range,consent)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const result = stmt.run(name, mobile, email, city, loanType, loanAmount, monthlyIncome, employmentType, existingEmi, cibilRange, 1);
  res.status(201).json({ ok: true, leadId: result.lastInsertRowid });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const creds = adminCredentials();
  if (String(username) !== creds.username || String(password) !== creds.password) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  const token = createSession();
  res.setHeader('Set-Cookie', `credora_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  const token = getCookie(req, 'credora_admin');
  sessions.delete(token);
  res.setHeader('Set-Cookie', 'credora_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAdmin, (_req, res) => res.json({ ok: true }));

app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS n FROM leads').get().n;
  const today = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE date(created_at,'localtime') = date('now','localtime')").get().n;
  const newLeads = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status='New'").get().n;
  const approved = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status='Approved'").get().n;
  const amount = db.prepare('SELECT COALESCE(SUM(loan_amount),0) AS n FROM leads').get().n;
  res.json({ total, today, newLeads, approved, amount });
});

app.get('/api/admin/leads', requireAdmin, (req, res) => {
  const search = cleanText(req.query.search, 100);
  const status = cleanText(req.query.status, 30);
  const loanType = cleanText(req.query.loanType, 80);
  const limit = Math.min(Math.max(cleanNumber(req.query.limit || 500), 1), 1000);
  const where = [];
  const params = {};
  if (search) { where.push('(name LIKE @search OR mobile LIKE @search OR city LIKE @search OR email LIKE @search)'); params.search = `%${search}%`; }
  if (status && statuses.includes(status)) { where.push('status=@status'); params.status = status; }
  if (loanType && loanTypes.includes(loanType)) { where.push('loan_type=@loanType'); params.loanType = loanType; }
  const sql = `SELECT * FROM leads ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ${limit}`;
  res.json(db.prepare(sql).all(params));
});

app.get('/api/admin/leads/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM leads WHERE id=?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Lead not found.' });
  res.json(row);
});

app.patch('/api/admin/leads/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const status = cleanText(req.body.status, 30);
  const notes = cleanText(req.body.notes, 2000);
  if (!Number.isInteger(id) || !statuses.includes(status)) return res.status(400).json({ error: 'Invalid update.' });
  const result = db.prepare('UPDATE leads SET status=?, notes=? WHERE id=?').run(status, notes, id);
  if (!result.changes) return res.status(404).json({ error: 'Lead not found.' });
  res.json({ ok: true });
});

app.get('/api/admin/export.csv', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
  const headers = ['id','name','mobile','email','city','loan_type','loan_amount','monthly_income','employment_type','existing_emi','cibil_range','consent','status','notes','created_at'];
  const esc = v => `"${String(v ?? '').replaceAll('"','""')}"`;
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="credora-leads.csv"');
  res.send(csv);
});

app.get('/admin', (_req, res) => res.sendFile(path.join(FRONTEND, 'admin.html')));
app.get('/privacy', (_req, res) => res.sendFile(path.join(FRONTEND, 'privacy.html')));
app.get('/terms', (_req, res) => res.sendFile(path.join(FRONTEND, 'terms.html')));
app.get('*', (_req, res) => res.sendFile(path.join(FRONTEND, 'index.html')));

app.listen(PORT, () => console.log(`Credora running at http://localhost:${PORT}`));
