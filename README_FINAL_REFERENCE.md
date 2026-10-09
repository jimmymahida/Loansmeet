# LOANSMEET — Same Reference Build

This build uses the user's supplied LoanMeet reference board as the visual master.
Existing backend/API/database structure is preserved from the prior project build.

Replace the contents of your repository with this package, keeping your production database out of Git.
Render:
  Build: cd backend && npm install
  Start: cd backend && npm start

Frontend pages:
- /
- /customer
- /partner
- /admin.html
- /admin-documents.html

The new master reference theme is in frontend/styles.css.
