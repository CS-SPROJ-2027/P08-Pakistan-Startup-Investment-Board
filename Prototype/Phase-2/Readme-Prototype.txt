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



LIST OF REQUIREMENTS COMPLETED IN THE PROTOTYPE (PHASE 2)


5. UC-005 Upload Data Room Documents - developed by Akbar Munj
   Founders upload PDF, XLSX or DOCX files (max 25 MB) to a private data room
   and choose the document type. Each file is checked, scanned for malware,
   encrypted and stored as a new version. Revenue, costs, burn, cash and
   headcount are read from spreadsheets with the sheet and cell they came from.
   Values the system is not sure about are marked "Verify" until the founder
   confirms them. Files with malware are quarantined and only the
   Administrator can see them. Founders can download a financial statement
   template so their numbers are always read correctly.

6. UC-006 Run Readiness and Consistency Check - developed by Minaa Azmat
   Founders run a check that rates Team, Traction, Financials, Cap table and
   Fundraising from 0 to 5 (rubric v1) and lists the criteria met and missing.
   Consistency flags show problems such as a cap table that does not add up to
   100% or profile revenue that does not match the financial statement, with
   the source file and cell. Founders can explain a flag (investors see the
   explanation) or dispute a rating, which the Administrator can override or
   keep with a reason saved in the audit log.

7. UC-015 Compare Startups Side by Side - developed by Subhan Malik
   Investors and Incubator Managers tick 2 to 4 shared startups and compare
   them in one table: sector, stage, team, customers, revenue, round, the five
   readiness ratings and open flags. Missing values show "Not provided". The
   best value in each row is highlighted, rows can be sorted, startups can be
   removed, and the comparison can be saved to the organisation's shortlist.

8. UC-016 Generate Diligence Memo - developed by Huzaif ur Rehman
   Investors and Incubator Managers open a one-page memo of a shared startup
   with team, market position, traction, financials, risks and red flags.
   Growth, gross margin, burn and runway are calculated in code from the
   monthly values in the financial statement, and red flags come from rules
   (for example runway under 6 months or revenue falling two months in a row).
   Every claim links to its source, and clicking a cell link opens the
   spreadsheet with that cell highlighted. The summary is written by a local
   AI model (Ollama) using only the memo's facts; if the model is not running,
   a rule-based summary is used instead.




------------------------------------------------------------------------------------------------

HOW TO ACCESS THE PROTOTYPE


URL: https://psib-p08.onrender.com/

The prototype is hosted on Render's free plan. If nobody has opened it for a
while, the first page load can take up to a minute while the server starts.
It can also be run locally (steps in README.md), then opened at
http://localhost:5173

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
  - UC-005: log in as a founder, open "Data Room" and upload a financial
    statement (choose "Financial statement" to download the template).
  - UC-006: log in as a founder and open "Readiness", then "Run readiness
    check". Disputes are reviewed by the Administrator under "Disputes".
  - UC-015: log in as the investor, tick two startups in "Shared Startups"
    and click "Compare selected".
  - UC-016: log in as the investor, open a startup and click "Open diligence
    memo". Click any cell link to see the source.

KissanLink is shared with Indus Ventures and Lahore Founders Lab; PaySaaf is
shared with Indus Ventures. All demo data is made up.



------------------------------------------------------------------------------------------------



ADDITIONAL INFORMATION

- Code is in the Prototype folder: client (React + TypeScript) and server
  (Node.js + Express + TypeScript) with a PostgreSQL database on Neon.
  Prototype/README.md explains how to run it locally.
- The memo summary (UC-016) uses Ollama with the llama3.2:3b model when it is
  installed and running locally (setup in README.md). Ollama does not run on
  the hosted site, so there the memo uses the rule-based summary.
- The malware scan is a simple check for the prototype (EICAR test file); a
  real scanner such as ClamAV would be used in the final system.
- Planned for later sprints: email verification and MFA (UC-001), reading
  numbers from PDF files (UC-005), fit score (UC-013), which will also be added
  to the comparison (UC-015).
