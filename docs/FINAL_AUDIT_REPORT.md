# BMIS / Barangay 181: Final audit report

Prepared 12 November 2026, after the last round of changes (resident home, button standard, User Accounts table, purpose-based appointments with linked document pickup, processing-time rules, demo data). Repository: MaeVisionary/brgy-181. Live prototype: https://maevisionary.github.io/brgy-181/.

## 1. Where the system stands

BMIS is a **working front-end prototype**. Every screen runs on mock services that keep data in the browser (in memory and on the device), standing in for the database. All requirements were checked against the code (full table: `docs/REQUIREMENTS_STATUS.md`).

| Status | Rows | Share |
|---|---|---|
| Done (works in the prototype) | 710 | 58% |
| Partial | 286 | 23% |
| Frontend only (needs a real server to be complete) | 97 | 8% |
| Superseded by a later requirement | 55 | 4% |
| Not built | 45 | 4% |
| Waiting for a barangay decision | 35 | 3% |
| **Total** | **1,228** | |

"Done" means the behaviour exists in the screens and mock services. **None of it is enforced by a server yet**: permissions, two-person approval, rate limits and audit logs all run in the browser and can be bypassed by anyone with developer tools. That is expected for this phase and is the main reason the system is not ready for real resident data (section 5).

By area:

| Area | Done | Partial | Frontend only | Not built | Needs policy | Superseded |
|---|---|---|---|---|---|---|
| Resident portal | 25 | 4 | 0 | 0 | 1 | 2 |
| Registration | 42 | 14 | 4 | 0 | 2 | 2 |
| Corrections | 30 | 12 | 3 | 6 | 2 | 3 |
| Documents | 53 | 12 | 2 | 1 | 4 | 6 |
| Complaints, cases, mediation | 27 | 7 | 1 | 0 | 3 | 3 |
| Community concerns | 25 | 3 | 3 | 2 | 0 | 0 |
| Equipment | 44 | 7 | 0 | 1 | 1 | 6 |
| Appointments and scheduling | 31 | 8 | 2 | 2 | 2 | 1 |
| Calendar and closures | 8 | 3 | 0 | 0 | 1 | 0 |
| Announcements | 26 | 3 | 3 | 0 | 1 | 0 |
| Notifications | 32 | 19 | 5 | 2 | 2 | 4 |
| Security, permissions, two-person, step-up | 57 | 24 | 38 | 10 | 8 | 4 |
| Uploads, storage, Supabase | 26 | 11 | 22 | 4 | 2 | 0 |
| Analytics and reports | 76 | 10 | 0 | 2 | 1 | 4 |
| UI, mobile, accessibility | 121 | 50 | 0 | 2 | 1 | 12 |
| Landing page | 18 | 2 | 0 | 1 | 1 | 3 |
| Other (process, QA, roadmap) | 59 | 93 | 14 | 12 | 3 | 5 |
| Standing constraints | 10 | 4 | 0 | 0 | 0 | 0 |

## 2. Most important gaps

Security and data
1. **Test-account login is in the public site's code.** The deploy workflow passes the test accounts' e-mail and password hash (`VITE_TEST_ACCOUNT_*`) into the built JavaScript, so anyone can read them and try to guess the password offline. Use a long random password for the test accounts, change it after every demo, and remove the test login from the public build before any real use.
2. **No server-side enforcement** of roles, two-person approval, lockout or audit (see section 5). Database rules are written (`docs/supabase/*.sql`) but not applied.
3. **Notifications live only in the open browser tab** (lost on reload; the activity log is now kept on the device, shared by its tabs, but not on a server; R0460, R0477, R0624, R0626). The audit log does not store old/new values or a request id.
4. **Registration still auto-approves** when every automatic check passes (`registrationService`, status `auto_approved`), although a later rule says only Barangay Personnel decide (R0054, R0041).
5. **Account lockout is permanent** until an administrator resets the password (R0584 asks for a temporary lock); "Forgot password" only sends a request to the administrator (R0582).
6. **Browser OCR and face matching were built** (tesseract.js, face-api) although an early constraint said not to process IDs or faces until authorized (C01, R1029). Confirm this was authorized; otherwise switch it off.

Workflows
7. No "request more information" or "escalate to the Chairman" for registrations and corrections; the correction queue has two tabs, not the five categories asked for (R0077, R0114, R0145 to R0149).
8. Complaints cannot carry attachments or evidence (R0231, R0263); online complaints get a blotter number before they are formal blotter entries (R0250).
9. No duplicate-request check for documents, and no once-only check for First Time Job Seeker (RA 11261) (R0216, R0201).
10. Every certificate uses the same approval workflow; reviewer, approver and releaser are not configurable per document (R0159, R0161).
11. No walk-in queue (queue numbers, call next, waiting time) (R0368 to R0370).
12. No automated tests of any kind (unit, end-to-end, security); `package.json` has only build and lint (R1159, R1170, R1183). Every check so far was done by hand in the preview browser.

Not built yet (product)
- Kagawad programs, tasks and accomplishment reports; personnel task management (R1122).
- Release 3 modules: emergency, surveys, project monitoring, satisfaction feedback (R1125 to R1129).
- Community concerns map (R0304); concern, incident and service-performance reports and trend analytics (R0769, R0770, R0784).
- Help center / FAQ and the public transparency portal (R1022, R1023).
- Real e-mail, SMS and one-time codes (OTP/MFA); contact-number changes are applied without a code (R0126, R0127, R0591, R0595, R0599).
- Residents cannot change their e-mail, and there is no recovery path when the old phone is lost (R0128, R0129).
- Resident records lack deceased handling, archiving, retention, secure disposal and address history (R0003).

The complete lists are in Appendix B (not built) and Appendix C (needs a decision).

## 3. Contradictions found

These pairs of requirements disagree. The later one was followed unless noted; please confirm.

| Topic | Conflict | What the system does now |
|---|---|---|
| Status lists | Several briefs give different status lists for resident requests (R0021 vs R0022), registration (R0083 vs R0084), documents (R0186) and complaints (R0255, R0324) | One set of plain statuses per module (Submitted, Processing, Action needed, Ready, Completed, Unsuccessful); the other lists are not adopted |
| Registration approval | Early briefs allow automatic approval on matching records; later ones say a person must decide (R0041, R0054) | Still auto-approves on a full match. Needs a decision |
| Treasurer role | Fee and payment requirements name a Treasurer (R0529, R0548, R0549); a later change removed the Treasurer | No Treasurer; fees are recorded by the Secretary and Chairman (`documents.payment`) |
| Simplified lists vs scheduling detail | The simplification brief says lists show only the essentials (R0974, R0975); the scheduling brief asks for "Ready by" and "Pickup" on the Secretary's queue | The queue shows both columns (the more recent brief) |
| Toggle switches | On/off settings should use the Toggle component (R0849) | Only the admin pages use it; scheduling, borrowing and announcement settings still use checkboxes |
| ID and face processing | No real OCR or face processing until authorized (C01) vs later registration briefs asking for them | Built in the browser (see gap 6) |
| Notification reminders | Older rule: reminders 1 day, same day, 1 hour; latest: 24 hours and 2 hours (R0512) | Default is still 1 day / same day / 1 hour (administrators can change it) |
| Mobile menu | A hamburger menu in the phone header (R0955) vs the bottom bar with "More" | Bottom bar with "More" |

## 4. Decisions the barangay needs to make

Waiting for the barangay (confirm or replace the values the system uses now):

| # | Decision | Value used now |
|---|---|---|
| 1 | Equipment borrowing period and grace period | 15 days + 3 days (from the system study; marked "not yet confirmed") |
| 2 | How fees are recorded and receipted; who may record payments | Secretary and Chairman record the OR number and amount |
| 3 | Holidays with movable dates (Eid'l Fitr, Eid'l Adha) and Manila local holidays | Only the nationally proclaimed dates are in the calendar; the administrator adds the rest each year |
| 4 | Whether office closures need the Punong Barangay's approval | The Secretary sets closures directly |
| 5 | Preparation time per document (12 to 124 office hours) and how many requests the office can prepare per day | Initial estimates, marked as such: Residency and Indigency 12 h, certificates 16 h, Cohabitation and Clearance 24 h, Business Clearance 48 h; 20 requests per day |
| 6 | Citizen's Charter processing days per document | RA 11032 maximum (3 working days for simple transactions) until the Charter values are entered |
| 7 | Visit purposes residents may book, and who handles each | Barangay consultation, mediation or dispute and complaint follow-up with the Punong Barangay; community concern with the Secretary |
| 8 | Registration: automatic approval allowed or not | Allowed on a full match (see section 3) |
| 9 | Treasurer role | Not used |
| 10 | Per-document approval chain (reviewer, approver, releaser) | Same chain for every certificate |
| 11 | Barangay Business Clearance requirements and process | Request form only; process marked pending |
| 12 | Authorization rules for corrections on behalf of others (SPA or other proof) | Authorization letter or guardianship proof, checked by personnel |
| 13 | Retention and disposal periods for records and uploads | None set |
| 14 | Contact details shown on the site | Placeholder e-mail (barangay181@example.com) until the official address is given |

## 5. Deployment readiness

**Ready now:** demonstrations, user testing with the demo data, and design review, on phones and desktops.

**Not ready for real resident data.** Before going live:

| Area | Needed | State |
|---|---|---|
| Database and API | Supabase project with the tables and row-level security in `docs/supabase/` | Designed, not applied |
| Authentication | Server sign-in, password reset by e-mail, temporary lockout, sessions | Browser simulation only |
| Permissions | Role checks and two-person approval enforced by the database | Browser only |
| Audit log | Stored on the server, tamper-protected, with old/new values | Kept on the device (newest 2,000 entries), not tamper-protected |
| Notifications | Stored per user; real e-mail and SMS | In-memory; e-mail simulated |
| File storage | Private bucket, signed links, virus scan, retention | Browser storage |
| Backups | Scheduled database backups and an offline copy | Not set up |
| Test accounts | Removed from the public build or protected | Hash in public code (gap 1) |
| Testing | Automated tests for the main flows and permissions | None |
| Data privacy | Privacy notice reviewed; NPC registration if required; real masterlist kept out of the repository | Notice in place; masterlist PII never committed |
| Content | Official contact details, Charter times, fees, holidays | Placeholders noted in section 4 |

## 6. Demo data

The prototype now opens with connected demo records so no screen is empty for any role. They are created through the same steps the system uses, so each record appears for the sender and the receiver, with notifications and activity-log entries:

- Resident Maria Clara Dizon: a noise complaint (reviewed by the Secretary, mediation set by the Punong Barangay, Kagawad Angelito Dela Cruz assigned), a street-light concern, a verified Postal ID on file, document requests in different stages, and the Secretary's verification visit waiting for her confirmation.
- Demo resident accounts Daniel Garcia and Lourdes Santos: a drainage concern (assigned to a Kagawad, with a note), a resolved stray-dog concern, a community-concern visit with the Secretary, a consultation confirmed by the Punong Barangay, and a chairs-and-tables borrowing approved by the Property Custodian with a booked pickup.
- Today's schedule for the Secretary, the Punong Barangay and the Property Custodian (visits earlier today show as completed with notes).
- An afternoon office closure for a Barangay Assembly (on every calendar, residents notified).
- Two access-change requests (one waiting for the Punong Barangay, one rejected), two blocked sign-in attempts and other activity-log entries.

All people are fictional sample residents; records that could be mistaken for real ones say "(demo)". No real e-mail or SMS is sent. Demo records are recreated each time the app starts (dates follow today), and **System Settings > Demo data > Reset demo data** clears everything saved on the device and starts again. Settings, holidays and passwords are kept.

## 7. Role and permission matrix

From `src/config/permissions.ts` (the System Administrator's two-person and extra-permission rules are in `docs/PERMISSION_MATRIX.md`). Extra permissions can be granted to an individual official through the two-person approval flow.

| Permission | Admin | Chairman | Secretary | Kagawad | Custodian | Resident |
|---|---|---|---|---|---|---|
| View population analytics and ayuda planning (`analytics.view`) |  | Yes | Yes | Yes |  |  |
| Approve or reject announcements (`announcements.approve`) |  | Yes |  |  |  |  |
| Write and submit announcements (`announcements.manage`) |  |  | Yes |  |  |  |
| View activity logs (`audit_logs.view`) | Yes |  |  |  |  |  |
| Approve or reject borrowing requests (`borrowing.approve`) |  |  |  |  | Yes |  |
| Record equipment release and return (`borrowing.release`) |  |  |  |  | Yes |  |
| Manage office closures and special schedules (`calendar.manage`) |  |  | Yes |  |  |  |
| Work on complaints assigned to them (view and add notes) (`cases.assigned`) |  |  |  | Yes |  |  |
| Assess complaints, record settlement or Lupon referral (`cases.decide`) |  | Yes |  |  |  |  |
| Create and manage cases and blotter records (`cases.manage`) |  |  | Yes |  |  |  |
| View case summaries (`cases.view`) |  | Yes | Yes |  |  |  |
| Encode complaints and incident reports (`complaints.create`) |  |  | Yes |  |  |  |
| Update complaint status (`complaints.update`) |  |  | Yes |  |  |  |
| View complaints and incident reports (`complaints.view`) |  | Yes | Yes |  |  |  |
| Manage community concerns (group, assign, resolve) (`concerns.manage`) |  | Yes | Yes |  |  |  |
| View community concerns (`concerns.view`) |  |  |  | Yes |  |  |
| Approve documents (official) (`documents.approve`) |  | Yes |  |  |  |  |
| Encode requests for residents (assisted service) (`documents.create`) |  |  | Yes |  |  |  |
| Record verification and ocular inspection findings (`documents.inspect`) |  |  | Yes |  |  |  |
| Record fees paid (official receipt) (`documents.payment`) |  |  | Yes |  |  |  |
| Verify and process document requests (`documents.process`) |  |  | Yes |  |  |  |
| Reject documents (official) (`documents.reject`) |  | Yes |  |  |  |  |
| Record document release (`documents.release`) |  |  | Yes |  |  |  |
| View document requests (`documents.view`) |  | Yes | Yes |  |  |  |
| Schedule hearings and record attendance (`hearings.manage`) |  |  | Yes |  |  |  |
| View hearing schedules (`hearings.view`) |  | Yes | Yes |  |  |  |
| Add and update equipment (`inventory.manage`) |  |  |  |  | Yes |  |
| View equipment inventory (`inventory.view`) |  |  |  |  | Yes |  |
| Export reports (PDF, Excel) (`reports.export`) |  |  | Yes |  |  |  |
| View reports (`reports.view`) |  | Yes | Yes | Yes |  |  |
| Approve registrations and change requests (`residents.approve`) |  |  | Yes |  |  |  |
| Create resident records (`residents.create`) |  |  | Yes |  |  |  |
| Import resident CSV (`residents.import`) |  |  | Yes |  |  |  |
| Look up borrower name and address only (`residents.lookup_borrower`) |  |  |  |  | Yes |  |
| Reject registrations and change requests (`residents.reject`) |  |  | Yes |  |  |  |
| Search the resident master list (`residents.search`) |  |  | Yes |  |  |  |
| Update official resident records (`residents.update`) |  |  | Yes |  |  |  |
| Review registrations (manual verification) (`residents.verify`) |  |  | Yes |  |  |  |
| View resident records (`residents.view`) |  |  | Yes |  |  |  |
| Manage roles and permissions (`roles.manage`) | Yes |  |  |  |  |  |
| Approve access changes as the second person (`security.approve`) | Yes | Yes |  |  |  |  |
| Request and track own borrowing (`self.borrowing`) |  |  |  |  |  | Yes |
| Request corrections to own information (`self.change_requests`) |  |  |  |  |  | Yes |
| Submit and track own complaints (`self.complaints`) |  |  |  |  |  | Yes |
| Request and track own documents (`self.documents`) |  |  |  |  |  | Yes |
| View own profile (`self.profile`) |  |  |  |  |  | Yes |
| View system health and backups (`system.health`) | Yes |  |  |  |  |  |
| Manage system settings (`system.settings`) | Yes |  |  |  |  |  |
| Manage user accounts (`users.manage`) | Yes |  |  |  |  |  |

## Appendix A. Full requirement status

See `docs/REQUIREMENTS_STATUS.md` (all 1,228 rows with evidence and gaps).

## Appendix B. Not built (45)

- R0128 (Corrections): If old number is inaccessible, route to a secure recovery process instead of auto-approving — No recovery process
- R0129 (Corrections): Email change: format check, uniqueness, verification to new email, recheck uniqueness before save,… — Email change not a correctable field
- R0145 (Corrections): Route 2 Records Clerk Verification: clerk views existing vs requested info, inspects docs, verifies,… — No Records Clerk role
- R0147 (Corrections): Route 4 Chairman Escalation only for items needing Chairman authorization under configured policy; never… — No Chairman escalation route
- R0149 (Corrections): Secretary dashboard categories: Needs Your Decision, Needs Verification, Requires Additional Information,… — Only To review / Recently decided tabs
- R0152 (Corrections): Test 10 correction scenarios: phone, employment, civil status, birthdate, duplicate, expired ID, household… — No automated test suite in repo
- R0199 (Documents): System checks eligibility and whether auto-processing permitted; Secretary receives only cases requiring… — No auto-processing; Secretary handles every request
- R0303 (Concerns): QA tests: 5 similarly worded same-location reports group; different streets not merged; different problems… — No automated test suite in repo
- R0304 (Concerns): Community map of concerns, flood-prone areas, public and emergency facilities, infrastructure, filterable by… — Community map (Release 3)
- R0363 (Equipment): Test 20 equipment scenarios: available, unavailable, over-quantity, concurrent, post-return availability,… — No automated test suite in repo
- R0370 (Appointments/scheduling): Display current queue, estimated wait (labelled approximate, from historical/current data, never… — No live queue or estimated wait display
- R0409 (Appointments/scheduling): Test unavailable staff, overlapping appointments, multiple documents, rescheduling, cancelled appointments — No automated tests in repo
- R0496 (Notifications): Notify both old and new contact number (and old/new email) on change when appropriate — No notice to old and new contact number/email
- R0500 (Notifications): Also email the affected user about permission changes if a verified email is registered. — No email on permission change
- R0548 (Security/permissions/2-person/step-up): Treasurer manages financial records, collections/payments and official receipts, authorized expenses,… — Treasurer role removed (PATCH_NOTES); confirm decision
- R0549 (Security/permissions/2-person/step-up): Treasurer cannot edit resident masterlists, approve registrations, approve/issue certificates or clearances,… — Same as R0548
- R0562 (Security/permissions/2-person/step-up): Migrate existing account permissions safely and require revalidation of existing privileged accounts — No revalidation of existing privileged accounts
- R0581 (Security/permissions/2-person/step-up): Test every role independently with direct API requests, modified client requests, direct URLs/route… — No role/API tests
- R0599 (Security/permissions/2-person/step-up): Prefer phishing-resistant MFA (passkeys/security keys or authenticator) for System Admins/privileged… — No passkeys/authenticator MFA
- R0602 (Security/permissions/2-person/step-up): Make the list of two-person-approval operations configurable via a protected security policy; no ordinary… — List not configurable
- R0610 (Security/permissions/2-person/step-up): High-impact automation rule changes require two-person approval, OTP/strong auth, notification to affected… — Rule changes saved without second approver
- R0614 (Security/permissions/2-person/step-up): Emergency/break-glass privileged access requires documented justification, limited records, expiration,…
- R0615 (Security/permissions/2-person/step-up): Provide secure admin recovery procedures that cannot bypass verification
- R0616 (Security/permissions/2-person/step-up): Provide an "I don't recognize this change" option leading to a secure account-security reporting process.
- R0667 (Uploads/storage/Supabase): Any additional format genuinely required by an official workflow must be justified and configured separately… — No per-workflow format config
- R0721 (Uploads/storage/Supabase): Backup strategy, recovery procedures, DB error monitoring, integrity checks and recovery testing; never… — No backups (needs backend)
- R0722 (Uploads/storage/Supabase): Test every upload flow: registration, initial ID, profile/ID updates, document requests, business clearance,… — No upload tests recorded
- R0723 (Uploads/storage/Supabase): Test scenarios: valid PDF/JPG/PNG, oversize, unsupported format, renamed executable, corrupted PDF,… — No upload test scenarios
- R0769 (Analytics/reports): Concern analytics: most reported, top locations, increasing concerns, avg time to action, avg resolution… — No concern analytics
- R0770 (Analytics/reports): Trend analytics (frequent concerns, service demand, population change, recurring infrastructure, repeat… — No trend analytics
- R0893 (UI/mobile/accessibility/font/watermark): Place watermark only in welcome sections of Resident, Secretary, Chairman, Treasurer, System Admin… — No watermark in any dashboard welcome section
- R1001 (UI/mobile/accessibility/font/watermark): Secretary metric icon colors: neutral navy for pending registrations, pending documents, forwarded to… — Secretary stat cards have no icons
- R1023 (Landing page): Help Center with FAQs, service requirements, processing times, office schedules, contacts, first-time user… — No Help Center or FAQ
- R1085 (Other): Cross-reference matrix per module: Feature, Resident side, Personnel side, Permission, Backend,… — No cross-reference matrix
- R1122 (Other): Personnel task management: create, assign, prioritize, deadline, instructions, progress, complete; show… — No personnel task management
- R1125 (Other): Emergency management: flood reports, fire incidents, emergency concerns, evacuation centers, emergency… — Release 3
- R1126 (Other): Personnel can record emergency incidents, assign responders, monitor progress, record actions, track… — Release 3
- R1127 (Other): Community needs surveys analyzing needs, satisfaction, zone concerns, program demand; avoid unnecessary… — Release 3
- R1128 (Other): Project monitoring: name, location, responsible personnel, timeline, budget (authorized), progress, docs,… — Release 3
- R1129 (Other): Citizen satisfaction feedback on completed services (satisfaction, processing, responsiveness, difficulties)… — Release 3
- R1147 (Other): Automation rules module: rule name, request type, conditions, validation steps, action, responsible role,… — No automation rules module
- R1159 (Other): Automated security tests (Playwright + API) covering the 20-scenario table: pending approval, self-approval… — No Playwright/API tests
- R1160 (Other): Perform horizontal/vertical escalation, session fixation, CSRF, IDOR, API authorization, RLS, rate-limit,… — No security tests
- R1170 (Other): Test matrix: Authentication, Account Setup, Role Mgmt, Dashboard, Residents, Households, Document Requests,… — No test matrix or test runner
- R1183 (Other): Add/improve automated tests: unit, integration, API authorization, DB policies, role permissions, form… — No unit/integration tests

## Appendix C. Waiting for a barangay decision (35)

- R0022 (Resident portal): Resident-facing statuses: Submitted, Verifying information, Action needed, For in-person verification,… — Conflicts with R0021; nine labels not implemented
- R0083 (Registration): Registration workflow: Pending Verification, Verified, Needs Correction, Approved / Rejected — Conflicting registration status lists
- R0084 (Registration): Registration statuses: Submitted -> Verification -> Needs Additional Information -> Approved / Rejected — Conflicting registration status lists
- R0108 (Corrections): Do not require an SPA in every case; apply authorization per legal relationship and NPC guidance — SPA is one option, not required
- R0148 (Corrections): Make approval requirements configurable per barangay's actual policies; do not invent approval authority — Policy hardcoded; not configurable
- R0161 (Documents): Configurable per-document approval workflows defining reviewer, verifier, approver, payment processor,… — Not configurable per document
- R0169 (Documents): Build a Citizen's Charter service catalog with official requirements, responsible personnel, fees,… — No Citizen's Charter catalog
- R0186 (Documents): Document statuses: Submitted -> Under Review -> Needs Additional Information -> Approved -> Ready for… — "Ready for Claiming" not adopted
- R0212 (Documents): Barangay Business Clearance: request interface only; workflow, process and requirements marked pending…
- R0243 (Complaints/cases/mediation): Lupon mediation duration is configurable or left for confirmation; do not invent it
- R0255 (Complaints/cases/mediation): Complaint statuses: Submitted -> Received -> Under Assessment -> Assigned -> In Progress -> Resolved -> Closed — Not adopted
- R0256 (Complaints/cases/mediation): Mediation statuses: Pending Scheduling -> Scheduled -> Completed -> Agreement Recorded / Unresolved
- R0324 (Equipment): Equipment statuses: Submitted -> Under Review -> Approved -> Ready for Release -> Borrowed -> Returned ->… — Implemented lifecycle close to this list
- R0371 (Appointments/scheduling): Do not require appointments for services officially handled by walk-in — Which services are walk-in only
- R0400 (Appointments/scheduling): Appointment statuses: Requested -> Confirmed -> Rescheduled / Cancelled -> Completed / Missed — Conflicts with R0399; barangay to pick status list
- R0416 (Calendar/closures): Define which calendar events need Chairman approval by event type; routine schedule maintenance should not… — Which event types need Chairman approval
- R0444 (Announcements): Emergency announcements may have a separate authorized publishing procedure — Emergency publishing procedure
- R0488 (Notifications): Each registration notification must include the relevant reference number. — Conflicts with R0483 on reference numbers
- R0518 (Notifications): Hearing reminders with configurable intervals (do not assume an interval) — Interval fixed at 1 day until confirmed
- R0534 (Security/permissions/2-person/step-up): Validate role responsibilities against Philippine law and local procedures; do not fabricate official… — Legal validation of role duties
- R0535 (Security/permissions/2-person/step-up): Document any permissions that require formal barangay authorization
- R0543 (Security/permissions/2-person/step-up): Kagawad permissions are configurable by committee/assigned responsibility per barangay-confirmed duties; no… — Committee duties to be confirmed
- R0560 (Security/permissions/2-person/step-up): Chairman or authorized administrator can assign personnel and manage permissions — Conflicts with admin-only role management
- R0635 (Security/permissions/2-person/step-up): Data Privacy Act (RA 10173): privacy notice and consent at registration (record acceptance and version),… — Retention, DPO, NPC items need barangay
- R0645 (Security/permissions/2-person/step-up): Chairman can view registration decisions, review escalated/disputed applications, and has extra approval…
- R0654 (Security/permissions/2-person/step-up): RA 10173 review before automated decisions: document purpose, data minimization, resident notice, retention,…
- R0655 (Security/permissions/2-person/step-up): Do not implement automated decisions with legal effects solely through automation without meeting legal…
- R0671 (Uploads/storage/Supabase): Recommended starting limits: individual image max 5 MB, individual PDF max 5 MB, total per submission max 10… — Conflicting limits (R0670 vs R0671 vs R0672)
- R0700 (Uploads/storage/Supabase): Preserve documents attached to active or legally required records; never auto-delete official records… — Approved retention policy
- R0741 (Analytics/reports): Clearly identify prototype sample statistics as demonstration data — Conflicts with removal of demo/prototype labels
- R0899 (UI/mobile/accessibility/font/watermark): Do not assume seal watermark usage is legally permitted; review PH rules and flag for barangay confirmation;… — Flagged "to be confirmed by the barangay"
- R1022 (Landing page): Public transparency portal without login: announcements, programs, events, office schedules, project… — Nothing built; public-disclosure scope needs barangay decision
- R1063 (Other): Do not promise exact processing times unless supported by actual barangay procedures — Estimates labelled until barangay sets times
- R1088 (Other): Investigate whether the barangay should adopt, complement, or integrate with the official DILG system rather… — LGUSS-BIMS question raised
- R1144 (Other): Automation decision classes: Automatically approved (low-risk, explicit rules, verified, policy permits);… — Auto-approval needs barangay rules
