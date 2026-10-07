
import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
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
 payout_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tickets (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, mobile TEXT, email TEXT, subject TEXT NOT NULL, message TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'New', assigned_staff TEXT DEFAULT '', follow_up_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const loanTypes = ['Personal Loan', 'Business Loan', 'Home Loan', 'Car Loan', 'Education Loan', 'Other Loan Requirement'];
const employmentTypes = ['Salaried', 'Self-employed', 'Business owner', 'Professional', 'Other'];
const cibilRanges = ['Below 650', '650–699', '700–749', '750+', 'Not sure'];

function cleanText(v, max=500){ return String(v ?? '').trim().slice(0,max); }
function cleanNumber(v){ const n=Number(v); return Number.isFinite(n) ? Math.round(n) : 0; }
function validMobile(v){ return /^[6-9]\d{9}$/.test(String(v||'')); }

// Security Headers Middleware (Tailwind & CDN Allowed)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', "default-src 'self' https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; connect-src 'self' https:;");
  next();
});

app.use(express.json({limit:'100kb'}));
app.use(express.urlencoded({extended:false}));
app.use(express.static(FRONTEND));

// API: EMI Calculation
app.post('/api/calculate-emi', (req, res) => {
  const b = req.body || {};
  const principal = cleanNumber(b.amount);
  const annualRate = Number(b.rate);
  const months = cleanNumber(b.tenure);

  if (!principal || !Number.isFinite(annualRate) || !months || principal <= 0 || annualRate < 0 || months <= 0) {
    return res.status(400).json({ error: 'Please provide valid EMI details.' });
  }

  const monthlyRate = annualRate / 12 / 100;
  const emi = monthlyRate === 0
    ? principal / months
    : principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);

  const totalPayment = emi * months;
  const totalInterest = totalPayment - principal;

  res.json({
    ok: true,
    emi: Math.round(emi),
    totalPayment: Math.round(totalPayment),
    totalInterest: Math.round(totalInterest)
  });
});

// API: Lead Submission
app.post('/api/leads', (req, res) => {
  const b = req.body || {};
  const name = cleanText(b.name, 120), mobile = cleanText(b.mobile, 15), city = cleanText(b.city, 120), loanType = cleanText(b.loanType, 80);
  const loanAmount = cleanNumber(b.loanAmount), income = cleanNumber(b.monthlyIncome), employment = cleanText(b.employmentType, 50);
  
  if (!name || !validMobile(mobile) || !city || loanAmount <= 0 || income <= 0) {
    return res.status(400).json({ error: 'Please fill out all required fields correctly.' });
  }

  const r = db.prepare(`INSERT INTO leads(name, mobile, city, loan_type, loan_amount, monthly_income, employment_type, consent) VALUES(?,?,?,?,?,?,?,1)`).run(name, mobile, city, loanType, loanAmount, income, employment);
  res.status(201).json({ ok: true, leadId: r.lastInsertRowid });
});

app.get('*', (_req, res) => res.sendFile(path.join(FRONTEND, 'index.html')));

app.listen(PORT, () => console.log(`LOANSMEET running at http://localhost:${PORT}`));
