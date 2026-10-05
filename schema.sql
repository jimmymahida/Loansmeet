-- LOANSMEET expanded production schema reference. Runtime migrations are applied non-destructively by backend/server.js.
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
CREATE INDEX IF NOT EXISTS idx_leads_mobile ON leads(mobile);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_history_application ON application_status_history(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_lead ON documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_followups_due ON followups(due_at,status);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notification_outbox(status,created_at);
CREATE TABLE IF NOT EXISTS customer_accounts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, status TEXT DEFAULT 'Active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS customer_sessions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(customer_id) REFERENCES customer_accounts(id) ON DELETE CASCADE
);
