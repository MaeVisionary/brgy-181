# Barangay 181 Information Management System (frontend)

Frontend of the Barangay 181, Zone 16, District II, Manila Information Management System (BMIS).

> **Frontend only.** There is no backend, database or real sign-in yet. Records are labelled sample data (or files you load in the browser), and every access check runs in the browser. Production security comes with the backend phase.

## Run

```bash
npm install
npm run dev        # http://localhost:5181
npm run build      # type-check + production build
```

## Using the prototype

- **Public site:** `/` (homepage) → `/portal` (choose account type) → `/login/:role` (role-specific sign-in). Sign-in only validates the form and says that authentication arrives with the backend. There are no demo accounts or shortcuts.
- **Test account:** configured in `.env.local` (see `.env.example`; never committed). Sign in from `/portal` with any account type, then use **Viewing as** in the top bar to switch between all roles. The credentials for this machine are in `test-account.local`.
- **Passwords:** *Forgot password?* sends a request to the System Administrator. In **User Accounts**, the administrator resets the password and gets a one-time temporary password. The user must choose a new one at sign-in. Everyone can change their password in **Account Settings**. Prototype passwords are stored as SHA-256 hashes on the device; the backend will verify them on the server.
- **Development preview:** `/preview`, only in `npm run dev`. It opens any role's screens with sample data and is **not included in production builds**.

## What's in it

| Area | Highlights |
|---|---|
| Roles | Barangay Chairman (Robert Atad), Barangay Secretary (Ana Manila Salvador), seven Barangay Kagawad, SK Chairman (Kriscelli Ann Reyes), Property Custodian, System Administrator, other personnel, residents. Each has its own dashboard. |
| Resident records | Master list, profiles, households with multiple families, registration verification, update requests, CSV import with duplicate review |
| Documents | All 13 official templates, used exactly as supplied, with values placed on their blanks; per-document workflows, preview, print / Save as PDF |
| Katarungang Pambarangay | Cases, assessment, 15-day mediation under the Chairman, Lupon referral, hearings, attendance, reminders (simulated) |
| Equipment | Chairs, tables, ladders, nebulizers; 15-day period + 3-day grace; release, return inspection, overdue tracking |
| Analytics and reports | Loads the OSCA senior citizen masterlist (.xlsx) in the browser, with data-quality checks; community planning by area; internal reports to PDF/Excel. Official DILG/OSCA/MADAO/Barangay Bureau formats are pending. |

## Structure

```
src/
  config/      barangay.ts (officials, settings), permissions.ts, navigation.ts, accountTypes.ts
  documents/   template catalog, workflows, value filling
  analytics/   masterlist parser, statistics, reports, exporters
  mocks/       SAMPLE DATA ONLY (fictional residents on Barangay 181 streets)
  services/    data-access layer, one Promise-based function per backend call
  pages/       public/, dashboard/, residents/, documents/, cases/, equipment/, analytics/, admin/, resident/
public/templates/  official document pages (rendered from the supplied files)
docs/        PERMISSION_MATRIX.md, MASTERLIST_NOTES.md
```

To connect the backend, replace each `services/*.ts` body with an API call. Pages never read mocks directly.

## Privacy

The real masterlist file is never stored in this repository. It is read in the browser when loaded and cleared on reload. Sample residents are fictional.
