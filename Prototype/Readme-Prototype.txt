Project: P08 - Pakistan Startup Investment Board (PSIB)
Team:
  Huzaif ur Rehman (27100105)
  Akbar Munj (27100023)
  Minaa Azmat (27100176)
  Abdullah Ahmad (27100387)
  Subhan Malik (26100120)

PROTOTYPE SUBMISSION GUIDELINES

1. Properly tested working system deployed on an online hosting platform.
2. Code with readable comments uploaded in "Prototype" folder of your project's Github repository.
3. For prototype phase-2 only: 3-4 minutes video that explains the functionality of the prototype. This must be uploaded in "Prototype" folder of your project's Github repository.
4. This "Readme" file must be uploaded in the "Prototype" folder.



------------------------------------------------------------------------------------------------

LIST OF REQUIREMENTS COMPLETED IN THE PROTOTYPE (PHASE 1)


1. UC-001 Register and Verify Account - developed by Huzaif ur Rehman
   Users register as Founder, Investor or Incubator Manager. New accounts stay
   pending until the Platform Administrator approves them or rejects them with a
   reason. Only approved accounts can log in.

2. UC-004 Submit Startup Profile - developed by Abdullah Ahmad
   Founders fill in team, sector, stage, city, traction, revenue (PKR), cap table
   and round details. The draft autosaves every 30 seconds and when leaving the
   page, and can also be saved with the Save draft button. Completeness is shown
   while typing. Submitting checks all mandatory fields, sets the status to
   "Ready for review" and saves a new version.

3. UC-010 Manage Consent and Data Room Access - developed by Huzaif ur Rehman
   Founders choose which investor or incubator organisations can see their
   startup, see exactly what will be shared before confirming, and can revoke
   access at any time. Every grant, revoke and view is saved in the audit log.

4. UC-014 Review Shared Startups on Investor Dashboard - developed by Abdullah Ahmad
   Investors and Incubator Managers see only the startups shared with their
   organisation, filter them by sector, stage, city and round size, sort them,
   and open a startup's submitted profile. Each view is logged. If the founder
   revokes access, the startup is removed from the list with a message.




------------------------------------------------------------------------------------------------

HOW TO ACCESS THE PROTOTYPE


URL: https://psib-p08.onrender.com

Demo accounts:

  Role                 Email                  Password
  Administrator        admin@psib.pk          Admin1234
  Founder (KissanLink) founder1@psib.pk       Founder@2026
  Founder (PaySaaf)    founder2@psib.pk       Founder@2026
  Investor             investor@psib.pk       Investor@2026
     (organisation: Indus Ventures)
  Incubator Manager    incubator@psib.pk      Incubator@2026
     (organisation: Lahore Founders Lab)

Suggested way to check each use case:
  - UC-001: register a new account, try to log in (blocked as pending), then log
    in as the Administrator and approve or reject it under "Approve Accounts".
  - UC-004: log in as a founder and open "My Profile".
  - UC-010: log in as a founder and open "Access".
  - UC-014: log in as the investor or incubator manager and open
    "Shared Startups".

KissanLink is shared with Indus Ventures and Lahore Founders Lab; PaySaaf is
shared with Indus Ventures. All demo data is made up.



------------------------------------------------------------------------------------------------



ADDITIONAL INFORMATION

- The prototype is hosted on Render's free plan. If nobody has opened it for a
  while, the first page load can take up to a minute while the server starts.
- Code is in the Prototype folder: client (React + TypeScript) and server
  (Node.js + Express + TypeScript) with a PostgreSQL database on Neon.
  Prototype/README.md explains how to run it locally.
- Planned for later sprints: email verification and MFA (UC-001), data room
  documents (UC-005), readiness checks (UC-006) and fit score (UC-013).
