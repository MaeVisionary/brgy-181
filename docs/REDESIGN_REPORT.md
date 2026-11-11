# BMIS Redesign and Workflow Improvements: Report (12 November 2026)

Scope: the brief "Comprehensive UI/UX Redesign, Workflow Improvements, and Functional
Enhancement" and the Barangay Chairman's 10 November 2026 follow-up interview.
The system is still **frontend only**. Every rule below runs in the browser
(mock service layer) and must be enforced again by the backend (see section 8).

## 1. Audit summary (before this round)

| Area | Found |
|---|---|
| Stack | React 19 + TypeScript, Vite 8, Tailwind v4, react-router 6; GitHub Pages; mock services in `src/services`, sample data in `src/mocks`, browser storage for prototype persistence |
| Roles | System Administrator, Chairman, Secretary, Kagawad, Property Custodian, Authorized Personnel, Resident. **No Treasurer role** |
| Route protection | `RequirePermission` on every staff route; permissions per role plus per-account grants |
| Documents | 13 document types with document-specific fields; workflow engine with history; Secretary verifies, Chairman approves. Missing: return for revision by the Chairman, "For Signature"/"Completed" steps, verification records (ocular inspection etc.), configurable requirements |
| Chairman | Approvals only by opening each request |
| Registration | ID OCR, face match, liveness, records match; pending/rejected accounts cannot sign in. Missing: resubmission after rejection |
| Complaints | KP case stages, hearings, attendance, 15-day period. Missing: blotter register and numbering, creating a case from a complaint, hearing availability, delivery vs. acknowledgment of summons, settlement / certificate to file action |
| Equipment | Inventory, borrowing, release, return with condition, overdue rules. Missing: location, maintenance, status per item, reports |
| Reports | Senior citizen analytics and official template slots. Missing: document, complaint, equipment, personnel reports |
| Homepage | Missing: Resident Login button, action buttons on service cards, contact details |

## 2. Redesigned pages and portals

- Homepage: Resident Login and Create Account in the hero; service cards with action buttons; full contact details.
- Chairman: new **Approvals** page (decide on each request on one page); dashboard cards: Pending Approvals, Approved Documents, Documents for Signature, Completed Requests.
- Secretary dashboard cards: Pending Registrations, Pending Document Requests, Under Verification, Forwarded to Chairman, Completed Requests.
- **Treasurer** portal (new): dashboard, fees to record, recent payments.
- Resident Home: Total / Pending / Approved / Completed counts.
- Request detail: verification panel, fee panel, approval record, "Record in blotter".
- Cases: search (case no., blotter no., names), blotter numbers, **New blotter entry** page, hearing availability, case documents with delivery and acknowledgment, outcome records.
- Hearings: **month calendar**.
- Equipment records: status chips, location, under-maintenance count.
- Reports: **Service reports** with date range and PDF/Excel export.
- Admin: assign a personnel position (Authorized Personnel, Property Custodian, Treasurer).
- All portals (previous round): light-blue title bars with dark text, larger text, 44px buttons.

## 3. New features

1. Document workflow (standard documents): Pending Review → Under Verification → Approved by Secretary → Forwarded to Chairman → Ready for Printing → For Signature → Ready for Pickup → Completed; plus Needs Revision, Rejected, Cancelled. Chairman: Approve / Return for revision / Reject with remarks. Secretary: Approve, Return for revision, Reject.
2. Approver recorded (account and date) and shown on the request.
3. Verification records before the Secretary can approve: **ocular inspection** (Business Clearance), residency verification (Non-Residency), cohabitation, civil status (Singleness) and indigency verification. Records result, findings, date and who checked.
4. Business Clearance fee recorded by the Treasurer (O.R. no., amount).
5. Requirements per document editable by the Secretary or Administrator (Document Templates page). No legal requirement is assumed by the system.
6. Registration resubmission after rejection; login shows "Status: Pending Approval" or "Status: Rejected" with the reason and a Register again link.
7. Blotter: entry numbers (BE-YYYY-NNNN), walk-in entries, recording an online complaint/report in the blotter (duplicates blocked), search.
8. Hearing availability (complainant, respondent, Chairman) with a warning when someone cannot attend.
9. Summons (respondent) and Notice of Hearing (complainant) prepared from the case and hearing; then approval → delivery → acknowledgment, each recorded separately.
10. Outcome records: Record of Mediation Proceedings, Amicable Settlement, Certificate to File Action (working layout until the official KP forms are supplied).
11. Equipment status per item: Available, Pending Request, Reserved, Borrowed, Overdue, Under Maintenance; location field.
12. Service reports: document requests, complaints and mediation outcomes, equipment borrowing, equipment availability, personnel processing activity, fees collected. Counted from stored records only.

## 4. Existing features kept

Self-registration with ID/face checks, resident records and import, households, record update requests with proof, all 13 document types and templates, printing, assisted (walk-in) requests, KP stages and 15-day period, reminders, internal notes, borrowing rules (15 days + 3-day grace), senior citizen analytics and reports, official report template slots, notifications, activity log, password resets, per-account permissions.

## 5. Data model changes (frontend types; tables for the backend)

- `RoleId` + `treasurer`; permissions `documents.inspect`, `documents.payment`.
- `DocumentStatus` + `for_signature`; `DocumentRequest` + `verification`, `payment`, `approvedBy/approvedAt`, `delivery`, `acknowledgment`, `hearingId`.
- `DocumentTypeDef` + `verification`, `fee`; requirement overrides (backend: `document_requirements` table).
- `KPCase` + `blotterNo`, `incidentDate`, `incidentPlace`, `sourceRequestId`; `Hearing` + `availability`.
- `Equipment` + `location`, `maintenanceQty`.

## 6. Security and permissions

- Each new action checks permissions inside the service, not only in the screen: inspection (`documents.inspect`), payment (`documents.payment`, Treasurer only), blotter entries and summons (`cases.manage`), delivery/acknowledgment (`documents.release` or `cases.manage`), requirements (`documents.process` or `system.settings`), role changes (System Administrator, personnel positions only).
- Chairman-only approval: the Secretary has no `documents.approve`; the Approvals route is guarded.
- Acknowledgment cannot be recorded before delivery; Secretary approval is blocked until the verification is confirmed.
- Every step is written to the request or case history; requirement and role changes go to the activity log.
- **Not real security yet**: the browser can be changed by its user. The backend must re-check every rule (section 8).

## 7. Test results (12 November 2026, local build, all passed)

| Scenario | Result |
|---|---|
| 1 Registration | Pending and rejected accounts cannot sign in; reason shown; same email can register again; approved account signs in |
| 2 Certificate of Indigency | Approval blocked until verification recorded; Secretary approves and forwards; Chairman returns for revision, then approves; approver recorded; printing → signature → pickup → completed; resident sees Completed |
| 3 Business Clearance | Front-desk account without permission cannot record the inspection; Secretary records it; Secretary cannot record payment, Treasurer can; Chairman approved from the Approvals page (UI) |
| 4 Complaint and mediation | Complaint recorded in the blotter (duplicate blocked, Kagawad blocked); hearing scheduled; availability set; summons and notice prepared (UI); approved, delivered, acknowledged (acknowledgment before delivery blocked); settlement recorded; Amicable Settlement generated |
| 5 Equipment | Resident request → custodian approves (Secretary blocked) → release → return with one damaged unit; counts update |
| 6 Permissions | Resident blocked from admin, approvals, blotter, reports and staff document pages; Secretary blocked from Approvals; resident cannot open another person's case; Treasurer sees no cases; Kagawad sees no document requests |
| Layout | No sideways scrolling at 375, 1024 and 1280 px on the changed pages for Chairman, Secretary, Custodian, Treasurer, Resident and the homepage |

## 8. Limitations and external dependencies

- **Backend needed** (not built, awaiting approval): accounts and sessions, database, file storage for uploads, server-side permission checks, audit log, SMS/email reminders. Recommended (free tiers): Supabase (Postgres + Auth + Storage + row-level security) or Firebase.
- Data in this prototype lives in the browser and resets on reload except items saved to this device.
- Requirements per document, fee amounts, and the official KP forms (Amicable Settlement, Certificate to File Action) must be supplied by the barangay.
- Barangay contact details on the homepage are placeholders (`src/config/barangay.ts`).
- Treasurer is a new role not in the study paper: confirm with the barangay.

## 9. Deployment

Pushing to `main` on MaeVisionary/brgy-181 runs the GitHub Action that builds and publishes to
https://maevisionary.github.io/brgy-181/. Local build: `BASE_PATH=/brgy-181/ npm run build`.

## 10. Checklist

| Requirement | Status |
|---|---|
| Homepage (header, hero buttons, service cards with actions, officials, contact) | Done |
| Registration with ID, photo, validation, statuses, rejection reason, resubmission | Done |
| Resident dashboard counts, recent activity, notifications, history | Done |
| Document-specific forms and verification per document type | Done |
| Configurable requirements | Done (saved per browser until the backend) |
| Full document status list and progress tracker | Done |
| Secretary dashboard and actions | Done |
| Chairman one-page approvals, return for revision, remarks, approver record | Done |
| Blotter, case creation, search, hearing calendar and availability | Done |
| Summons / notice: generation vs delivery vs acknowledgment | Done |
| Mediation record, amicable settlement, certificate to file action | Done (working layout) |
| Equipment statuses, location, condition, reports | Done |
| Treasurer role | Done |
| Role assignment by the administrator | Done (personnel positions) |
| Reports with date filters and export | Done |
| Server-side authorization, real database, file storage | **Not done: needs the backend** |
| Real SMS/email notifications | **Not done: needs the backend** |
