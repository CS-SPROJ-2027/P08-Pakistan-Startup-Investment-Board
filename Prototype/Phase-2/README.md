# PSIB Prototype

Prototype of the Pakistan Startup Investment Board.

- `client/` – React + TypeScript (Vite) frontend
- `server/` – Node.js + TypeScript (Express) backend with a PostgreSQL database on Neon

Demo accounts are listed in `Readme-Prototype.txt`.

## Requirements

- Node.js 20 or newer
- The project's PostgreSQL database on Neon (neon.tech)

## Setup

Create `server/.env` by copying the example file:

```
cd server
copy .env.example .env
```

Then set these values in `.env`. The Neon connection string comes from the Connect button in Neon; remove everything after `?`.

```
DATABASE_URL=postgresql://user:password@host/neondb
DATABASE_SSL=true
JWT_SECRET=any_long_random_text
JWT_EXPIRES_IN=8h
ADMIN_EMAIL=admin@psib.pk
ADMIN_PASSWORD=choose_an_admin_password
```

`npm run db:init` creates the tables and the admin account from these values.

## Running locally

1. Start the backend:

   ```
   cd server
   npm install
   npm run db:init
   npm run dev
   ```

   The API runs on http://localhost:5000

2. Start the frontend in another terminal:

   ```
   cd client
   npm install
   npm run dev
   ```

   Open http://localhost:5173. The home page should show "Server status: connected".

## Implemented use cases

- **UC-001 Register and Verify Account**: users register as founder, investor or incubator manager. New accounts are pending until the administrator approves or rejects them (with a reason). Only approved users can log in. Email verification and MFA are planned for a later sprint.
- **UC-004 Submit Startup Profile**: founders fill in team, sector, stage, traction, revenue in PKR, cap table and round details. The draft is autosaved every 30 seconds and when leaving the page, completeness updates while typing, and submitting checks all mandatory fields, sets the status to "Ready for review" and saves a new version. A warning is shown if the cap table does not add up to 100%.
- **UC-005 Upload Data Room Documents**: founders upload PDF, XLSX or DOCX files (max 25 MB) to a private data room, choosing the document type. Each file is checked, scanned for malware (a simple EICAR test check for the prototype), encrypted with AES-256 and stored as a new version. Revenue, burn, cash and headcount are read from XLSX files with the sheet and cell they came from; values with low confidence are marked "Verify" until the founder confirms or corrects them. PDF and DOCX files are marked "Not yet extracted". Quarantined files are only listed for the administrator.
- **UC-006 Run Readiness and Consistency Check**: founders run a check on their latest profile and data room documents. Rules in code (rubric v1) rate Team, Traction, Financials, Cap table and Fundraising from 0 to 5 and list the criteria met and missing; a category with no information shows "Not assessed". Consistency flags (cap table not 100%, profile revenue not matching the financial statement, missing documents) show severity and source file. If no document has been extracted, the report says "Documents not checked". Founders can explain a flag (investors see it on the startup page) or dispute a rating; the administrator overrides or keeps it with a reason, which is saved in the audit log.
- **UC-010 Manage Consent and Data Room Access**: founders choose which investor or incubator organisations can see their startup. Before sharing, the page shows exactly what the organisation will see. Sharing is only allowed when the profile is "Ready for review". Founders can revoke access at any time, and every grant and revoke is saved in the audit log and shown on the page.
- **UC-014 Review Shared Startups on Investor Dashboard**: investors and incubator managers see only the startups shared with their organisation (latest submitted version). They can filter by sector, stage, city and round size, sort the list, and see the result count. Opening a startup is saved in the audit log. If the founder removes access, the startup disappears from the list and a message is shown. Fit score and readiness come with later use cases (UC-006, UC-013).
- **UC-015 Compare Startups Side by Side**: investors and incubator managers tick 2 to 4 shared startups and compare them in one table: sector, stage, city, team size, customers, monthly revenue and round in PKR, the five readiness ratings and open flags. Missing values show "Not provided", never 0. The best value in each row is highlighted, rows can be sorted, and a startup can be removed from the table. The comparison can be saved to the organisation's shortlist, and each startup's founder sees it in the audit log. Fit score comes with UC-013 and the memo link with UC-016.
