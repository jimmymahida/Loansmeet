# LOANSMEET — Production 10/10 Closure

This package closes every item that can be completed safely inside the codebase. Items requiring ownership of external accounts are represented by deployment-ready configuration and explicit verification commands; credentials are never fabricated.

| # | Production item | Code/config included | Final external verification |
|---|---|---|---|
| 1 | Render deployment | `render.yaml`, health endpoint, production start command | Create/select Render service and deploy |
| 2 | Production DB | Non-destructive SQLite migrations + persistent disk path | First deploy, migration smoke test, inspect `/api/health` |
| 3 | Persistent documents | Configurable `DOCUMENT_STORAGE_DIR`, Render persistent disk | Upload/download a real dummy PDF/PNG and restart service |
| 4 | Email/SMS/WhatsApp | SendGrid, Twilio and Meta adapters + notification outbox | Add real credentials/templates and send test messages |
| 5 | Auth/security | Customer/partner auth, admin session, throttling, hashing, preflight | Test login/logout/expiry/permissions on deployed service |
| 6 | Backup/restore | `npm run backup`, `npm run restore`, backup directory config | Execute backup, restore to a test DB, verify records |
| 7 | Load/performance | `npm run loadtest -- <URL>` | Run against production/staging and record p95/p99 |
| 8 | SEO/analytics | Sitemap/robots, canonical `SITE_URL`, analytics event endpoint | Submit sitemap to Search Console; connect chosen analytics account |
| 9 | Domain/SSL/env | `SITE_URL`, Render HTTPS, env template, production preflight | Point DNS, verify HTTPS, set secrets, run preflight |
| 10 | Legal | Privacy/Terms/Disclaimer pages and no-guarantee wording | Insert verified legal entity/contact/grievance details and obtain professional review |

## Required production environment

Set at minimum:
- `NODE_ENV=production`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` (16+ characters)
- `ADMIN_2FA_CODE`
- `SITE_URL=https://your-real-domain.example`
- `DOCUMENT_STORAGE_DIR=/var/data/loansmeet/uploads`
- `BACKUP_DIR=/var/data/loansmeet/backups`

Messaging variables are optional until each provider is activated:
- SendGrid: `SENDGRID_API_KEY`, `NOTIFY_FROM_EMAIL`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- WhatsApp Cloud API: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`

## Verification commands

```bash
cd backend
npm install
npm run preflight
npm run test
npm run start
```

In another terminal:

```bash
npm run health -- http://localhost:3000
npm run loadtest -- http://localhost:3000
npm run backup
```

Do not mark the launch complete until the real external checks above have passed. Never commit secrets, real customer documents, or production database files to Git.
