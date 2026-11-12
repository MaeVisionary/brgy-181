# BMIS Patch Notes: Report formats, notifications, analytics and cleanup (12 November 2026)

## 2026-11-12 (latest): Saved account changes and activity log, pickup steps, demo recovery requests

- Account changes are kept on the device and survive a reload: personnel accounts added by the administrator, activation and deactivation, name changes, approved role or permission changes, suspensions from registration reports, and the e-mail changed after a verified account recovery. "Reset demo data" removes added accounts like it removes registered ones.
- The activity log is kept on the device (shared by its tabs, newest 2,000 entries). Sample entries made while the demo data loads are not saved, so they do not pile up on each start.
- Document pickup uses the same step controller as the other forms: "Step 1 of 2: Choose a time", "Step 2 of 2: Check and book"; Next needs a date and time, rapid taps move one step, and Back keeps the chosen time.
- Demo data adds two account recovery requests: Lourdes Santos (lost e-mail, waiting for the Secretary) and Kagawad Angelito Dela Cruz (identity checked by the System Administrator, Hall visit set for the next working day).

## 2026-11-12: Forgot password and account recovery

- "Forgot password?" on every sign-in page: enter the registered e-mail; the answer is the same whether or not an account exists. A single-use reset link is sent (random 32-byte token; only its SHA-256 hash is stored), expires in 15 minutes, and cancels any earlier link. Limits: 3 requests per address per 15 minutes, 10 per device per hour, 5 invalid links per 15 minutes (valid links are not affected).
- Create New Password page: at least 12 characters (up to 128), passphrases welcome, no forced symbols or capitals; common passwords, repeated or sequential characters, and the person's own username or e-mail are refused. Show/hide, length guide, and the token is removed from the address bar once read. Barangay Personnel also confirm their account number (EMP-181-…).
- After a reset: every session of the account is ended (other tabs are signed out within seconds and told why), failed sign-in counters are cleared, a "password was changed" e-mail and notification are sent, and the change is in the activity log.
- "I can't access my registered e-mail": a 4-step recovery request (account, details, what happened, check and send) with a reference number; 3 per device per hour. Routing: residents to the Barangay Secretary, Barangay Personnel to the System Administrator, administrator accounts to the Punong Barangay. Nobody reviews their own request.
- Account Recovery page (Secretary, System Administrator, Punong Barangay): list with status and next step; detail with the matching account, findings, request for more information, in-person verification, approve (a reset link to the registered e-mail, or to a new e-mail the reviewer verified) or reject with a reason. Approval needs a recorded finding; administrator accounts also need in-person verification. When the link sent to a verified new e-mail is used, that address becomes the account e-mail. Statuses: Pending Review, Additional Verification Required, In-Person Verification Required, Approved, Rejected, Completed.
- Personnel never see or set passwords: User Accounts now sends a reset link (not available for administrator accounts, which use Account Recovery), and new personnel accounts get a setup link instead of a temporary password.
- E-mail is still simulated (no provider connected). In development only, "/dev/mailbox" shows the links sent in that tab; it is not in production builds.
- Also in this update: step-by-step forms (registration, Book a visit, document requests, account recovery) use one step controller, so Next moves exactly one step even on rapid taps, only the current step is validated, Back keeps what was entered, and the progress indicator follows.

## 2026-11-12: Demo data, wording sweep and final audit report

- Demo data (src/demo/seedDemo.ts): connected, synthetic records for every role, created through the real services so each one shows for the sender and the receiver with its notifications and activity log: a complaint with mediation and an assigned Kagawad, three community concerns (one assigned with a note, one resolved), visits for today and tomorrow (Secretary, Punong Barangay, Property Custodian), an equipment borrowing with a booked pickup, an office closure, a verified ID on file, two access-change requests and security log entries. Two demo resident accounts (Daniel Garcia, Lourdes Santos) were added so the residents' side can be previewed.
- Demo records are recreated each start (dates follow today), marked "demo" on the device and removed before reseeding; one tab seeds at a time. System Settings > Demo data has "Reset demo data" (confirmed; keeps settings, holidays and passwords). No real personal data; no real e-mail or SMS.
- Wording: settings labels made distinct ("Barangay consultation (Punong Barangay)", "Mediation or dispute: first visit", "Mediation hearing", "Conciliation hearing", "Time to Check Each Original Document"); "1 file" instead of "1 files". No user-facing "staff" wording remains.
- docs/FINAL_AUDIT_REPORT.md: status of all 1,228 requirements (710 done, 286 partial, 97 need the server, 45 not built, 35 need a barangay decision, 55 superseded), the most important gaps, contradictions, decisions needed, deployment readiness and the role/permission matrix. Full table: docs/REQUIREMENTS_STATUS.md.

## 2026-11-12: Purpose-based appointments, document pickup and processing time

Appointments
- "General assistance" is removed. Book a visit now starts with the purpose: Barangay consultation (Punong Barangay), Community concern (Barangay Secretary), Mediation or dispute (Punong Barangay), Follow-up on my complaint (Punong Barangay; must name one of the resident's own complaints). Each needs a reason from a fixed list, a short description (15 to 500 characters, with a note not to include ID numbers or medical details), a mobile number and a chosen day and time; then a review screen. Field errors appear under each field; the same rules run in the service.
- Routing follows the purpose: the Punong Barangay holds consultations, mediation and complaint follow-ups (and confirms the time first); the Secretary handles community concerns. Duplicate open bookings for the same purpose are refused; a time taken a moment earlier is refused at saving.
- Earlier "General assistance" bookings are kept and shown as Community concern with "Purpose not recorded (booked before a purpose was required)".

Document pickup
- Pickup is booked from the document request (never as a separate visit) as soon as the request is submitted, but only for times after the estimated ready time, within office hours, on open days (holidays and closures shown as Closed) and within pickup capacity.
- Booking a pickup never marks the document ready. When the Secretary marks it "Signed and sealed: ready for pickup", an earlier pickup stands and the resident is told; otherwise they are asked to choose a time.
- A booked pickup is released (with a notice saying why and the new expected time) when more information is requested, when processing is extended, or when the estimate moves past it (bigger queue, changed processing time, staff leave). Residents can change or cancel a pickup up to 2 hours before.

Processing time
- Each document type has its own preparation time in office hours, 12 to 124 hours (initial estimates: Residency and Indigency 12, certificates 16, Cohabitation and Clearance 24, Business clearance 48; marked "initial estimate" until the administrator sets them). Settings > Processing times, also the daily capacity (default 20 requests).
- The estimate counts only office hours (8:00 to 5:00 with the lunch break), skips weekends, holidays, closures and days when everyone who prepares documents is on leave, adds a day for each full day's worth of requests ahead, pauses while waiting for the resident's reply, and is recalculated every time it is shown. The RA 11032 / Citizen's Charter date stays as "Latest allowed"; estimates past it are flagged for the Secretary.
- Residents get a receipt with the expected ready time when they submit, and notices when more information is needed, when processing is delayed or extended, when the document is ready, and when the pickup is booked, moved or released.

Secretary and resident screens
- Document Requests (personnel): stage filters with counts (New, Under review, Processing, Awaiting requirements, Ready for pickup, Pickup scheduled, Completed, Rejected or cancelled), and Ready by and Pickup on every row; delayed or past-charter estimates in red.
- Request details (personnel): "Processing and pickup" panel with the estimate and how it was counted, the legal latest date, the linked pickup and who releases it.
- Resident Home: a separate Document Requests section (status, expected ready time, pickup); Upcoming Appointment shows visits only.

## 2026-11-12: User Accounts table

- Desktop (1280 px and wider): table with select boxes, an expand arrow per row (one open at a time), Name, Username, Role, Email, Contact number, Status and compact Edit and More actions. From 1280 to 1535 px the username sits under the name and the contact number under the email. Phones and tablets: account cards with Details, Edit and an actions menu.
- Expanded rows show only fields the system holds (missing ones say "Not on file" or "Not recorded"): personnel role, responsibility and contact; residents' resident number, verification, registration date and linked record; account number, status, password state and last sign-in.
- All / Barangay Personnel / Residents with counts; search by name, username, email, role, resident or account number and contact number; 10 per page, back to page 1 when the filter or search changes.
- Bulk Activate / Deactivate (confirmed first; your own account and test accounts are skipped and named) and Export selected (CSV of name, username, account number, role, email and status only). Logged in the activity log.
- Add User creates Barangay Personnel accounts (Kagawad or Property Custodian) with a one-time temporary password; residents still get accounts by registering.

## 2026-11-12: Resident home, buttons and personnel activity

- Resident home order: greeting, the three services, Upcoming Appointment (its own section right under the services on every screen size), Document Requests, Barangay Calendar, Barangay Announcements. Phones use full-width rows; tablets and desktops use tiles; from 1280 px the calendar is the wide column with announcements beside it. An appointment the resident still has to confirm gets an accent bar, a soft pulse and "Review and confirm".
- Sample record (labelled "sample"): the Barangay Secretary schedules an in-person verification for the sample resident's address correction; it shows on the resident's Home, in the Secretary's appointments and in the activity log.
- Each personnel dashboard has "My recent activity" (the official's own logged actions).
- Button standard (src/components/ui/Button.tsx): 44 / 48 / 56 px minimum heights, labels wrap instead of clipping, buttons in one row share the same height, 20 px icons, visible focus, pressed and disabled states, solid red only for the final confirmation of a destructive action. Selection cards (certificates, clearances, complaint types, visit purposes) share one height per group. Every page was checked for each role at 375 px and 1280 px with the largest text size: no button below 44 px, no clipped labels, no uneven groups.

## 2026-11-12: Next buttons and icon alignment

- Root cause of steps "jumping": step and page buttons computed "current + 1" (setStep(s => s + 1), setPage(p => p + 1)). A quick double tap ran it twice using the previous screen's check, so registration went from Privacy straight to Valid ID without the details step, and lists skipped a page. Fixed by moving to an exact step/page number, a short lock after each step change, clamped pagination, and a shared Button that ignores a second tap within 400 ms (also stops double submissions).
- Back goes back exactly one step; the progress bar matches the step shown. Pagination buttons are 44 x 44 px; the resident list uses the shared pager.
- Icon alignment standard (src/index.css, icon-line): icons beside text that can wrap sit in a box one text line tall, centred on the first line at every text size. Applied to 21 icons that used fixed nudges (2.5 px off at default size). Row arrows stay centred on the row.
- Mobile bottom bar: icons pinned at the same height, labels may wrap to two lines instead of being cut off; resident "Documents" shortened to "Requests".
- On phones the registration Continue button sits above the "please correct" note, so the note does not push it.

## 2026-11-12: Form validation, face check on phones, auto-save and draft recovery

Validation
- Continue / Submit never does nothing: on a problem the page scrolls to the first field marked in red, puts the cursor there, and says how many items need correcting. Messages sit under the field, say what to fix with an example (e.g. "Please enter a valid email address. Example: name@gmail.com", "Please select Yes or No."), and disappear once corrected. Nothing typed is cleared.
- Shared rules in src/lib/validation.ts are used by the forms and re-checked in the service layer (registration, document requests, complaints, concerns, borrowing, corrections); a request that skips the form is refused with the same messages.
- Buttons that used to stay greyed out until a form was complete now stay tappable and explain what is missing (Button `blockedReason`).
- Server problems say so plainly, keep the entries, and allow Try again. Double taps are ignored while sending.

Face check (registration)
- Phone-first layout: tighter card, camera box sized to the screen height so the whole oval and the buttons fit, steps listed one per line with done and current steps marked, full-width 48 px buttons, safe-area padding.
- Starts with a short explanation and a Start camera button. Clear messages for permission refused, camera in use, no camera, non-secure page, and a 15-second start-up timeout, each with Try again and the existing upload fallback. Leaving the app mid-check turns the camera off and offers to start again. The verification steps and checks are unchanged.

Auto-save and draft recovery
- Forms save as you type (after a short pause) on this device: registration (24 hours), document requests, complaints, community concerns, equipment borrowing, profile corrections, visit requests, and for Barangay Personnel the walk-in request, new blotter entry, announcement editor, walk-in borrowing and add equipment (7 days). A small "Saved on this device" note shows progress; "Unable to save" appears if the device cannot store it.
- Returning to an unfinished form shows "Welcome back!" with Continue where I left off / Start over, only when a draft exists. A change made in another tab is offered, not silently overwritten.
- Never saved: passwords, ID numbers, ID photos, selfies, face data, session tokens. After a refresh during registration the ID and face steps start again (the resident is told why). Uploaded files are re-attached if still kept (24 hours); otherwise the form asks to attach them again.
- Drafts belong to the signed-in account; signing out removes them from the device; expired drafts are removed on start. A draft is never a submission: nothing is sent, approved, recorded or published by auto-save, and reference numbers are given only on submission.
- One submission per draft: each submission carries the draft id, so pressing Submit twice or retrying after a dropped connection returns the first record instead of creating a duplicate. While offline nothing is sent and the form says so.
- Database design: docs/supabase/drafts.sql (owner-only RLS, versioned saves, unique client_request_id). Not applied; server-side drafts across devices need the backend.

## 2026-11-12 (latest): Identification numbers and household records

- One standard: Resident RES-181-YYYY-NNNNNN, Household HH-181-NNNNNN, Family FAM-181-NNNNNN, resident portal Account ACC-181-NNNNNN, Barangay Personnel EMP-181-NNNNNN. Transaction references (CLR-, APT-, BRW-, ANN-, KP-) are unchanged and never used as a person's number.
- Numbers come from a counter that only goes up (src/lib/ids.ts), never from a row count, so archived numbers are never reused. Internal ids stay separate. On Supabase these are database sequences with unique constraints and UUID primary keys (docs/supabase/identifiers.sql, not applied).
- Migration: every resident and household got a new number; the earlier number (181-2026-000N, HH-181-00N) is kept as "Earlier number", shown on the personnel profile and still found by search. Imported and newly registered residents also get standard numbers.
- Resident My Profile shows the Resident Number and Household Number with a short explanation; My family shows the Family Number. Account Settings shows the Account or Personnel Number.
- Barangay Personnel: profile shows Household and Family Numbers, Change household (reason required; Resident Number unchanged; household history kept and audited), Make family head (adults 18 and older only). Households: New household (one per address; a second household at the same address is refused), Add a family, families listed with their numbers.
- Resident menu regrouped: My Appointments and My Calendar moved under Main menu (the menu headings no longer repeat).
- Search: residents, households and accounts can be found by any number (new or earlier), name, address or contact number.
- Possible duplicates (same name and birthdate, same name on the same street, same contact number) are shown on registration review and import. Nothing is merged automatically.
- Prototype limit: resident and household edits are kept in memory for the session; only the number counters persist in this browser. Atomic numbering across devices needs the database.

## 2026-11-12 (later): Security, accessibility, phones, uploads, registrations

- Roles: only System Administrator, Chairman, Secretary, Kagawad, Treasurer, Property Custodian and Resident. "Authorized Personnel" removed (role, login, seed account). Treasurer sees fee documents only. Kagawads see complaints assigned to them by case personnel.
- Log out asks for confirmation; signing out clears the session and returns to the sign-in page. Sessions end after 30 minutes without activity (activity keeps them alive) and the sign-in page says why.
- Role and permission changes: staged, reviewed as a before/after table, need a reason and the administrator's password. The confirmation is bound to that exact change, expires in 5 minutes, allows 5 attempts and works once. Nobody can change their own role or access. Affected accounts are notified and every step is in the activity log.
- One-time codes (OTP) are not implemented: they must be generated and checked on a server (e.g. Supabase Auth MFA). Password re-entry is the step-up until then.
- Registrations: full application view, ID with masked number (reveal is logged), checks shown as Passed / Needs review / Failed / Not checked (missing checks never count as passed), in-person visit request with a generated email, visit record, then decision. No email service is connected, so emails are recorded as "not sent" and the screen says so.
- Text size: Aa control (Small / Default / Large) scales all text; larger default on phones.
- Phones: bottom bar with More sheet; record tables become tappable lists; no sideways scrolling at 320 px.
- Uploads: PDF, JPG, PNG only (checked by content); photos resized and location data removed; limits in src/config/uploads.ts; duplicates stored once; unsubmitted uploads removed after 24 hours; Supabase schema and policies in docs/supabase/documents.sql (not connected).

## 2026-11-12: Simplification, resident profile reuse, complaints workflow

- Reports: Official Forms / Regular Reports as name, agency, download. Analytics and service reports use short names, compact figures, collapsible report details, and a selector on phones.
- Registrations: one row per applicant with one result (Passed / Needs review / Failed); details grouped as Identity and Resident record; reason required only when rejecting. ID updates queue for replacement IDs.
- Notifications: one-line tappable cards with coloured icons; tap opens the record, x dismisses.
- Equipment: total and available list; detail sheet with all counts and a warning when counts do not reconcile.
- Colour icon tiles per function in the sidebar.
- Resident ID on file: taken from the registration or a verified replacement; expiry rules per ID type (no expiry assumed for IDs without one); expired IDs refused; ID image visible only to staff who verify residents; ID number masked.
- Document requests reuse saved details and the verified ID; an ID upload is asked only when missing, expired or rejected.
- Corrections: own record; minor dependent with guardianship proof; another adult only with an authorization staff verify; household updates by the family head only. Checked in the service, audited, notified.
- Resident statuses: Submitted, Processing, Action Needed, Ready, Borrowed (borrowing only), Completed, Unsuccessful; filter shows only statuses that occur for the chosen type. Workflow statuses on records are unchanged.
- Processing time: RA 11032 classification per service (simple = up to 3 working days) until the Citizen's Charter time is entered in System Settings; weekends, holidays and after-hours receipt handled; one-time extension with reason, notified to the resident.
- Resident portal offers only resident services. Non-residency certification, summons, incident and blotter forms, and notices of hearing are refused for residents in the service layer.
- Complaints: dedicated File a report page (complaint against a person, incident report, community concern) saved as a case with its own KP number; staff notified; complainant notified when the visible status changes.

Needs the backend (not possible in this frontend prototype): server-side enforcement of all checks above, encrypted ID storage, database-level access rules, and tamper-proof audit logs.

- **Report formats** (Reports page): official files from the barangay's shared drive — DILG BOIS form,
  OSCA social pension transmittal, BADAC (MADAO) transmittal, DILG weekly clean-up report (Annex A);
  prepared formats for the Barangay Bureau monthly report, Katarungang Pambarangay monthly report and the
  monthly senior masterlist (blank, same columns as the July 2025 masterlist). A filled-in field in the BOIS
  copy was blanked; the "Barangay Blue Format" file was not used because it contains a resident's personal data.
- **Notifications**: iOS-style cards grouped by Today / Yesterday / Earlier; tap to expand for the reference,
  person, time and an action (View Request, Open Case…); mark read, mark all read, dismiss (history kept).
  Preview notifications are used only while developing locally, never on the live site.
- **Analytics**: short titles (Age Distribution, Residents by Area…), stat cards without hints,
  area table (Area · Records · %), no methodology sections, import messages limited to results and problems.
- **Global cleanup**: removed internal explanations ("How addresses were grouped", normalization log,
  "About this data", auto-approval explanation, report methodology notes, "set automatically" placeholders).
- **Recent transactions**: reference and status on top, name and date below.
- Live sweep: 79 pages × 8 roles, no raw values (undefined/null/NaN), no escape codes, no overflow, no console errors.

---

# BMIS Patch Notes: Compact feeds, inventory table, work queue (12 November 2026)

- **Status badges** everywhere: small, softly tinted, square-cornered, no dots. Pending Review amber,
  Under Verification blue, Approved by Secretary / Ready for Printing green, Needs Revision red.
- **Recent transactions** (Custodian): compact activity feed. Reference number first with a short status
  (Submitted, Encoded, Approved, Released, Returned…), resident and date below (date only, e.g. Nov 5, 2026). Shows 10 entries.
- **Your work queue** (Secretary): compact rows (document · resident; reference · submission date; status on the right).
  Summary counts from the records: needs your action, open requests (not completed/rejected/cancelled),
  completed this week (marked completed in the last 7 days).
- **Property and Equipment Records**: shorter rows, statuses as one line of small badges (Available green,
  Pending amber, Reserved purple, Borrowed blue, Overdue red), totals right-aligned, damaged/missing highlighted
  only when non-zero, pencil icon instead of "Edit Record", phone layout as cards, edit form opens under the item.
  Calculations unchanged. Note: Overdue is part of Borrowed (not extra units); Pending is requested units,
  not yet set aside, so it is not subtracted from Available.

---

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

## Automation: contact numbers, name formatting, Secretary queue (2026-11-11)
- Contact number corrections are refused when the number already belongs to another resident (checked when submitted and again just before saving; spaces and dashes ignored, stored without them). Database-level uniqueness and the one-time code to the new number still need the backend.
- Full name corrections that change only spacing or capital letters (same letters) are applied automatically and audited. Any spelling change still goes to the Secretary.
- Secretary dashboard: new "Who needs to act" panel. It shows five counts: Needs my attention, Past expected date (exceptions), Waiting for resident, Waiting for Chairman, and Done automatically (last 7 days).

## Appointments: one scheduling engine for every visit (2026-11-12)
- New scheduling engine (`schedulingService`): it calculates how long a visit takes from the items to check, so the Secretary no longer picks a duration. One ID takes 10 min; several items are checked together (the longest, plus 5 min for each other item, between 20 and 30 min). It also applies office hours, the lunch break, per-staff working days and hours, leave, holidays, a 5-minute buffer after each visit, an office-wide limit at the same time, a daily limit, and the earliest bookable time. Free times are re-checked at the moment of saving, so two people cannot take the same last slot (tested).
- The duration is read-only. Authorized staff can override it with a reason; the original and adjusted length, who changed it and when are kept and audited.
- When the chosen staff member is unavailable, the form says why (on leave, not on duty, hall closed, fully booked) and offers other staff free that day and the next free time.
- One appointment record for all services: in-person verification, document claiming, complaint consultation, and equipment pickup and return (wired in the equipment update). Appointment statuses are their own: Awaiting schedule, Pending confirmation, Confirmed, Reschedule requested, Rescheduled, Completed, Cancelled, No-show. Older saved visits are mapped onto these.
- Document claiming is automatic: when a request becomes "Ready for pickup", the resident gets a claiming appointment to book (no duplicates). Releasing the document completes it; cancelling or rejecting the request cancels it. Walk-ins without an account are not given one.
- Residents pick a day from a simple list (open / no free times / closed), then a time, then confirm on a summary screen. Staff can book for a resident who needs help.
- The Secretary can let the resident choose the time (recommended) or set it now, and can preview the exact message the resident will get.
- Messages include the resident's name, reason, date and time, expected end, place, what to bring, how to reschedule, and contact details. They go out in-app and as an email record for: ready to schedule, scheduled, confirmed, moved, length changed, cancelled, reminder, and no-show. No email is actually sent: each is shown as "not sent (no email service configured)".
- Automatic jobs: reminders at 24 h and 2 h (each sent once; a late run sends only the nearest). A visit nobody checked in becomes a no-show 30 minutes after its end; the request stays open.
- Staff calendar with Today / This week / Next 30 days / Needs action tabs, filters by service and staff, and a free/booked times view. Hearings appear read-only from the case module. Staff see only the services their permission covers; the System Administrator and Treasurer see none.
- "Today's appointments" summary on the Secretary dashboard. Complaint consultation can be scheduled from the case page (hearings still follow the case steps).
- Admin › Settings › Appointment scheduling rules: every rule above, plus staff hours and leave. System Administrator only; versioned and audited.
- docs/supabase/scheduling.sql: tables, an exclusion constraint against double booking, one open appointment per record, RLS by permission, and the job that sends reminders. Not applied.

## Equipment borrowing lifecycle and simpler scheduling settings (2026-11-12)
- Lifecycle: Request Submitted / Availability Checking → Approved → Ready for Pickup → Borrowed → Return Due Soon / Overdue → Returned → Completed (or Rejected / Cancelled). Every step has a set role and is logged with time and person. Steps that don't apply to the current status are refused.
- Availability is counted for the requested dates, not just total stock. It is usable stock (total minus damaged, missing and maintenance) minus every approved, prepared or borrowed request that overlaps those dates. Overdue items count as out until returned. Approval and release re-check stock at the moment of saving; two approvals for the last units cannot both pass (tested).
- Each request gets an estimate when submitted, labelled as an estimate. Without a date, the resident sees "Your estimated availability is being determined…". The estimate is recalculated when stock changes, and residents are told only if their outlook changes.
- The custodian can approve fewer items, with a reason the resident sees. Approval creates a pickup appointment for the resident to book in the shared appointment system.
- Release needs an ID check and the borrower's confirmation. The deadline counts from the actual release date, at the configured return time, moved to the next open day. A grace period is added if one is configured.
- Reminders before the deadline and on the day. Overdue notices go to the resident and the Property Custodian, repeated every 2 days by default. A reserved pickup at risk from a late return triggers a warning. Each notice is sent once. No fines are computed.
- Returns can be partial. Damaged or missing items update inventory and open a review that needs a settlement note to close. The return date can be moved, with a reason the resident is told.
- Residents never see staff-only notes. The resident page shows the status, last update, a schedule block (Estimate / Confirmed / Actual), a progress tracker and the updates. The list shows simple cards.
- Property Custodian dashboard: overdue first, then requests to review, awaiting pickup, borrowed now, due today, due within 48 hours, under maintenance and available now. It also shows today's appointments and a "Needs your action" list.
- Admin › Equipment Borrowing Rules: period, grace, return time, preparation days, reminders, overdue repeat, and a "Confirmed by the barangay" box. The default 15 + 3 days comes from the study (FR22) and is flagged until confirmed.
- Prototype data is now kept in this browser across reloads. docs/supabase/equipment.sql describes the locked stock count, constraints and RLS. Not applied.
- Appointment Scheduling settings redesigned: Office Hours, Appointment Availability, Attendance and Reminders, Processing Time, Staff Leave, plus collapsible Advanced Settings. Fields are larger, with no overlapping labels and no explanatory paragraphs. New checks: the break must be within office hours, and hours must leave time for appointments. A warning appears when new hours leave booked appointments outside them.

## Navigation, landing page, login and request forms (2026-11-12)
- Back always returns to the page you came from. When there is no earlier page (a direct link or a reload), it goes to that page's parent list. Fixed the Chairman's path Approvals → request → Preview → Back, which used to land on Document Requests. The document preview and walk-in request pages had fixed "Back" links; they now use the shared Back.
- Going back restores where you were: scroll position (every page), the expanded approval card, and list filters, searches, tabs and page numbers (Document Requests, Approvals, Cases, Residents, Households, Borrowing, Appointments, Registrations, Corrections, Users). These are kept for the visit only, in sessionStorage.
- Landing page on phones: the text-size box no longer runs off the screen (fixed for every page that uses it). The header now fits at 320px with Large text. Checked at 320, 360, 375, 414 and 768px with no sideways scrolling.
- Login: "Remember me" and "Forgot password?" stay on one line at normal text size, with a larger checkbox and 44px tap areas. On the narrowest screens with Large text they move to two tidy rows instead of squeezing.
- Document requests: choosing a certificate opens its own form page (/my/documents/new/<type>), with Back, the document's name and one line on what it is for. Restricted documents still cannot be opened, even by typing the address. Progress is kept if you go back by mistake. "Review Request" shows a summary before "Submit Request". "Cancel" asks before discarding what you typed.
- The same pattern now applies to reports (each report type has its own form page) and to equipment borrowing (the form has its own page instead of appearing above the list).

## Per-service scheduling, role calendars, simpler cases and timelines (2026-11-12)
- Each appointment type has its own rules, set by the System Administrator: duration, buffer, start interval, the roles that handle it, a per-person daily limit, how late residents may change it, reminders, whether residents can book it, and whether the official must confirm. Starting values: claiming 10+5 min, verification 15+5, complaint interview 30+10, equipment release and return 15+5, consultation with the Punong Barangay 20+10, general assistance 15+5, mediation and conciliation 60+15. These are operating estimates, not legal timelines.
- Workload protection: a daily limit per person, and a cap on back-to-back work (120 min by default; a break is kept after that). Tested: claims run 8:00–9:45, then the next free time is 10:15.
- Staff are chosen by role, and the person with the least booked time that day gets the slot. Appointments can be reassigned to a qualified colleague with a reason; it is audited and both are told.
- Hearings stay in Case Management (one record). They appear automatically on the calendars of the Punong Barangay (mediation) and of personnel assigned to the case, and they block those people's time. Residents who are parties see them as "Barangay hearing", without case details.
- Calendar (formerly Appointments): My calendar or Team; Day, Week and Month (a month grid on larger screens, a list on phones); Needs action. Filters by service and by person. Each person sees only the services they handle.
- Dashboards: "Today's schedule" shows only your own appointments and hearings, how much free time is left, items to confirm and reschedule requests. Added to the Chairman's dashboard.
- Residents can "Book a visit" for general assistance or a consultation with the Punong Barangay. Consultations wait for the official to confirm. Residents can cancel these up to the service's cutoff.
- Reminders per service: 7 days, 3 days, 1 day, on the day (7:00 AM), 1 hour. Only reminders after the booking time are sent; a late run sends one notice; each is sent once (tested). Assigned staff get the day-of and 1-hour reminders. Interview and consultation reminders use neutral wording.
- Actual visit durations (check-in to completion) are recorded and shown beside each service in settings, so estimates can be tuned after a few weeks.
- Settings: Service Durations and Workload Protection sections. Per-service interval, limits, change cutoff and reminders are under Advanced Settings.
- Case list: one row per case with case number, parties, one status and the next hearing if any, plus a small marker when mediation is past its period. Search, stage filter and "Show removed cases" remain. Removing or restoring a closed case moved to the case page.
- Hearing history: a compact entry (date and time, type and place, one status, one outcome line) with "View details" for attendance, notes and reminders. Attendance can be Present, Absent or Excused, and is final once saved. Actions match the status, and saving or moving a hearing asks for confirmation.
- One timeline for every history: cases, document requests, appointments, borrowing, concerns, and the resident Updates. Newest first, with a thin line, markers for important events, and details on tap.
- Back fix: a page that replaces another (for example a finished form) no longer leaves the form as the "previous page".

## Announcements with Chairman approval; consultations belong to the Punong Barangay (2026-11-12)
- New Announcements module. The Secretary writes (title, category, one-sentence summary, full text; date, time and place for activities; effective dates and hours for office schedules; what to bring; contact; audience; important flag; publish now or on a set date; end of display). Actions: Save Draft, Preview (exactly what residents will see) and Submit for Approval.
- The Punong Barangay reviews in the same place: Approve (with confirmation), Request revision (with a note the Secretary sees) or Reject (with a reason). Self-approval is blocked. Approval publishes now or at the chosen time. Residents are notified once, and important ones also get an email record (no email service is connected, so none is sent).
- Editing an approved or published announcement creates a proposed change. Residents keep seeing the current version until the Chairman approves the change. Cancelling a published one tells residents. Expired ones archive themselves.
- Tabs: All, Drafts, Pending approval, Approved, Published, Archived. The Chairman starts on Pending approval.
- Residents: a simple list (title, category · date, an "Important" marker, an unread dot) and a detail page with the Barangay 181 seal and name, the category, title, date, the text, then When, Where, What to bring and Questions, shown only when filled. The faint seal sits only in the heading, never behind text or buttons. The home page shows the three newest.
- Permissions: announcements.manage (Secretary) and announcements.approve (Chairman). The System Administrator cannot approve. Tested: drafts are hidden from residents; residents and the Secretary cannot approve.
- The three earlier sample announcements are kept as published samples.
- Complaint consultations are now always held by, and on the calendar of, the Punong Barangay. The Secretary can book one for the Chairman (the Chairman is notified) but cannot record its outcome. A consultation can only be set up after the case has been forwarded to the Chairman.
- docs/supabase/announcements.sql: tables, no-self-approval check, a published-only view for residents, RLS. Not applied.

## Treasurer removed; "Barangay Personnel" wording (2026-11-12)
- The Treasurer role is removed completely: role list, permissions, sign-in account type, development test levels, the Treasurer dashboard, the officials list (landing page and council panel), the sample account, sample notifications, and the database role type (docs/supabase/security.sql). Fee-bearing documents (Business Clearance) still need an official receipt; recording it is now a Secretary permission (documents.payment). Fee text now says "paid at the Barangay Hall". Older saved role settings cannot switch this permission off.
- "Authorized Personnel" no longer exists as a role (removed earlier). The phrase's last uses in code comments were reworded.
- Audit: a scan of src/, index.html and public/ finds no "Treasurer", "Authorized Personnel" or "Authorized Supporting Personnel". These words remain only in historical documents (earlier patch notes, the redesign report, the system audit, and the requirements inventory quoting the original briefs).
- Every visible "staff" in labels, headings, messages and history notes now reads "Barangay Personnel" (Calendar filters, the scheduling settings sections, reassignment and confirmation messages, "Barangay Personnel only" history notes, concern and appointment notes). Internal code values that are never shown keep their names.

## Official Barangay Calendar: holidays, closures, events, resident calendar (2026-11-12)
- Holidays follow Proclamation No. 1006, s. 2025 (checked against the Palace list): 10 regular holidays and 8 special non-working days, including the previously missing Chinese New Year (17 Feb) and All Souls' Day (2 Nov). 25 February is a special working day, so the hall stays open. Each holiday records its classification, source, whether the hall is closed, and optional special office hours. Eid'l Fitr, Eid'l Adha and Manila local holidays are not guessed; the System Administrator adds them with their proclamation as the source (required).
- One source of truth: working days, appointment slots and document processing deadlines all read the calendar. The old holiday list in System Settings was replaced by a link.
- Office closures (Secretary, new permission "calendar.manage"): whole days, part of a day, or only some services, with a reason. On saving, booked appointments in that time return to "choose a new time" (never cancelled) and residents and the assigned Barangay Personnel are told; equipment return dates on closed days move to the next open day; document deadlines skip the day; the Punong Barangay is notified. It can also prepare an announcement draft for the Chairman's approval. Closures can be cancelled with a reason.
- Barangay Calendar page: office closures, the year's holidays (the System Administrator can change hall open/closed, set special hours, and add holidays with a source), and upcoming events (from approved announcements).
- The personnel Calendar now shows holidays, closures and events alongside appointments.
- Residents: "My Calendar" with Upcoming (date blocks; "My appointment" vs "Barangay"; holidays open their details inline) and Month (filled dots for mine, outlined dots for barangay items; tap a day). Other residents' appointments are never included.
- Resident home is simpler: next appointment (or "choose a time"), the next three barangay calendar items, three service buttons, and announcements. The counts and recent-activity list were removed from the home (still under My Transactions).
- Reminders for public items: closures 7 days and 1 day before; events by category (health 3 days and the day, community activities 3 days and 1 day, and so on). Each is sent once. Ordinary holidays that change nothing send nothing.
- All automatic jobs (appointment reminders and no-shows, overdue equipment, scheduled announcements, calendar notices) now run on app load and every 5 minutes, not only on specific pages.
- The browser's built-in prompt and confirm pop-ups were replaced with in-app fields and dialogs (closure cancel, holiday removal, registration rejection).
- docs/supabase/calendar.sql: tables, checks, RLS, and an is_working_day function used by bookings and deadlines. Not applied.

## Equal-size action buttons (2026-11-12)
- New shared ActionStack layout for groups of action buttons. Buttons are stacked with 8 px between them, all the same height (48 px), and all as wide as the longest label (at least 240 px on larger screens; full width on phones). Text is centred, so widths no longer depend on text length. Colours, actions and order are unchanged.
- Applied to the 44 groups of two or more buttons across BMIS: the registration review (Request in-person visit / Approve / Reject), corrections, document approvals and requests, appointments (resident and Barangay Personnel), announcements, the calendar, cases and hearings, concerns, borrowing and inventory, resident request, report and concern forms, reports, and user administration.
- Checked: Request in-person visit, Approve and Reject measure 240×48 each on desktop and 347×48 each at a narrow width, left-aligned in one column.
