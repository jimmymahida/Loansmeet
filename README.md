# LOANSMEET — All-in-One Project

This is the consolidated LOANSMEET project. It keeps the working customer enquiry flow and combines the homepage, lead database, admin dashboard, legal pages, security headers, and launch documentation in one folder.

## Included
- Premium responsive LOANSMEET homepage
- Loan categories and enquiry form
- Consent-based lead capture
- SQLite lead database
- Admin login/dashboard
- Search, status, notes, filters and CSV export
- Privacy Policy and Terms pages
- Basic security headers and request-rate limiting
- Mobile-responsive customer and admin UI
- End-to-end local test checklist
- DSA/partner workflow notes
- Production launch checklist

## Run locally
From this project folder:

```bat
cd backend
npm install
npm start
```

Open: http://localhost:3000

Admin: http://localhost:3000/admin

No real admin password is bundled. Copy `backend/.env.example` to `backend/.env` and set your own strong password. Never commit `.env` to a public repository.

## Important production items
Domain/hosting, HTTPS certificates, production secrets, business/legal registrations, lender/DSA contracts, telecom messaging registration, privacy/data-retention review, and live marketing accounts require the owner's real accounts/credentials and professional review. The project contains the implementation and checklists, but those external accounts cannot be created inside a local ZIP.
