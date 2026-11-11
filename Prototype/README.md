# PSIB Prototype

Prototype of the Pakistan Startup Investment Board.

- `client/` – React + TypeScript (Vite) frontend
- `server/` – Node.js + TypeScript (Express) backend with PostgreSQL

## Requirements

- Node.js 20 or newer
- A PostgreSQL database: either installed locally, or a free online one from neon.tech

## Database setup

Create `server/.env` by copying the example file:

```
cd server
copy .env.example .env
```

Then fill in **one** of the two options in `.env`:

- **Online (Neon):** paste the connection string from Neon (Connect button), removing everything after `?`, and set SSL on:
  ```
  DATABASE_URL=postgresql://user:password@host/neondb
  DATABASE_SSL=true
  ```
- **Local PostgreSQL:** create a database called `psib` and set your password:
  ```
  DB_PASSWORD=your_postgres_password
  ```

Also set these in `.env`:

```
JWT_SECRET=any_long_random_text
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
