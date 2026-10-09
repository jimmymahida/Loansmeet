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
From the project root:

```sh
npm install
npm start
```

Open: http://localhost:3000

Admin: http://localhost:3000/admin

No real admin password is bundled. Copy `backend/.env.example` to `backend/.env` and set your own strong password. The example uses `NODE_ENV=development` for local HTTP; set production mode only behind HTTPS. Never commit `.env` to a public repository.

### AI assistant setup

The website assistant uses a server-side OpenAI-compatible chat-completions provider. It never sends an API key to the browser. To enable model responses, set these variables in the server environment (or in an uncommitted `backend/.env` file):

```env
AI_PROVIDER=openai
AI_API_KEY=your-provider-key
AI_MODEL=gpt-4o-mini
AI_BASE_URL=https://api.openai.com/v1
AI_TIMEOUT_MS=12000
```

`AI_BASE_URL` can point to another OpenAI-compatible provider. `AI_SYSTEM_PROMPT` is optional additional operator guidance; the built-in LOANSMEET safety and behavior prompt is always retained. Restart the server after changing environment variables.

If `AI_PROVIDER` or `AI_API_KEY` is not configured, the assistant remains available with a clearly limited built-in response that does not pretend a model is connected. Provider timeouts and errors return a safe message directing visitors to the support form. Messages are limited to 1,000 characters and the assistant has a per-IP request limit.

The authoritative server entry point is `backend/server.js`. Hosting platforms must run `node backend/server.js` (or `npm start`, which resolves to that entry point). The root `server.js` is only a compatibility launcher for existing tooling.

### Domain, indexing and installability

The production canonical domain is `https://loansmeet.com`; `www.loansmeet.com` redirects to the apex host. Render is configured for both hostnames and manages HTTPS certificates after the domain is attached and DNS is configured. Loan category pages are available under `/loans/<loan-category>` and are included in the sitemap. The service worker caches only the static site shell and never caches API responses or customer data. Push delivery is not enabled because no push provider and permission flow are configured. DNS was not changed and no deployment was performed.

The current partner/customer account models, login and protected dashboard APIs are retained. Partner/customer login and secured data routes require valid sessions; admin has an optional configured second code but no OTP delivery provider is configured. Support and customer callback tickets return a one-time tracking token; retain it with the ticket number and enter both under Support on the home page. Only ticket status, subject, and timestamps are exposed through token-protected tracking. A public WhatsApp enquiry link is shown only when `WHATSAPP_BUSINESS_NUMBER` is configured as an international-format number without `+` or punctuation (for example, set the real business number in `backend/.env`); no number is bundled. WhatsApp notification delivery remains separately dependent on WhatsApp Cloud API credentials. Customer accounts are currently anchored to one application, so a multi-application customer account needs a deliberate account-linking and verification flow.

## Important production items
Domain/hosting, HTTPS certificates, production secrets, business/legal registrations, lender/DSA contracts, telecom messaging registration, privacy/data-retention review, and live marketing accounts require the owner's real accounts/credentials and professional review. The project contains the implementation and checklists, but those external accounts cannot be created inside a local ZIP.
