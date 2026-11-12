# BMIS Patch Notes: Role manager, toggles, new icons, no instructions (12 November 2026)

- **Roles and Permissions** (System Administrator): editable manager. Roles are columns (Chairman, Secretary,
  Kagawad, Property Custodian, Treasurer, Authorized Personnel); permissions are grouped (Resident records,
  Document requests, Complaints/cases/hearings, Property and equipment, Reports and analytics). Each cell is an
  on/off toggle; changes apply immediately and are written to the activity log.
  Prototype: saved on this device. Backend: a roles/permissions table.
- **Manage Account → extra permissions**: each permission is a row with an Enabled / Disabled toggle (saved with password confirmation as before).
- **Icons**: replaced the generic Lucide outline set with Phosphor Icons (MIT): duotone for navigation, sections,
  tiles and states; bold for small controls. All icons come from one file, `src/icons/index.tsx`. No brand logos
  are used because BMIS represents no third-party services.
- **No instruction text**: removed step hints shown when choosing an action, instruction subtitles, and notes
  such as "Closed cases can be removed…". Empty states are short ("No hearing scheduled yet.").

---

# BMIS Patch Notes: Second test account, smaller corners (12 November 2026)

- Test accounts: a second team test account is supported (same "Viewing as" level switcher, own password).
  Its email and password hash come from `.env.local` locally and from repository secrets
  `VITE_TEST_ACCOUNT_2_EMAIL` / `VITE_TEST_ACCOUNT_2_PASSWORD_SHA256` on the live site. The Treasurer level was added to the switcher.
- Corners: cards 15px → 8px, buttons and inputs 8px → 6px, large rounded panels → 8px, pill buttons → normal buttons. Avatars, dots and the camera oval stay round.

---

# BMIS Patch Notes: Containers restored (12 November 2026)

- Brought back the boxed layout (cards, light-blue title bars, grey page background, boxed greeting and stat cards), as it was before the "open layout" change.
- Kept every removal made since: no subtext under titles, no helper text under fields, no developer-facing text, no status dots or pill badges, full-width content, connected workflow steps, plain equipment figures, full-width report template rows.

---

# BMIS Patch Notes: No developer-facing text (12 November 2026)

Removed or reworded text that described how the prototype works instead of helping users:
- Request details: "Set by the system" heading removed (values stay); "(in this browser session only)" removed from the saved message.
- "(simulated)" removed from Send reminder / Send late-return notice.
- Outcome records: "Working layout…" notice removed.
- Analytics: "Copy: Built-in, no names" and "Loaded in this tab" removed/reworded.
- Health page: "Application (frontend)" → "Application"; "Not connected: backend phase" → "Not connected".
- "Format pending" report schedules → "As required"; dashboard badge reads "Awaiting official file".
- "…in this session" messages, the permission code in the resident search message, and the unused "module not built yet" screen reworded.

---

# BMIS Patch Notes: Less AI-looking, better use of space (12 November 2026)

- Content uses the full width beside the sidebar (up to 1600px) instead of a narrow 1180px column.
- Status labels (Submitted, Ready for Pickup, Pending, Approved, Rejected, Overdue…) are coloured text: no dots, no pill backgrounds. Same colours as before.
- Numbers that need attention turn red instead of having a red dot. Pulsing dots removed.
- Helper text under fields removed; useful examples moved into the field placeholder (e.g. "Jr., Sr., III", password rule). Validation messages unchanged.
- Document Templates: the workflow is shown as connected numbered steps. The same stepper on each request shows done, current and upcoming stages (replaces the side progress list).
- Equipment Records: status as plain figures (Available, Pending request, Reserved, Borrowed, Overdue, Under maintenance); green for available, red for overdue.
- Reports: each official and recurring report template is one full-width row; "No template yet…" text removed; status reads "Awaiting official file".
- Checked: no sideways scrolling at 375, 1024 and 1440 px for every role.

---

# BMIS Patch Notes: Less subtext (12 November 2026)

- Page titles and dashboard greetings no longer show a description line under them.
- Removed descriptive notes under sections (stage explanations, calendar legend, "showing your most recent…", policy reminders, intro lines).
- Kept only text that helps someone act: password rules, what to attach, import warnings, empty-state messages, the one-time password notice.

---

# BMIS Patch Notes: Open layout, no boxed cards (12 November 2026)

Design only. The boxed-card look (borders, rounded corners and tinted title bars around
every block) was removed. Pages now use a white background, section headings with a thin
rule under them, and content lined up with the page edge.

- Sections (`Panel`): heading + thin rule, no box. Lists inside run edge to edge with dividers.
- Content blocks (`Card`): a thin top rule instead of a box. Tinted notices (warnings, errors) keep their box because the colour carries meaning.
- Stat numbers and the resident service shortcuts: label and number on a top rule.
- Greeting: a heading area with a rule below.
- Kept as boxes because they are controls or data: form fields, buttons, tables' header rows, the hearing calendar grid, account type choices, search results, tinted notices.
- Homepage: the same open style for the services, officials and contact sections.
- Checked: no sideways scrolling at 375, 1024 and 1280 px for every role.

---

# BMIS Patch Notes: Spacing and alignment (12 November 2026)

Design only; no change to colours, fonts or features.
- One spacing scale: 16px between page sections (header, cards, grids), 12px inside cards.
- Fixed list cards (dashboards, case documents, hearings, 21 places): rows were padded twice, so lists looked inset with uneven gaps. Rows now line up with the card title and fill the card edge to edge.
- Side lists on Reports and Document Templates stay in view while scrolling the preview beside them.
- Kagawad dashboard: both columns end at the same height.
- Checked: even 16px section gaps on every page for all roles; no sideways scrolling at 375, 1024 and 1280 px.

---

# BMIS Patch Notes: Workflow improvements from the Chairman interview (12 November 2026)

Full details, test results and checklist: `docs/REDESIGN_REPORT.md`.

**Not in the paper** (confirm with the barangay, then add to the paper's scope):
- Barangay Treasurer role (records document fees).
- Chairman "Return for revision"; separate "For Signature" step; "Completed" status name.
- Verification records (ocular inspection for Business Clearance, residency, cohabitation, civil status, indigency) required before Secretary approval.
- Editable requirements per document.
- Blotter entry numbers, hearing availability, summons delivery vs acknowledgment, outcome records (working layouts).
- Equipment location and under-maintenance count; service reports.
- Registration resubmission after rejection.

Backed by the paper: Secretary verification → Chairman approval, KP mediation process, borrowing rules, role-based access.

---

# BMIS Patch Notes: Readability for older users (11 November 2026)

- **Title bars are light blue with dark navy text** (was dark navy with white text).
  Dark text on a light background is easier to read. One colour token: `--color-bar` in `src/index.css`.
- **Bigger text everywhere** (about +2px): body text 13px to 15px, small labels at least 13px,
  uppercase labels 10.5px to 12.5px, chart labels 11px to 13px. Printed official documents keep their exact sizes.
- Wider side menu (292px); long menu items wrap instead of being cut off with "...".
- Wide tables (transactions, document requests, households, user accounts, activity log) switch to
  the card list below 1280px wide, so nothing scrolls sideways on laptops or tablets.
- Checked with no sideways scrolling at 375px (phone), 1024px (tablet) and 1280px (laptop) for
  Chairman, Secretary, System Administrator and Resident.

Design only; not a paper requirement (supports the paper's usability goal for elderly residents).

---

# BMIS Patch Notes: UI Finalization, round 2 (11 November 2026)

Changes from "UI FINALIZATION (1).pdf". The same rules as below apply: items marked
**Not in the paper** should be confirmed with the barangay.

| # | Change | Backed by the paper? |
|---|---|---|
| 1 | Every container title bar uses the navy fill in all portals (Resident, Chairman, Secretary, Kagawad, Custodian, Authorized Personnel, Admin). Descriptive subtitles under titles were removed; only subtitles that tell the user what to do were kept. | Design only |
| 2 | "Barangay Kagawad" is its own account type on the portal page (own login page), separate from Authorized Personnel, because its screens differ. | Yes: Kagawad is a user role |
| 3 | Home page: "Explore Services" button removed. | Design only |
| 4 | Home page: "What you can do through the portal" cards are wider. | Design only |
| 5 | The seal on dark backgrounds uses an image on an even white circle instead of a CSS disc. | Design only |
| 6 | Resident Home "Need Assistance": "View contact information" sits beside the heading; hall, phone, email and office hours are filled in. **The contact details are placeholders** in `src/config/barangay.ts` (`BARANGAY_CONTACT`); replace them with the confirmed values. | Contact details: **to be confirmed by the barangay** |
| 7 | My Profile corrections: civil status, educational attainment, employment and relationship in the family need proof (attach a photo/PDF, or choose to bring the original to the Barangay Hall). Name, birthdate and contact number fixes need no file. The Secretary must approve every correction. | Yes: record updates go through the Secretary. Proof per field: **Not in the paper** |
| 8 | Record Update Requests: "To review" and "Recently decided" tabs. Decided requests leave the screen after 7 days but stay in the resident's record history. The Secretary can open the attached proof before approving. | Review: yes. 7-day view: **Not in the paper** |
| 9 | Hearings and Mediation: total cards are plain white with dark blue text. | Design only |
| 10 | Analytics: tabs wrap instead of scrolling sideways. | Design only |
| 11 | Reports preview: report details in a tidy grid; summary figures shown as even tiles across the full width. | Design only |
| 12 | Registrations: check icons aligned in one column, top-aligned when the text wraps. | Design only |
| 13 | Dashboard "Population by street" (Chairman, Kagawad, Secretary): navy title bar, then one toolbar row with the street filter on the left and exports on the right. | Design only |

Prototype note: uploaded proof files stay in the browser only (no backend yet).
The sample requests use images marked "SAMPLE" in `public/samples/`.

---

# BMIS Patch Notes: UI Finalization (10 November 2026)

These notes cover the changes from the "UI Finalization" review. Each item says
whether it is backed by the final study paper (SE Group 4, latest full version)
or was added because the review asked for it. Items marked
**Not in the paper** should be confirmed with the barangay and, if kept,
added to the paper's scope.

## Colour codes (every status shown with one dot)

| Colour | Meaning | Examples |
|---|---|---|
| Green | Done, verified, ready, active | Verified account, Ready for Pickup, Approved: to claim, Returned, Template uploaded, Analytics ready |
| Blue | In progress, waiting for the next step | Submitted, Under Review, Scheduled, On loan |
| Amber | Needs attention soon | No portal account, Pending, Needs Additional Information, Format pending, Template pending, Due soon, In grace period |
| Red | Problem or failure | Overdue, Rejected, Failed check, Locked |
| Grey | Recorded, closed or nothing to do | Closed, Cancelled, Released |

Plain tags (sector tags such as PWD or 4Ps, "2 families", attendance counts) have no dot.

## All users

- Sidebar uses the flat, always-open format for every role. The Barangay Secretary,
  who has the most items, can fold sections.
- The page fills the window: header and menu stay in place and only the page
  content scrolls, so the account card at the bottom of the menu is always visible.
- "Back" returns to the page you came from (for example a case opened from
  Hearings and Mediation goes back there). Opened directly, it goes to the parent list.
- Removed "Sample data", "sample record", "Sample content", prototype notes and
  study references (Study §…, FR/NFR codes). Record numbers now look real (181-2026-0002).
- Empty containers say they are empty (for example "No sector recorded").
- Navy title bars are used only on the containers to look at first
  (My Recent Activities, Your work queue, Routed to you for approval, Requests to review).
- "View All ›" links everywhere; clickable items show the hand cursor.
- Account Settings: new layout, "(required)" on every field, Show password and
  Update Password buttons; the current password is still required.
- **Password change limit: 3 changes per 30 days per account.**
  A change forced after an administrator reset does not count. *Not in the paper.*
- Notifications menu: "No notifications yet" message and "View All Notifications ›".

## Public website

- "What you can do through the portal": three compact service cards.
- Login: back link above the card; left panel shows "Welcome back!" and the role in
  large type; the seal sits on a white disc on navy backgrounds (also on the
  account-type page); heading "Login as …".

## Resident

- Barangay Announcements show realistic example announcements instead of
  "sample content". *An announcements module is not in the paper*; these are
  fixed examples until personnel can post announcements.
- Needs Additional Information *(paper: residents submit a valid ID and a photo
  holding it)*:
  - When asking for more information, the Secretary ticks exactly what the resident
    must send (e.g. "Clearer photo of a valid ID", "Photo of yourself holding your valid ID").
  - The resident's transaction is highlighted with a pulsing dot on Home and in
    My Transactions until they reply; the message is shown first on the details page.
  - The resident attaches each requested file under the reply and sends it; the request
    returns to the Secretary's review and the requirement is marked as sent.
- My Transactions: friendlier empty states with "Report or complain" /
  "Show all transactions".
- New request: wider layout (three columns on large screens).
- My Profile: corrections now include full name and birthdate (age updates
  automatically once approved) and relationship in the family; corrections can be
  requested for family members too. Family shown as a table with headings.

## System Administrator

- User Accounts: "All / Barangay Personnel / Residents" filters with counts and a search bar.
- Manage Account: actions and the official's-account note on top, permissions below
  in equal-size boxes, "Save permissions" at the bottom right.
- **Saving permissions asks for the administrator's password** and shows a
  "Permissions saved" message. *Not in the paper* (the paper only requires
  role-based access).
- Extra permissions can be given to every barangay official account (Chairman,
  Secretary, Kagawad, Property Custodian, other personnel), not residents.
- Barangay Personnel: source column removed; "Previous · Page 1 of 2 · Next".
- Dashboard: spacing between sections fixed.

## Barangay Chairman / Secretary / Kagawad / Authorized Personnel

- Dashboards: greeting card, "Barangay Overview" / "Secretary Overview" row with the
  main button, plain stat tiles of equal height. Secretary: work queue across the full
  width with Upcoming hearings and Case records to update side by side below.
- Document Requests and Approvals: "Needs my action / Open / All" tiles, search and
  filters, reference numbers as outlined chips, 10 rows per page.
- Cases: "Day x of 15" above the stage, Remove as an outlined button.
- Case details: clearer header; numbered stages joined by a line; complainant and
  respondent in separate boxes; confidential complaint details in their own
  highlighted box; hearing participants listed in their own box.
- Hearings: the "Upcoming hearings" card text is visible again.
- Analytics: data source card reorganised (key facts, date and file buttons; details
  folded under "About this data"); filters in even rows. The "Resident records: sample
  data" card was removed.
- Kagawad: shortcut buttons removed (use the menu); officials card no longer stretches;
  Population by street header reorganised (street choice first, then exports).

## Barangay Secretary only

- Master list import moved into Resident Master List ("Import Master List" button);
  the separate import page and its menu item were removed. Excel (.xlsx) or CSV.
  *Paper: imports through CSV upload*; Excel is accepted as well so personnel do not
  need to convert the file.
- Households: clearer "2 families" label, aligned icons; household details have
  column headings (Name, Relationship to the head, Age, Sectors).
- Registrations: any check that failed or was not certain is highlighted in red.
- Reports: upload, replace, download and delete the official template for DILG, OSCA,
  MADAO, Barangay Bureau and each recurring report; missing templates are amber.
  *Paper: reports follow each office's required format*; the upload itself is new.
- Record update requests show who asked (when a family member requested it).

## Property Custodian

- Dashboard: Equipment Records button in the greeting card, Requests to review /
  Returns to watch with status dots, Recent transactions with arrows.
- Equipment Records: "Edit Record" button per row; editing covers every field
  (name, category, description, total, damaged, missing).
- **Categories can be added or changed** (type a new category); new equipment appears
  automatically in the residents' borrowing form. *The paper lists chairs, tables and
  nebulizers*; open categories are an addition.
- Borrowing statuses use the colour codes above ("Approved: to claim" is green).

## Differences from the paper still to decide

- Registration: the paper asks for **a photo of the resident holding the ID**; the
  portal currently takes a live selfie and compares it with the ID. The Secretary can
  now ask for the holding-ID photo when needed. Decide which one the paper keeps.
- Automatic approval: the paper matches **name, birthdate and address**; the portal
  matches name and birthdate. Address matching can be added.
