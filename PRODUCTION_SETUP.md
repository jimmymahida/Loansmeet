# Credora — Production Setup

The application code is bundled here. External account creation cannot be performed from a ZIP.

## 1. Server
- Use a supported Node.js LTS release.
- Copy `backend/.env.example` to `backend/.env`.
- Set a unique long admin password.
- Set `NODE_ENV=production`.
- Do not publish `.env`.

## 2. Domain and HTTPS
- Point your domain DNS to the production server.
- Put the Node app behind a reverse proxy (for example Nginx or a managed platform).
- Enable HTTPS and redirect HTTP to HTTPS.

## 3. Database and backups
- The bundled SQLite database is suitable for local/small deployments.
- For higher traffic, migrate to a managed production database after testing the schema.
- Back up the production database and test restoration.

## 4. Business/legal
- Obtain professional review of Privacy Policy, Terms, consent wording, data retention and sharing.
- Execute written DSA/lender agreements defining lead ownership, duplicates, disbursal attribution, payout trigger, payment timeline and disputes.
- Complete applicable business/tax registrations with a CA/CS.
- Set up compliant commercial communications and consent handling before bulk messaging.

## 5. Go-live test
- Submit a test lead.
- Confirm it appears in admin.
- Test search, filters, status, notes and CSV export.
- Verify authentication and HTTPS.
- Verify backups and monitoring.
