CREATE TABLE leads (
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
