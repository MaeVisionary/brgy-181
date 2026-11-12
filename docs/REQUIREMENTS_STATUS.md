# BMIS / BRGY 181: Requirements status

Status of every row in REQUIREMENTS_INVENTORY.md, checked against the code on 2026-11-12 (after the appointment, pickup, User Accounts and demo-data work). "Done" means it works in the prototype (mock services and screens); server-side enforcement still needs the backend everywhere. Evidence is one representative file.

**Status meanings:** Done · Partial (some parts missing) · Frontend only (needs a real server, e.g. e-mail/SMS/OTP, database rules, storage, backups) · Not built · Needs policy (waiting for a barangay decision) · Superseded (a later requirement replaced it).


## Resident portal

Done: 25 · Partial: 4 · Superseded: 2 · Needs policy: 1

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R0001 | Resident record supports full name, birthdate, address, contact, residency, family relationships, household, senior, solo parent, 4Ps,… | Done | src/types/resident.ts (Resident) |  |
| R0002 | Support multiple residents and multiple families per household/address; household grouping and family relationships; never assume one… | Done | src/types/resident.ts (Household.families), pages/residents/HouseholdsPage.tsx |  |
| R0003 | Resident data model supports unique resident ID, duplicate detection, household relationships, address history, transfer records, deceased… | Partial | src/types/resident.ts, lib/ids.ts | No deceased, archival, retention, secure disposal or address history; transfers only as household moves |
| R0004 | Resident profile is single source of truth: personal info (name, birthdate, auto age, sex, civil status, address, contact, email),… | Partial | pages/resident/ResidentPortalPages.tsx (MyProfilePage) | Email lives on the account, not the resident record; account status/registration date not shown together |
| R0005 | Resident master list columns: name, address, household, contact, birthdate/age, residency, senior, solo parent, PWD, 4Ps, voter,… | Done | pages/residents/ResidentsPage.tsx | No separate residency column |
| R0006 | Households page as a list view with search | Done | pages/residents/HouseholdsPage.tsx |  |
| R0007 | Resident dashboard: My Profile; My Document Requests (browse, view requirements, submit, upload, track, history); My Complaints (with… | Done | config/navigation.ts (resident nav), ResidentPortalPages.tsx | Spread across pages per later simplification (R0009) |
| R0008 | Resident dashboard overview counts: Total, Pending, Approved, Completed requests, plus Recent Activity, notifications and transaction… | Superseded | R0009; pages/resident/ResidentHome.tsx | Counts removed from home; transaction counts only in My Transactions tabs |
| R0009 | Simplify resident dashboard to prioritize: important updates, active requests, recent transactions, announcements, common services | Done | pages/resident/ResidentHome.tsx |  |
| R0010 | Recent activity items show service name, short reference, relevant date, status only when useful, and an action to open details; no long… | Done | pages/resident/parts.tsx (TransactionList) |  |
| R0011 | Resident portal includes: Dashboard, registration, verification status, profile, household/family info, correction requests, document… | Done | config/navigation.ts, App.tsx /my/* routes |  |
| R0012 | Resident allowed: own profile, submit registration, request certificates, submit complaints, track own requests, receive notifications,… | Done | config/permissions.ts self.* permissions |  |
| R0013 | Collect once, reuse everywhere: auto-populate info already on file (name, birthdate, address, contact, verified ID) and show saved values… | Done | pages/resident/RequestFormPage.tsx ("Your information") |  |
| R0014 | ID states: valid reuse; expired request replacement; expiring soon notify; missing request upload; unreadable request clearer image;… | Partial | services/identityService.ts (stateOf) | No "unreadable" state; expiring-soon only shown on profile, no notification |
| R0015 | Audit resident pages (registration, account creation, login, onboarding, My Profile, Account Settings, Document Requests, My Complaints,… | Done | RequestFormPage.tsx, identityService.needsUpload | Audit itself is a process; evidence is the reuse changes |
| R0016 | No admin terminology residents don't understand; no info shown just because DB holds it; no unnecessary confirmation steps | Done | lib/residentStatus.ts |  |
| R0017 | Resident workflows: show only info needed for the current task, simple step-by-step flows, few options at once, explain what is needed and… | Done | RequestFormPage.tsx, NewComplaintPage.tsx |  |
| R0018 | Mobile resident forms feel like simple guided steps; primary action easy to reach | Done | components/ui/Button.tsx, step forms |  |
| R0019 | After submission, show plain confirmation (e.g. "Your request was sent." then "We will review it and notify you when there is an update.")… | Partial | RequestFormPage.tsx (navigates to details) | justSubmitted state unused; no explicit "Your request was sent" confirmation |
| R0020 | Keep registration, document request, complaint/report and equipment borrowing statuses separate; My Transactions has separate categories… | Done | pages/resident/ResidentV2Pages.tsx (MyTransactionsPage) |  |
| R0021 | My Transactions resident statuses only: Submitted, Processing, Action Needed, Ready, Completed, Unsuccessful; default filter All… | Done | lib/residentStatus.ts | Implements six-status list; later nine-status list (R0022) not adopted |
| R0022 | Resident-facing statuses: Submitted, Verifying information, Action needed, For in-person verification, Processing, Approved, Ready for… | Needs policy | lib/residentStatus.ts | Conflicts with R0021; nine labels not implemented |
| R0023 | Map internal to resident labels: Under Review/For Verification/Approved/Borrowed to Processing; Needs Additional Info to Action Needed;… | Done | lib/residentStatus.ts |  |
| R0024 | Category filters: Documents (Submitted, Processing, Action Needed, Ready, Completed, Unsuccessful); Complaints (same minus Ready);… | Done | lib/residentStatus.ts (STATUSES_BY_KIND) |  |
| R0025 | Resident transaction filters show only relevant statuses: no Borrowed in Document Requests, no Ready for Pickup in Complaints, no… | Done | ResidentV2Pages.tsx (statusOptions with counts) |  |
| R0026 | Remove text "Showing 4 transactions, newest first. Select a row to see its details." with no replacement sentence | Done | (text no longer in src) |  |
| R0027 | Tracking shows current status, last update, expected processing time when reliable, whether in-person visit needed, exact next-step… | Done | ResidentV2Pages.tsx (DocumentDetailsPage "What happens next") |  |
| R0028 | When a hall visit is needed, explain why, what to bring, where to go, office hours, whether appointment required | Done | pages/resident/PickupSection.tsx, AppointmentPages.tsx |  |
| R0029 | Resident navigation: Home, Document Requests, Complaints and Reports, Equipment Borrowing, My Transactions, Notifications; Account: My… | Superseded | R0030/R0031 |  |
| R0030 | Resident nav: Home, Document Requests, My Complaints, Equipment Borrowing, My Transactions, Notifications, My Profile; only services… | Done | config/navigation.ts (resident) |  |
| R0031 | Add a simple "My Appointments" section and nav item: upcoming, pending, completed appointments as cards (title, date, time, status, View… | Done | pages/appointments/AppointmentPages.tsx (MyAppointmentsPage) |  |
| R0032 | Resident appointment UI uses large text, clear buttons, plain language, no technical terms | Done | AppointmentPages.tsx |  |

## Registration

Done: 42 · Partial: 14 · Frontend only: 4 · Superseded: 2 · Needs policy: 2

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R0033 | Secretary imports existing resident master list via CSV: upload, preview, column mapping, field validation (missing/invalid), duplicate… | Partial | pages/residents/ImportPage.tsx | No import history; no saved "records requiring review" list after import |
| R0034 | Duplicate detection compares full name, birthdate and address; never auto-merge similar-name residents; send possible duplicates to an… | Done | services/residentService.ts (dupKey, possibleDuplicates) |  |
| R0035 | An uncertain masterlist match must not automatically create a duplicate resident. | Done | ImportPage.tsx, ReviewPages.tsx |  |
| R0036 | Before approval, check the resident does not already exist and prevent duplicate resident creation, including double approval of the same… | Done | services/registrationService.ts (decideRegistration, one active account) |  |
| R0037 | Resident registration form: personal info with clear labels, required markers, instructions and validation; accept privacy notice; valid… | Done | pages/public/RegisterPage.tsx | Status tracked only via sign-in message |
| R0038 | Add "Create account" on resident login with ID upload, live selfie, face match ID vs selfie, questions like the sheet, masterlist lookup;… | Superseded | R0054 | Code still auto-approves when all checks pass |
| R0039 | During account setup collect only info needed to establish and verify the account; collect an accepted valid ID if identification is… | Done | RegisterPage.tsx |  |
| R0040 | Setup flow: create account, provide info, upload valid government ID, OCR read, check expiry, match ID to submitted info, save ID… | Frontend only | lib/idOcr.ts (tesseract in browser) | Secure ID storage and server OCR need backend |
| R0041 | Registration workflow: submit, system validates, system checks ID, personnel reviews uncertain cases, approve/reject, approved record… | Partial | registrationService.submitRegistration | Clean applications skip personnel review (auto_approved) |
| R0042 | Registration appointments (in-person ID, original ID, household clarification, duplicate investigation, address verification) only when… | Done | ReviewPages.tsx (VisitForm) |  |
| R0043 | Validate ID: image readability, document type and whether supported, full name, birthdate, expiration date, ID number, consistency with… | Partial | lib/idOcr.ts, RegisterPage.tsx | No check that the ID number is already linked to another account |
| R0044 | Never treat an expired ID as valid; reject expired IDs; do not assume all IDs expire or reject a valid permanent ID lacking an expiry… | Done | config/idTypes.ts, identityService.stateOf |  |
| R0045 | ID upload: specify acceptable ID types, check expiry where applicable, reject expired IDs when valid one needed, clear failure reason,… | Done | identityService.ts (submitReplacementId, decideId) |  |
| R0046 | Distinguish OCR extraction, expiry validation and identity verification; OCR does not prove authenticity; flag uncertain cases to staff;… | Done | lib/idOcr.ts (inconclusive, never denial) |  |
| R0047 | Uploaded documents must not be declared authentic solely because an AI system considers them legitimate; AI may assist extraction but not… | Done | registrationService.ts |  |
| R0048 | Identity verification: OCR of name/birthdate/address, match against master list, ID-vs-selfie face comparison, liveness, verification result | Frontend only | lib/faceVerify.ts | Face match/liveness run client-side; need server-side service |
| R0049 | Record verification outcomes, timestamps and decision metadata | Done | registrationService.decideRegistration (decidedBy/At, audit) |  |
| R0050 | Display face matching, liveness, identity document verification, and masterlist matching results, each with result, explanation,… | Partial | ReviewPages.tsx (CheckRow) | Confidence only for face; no per-check date/time or explanation for each |
| R0051 | Do not invent verification results or confidence scores. | Done | ReviewPages.tsx |  |
| R0052 | If a verification service returned no result, display "Not checked", never "Passed"; missing verification data must never be treated as… | Done | ReviewPages.tsx ("Not checked") |  |
| R0053 | Auto-approve only when all checks pass; failed/inconclusive checks go to Secretary manual review queue | Superseded | R0054 |  |
| R0054 | Never auto-approve a registration because most checks or an identity tool passed, or on an uncertain match; identity verification and… | Partial | registrationService.submitRegistration | Status 'auto_approved' still set when all checks pass; contradicts never-auto-approve |
| R0055 | A failed automated check (including face/liveness) must never auto-deny/reject; provide manual and in-person verification alternative;… | Done | registrationService.ts (failed checks go to manual_review) |  |
| R0056 | A failed face match must not be automatically overridden. | Done | registrationService.ts |  |
| R0057 | Secretary dashboard shows pending registrations, verification queue, info update requests, master list and possible duplicates | Partial | pages/dashboard/SecretaryDashboard.tsx (Needs attention) | No master list or possible-duplicates entry on dashboard |
| R0058 | Secretary processes new registrations, reviews unmatched registrations, and approves or denies after manual verification | Done | ReviewPages.tsx (RegistrationsPage) |  |
| R0059 | Resident lists prioritize names and essential details; registration forms use clear labels, grouped fields, no repeated explanations | Done | ReviewPages.tsx |  |
| R0060 | Registration review list default shows only applicant name, registration date, address, one review result, View Details, Approve, Reject | Partial | ReviewPages.tsx (RegistrationReview) | Approve/Reject only after opening details |
| R0061 | Provide registration queue filters: New applications, Under review, In-person verification required, Awaiting applicant, Ready for… | Partial | ReviewPages.tsx (tabs To review / Visit requested / Decided) | Only 3 of 7 filters |
| R0062 | Registrations review: align the check icons | Done | ReviewPages.tsx (CheckIcon) |  |
| R0063 | Provide a dedicated application review page or expandable detail view when the Secretary opens a resident registration application. | Done | ReviewPages.tsx (expandable) |  |
| R0064 | Registration review organized into expandable sections: Personal Information, Submitted Identification, Identity Verification (ID, face… | Done | ReviewPages.tsx (Section) |  |
| R0065 | Review page header shows applicant name, registration reference number, submission date, and current review state. | Partial | ReviewPages.tsx | Reference number is inside details, not in header |
| R0066 | Show applicant info: complete legal name, first/middle/last name, suffix, date of birth, auto-calculated age, sex, civil status, full… | Partial | ReviewPages.tsx (Personal information) | Household number not shown |
| R0067 | Secretary review screen shows full name, ID details, uploaded ID, expiry, address, other info, identity verification result, face match… | Partial | ReviewPages.tsx | No verification history |
| R0068 | Registration Details section with all other signup fields from the current form, original submitted values and corresponding verification… | Done | ReviewPages.tsx |  |
| R0069 | Show uploaded ID image (front) and back image if required, ID type, name extracted from ID, DOB from ID, expiration date, OCR result,… | Partial | ReviewPages.tsx (Submitted ID) | No back image; extracted name/DOB values not shown, only which fields were read |
| R0070 | Provide an option to enlarge or inspect the uploaded ID image. | Done | ReviewPages.tsx (open full size) |  |
| R0071 | Do not show only an OCR result like "Passed"; the Secretary must be able to inspect the actual supporting document. | Done | ReviewPages.tsx |  |
| R0072 | Separate individual verification results from the overall application review state; one failed check must not make the overall application… | Done | ReviewPages.tsx (attention count) |  |
| R0073 | Individual verification states are limited to: Passed, Failed, Needs review, Not checked. | Done | ReviewPages.tsx (CheckRow) |  |
| R0074 | Review result indicators: green Passed, amber Needs review, red Failed | Done | ReviewPages.tsx |  |
| R0075 | Failed or uncertain identity checks must be immediately noticeable and never hidden | Done | ReviewPages.tsx |  |
| R0076 | Identify the specific failing/review-needed issue so the Secretary can investigate rather than showing a blanket failure. | Done | ReviewPages.tsx (evidence.reasons) |  |
| R0077 | Secretary decision actions: Approve Registration, Request In-Person Verification, Reject Registration (with reason), Request additional… | Partial | ReviewPages.tsx (Decide, VisitForm) | No "Request additional information" action |
| R0078 | On approval: create/activate resident record, link account to the correct resident record, notify applicant, record approving Secretary… | Done | registrationService.decideRegistration (linkResident, notify) |  |
| R0079 | Rejection requires reviewing the submission, a mandatory rejection reason (field shown only when rejecting; no permanently visible… | Done | ReviewPages.tsx (Decide) |  |
| R0080 | On rejection: update decision, record reason, Secretary and timestamp, notify applicant, preserve history; do not silently delete the… | Done | registrationService.decideRegistration | Rejected account is replaced if applicant resubmits |
| R0081 | Account statuses Pending Approval / Approved / Rejected; rejection shows reason and a resubmission process | Done | registrationService.pendingAccountMessage |  |
| R0082 | Unapproved accounts cannot access protected resident services | Done | registrationService.pendingAccountMessage |  |
| R0083 | Registration workflow: Pending Verification, Verified, Needs Correction, Approved / Rejected | Needs policy |  | Conflicting registration status lists |
| R0084 | Registration statuses: Submitted -> Verification -> Needs Additional Information -> Approved / Rejected | Needs policy |  | Conflicting registration status lists |
| R0085 | Resident registration status is separate from transaction statuses; do not reuse transaction values for active/pending-verification… | Done | src/types/resident.ts (RegistrationStatus) |  |
| R0086 | Keep registration-specific statuses within the registration management area; do not display them elsewhere in the system. | Done | ReviewPages.tsx |  |
| R0087 | Add a "Request In-Person Verification" button opening a form: reason (required), what to bring (required), preferred date, preferred time,… | Done | ReviewPages.tsx (VisitForm) |  |
| R0088 | Offer suggested in-person reasons: ID needs physical verification; name/birthdate mismatch; face verification needs manual confirmation;… | Done | registrationService.IN_PERSON_REASONS |  |
| R0089 | Secretary can edit the in-person verification message before sending. | Done | ReviewPages.tsx (editable email body) |  |
| R0090 | After sending in-person request: save request, set state to "In-Person Verification Required", record Secretary name and timestamp, show… | Done | registrationService.requestInPerson |  |
| R0091 | Sending an in-person verification request must not approve or reject the applicant. | Done | registrationService.requestInPerson |  |
| R0092 | In-person verification: Secretary selects "Please visit the Barangay Hall.", gives required reason, decision recorded; resident receives… | Frontend only | services/emailService.ts | Email recorded as "not sent"; no email service |
| R0093 | After the applicant visits: open original application, confirm in-person appearance, record documents physically inspected, add… | Done | ReviewPages.tsx (VisitedForm), completeInPerson |  |
| R0094 | Prevent unauthorized changes to submitted registration data; keep submissions immutable and record corrections through an authorized… | Frontend only | registrationService.ts | No edit path in UI; immutability needs server enforcement |
| R0095 | Desktop registration review: two-column layout for applicant info and verification, easy ID inspection, decision actions always accessible. | Partial | ReviewPages.tsx | Sections stacked; no two-column desktop layout |
| R0096 | Mobile registration review: show name and short summary first; details, IDs, verification in expandable sections; Approve/Request… | Done | ReviewPages.tsx |  |

## Corrections

Done: 30 · Partial: 12 · Not built: 6 · Superseded: 3 · Frontend only: 3 · Needs policy: 2

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R0097 | Resident submits a correction (select own record, field, correct value, reason, supporting docs only if needed); original value recorded;… | Done | services/residentService.submitCorrection, decideChangeRequest |  |
| R0098 | Never overwrite the official record/masterlist when a correction is submitted; pending requests never modify it; update only after… | Done | residentService.decideChangeRequest |  |
| R0099 | Keep audit trail per correction: previous value, approved value, reviewer, date; original preserved until approval; never silently… | Done | residentService.ts (originalValue, decidedBy, audit) |  |
| R0100 | If profile info is outdated, let the resident request a correction through the correction workflow rather than retyping in forms | Done | pages/resident/CorrectionPanel.tsx |  |
| R0101 | Corrections to civil status, educational attainment, etc. need proof (file upload or bring onsite) and Secretary verification; light… | Superseded | R0132 |  |
| R0102 | Record Update Requests split into "To be approved" and "Approved"; decided requests auto-move and hide after some days but stay in record;… | Superseded | R0149 | Code implements this (To review / Recently decided, 7 days) |
| R0103 | Replace "Whose record" dropdown with three options: My own record; My child or dependent; Someone I am authorized to represent | Done | CorrectionPanel.tsx, residentService (CorrectionBasis) |  |
| R0104 | Residents may request corrections to their own record; system auto-identifies the logged-in resident and verifies identity | Done | residentService.correctionTargets |  |
| R0105 | Child/dependent: only minors under a verified parent/legal guardian once relationship and authority are established; don't assume… | Done | residentService.submitCorrection (dependent rules) |  |
| R0106 | Household membership alone never grants permission to modify another person's info; household heads/adult members cannot change another… | Done | residentService.submitCorrection |  |
| R0107 | Authorized representative/other relationships: explicitly established legal or administrative authority; record represented person,… | Partial | residentService (REPRESENTATION_KINDS) | Representation limited to same family; outside family deferred to Hall |
| R0108 | Do not require an SPA in every case; apply authorization per legal relationship and NPC guidance | Needs policy | residentService.REPRESENTATION_KINDS | SPA is one option, not required |
| R0109 | Family assistance only via a proper authorized representative process; never by sharing another person's password | Done | residentService (representative flow) |  |
| R0110 | Separate household composition updates, household address updates, and individual corrections; household reps may initiate household-level… | Done | residentService (HOUSEHOLD_UPDATES, head only) |  |
| R0111 | Every correction enters staff review showing requester, affected person, requested correction, reason, authorization evidence, supporting… | Superseded | R0124 |  |
| R0112 | Correction UI: clear categories, minimal text, simple authorization upload, clear submission confirmation | Done | CorrectionPanel.tsx |  |
| R0113 | Acceptance tests: own name allowed; parent-minor allowed after verification; spouse without auth blocked; household head changing adult… | Frontend only | residentService.submitCorrection | Rules client-side only; direct API block needs backend; no test suite |
| R0114 | Secretary correction actions: Approve, Reject, Request additional information, Require in-person verification, Escalate to Chairman… | Partial | ReviewPages.tsx (CorrectionActions) | No Request additional information or Escalate to Chairman |
| R0115 | Require In-Person Verification opens a simple scheduling interface inside the correction workflow (no disconnected/duplicate feature):… | Done | AppointmentPages.tsx (ScheduleVisitForm), appointmentService |  |
| R0116 | In-person request captures a specific reason for visit: Verify original ID document; Verify supporting documents; Confirm resident… | Done | appointmentService.VISIT_REASONS | No "Other (specify)" option |
| R0117 | Secretary can select or specify exact documents to bring (e.g. original valid government ID, birth certificate, proof of employment, proof… | Done | appointmentService.DOCUMENT_OPTIONS |  |
| R0118 | Do not ask residents to upload documents already stored in their account unless expired, invalid, unreadable, or requiring replacement | Done | identityService.needsUpload |  |
| R0119 | Marking Verified requires recording result (original ID presented, name matches, supporting document checked, notes) plus who verified and… | Done | appointmentService.recordVerification |  |
| R0120 | Never auto-approve a correction because the resident arrived or was verified; Secretary must still make the approval decision | Done | residentService.decideChangeRequest |  |
| R0121 | If verification fails, Secretary can provide a clear reason and instructions to the resident | Done | appointmentService.recordVerification (not_verified notes) |  |
| R0122 | Do not make residents visit the Barangay Hall unnecessarily | Done | appointmentService (visit only when required) |  |
| R0123 | Audit existing profile page, correction form, submission logic, Secretary and Chairman dashboards, approval workflows, notifications, data… | Done | (process; existing flows extended) |  |
| R0124 | Secretary must not individually approve every profile correction; system auto-validates, classifies, routes, and processes when safe | Done | residentService.CORRECTION_POLICY |  |
| R0125 | Configurable correction classification engine with Low, Medium, High risk tiers | Partial | residentService.CORRECTION_POLICY | Three routes (auto/self_reported/review), hardcoded, not configurable |
| R0126 | Low-risk (contact number, email): validate format, OTP to new contact, verify OTP, duplicate/conflict check, auto-process without… | Frontend only | residentService (contact auto-update) | No OTP; number marked not verified |
| R0127 | Contact number change: normalize/validate format, check uniqueness across active accounts, conflicting pending check, OTP to new number,… | Frontend only | residentService.correctionChecks | No OTP or server verify |
| R0128 | If old number is inaccessible, route to a secure recovery process instead of auto-approving | Not built |  | No recovery process |
| R0129 | Email change: format check, uniqueness, verification to new email, recheck uniqueness before save, auto-update when all pass | Not built |  | Email change not a correctable field |
| R0130 | Medium-risk (employment, educational attainment, non-identity details): validate, determine evidence need, auto-process only if rules… | Partial | residentService.CORRECTION_POLICY (self_reported) | No routing to Records Clerk; no evidence rules |
| R0131 | Self-reported unverified changes keep their verification status; never falsely label as officially verified | Done | residentService (self-reported note) |  |
| R0132 | High-risk (legal name, birthdate, civil status, household membership, conflicting address, identity data): require supporting docs,… | Partial | residentService.PROOF_REQUIRED | Name and birthdate need no document; no conflicting-address handling |
| R0133 | Name change flow: fetch current name, ask what to correct, require reason, identify type, require supporting civil registry document,… | Partial | residentService.correctionChecks | No civil registry doc, OCR or name-change type identification |
| R0134 | Name categories: 1 minor formatting (auto when unambiguous and rule permits); 2 document-supported (Secretary approval unless approved… | Partial | residentService (formattingOnly) | Only category 1 auto; 2 and 3 not distinguished |
| R0135 | Address change: check against records/household DB; distinguish minor detail, move within 181, move outside 181, household membership;… | Partial | residentService (HOUSEHOLD_UPDATES) | No minor/within/outside-181 address distinction |
| R0136 | Do not automatically delete historical residency records | Done | residentService.moveResident (history kept) |  |
| R0137 | Field-specific rules for employment, education, civil status, voter info, household relationships; voter status never changed on resident… | Partial | residentService | Voter info not correctable; no field-specific rules beyond proof |
| R0138 | Never auto-change legally significant information based solely on OCR or AI interpretation | Done | residentService |  |
| R0139 | Never let OCR or AI certify a document as genuine | Done |  | No AI certification anywhere |
| R0140 | AI may assist extraction/comparison but final decisions follow deterministic rules and assigned approval authority | Done | residentService.correctionChecks (deterministic) |  |
| R0141 | Reusable verification engine runs 12 checks: required fields, format, duplicate request, record match, conflicts, doc requirement, file… | Partial | residentService.correctionChecks | About 8 of 12 checks; no ID expiry, file, fraud checks |
| R0142 | Each verification check returns Passed, Failed, Needs Review, or Not Applicable | Done | residentService (CheckResult) |  |
| R0143 | Expired ID is rejected as insufficient evidence with explanation of how to submit an acceptable replacement | Done | identityService.idUploadProblem |  |
| R0144 | Route 1 Automatically Processed: when all checks pass, update record, save old/new values, record automated event, notify resident, keep… | Done | residentService.submitCorrection (route auto) |  |
| R0145 | Route 2 Records Clerk Verification: clerk views existing vs requested info, inspects docs, verifies, requests more info, recommends… | Not built |  | No Records Clerk role |
| R0146 | Route 3 Secretary Review shows name, resident number, field, existing, requested, reason, docs, automated results, and why Secretary… | Partial | ReviewPages.tsx (ChangeRequestsPage) | No "why Secretary attention needed" line; no resident number |
| R0147 | Route 4 Chairman Escalation only for items needing Chairman authorization under configured policy; never routine contact/profile changes | Not built |  | No Chairman escalation route |
| R0148 | Make approval requirements configurable per barangay's actual policies; do not invent approval authority | Needs policy | residentService.CORRECTION_POLICY | Policy hardcoded; not configurable |
| R0149 | Secretary dashboard categories: Needs Your Decision, Needs Verification, Requires Additional Information, Escalated, Recently Completed | Not built | ReviewPages.tsx | Only To review / Recently decided tabs |
| R0150 | Auto-processed requests excluded from Secretary's active queue; shown in a separate activity history | Partial | ReviewPages.tsx | Auto-processed show under Recently decided, not separate history |
| R0151 | Each queued request shows concise summary (name, field change, existing, requested, verification, action needed); click opens full details | Done | ReviewPages.tsx (ChangeRequestsPage) |  |
| R0152 | Test 10 correction scenarios: phone, employment, civil status, birthdate, duplicate, expired ID, household conflict, in-person,… | Not built |  | No automated test suite in repo |

## Documents

Done: 53 · Partial: 12 · Superseded: 6 · Needs policy: 4 · Frontend only: 2 · Not built: 1

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R0153 | Support 13 document types: First Time Job Seeker, Non-Resident, Cohabitation, Singleness, Residency, Indigency, Summon, Incident Record… | Done | src/documents/catalog.ts |  |
| R0154 | Document Requests exclusively handles: First Time Job Seeker, Non-Resident, Cohabitation, Singleness, Residency, Indigency, Barangay… | Superseded | R0155 |  |
| R0155 | Resident portal document services limited to those the barangay actually offers online: Clearance (Person), Business Clearance, Residency,… | Done | documents/catalog.ts (RESIDENT_SERVICES) |  |
| R0156 | Remove Certificate of Non-Resident, Barangay Summon, Incident Report Form (Blotter), Blotter Report, Notice of Hearing from all… | Done | documentService.createRequest, RESIDENT_SERVICES |  |
| R0157 | Move restricted services to personnel workflows: Non-Resident (personnel certification); Summon and Notice of Hearing (authorized… | Done | documents/workflows.ts (summon, record, notice) |  |
| R0158 | Resident service cards: clear names, no descriptions, no status badges, no duplicate services or extra categories, mobile-first | Done | pages/resident/NewRequestPage.tsx |  |
| R0159 | Each document type has its own requirements, fields, processing rules and approval workflow; no single generic form or request process | Partial | documents/catalog.ts | Per-document fields/requirements, but certificates share one 'standard' workflow |
| R0160 | Separate rule set per document; do not assume all certificates can be auto-issued | Done | documents/workflows.ts |  |
| R0161 | Configurable per-document approval workflows defining reviewer, verifier, approver, payment processor, releaser; not one sequence for all | Needs policy | documents/workflows.ts | Not configurable per document |
| R0162 | Create an eligibility/processing matrix per document type: info, eligibility, attachments, residency, fees, in-person, Secretary review,… | Partial | catalog.ts, config/serviceStandards.ts | No single eligibility/processing matrix |
| R0163 | Preserve per-document process distinctions (e.g. Singleness requires personal visit; Cohabitation both applicants; Summon via official… | Done | catalog.ts (Singleness online:false) |  |
| R0164 | Provide assisted-service option at the Barangay Hall for residents who cannot use the application | Done | pages/documents/NewAssistedRequestPage.tsx |  |
| R0165 | Centralized, configurable document-requirements config, editable by authorized administrators, defining required supporting documents per… | Done | pages/documents/RequirementsEditor.tsx, requirementService |  |
| R0166 | New certificate requests only request documents specifically required for that service; never ask for the same document twice or for docs… | Done | RequestFormPage.tsx |  |
| R0167 | Request updated ID only if expired, missing, unreadable or invalid; do not assume every document requires a new ID upload | Done | identityService.needsUpload |  |
| R0168 | Admin service configuration per document type: official name, classification, approved duration, required documents, fees, responsible… | Partial | pages/admin/ServiceStandardsPanel.tsx | Fees, responsible role, special conditions not configurable |
| R0169 | Build a Citizen's Charter service catalog with official requirements, responsible personnel, fees, processing deadlines, expected release… | Needs policy | serviceStandardService.ts | No Citizen's Charter catalog |
| R0170 | Configurable processing-time settings per document type in working days (same-day only if supported; interview/investigation instructions;… | Done | serviceStandardService.ts, processingService.ts |  |
| R0171 | Reproduce each supplied official template exactly (title, wording, labels, order, tables, margins, signature lines, seals, page size); no… | Done | documents/catalog.ts (templates) |  |
| R0172 | Separate generation template per document type; never one generic template | Done | catalog.ts |  |
| R0173 | Auto-populate only fields that exist on the reference from resident/request/case records; leave missing values blank/flagged; never… | Done | documents/fill.ts (missingFields) |  |
| R0174 | Before generation: select type, retrieve data, review fields, preview original layout, show missing info, then generate | Done | pages/documents/PreviewPage.tsx |  |
| R0175 | Print and PDF output must preserve the reference layout | Done | PreviewPage.tsx (Print / Save as PDF) |  |
| R0176 | Documents without a supplied printable template are marked pending reference; no invented wording or layout | Done | pages/documents/TemplatesPage.tsx |  |
| R0177 | Use 2026 for dates on templates and use names as in the actual documents | Done | catalog.ts |  |
| R0178 | Where no process is documented, use the best Philippine-context process | Superseded | R0165 |  |
| R0179 | Standard workflow: submit, Secretary receives/verifies/processes, forward to Chairman when needed, approve/reject, sign and seal,… | Done | documents/workflows.ts (standard) | Chairman always in path, not "when needed" |
| R0180 | Workflow: submit, Secretary reviews, approves or returns for revision, forward to Chairman, Chairman approves, prepare for printing and… | Done | documents/workflows.ts |  |
| R0181 | Backend-validated workflow transitions; a request cannot jump from Submitted to Released or skip approvals | Frontend only | documentService.applyTransition | Client-side validation only |
| R0182 | Statuses: Draft, Submitted, Under Review, Needs Additional Information, Processing, Pending Chairman Approval, Approved, Rejected, Ready… | Superseded | R0186 |  |
| R0183 | Statuses: Pending Review, Under Verification, Needs Revision, Approved by Secretary, Forwarded to Chairman, Pending Chairman Approval,… | Superseded | R0186 | Code labels match this list (workflows.ts STATUS_META) |
| R0184 | Staff document workflow: Submitted, Under Review, Needs Additional Information, Approved, Ready for Pickup, Completed | Superseded | R0185 |  |
| R0185 | Document request statuses: Submitted, Under Review, Needs Additional Information, Approved, Ready for Pickup, Completed, Rejected,… | Partial | workflows.ts STATUS_META | Labels differ (Needs Revision, Released) |
| R0186 | Document statuses: Submitted -> Under Review -> Needs Additional Information -> Approved -> Ready for Claiming -> Completed; plus… | Needs policy |  | "Ready for Claiming" not adopted |
| R0187 | Simple request timeline Submitted → Under Review → Approved → Ready for Pickup → Completed with dates on completed stages, no explanatory… | Partial | ResidentV2Pages.tsx (Progress) | Uses resident labels (Processing/Ready), not Under Review/Approved |
| R0188 | Document Templates Workflow shows a connected step-progress tracker indicating completed, current, pending and not-reached stages | Done | TemplatesPage.tsx (stepper) |  |
| R0189 | Chairman approves/rejects (or returns for revision, adds remarks) documents already verified by the Secretary, viewable and actionable… | Done | pages/documents/ApprovalsPage.tsx |  |
| R0190 | Chairman approval triggers the next step (signing, sealing, printing, release) | Done | workflows.ts (approved to for_signature) |  |
| R0191 | Keep approval history, approving personnel, timestamps, document version, rejection reasons, release records; unauthorized users cannot… | Frontend only | documentService.ts (history) | Server-side authorization needed |
| R0192 | Chairman dashboard cards: Pending Approvals, Approved, For Signature (awaiting signing and sealing), Completed; each pending item shows… | Done | pages/dashboard/ChairmanDashboard.tsx |  |
| R0193 | Secretary dashboard/portal cards: Pending Registrations, Pending Requests, Under Verification, Requiring Preparation, Forwarded/Awaiting… | Done | SecretaryDashboard.tsx |  |
| R0194 | Secretary receives requests, verifies info and requirements, can request additional info, prepares the document, routes to Robert Atad… | Done | workflows.ts |  |
| R0195 | Document request list shows request type, resident, date, status, with clear processing actions | Done | pages/documents/DocumentRequestsPage.tsx |  |
| R0196 | Every request row is clickable and opens its correct full detail page; avoid accidental taps on adjacent rows on mobile. | Done | DocumentRequestsPage.tsx |  |
| R0197 | Request detail shows reference number, full name, request type, date submitted, workflow status, submitted info, uploaded documents,… | Done | pages/documents/RequestDetailPage.tsx |  |
| R0198 | Personnel dashboard highlights approaching and overdue deadlines | Partial | SecretaryDashboard.tsx ("Past expected date") | Overdue only; approaching deadlines not highlighted |
| R0199 | System checks eligibility and whether auto-processing permitted; Secretary receives only cases requiring human intervention; completed… | Not built |  | No auto-processing; Secretary handles every request |
| R0200 | First Time Job Seeker: Valid ID; online request, Secretary processes, routed to Robert Atad, signing and sealing, ready for pickup at… | Done | catalog.ts (first-time-job-seeker) |  |
| R0201 | First Time Job Seeker certificate: validate statutory requirements, prevent duplicate or ineligible applications, route exceptions | Partial | catalog.ts | No duplicate/eligibility check (RA 11261 once-only) |
| R0202 | Certification of Non-Resident: request interface only; mark unspecified workflow details "pending confirmation"; no invented requirements | Superseded | R0156 |  |
| R0203 | Non-Residency: personnel verify residency status and record findings | Done | catalog.ts (verification), documentService.recordVerification |  |
| R0204 | Certification of Cohabitation: form supports two applicants with info and IDs for both; Secretary verifies both; routed to Robert Atad;… | Done | catalog.ts (cohabitation) |  |
| R0205 | Cohabitation captures both individuals with verification fields; Singleness and Indigency capture applicant and purpose | Done | catalog.ts |  |
| R0206 | Certificate of Singleness is an in-person process at the Barangay Hall (receive, verify identity, check records, prepare,… | Done | catalog.ts (no-partner online:false) |  |
| R0207 | Certificate of Residency: online request with valid ID upload; Secretary verifies against records; routed to Robert Atad; signing/sealing;… | Done | catalog.ts (residency) |  |
| R0208 | Certificate of Residency: check record and residency requirements, prepare when eligible, still require authorized certification and… | Done | workflows.ts |  |
| R0209 | Certificate of Indigency: Valid ID; Secretary processes; Chairman approval; signing/sealing; pickup; no invented income threshold or… | Done | catalog.ts (indigency) |  |
| R0210 | Certificate of Indigency: do not auto-determine indigency with AI; require human assessment and authorization | Done | catalog.ts |  |
| R0211 | Barangay Clearance: check identity/eligibility, apply approved requirements, route verification matters to personnel | Done | catalog.ts (clearance-person) |  |
| R0212 | Barangay Business Clearance: request interface only; workflow, process and requirements marked pending confirmation and clarified before… | Needs policy | catalog.ts (business-clearance) |  |
| R0213 | Document-specific forms; Business Clearance captures business info, location, nature, ocular inspection with findings and inspection status | Done | catalog.ts verification record | Conflicts with R0212 |
| R0214 | Document request auto-fills from the verified profile (name, birthdate, age, address, household, contact, resident number), checks ID… | Done | RequestFormPage.tsx |  |
| R0215 | Show a "Your information" confirmation (name, age · area, Verified ID indicator, Continue) instead of re-asking name/age/address/ID upload | Done | RequestFormPage.tsx |  |
| R0216 | Document requests need: eligibility, required field validation, upload size limits, accepted formats, completeness checks, duplicate… | Partial | documentService.createRequest | No duplicate active request detection |
| R0217 | Resident progress tracker with reference no., submission date, type, purpose, assigned personnel, approval history, remarks, status | Partial | ResidentV2Pages.tsx (DocumentDetailsPage) | No assigned personnel shown |
| R0218 | Each request/transaction detail shows submitted date, current step/status, estimated processing period and expected completion date,… | Done | ResidentV2Pages.tsx |  |
| R0219 | Processing summary: Submitted date/time, Expected completion, Current step, Pickup method; no employee IDs or technical codes | Done | ResidentV2Pages.tsx |  |
| R0220 | Keep transaction details structure: reference number, simple progress timeline, request title, Cancel when permitted, request details | Done | ResidentV2Pages.tsx, workflows.ts (owner cancel) |  |
| R0221 | Mobile transaction detail prioritizes document name, progress, expected completion, whether a visit is needed, next action | Done | ResidentV2Pages.tsx |  |
| R0222 | Compute expected completion from configurable service time per document type in working days, excluding weekends, holidays and official… | Done | services/processingService.ts |  |
| R0223 | Never display invented, fabricated or guaranteed completion dates or fake live countdowns; if estimate unavailable show "Processing time… | Done | ResidentV2Pages.tsx |  |
| R0224 | Delays show reason, revised expected completion date, and any required resident action; recalculate and notify the resident; follow RA… | Done | documentService.extendProcessing |  |
| R0225 | Status-specific "What happens next?" messages in simple language for Submitted, Under Review, Needs Additional Information, Approved,… | Done | ResidentV2Pages.tsx (next messages) |  |
| R0226 | Show only applicable visit/pickup instructions: no visit before approval unless staff asks ("No visit needed yet", "Wait for approval");… | Partial | PickupSection.tsx | No "No visit needed yet"; online download not offered |
| R0227 | Approved document auto-generates a claiming appointment; resident confirms, gets reminders, identity verified at release, transaction… | Done | appointmentService (document_claim), pickupService |  |
| R0228 | When original documents must be inspected, system generates verification appointment; resident picks slot; result advances transaction… | Partial | appointmentService (correction_verification) | No verification appointment for document requests |
| R0229 | Do not create appointments for documents that don't require an in-person visit; allow digital processing when permitted | Done | appointmentService |  |
| R0230 | Use watermark on printable certificates, clearances, reports, document previews only where appropriate; never make an internal watermark… | Partial | components/layout/SealWatermark.tsx | No watermark on certificate previews or reports |

## Complaints/cases/mediation

Done: 27 · Partial: 7 · Needs policy: 3 · Superseded: 3 · Frontend only: 1

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R0231 | Case records (complaints, incidents, blotter) hold unique reference no., category, complainant/reporting party, respondent,… | Partial | src/types/case.ts (KPCase) | No attachments/evidence on cases |
| R0232 | Schedule hearings and mediation; record dates, attendance, reschedules, actions, outcomes, agreements, failed mediation, status and… | Done | services/caseService.ts (scheduleHearing, recordHearing) |  |
| R0233 | Hearing calendar with date/time, assigned personnel, complainant/respondent/chairman availability and history | Done | pages/cases/HearingCalendar.tsx |  |
| R0234 | Residents see only permitted info and status of own submission; never other party data, internal investigation notes, restricted/internal… | Done | ResidentV2Pages.tsx (ComplaintDetailsPage) |  |
| R0235 | Strict confidentiality and authorized-only access for case info; immutable audit history; AI never decides guilt, responsibility or outcomes | Frontend only | caseService.ts | Immutable audit needs backend |
| R0236 | Chairman dashboard shows pending complaints for assessment, upcoming hearings/mediation, active KP cases, outcomes and unresolved cases;… | Done | ChairmanDashboard.tsx |  |
| R0237 | Secretary dashboard shows complaints/incident submissions, blotter records, upcoming hearings, case records needing updates | Done | SecretaryDashboard.tsx |  |
| R0238 | Secretary receives and verifies complaints, coordinates with complainants, maintains blotter, prepares hearing notices from approved… | Done | caseService.ts, documentService.prepareHearingDocuments |  |
| R0239 | Personnel have a separate case-management interface to view/review incoming reports, verify, assign personnel, record actions, add… | Done | pages/cases/CaseDetailPage.tsx |  |
| R0240 | Kagawad/Case Handler: access assigned cases, review relevant concerns, manage assigned mediation schedules, record case updates, escalate | Done | caseService.assignCase (cases.assigned) |  |
| R0241 | KP process: filing, complainant/respondent and details recorded, Chairman involvement, mediation up to 15 days under Chairman, elevation… | Done | caseService.mediationDay |  |
| R0242 | Complaint flow: file, record in blotter, schedule hearing, summons to both parties, Notice of Hearing, mediation, outcome, DILG/KP reports | Done | caseService.ts, analytics reports |  |
| R0243 | Lupon mediation duration is configurable or left for confirmation; do not invent it | Needs policy | caseService.ts |  |
| R0244 | Barangay Summon: complainant submits details and involved parties; Secretary reviews; forwarded to authorized official for assessment;… | Done | workflows.ts (summon) |  |
| R0245 | Never auto-generate an approved summons immediately after submission | Done | workflows.ts (for_assessment) |  |
| R0246 | Notice of Hearing: Secretary prepares from existing case record and approved schedule; official approves; printed, signed, served;… | Done | workflows.ts (notice) |  |
| R0247 | Generate Summon, Notice of Hearing, Mediation Records, Amicable Settlement, Certificate of Final Action when applicable | Done | pages/cases/CaseRecordPrintPage.tsx |  |
| R0248 | Distinguish document generation, actual delivery and acknowledgment of receipt | Done | documentService.recordDelivery, recordAcknowledgment |  |
| R0249 | Incident Record Form: resident submits; Secretary reviews, verifies, contacts reporter if needed; recorded and forwarded to official;… | Superseded | R0156 | Personnel 'record' workflow exists |
| R0250 | Blotter Report: resident submits; Secretary reviews, verifies, coordinates; forwarded to official; advise Barangay Hall visit for formal… | Superseded | R0156 | Online complaint gets blotterNo immediately (caseService.submitComplaint) |
| R0251 | Blotter: record, generate blotter records, search, history, authorized access | Done | caseService.ts (blotterNo), CasesPage.tsx |  |
| R0252 | Case stages: Filed, Under Review, For Assessment, Mediation Scheduled, Ongoing Mediation, Settled, Referred to Lupon, Lupon Mediation,… | Done | src/types/case.ts (CaseStage) |  |
| R0253 | Staff complaint workflow: Received, For Verification, Under Investigation, Scheduled for Mediation, Resolved / Referred, Closed | Superseded | R0255 |  |
| R0254 | Resident-facing complaint statuses: Submitted, Under Review, In Progress, Resolved, Closed; internal classifications/investigation states… | Partial | lib/residentStatus.ts (caseStageForResident) | Uses Submitted/Processing/Completed |
| R0255 | Complaint statuses: Submitted -> Received -> Under Assessment -> Assigned -> In Progress -> Resolved -> Closed | Needs policy |  | Not adopted |
| R0256 | Mediation statuses: Pending Scheduling -> Scheduled -> Completed -> Agreement Recorded / Unresolved | Needs policy | types/case.ts (Hearing.status) |  |
| R0257 | Hearings and Mediation top total cards: plain white with dark blue text | Done | HearingCalendar / HearingsPage |  |
| R0258 | Remove instructional UI messages like "Closed cases can be removed from this list... can be restored anytime"; present client-ready text… | Done | (text removed) |  |
| R0259 | Blotter/complaint lists prioritize case number, complainant, date, current status, with action menus and protected sensitive info; case… | Done | pages/cases/CasesPage.tsx |  |
| R0260 | "File a report" (My Complaints and Reports) opens the dedicated complaint/report-filing workflow and never redirects to Document Requests;… | Done | App.tsx /my/complaints/new, NewComplaintPage.tsx |  |
| R0261 | Documents and complaints/reports have independent records, reference numbers, forms, validation, attachments, workflows, status histories,… | Done | caseService.submitComplaint |  |
| R0262 | My Complaints and Reports exclusively handles filing complaints, incident reports, community concerns, viewing reports, tracking progress,… | Partial | ResidentPortalPages.tsx (MyComplaintsPage) | No resident reply to info requests on complaints |
| R0263 | Independent report form/flow: report type/category, description, location, date and approximate time, optional evidence/attachments,… | Partial | NewComplaintPage.tsx | No evidence attachments |
| R0264 | Do not require personal info on report submission when the resident is authenticated and verified info is available | Done | NewComplaintPage.tsx |  |
| R0265 | Keep three separate resident report types: complaint against a person, incident report, community concern; do not combine them | Done | caseService.COMPLAINT_CATEGORIES |  |
| R0266 | Complaints against a person stay confidential and are never auto-grouped with public community concerns | Done | caseService.ts, concernService.ts |  |
| R0267 | Incident reports keep their own reference numbers, review and handling process; urgent incidents escalated | Partial | caseService.submitComplaint | No urgent escalation; shares KP numbering |
| R0268 | Complaint scheduling workflow when attendance needed: categorize, check need, personnel decides, schedule, notify parties, conflict check,… | Partial | appointmentService (complaint_consult) | Hearings not conflict-checked against all parties |
| R0269 | Support appointment types: initial consultation, complaint clarification, mediation, barangay conciliation, hearing, follow-up, additional… | Partial | appointmentService.PURPOSES | No clarification or additional-documentation types |
| R0270 | Do not auto-schedule legally significant hearings or conciliation without authorized personnel review and procedural requirements | Done | caseService.scheduleHearing |  |
| R0271 | Hearing and formal mediation changes require authorized personnel review before finalizing | Done | CaseDetailPage.tsx |  |

## Concerns

Done: 25 · Partial: 3 · Frontend only: 3 · Not built: 2

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R0272 | Community concern form: required title/subject, what is happening, location/landmark; optional start date, frequency, details, supporting… | Done | pages/resident/ConcernForm.tsx |  |
| R0273 | Concern categories: Road and infrastructure, Streetlights and electrical, Garbage and sanitation, Drainage and flooding, Water supply,… | Done | src/concerns/engine.ts (CONCERN_CATEGORIES) |  |
| R0274 | Residents can submit a concern without picking a category; system assists classification; do not ask for info already in profile | Done | engine.suggestCategory |  |
| R0275 | Classify incoming concerns and detect/group similar or duplicate reports by issue, meaning, keywords, category, location, time period and… | Done | engine.similarity, conceptsOf | Concept matching, not AI semantic |
| R0276 | Location-aware matching (street, zone, landmark, facility, proximity); same problem on different streets is not auto-grouped; insufficient… | Done | engine.similarity |  |
| R0277 | Similarity confidence levels High/Medium/Low; auto-group only on strong match; medium requires review; low stays separate | Done | engine.similarity (Confidence) |  |
| R0278 | Do not auto-merge sensitive personal complaints, individual disputes, or unrelated incidents just because wording is similar; preserve… | Done | concernService.ts |  |
| R0279 | AI semantic matching must be modular; system works with basic matching and manual review if AI unavailable | Done | engine.ts |  |
| R0280 | Authorized personnel can confirm a match, move a report, separate wrongly grouped reports, merge groups, create a new issue group | Done | concernService.moveSubmission, mergeIssues |  |
| R0281 | Never discard original submissions; keep each linked to the grouped concern with its own reference number and original info so each… | Done | concernService.ts |  |
| R0282 | Do not delete duplicate reports or auto-close complaints for similarity; route emergencies/threats per approved escalation | Done | concernService.ts |  |
| R0283 | Prevent double-submission inflation; distinguish total reports, unique residents reporting, and estimated affected households (only with… | Partial | engine.computePriority | No affected-households estimate |
| R0284 | Count affected residents; priority via transparent rules: urgency (safety, injury, health, hazard, disruption), severity, frequency/count,… | Partial | engine.computePriority | Simplified rules; no vulnerable populations, facility, duration weighting |
| R0285 | Priority levels Critical, High, Normal, Low; do not prioritize by volume alone; a single critical safety/emergency report is not buried… | Done | engine.computePriority |  |
| R0286 | Show a factual explanation for each priority (e.g. "24 reports from 21 residents ... one location"); no unsupported AI explanations; AI… | Done | engine.computePriority (reason) |  |
| R0287 | Authorized personnel can override suggested priority with a recorded reason | Done | concernService.setPriority |  |
| R0288 | Dedicated Community Concerns section for personnel (not overloading main dashboard) with metrics: Critical, High-priority, Open, Resolved… | Done | pages/concerns/ConcernPages.tsx |  |
| R0289 | Grouped issue list/summary shows title, location, "N reports · M unique residents", priority and status badges, assignee/current action,… | Done | ConcernPages.tsx |  |
| R0290 | Opening a group (e.g. "Broken streetlight — 35 reports") shows original reports, reference numbers, dates, descriptions, locations,… | Done | ConcernPages.tsx (ConcernIssuePage) |  |
| R0291 | Show resident personal info in groups only to authorized personnel; residents never see other residents' info; grouping never exposes… | Frontend only | concernService.ts | Server-side RLS needed |
| R0292 | Concern filters: priority, status, category, zone/location, date range, assigned personnel; no unnecessary filters | Partial | ConcernPages.tsx | No date range filter |
| R0293 | Issue management actions: review, verify reports, confirm/correct grouping, set priority, assign, internal notes, record actions, update… | Done | concernService.ts |  |
| R0294 | Personnel workflow: intake, duplicate detection, grouping, assigned department, priority, investigation, action taken, resolution,… | Done | concernService.ts |  |
| R0295 | Route grouped concern to appropriate personnel/department; track progress; notify affected residents on meaningful updates | Done | concernService.assignIssue, setIssueStatus |  |
| R0296 | Issue statuses: Open, Under Review, Action Assigned, In Progress, Resolved, Closed; separate from document, registration, equipment statuses | Done | concernService.ISSUE_STATUS_LABEL |  |
| R0297 | Record assignment: assigned person/office, date assigned, assignment history, expected action date, actual action | Done | concernService.assignIssue |  |
| R0298 | Resolving requires resolution description, action taken, date resolved, evidence if applicable; status change alone cannot mark resolved | Done | concernService.setIssueStatus |  |
| R0299 | Audit who created a group, which reports grouped, who confirmed matches, changed priority, assigned, updated status, resolved, and when | Done | concernService.ts (history) |  |
| R0300 | Data entities: submissions, issue groups, group memberships, categories, assignments, activity history, resolutions, notifications;… | Frontend only | concernService.ts | Supabase tables/RLS not applied |
| R0301 | No unrestricted client-side queries exposing resident info; no duplicate attachment copies; index for growth | Frontend only |  | Needs backend |
| R0302 | Do not merely create a dashboard with sample grouped concerns; implement real logic, relationships, workflows, permissions | Done | concernService.ts |  |
| R0303 | QA tests: 5 similarly worded same-location reports group; different streets not merged; different problems same street separate; single… | Not built |  | No automated test suite in repo |
| R0304 | Community map of concerns, flood-prone areas, public and emergency facilities, infrastructure, filterable by zone, category, date,… | Not built |  | Community map (Release 3) |

## Equipment

Done: 44 · Partial: 7 · Superseded: 6 · Needs policy: 1 · Not built: 1

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R0305 | Equipment record fields: name, description, category, quantity, availability, condition, location, equipment ID/reference number, history | Done | src/types/equipment.ts |  |
| R0306 | Use documented equipment examples (Chairs, Tables, Ladders, Nebulizers); no generic items like laptops, printers, supplies, vehicles | Done | src/mocks/equipment.ts |  |
| R0307 | Property Custodian scope: asset registration and inventory management, check availability, approve/reject borrowing within delegated… | Done | equipmentService.ts, InventoryPage.tsx |  |
| R0308 | Property Custodian only handles actions needing physical inspection, approval or inventory accountability; system computes availability,… | Done | equipmentService (availableFor, runBorrowingJobs) |  |
| R0309 | Track borrower, borrow date, expected return, grace end, actual return, overdue, condition on release/return, damage reports, missing… | Done | types/equipment.ts (Borrowing) |  |
| R0310 | Borrowing history, return tracking, overdue notifications, condition reports, inventory reports | Done | equipmentService, analytics/ServiceReports.tsx |  |
| R0311 | Record all inventory changes in an audit trail | Done | equipmentService.updateEquipment (history, audit) |  |
| R0312 | Preserve inventory info, calculations, CRUD, search/filter/sort; Available/Pending/Borrowed/Reserved/Overdue may overlap; if quantities… | Done | pages/equipment/InventoryPage.tsx (balance warning) |  |
| R0313 | Prevent negative inventory, borrowing unavailable quantities, duplicate equipment records, unrecorded returns and unauthorized adjustments | Done | equipmentService.addEquipment, updateEquipment |  |
| R0314 | Low-stock alerts for supplies; block borrowing when unavailable; keep resident borrowing separate from internal inventory | Partial | equipmentService.requestBorrowing | No supplies or low-stock alerts |
| R0315 | Distinguish total, available, reserved, borrowed, unavailable/damaged inventory; never approve on total inventory alone (e.g. 50 chairs… | Done | equipmentService.availableFor |  |
| R0316 | Auto availability check on submit: item, quantity, available, reserved, borrowed, expected returns, maintenance, overlapping reservations,… | Done | equipmentService.estimateFor |  |
| R0317 | If quantity insufficient, suggest alternative dates or available quantities; prevent double booking and over-allocation | Partial | equipmentService.estimateFor | Gives a ready date; no alternative-quantity suggestions |
| R0318 | Resident borrowing connected to Property Custodian inventory: real-time availability, duplicate reservation prevention, borrowing limits,… | Partial | equipmentService.ts | No borrowing limits |
| R0319 | Equipment record statuses: Available, Pending Request, Reserved, Borrowed, Overdue, Under Maintenance | Done | equipmentService.equipmentStatus |  |
| R0320 | Equipment record statuses: Available, Borrowed, Reserved, Under Maintenance, Retired | Partial | equipmentService.ts | No Retired status |
| R0321 | Staff equipment workflow: Submitted, Under Review, Approved, Scheduled for Release, Borrowed, Returned | Superseded | R0324 |  |
| R0322 | Equipment borrowing statuses: Submitted, Under Review, Approved, Borrowed, Returned, Overdue, Rejected, Cancelled; no document statuses | Superseded | R0324 |  |
| R0323 | Equipment resident statuses: Request Submitted, Availability Checking, Approved, Ready for Pickup, Borrowed, Return Due Soon, Overdue,… | Done | equipmentService.borrowingStage |  |
| R0324 | Equipment statuses: Submitted -> Under Review -> Approved -> Ready for Release -> Borrowed -> Returned -> Completed; plus Rejected,… | Needs policy | equipmentService.borrowingStage | Implemented lifecycle close to this list |
| R0325 | Residents see only current relevant status; custodian/authorized see detailed operational statuses | Done | lib/residentStatus.ts (borrowingStatusForResident) |  |
| R0326 | Every status transition has defined trigger, responsible role, timestamp, notification; no arbitrary status changes | Done | equipmentService.actOnBorrowing |  |
| R0327 | Returned or completed transactions must never be marked overdue | Done | equipmentService.returnState |  |
| R0328 | Borrowing request fields: name, address, equipment, quantity, intended use, date of use/borrowing date, expected return date | Partial | equipmentService.requestBorrowing | No intended-use field |
| R0329 | Borrowing workflow: request, custodian checks availability, approve/reject and notify resident, resident claims at Barangay Hall,… | Done | equipmentService.actOnBorrowing |  |
| R0330 | 15-day borrowing period plus 3-day grace period; show due date, grace period and overdue status clearly; late notices to borrower and… | Superseded | R0331 |  |
| R0331 | Do not assume 15-day borrowing or 3-day grace; if no approved policy exists, flag for configuration | Done | pages/admin/BorrowingPolicyPanel.tsx ("Confirmed by the barangay") | Default 15+3 flagged until confirmed |
| R0332 | Return deadline computed automatically from barangay's approved borrowing rules and actual release date (not submission date), grace only… | Done | equipmentService.actOnBorrowing (release) |  |
| R0333 | Do not invent or auto-impose fines, penalties or replacement payment amounts without officially approved policy; continue reminders at… | Done | equipmentService.sendLateNotice, runBorrowingJobs |  |
| R0334 | Show "Estimated availability: <date>" calculated from inventory, reservations, returns, processing time, hours, holidays, custodian… | Done | equipmentService.estimateFor |  |
| R0335 | If availability can't be calculated, show "Your estimated availability is being determined. We will notify you once your request has been… | Done | equipmentService.ts |  |
| R0336 | Clearly distinguish estimated, confirmed and actual dates; never confuse them | Done | ResidentV2Pages.tsx (BorrowingDetailsPage) |  |
| R0337 | System Admin configures default processing times and operational borrowing rules | Done | BorrowingPolicyPanel.tsx, SchedulingRulesPanel.tsx |  |
| R0338 | After approval, suggest pickup dates/slots per hours and custodian availability, prevent overlaps; staff can confirm/adjust; auto-calc… | Done | appointmentService (equipment_pickup) |  |
| R0339 | Generate pickup, return and inspection appointments for equipment borrowing; reminders before deadline and overdue flags | Done | appointmentService (equipment_pickup, equipment_return) |  |
| R0340 | Release: custodian opens request, verifies identity, confirms items/quantities, records release time and condition, confirms resident… | Done | equipmentService.actOnBorrowing (release checks) |  |
| R0341 | On release, auto-set Borrowed, update inventory, record timestamp, compute return deadline, generate return schedule, notify resident | Done | equipmentService.actOnBorrowing |  |
| R0342 | Auto overdue detection: set Overdue, notify resident and custodian, show overdue duration and original deadline, record event, add to… | Done | equipmentService.runBorrowingJobs |  |
| R0343 | Overdue message: "Your borrowed equipment is overdue. Please return it to the Barangay Hall as soon as possible." | Done | equipmentService.ts |  |
| R0344 | Return: confirm items, quantity, inspect condition, record missing/damaged, return time, notes/evidence | Done | equipmentService.actOnBorrowing (return) |  |
| R0345 | On return, auto-update inventory, recalc availability, close when all accounted, notify resident, keep history | Done | equipmentService.actOnBorrowing |  |
| R0346 | Missing or damaged items create a separate review workflow instead of closing the transaction | Done | types/equipment.ts (review) |  |
| R0347 | Property Custodian dashboard: total, available, borrowed, pending requests, upcoming returns, overdue, damaged, missing, recent transactions | Superseded | R0348 |  |
| R0348 | Custodian dashboard cards: requests needing action, awaiting pickup, scheduled release, borrowed, due today, due in 48h, overdue,… | Done | pages/dashboard/CustodianDashboard.tsx |  |
| R0349 | Equipment Records statuses simplified (no decorative dots/highlights), still easy to distinguish Available, Borrowed, Overdue, etc. | Done | InventoryPage.tsx |  |
| R0350 | Equipment table Status column compact (badges: Available green, Pending Request amber, Borrowed blue, Overdue red, Reserved purple); all… | Superseded | R0354 |  |
| R0351 | Equipment table reduced row height; bold names, muted descriptions, secondary IDs, emphasized total/available/damaged/missing quantities;… | Done | InventoryPage.tsx |  |
| R0352 | Replace oversized "Edit Record" buttons with compact pencil edit action in an aligned Actions column | Done | InventoryPage.tsx |  |
| R0353 | Table styling: subtle dividers, light header, aligned numbers, hover states; mobile uses responsive inventory cards with edit access | Superseded | R0355 |  |
| R0354 | Desktop equipment list shows name, code, total, available and damaged quantity; other details open in the record | Done | InventoryPage.tsx |  |
| R0355 | Mobile equipment list: compact rows/cards with only item name and "N total · N available" summary plus chevron, tap for details, and an… | Done | InventoryPage.tsx |  |
| R0356 | Equipment detail screen/bottom sheet: info, Available, Total, Borrowed, Pending, Reserved, Damaged, Missing, Overdue, borrowing history,… | Partial | InventoryPage.tsx (detail sheet) | No separate damage reports or maintenance history; one history list |
| R0357 | Resident detail page top: request name, reference number, status, last updated; then schedule section (estimate, pickup, release,… | Done | ResidentV2Pages.tsx (BorrowingDetailsPage) |  |
| R0358 | Add an e-commerce-style visual progress tracker with chronological updates | Done | pages/resident/parts.tsx (Progress) |  |
| R0359 | Residents never see staff-only notes, internal risk assessments, or admin discussions | Done | equipmentService (internal history) |  |
| R0360 | Resident can submit requests, view own transactions and dates, get reminders, cancel eligible requests, view return instructions | Done | ResidentPortalPages.tsx, ResidentV2Pages.tsx |  |
| R0361 | Handle conflicts: unavailable, partial availability, late returns affecting reservations, staff unavailable, holidays, cancel, reschedule… | Partial | equipmentService.ts | Staff unavailability and pickup reschedule partly handled |
| R0362 | Schedule changes auto-recalculate affected availability and notify affected residents; never silently change confirmed appointment or… | Done | equipmentService.moveDueDatesOffClosedDays |  |
| R0363 | Test 20 equipment scenarios: available, unavailable, over-quantity, concurrent, post-return availability, staff unavailability, pickup,… | Not built |  | No automated test suite in repo |

## Appointments/scheduling

Done: 31 · Partial: 8 · Not built: 2 · Needs policy: 2 · Frontend only: 2 · Superseded: 1

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R0364 | Dedicated, unified Appointment Management module and scheduling engine for document claiming/verification, in-person registration and… | Partial | AS APPOINTMENT_TYPES | Registration in-person visit not in the engine; hearings shown read-only from cases (hearingsFor) |
| R0365 | Create appointments only when the workflow requires a visit (approved doc -> claiming; mediation complaint -> mediation), linked to their… | Done | AS createAwaitingSchedule, bookPurposeVisit |  |
| R0366 | System determines when appointments are required; Secretary does not create every appointment manually | Done | AS createAwaitingSchedule |  |
| R0367 | Update related transaction statuses automatically only when business rules allow | Done | AS completeFor, recordVerification |  |
| R0368 | Residents can view schedules, select service, book appointment, get confirmation, view queue number, cancel/reschedule when permitted,… | Partial | AP BookVisitPage, MyAppointmentPage | No queue number; reminders in-app only |
| R0369 | Personnel can set schedules, service hours, daily limits, manage walk-ins and scheduled, call next, mark served, monitor waiting times | Partial | src/pages/admin/SchedulingRulesPanel.tsx | No walk-in queue, call next, mark served, waiting-time monitor |
| R0370 | Display current queue, estimated wait (labelled approximate, from historical/current data, never guaranteed), schedule, availability | Not built | none | No live queue or estimated wait display |
| R0371 | Do not require appointments for services officially handled by walk-in | Needs policy |  | Which services are walk-in only |
| R0372 | Resident appointment details: reference, purpose, related transaction, date/time, location, service desk/personnel, expected duration,… | Partial | AP MyAppointmentPage (Details) | Service desk and estimated completion not shown |
| R0373 | Appointment scheduling captures date, available time slot, expected duration, assigned personnel, and additional instructions | Done | AP ScheduleVisitForm | Duration auto-calculated per R0387 |
| R0374 | Booking screen: "Your appointment is ready to schedule!" with calendar marking Available, Fully booked, Unavailable, Selected | Done | AP TimePicker, AS dayOptions |  |
| R0375 | After slot selection show confirmation (service, date, time, location, what to bring, [Confirm Appointment]) then "Your appointment is… | Done | AP TimePicker ("Confirm Appointment") |  |
| R0376 | Appointment notification offers working [Confirm Appointment] and [Request Another Schedule] actions that update the actual appointment… | Partial | AS confirmAppointment, requestReschedule | Actions live on appointment page; notification card itself has no action buttons |
| R0377 | Authorized personnel can assist residents with scheduling | Done | AP AppointmentDetailPage ("Book for the resident") |  |
| R0378 | Resident reschedule/cancel: check availability, reserve new slot only after confirmation, release old slot safely, notify personnel,… | Done | AS rescheduleAppointment, SS assertFree |  |
| R0379 | Never silently cancel an appointment | Done | AS cancelAppointment, flagForClosure |  |
| R0380 | Show only available slots; prevent double booking (including simultaneous attempts), conflicting slots, invalid/out-of-hours times,… | Frontend only | SS freeSlots, assertFree | Simultaneous-booking protection needs server-side validation |
| R0381 | Staff availability accounts for office hours, staff schedules, existing appointments, leave, capacity, breaks, buffers; never overlap per… | Done | SS freeSlots, onLeave, staffHours |  |
| R0382 | If selected staff unavailable, suggest next available staff or slot; do not auto-assign staff outside authorized responsibilities | Done | SS nextAvailable, staffForService |  |
| R0383 | Use deterministic scheduling rules, not AI; calculate availability server-side and revalidate before confirming; store timestamps… | Frontend only | SS (deterministic, configurable) | Availability computed in browser, not server |
| R0384 | Admin/authorized-personnel configurable, RBAC-protected and logged scheduling settings: office hours, working days, holidays, staff… | Done | src/pages/admin/SchedulingRulesPanel.tsx, SS saveSchedulingRules | Stored in localStorage |
| R0385 | Do not invent office schedules; use the actual configured Barangay Hall operating hours | Partial | SS DEFAULT_RULES | 8:00 to 5:00 hours are defaults until barangay confirms |
| R0386 | Do not display example dates or durations as real appointments; use actual saved appointment data | Done | AS ensureSampleVisit (labelled sample) |  |
| R0387 | Remove the manual Expected Duration dropdown (15/30/45 min, 1 hour) from the Secretary's in-person verification interface | Done | AP ScheduleVisitForm |  |
| R0388 | Configurable duration engine considering reason, document types, count, complexity, staff availability, existing schedules | Done | SS estimateDuration |  |
| R0389 | Default durations: Gov ID 10 min; PSA birth cert 15; marriage cert 15; proof of employment 10; proof of address 10; multiple docs 20–30;… | Done | SS DEFAULT_RULES.documentMinutes |  |
| R0390 | Multi-document durations must not simply sum individual document durations | Done | SS extraDocumentMinutes, multiDocumentMin/Max |  |
| R0391 | Duration configured per service type (claiming short, ID verification moderate, mediation longer, hearing per proceedings) | Done | SS DEFAULT_RULES.services |  |
| R0392 | On picking date and staff, auto-calc duration, check hours and existing appointments, list slots, prevent conflicts, compute end time,… | Done | AP StaffSlotPicker |  |
| R0393 | Appointment automation: identify service, check personnel availability, office hours, holidays/closures, conflicts; generate slots;… | Done | AS runAppointmentJobs, SS openTimes | Email/SMS reminders not delivered (no provider) |
| R0394 | Display estimated duration (read-only for Secretary) and expected completion time | Done | AP ScheduleVisitForm |  |
| R0395 | Authorized personnel can override duration/schedule with a required reason; audit trail records original, adjusted, who and when;… | Done | AS overrideDuration |  |
| R0396 | Secretary steps limited to: review reason, review docs, select/confirm date, confirm staff, send/confirm notification | Done | AP ScheduleVisitForm |  |
| R0397 | Auto-assign by service type to configured personnel (claiming staff, Secretary/verifier, registration staff, complaint handler, mediator,… | Done | SS staffForService (roles) |  |
| R0398 | Appointment statuses (msg 132): Awaiting Schedule, Scheduled, Confirmed, Reschedule Requested, Arrived, Verification in Progress,… | Superseded | AS AppointmentStatus | Replaced by R0399 list (used in code) |
| R0399 | Appointment statuses (msg 141): Awaiting Schedule, Pending Confirmation, Confirmed, Reschedule Requested, Rescheduled, Completed,… | Done | AS APPOINTMENT_STATUS_LABEL |  |
| R0400 | Appointment statuses: Requested -> Confirmed -> Rescheduled / Cancelled -> Completed / Missed | Needs policy |  | Conflicts with R0399; barangay to pick status list |
| R0401 | Keep appointment statuses separate from registration, account, document request, complaint and general transaction statuses; each module… | Done | AS AppointmentStatus |  |
| R0402 | Secretary has a "Today's Appointments" section listing only resident name, time, purpose, status; clicking reveals full details | Done | AP TodayAppointmentsPanel |  |
| R0403 | Personnel dashboard "Today's Appointments" summary (total, confirmed, completed, pending) and clickable list "time - service - name" | Partial | AP TodayAppointmentsPanel | Shows today count and to-confirm, not total/confirmed/completed/pending breakdown |
| R0404 | Dashboard also shows upcoming, overdue, unconfirmed appointments and rescheduling requests; separate full calendar view | Partial | AP AppointmentsPage ("Needs action") | No separate overdue/unconfirmed groups on dashboard |
| R0405 | Personnel centralized calendar: today, upcoming, week/month views, filter by service and personnel, free/occupied slots, details,… | Done | AP AppointmentsPage, FreeTimes |  |
| R0406 | Personnel actions on appointments: Mark as Arrived, Start Verification, Mark as Verified, Mark as Not Verified, Mark as No Show,… | Done | AS checkIn, recordVerification, markNoShow |  |
| R0407 | Attendance flow: open, verify identity, mark Arrived/Checked In, perform service, record result, mark Completed; update linked transaction | Done | AP AppointmentDetailPage |  |
| R0408 | No-show marked after configured grace period; notify resident and personnel; Secretary can reschedule or mark No Show; do not auto-reject… | Done | AS runAppointmentJobs (noShowGraceMinutes) |  |
| R0409 | Test unavailable staff, overlapping appointments, multiple documents, rescheduling, cancelled appointments | Not built | none | No automated tests in repo |

## Calendar/closures

Done: 8 · Partial: 3 · Needs policy: 1

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R0410 | Configurable calendar rules: working days, office hours, special working schedules, non-working days, Philippine public holidays,… | Done | src/services/calendarData.ts, src/config/serviceStandards.ts |  |
| R0411 | Do not hardcode yearly holidays permanently; use maintainable, updateable holiday records | Done | CS saveHoliday, removeHoliday |  |
| R0412 | Resident and personnel calendars use the same underlying schedule data (one authoritative scheduling system) | Done | CS calendarEntries |  |
| R0413 | Calendar items (closures, holidays, staff availability, reservations, approved/cancelled/rescheduled appointments, mediation, claiming,… | Partial | AS flagForClosure | No general consistency check across all calendar item types |
| R0414 | Personnel can add office closures, holidays, special schedules, community activities, barangay events, appointment availability, mediation… | Partial | src/pages/calendar/CalendarPages.tsx | Closures/holidays added directly; events only via announcements; no special schedules entry |
| R0415 | Calendar event types: operating hours, closures, national/local holidays, special schedules, document claiming/verification, mediation,… | Partial | CS CalendarKind | Only holiday, closure, event plus appointments/hearings |
| R0416 | Define which calendar events need Chairman approval by event type; routine schedule maintenance should not burden Chairman | Needs policy |  | Which event types need Chairman approval |
| R0417 | Resident calendar shows only relevant items: own appointments, closures, important announcements, community activities, own mediation… | Done | src/pages/calendar/CalendarPages.tsx |  |
| R0418 | Office closure config: closure date, reason, start/end date, partial or whole-day, affected services, public announcement details | Done | CS ClosureInput, addClosure |  |
| R0419 | Office closure: resident calendar auto-displays it; online document requests stay available if supported; processing deadlines account for… | Done | src/services/processingService.ts |  |
| R0420 | Appointments cannot be booked during closures; unavailable slots disappear | Done | src/services/calendarData.ts closedFor |  |
| R0421 | Existing appointments affected by a closure are flagged for rescheduling, never silently cancelled; affected residents notified and given… | Done | AS flagForClosure |  |

## Announcements

Done: 26 · Partial: 3 · Frontend only: 3 · Needs policy: 1

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R0422 | Dashboard announcements show title, date and a short preview, opening to the full announcement; never full text in cards | Done | src/pages/resident/ResidentHome.tsx Announcements | Conflict with list-without-preview noted in inventory |
| R0423 | Resident announcement list shows only: title, small category label, publication date, optional important/urgent indicator (e.g. "Free… | Done | ANP AnnouncementRows |  |
| R0424 | Do not display full description, long instructions, multiple paragraphs, or unnecessary metadata on the announcement listing page | Done | ANP AnnouncementRows |  |
| R0425 | Announcement list uses generous spacing, readable typography, clear touch targets | Done | ANP AnnouncementRows |  |
| R0426 | Urgent announcements get visual priority without making the whole interface overwhelming | Done | ANP AnnouncementRows ("Important" badge) |  |
| R0427 | Residents can mark announcements as read | Partial | ANS getPublished (readBy) | Marked read on open only; no manual mark-as-read |
| R0428 | Clicking an announcement opens a dedicated detail page with Barangay 181 logo, Barangay 181 identification, category, title, publication… | Done | ANP AnnouncementView |  |
| R0429 | Announcement detail shows conditional sections only when applicable: When (dates/schedules), Where (location), What to bring… | Done | ANP AnnouncementView |  |
| R0430 | Provide a dedicated personnel "Announcements" navigation item/module for creating, editing, managing, submitting announcements, separate… | Done | ANP AnnouncementsAdminPage |  |
| R0431 | Announcement management tabs/filters: All, Drafts, Pending Chairman Approval, Approved, Published, Archived | Done | ANP TAB_STATUSES |  |
| R0432 | Management list shows initially only title, category, current status | Done | ANP AnnouncementsAdminPage |  |
| R0433 | Secretary can edit drafts, schedule announcements, view pending approvals, see published ones, archive expired, cancel when necessary | Done | ANP AnnouncementAdminPage |  |
| R0434 | Announcement statuses: Draft -> Submitted for Approval -> Pending Chairman Review -> Approved -> Published, plus Rejected, Returned for… | Partial | ANS AnnouncementStatus | Submitted and Pending Chairman Review merged into one "pending" |
| R0435 | Creation form: required title, category, content (short description + full details), publication date/schedule; optional expiration date,… | Partial | ANP AnnouncementEditorPage | No attachments/images field |
| R0436 | Announcement categories: Public Advisory, Office Schedule, Community Activity, Health and Safety, Emergency Announcement, Government… | Done | ANS ANNOUNCEMENT_CATEGORIES |  |
| R0437 | Use conditional fields: Community Activity shows event date/time/location; Office Schedule shows effective dates and office hours; never… | Done | ANS validate |  |
| R0438 | Form actions: Save Draft, Preview, Submit for Approval | Done | ANP AnnouncementEditorPage |  |
| R0439 | Preview shows exactly how the announcement will appear to residents | Done | ANP AnnouncementView (preview) |  |
| R0440 | Workflow: Secretary creates -> system validates required info -> submits for Chairman approval -> Chairman notified -> reviews ->… | Done | ANS submitForApproval, approveAnnouncement |  |
| R0441 | Enforce announcement approval on the backend, not only via UI restrictions; do not leave creation frontend-only | Frontend only | ANS mutate | Approval enforced in mock service only |
| R0442 | Never publish without Chairman authorization (Secretary must not auto-publish announcements requiring approval); residents never see… | Done | ANS approveAnnouncement, listPublished |  |
| R0443 | Only authorized personnel may create announcements; only authorized approvers may publish | Done | ANS mutate (permissions) |  |
| R0444 | Emergency announcements may have a separate authorized publishing procedure | Needs policy |  | Emergency publishing procedure |
| R0445 | Chairman has dedicated approval area: view pending, open full announcement, preview resident design, Approve, Request Revisions, Reject… | Done | ANP AnnouncementAdminPage |  |
| R0446 | Keep Chairman approval minimal; no multi-page navigation to approve a simple announcement | Done | ANP AnnouncementAdminPage |  |
| R0447 | Require confirmation before publishing | Done | ANP ConfirmDialog |  |
| R0448 | On revision request or rejection, notify Secretary and clearly display the Chairman's comments/reason | Done | ANS requestRevision, rejectAnnouncement |  |
| R0449 | Maintain complete approval history; record every approval, rejection, edit, publication, and who approved/published and when | Done | ANS mutate (history + audit) |  |
| R0450 | Published/approved announcements must never silently change without audit record; determine if material edits require reapproval | Done | ANS revision |  |
| R0451 | On approval, system automatically publishes, displays in Resident Portal, generates resident notifications, records publication date/time | Done | ANS publish |  |
| R0452 | Respect publication schedule: scheduled announcements auto-publish at configured date/time after approval | Frontend only | ANS runAnnouncementJobs | Runs on page load; needs a server job |
| R0453 | Automatically move expired announcements to Archived while preserving history | Frontend only | ANS runAnnouncementJobs | Same: page-load job |
| R0454 | Announcement with event date updates the calendar when applicable | Done | CS calendarEntries (announcementEvents) |  |

## Notifications

Done: 32 · Partial: 19 · Frontend only: 5 · Superseded: 4 · Needs policy: 2 · Not built: 2

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R0455 | In-app first, plus email and SMS when a provider is configured and authorized; history and delivery status; triggered by real events;… | Partial | NS, ES EMAIL_CONFIGURED=false | In-app only; no SMS; no notification preferences |
| R0456 | Centralize notifications: every important event (registration received/approved/rejected, doc received/needs info/approved/ready,… | Partial | per-service notify() in AS, ANS, documentService | No central dispatcher; each module pushes its own |
| R0457 | Notification recipients table: registration submitted (resident + verifier), correction approved/needs verification (resident), doc… | Partial | src/services/documentService.ts, src/services/residentService.ts | Most recipients covered; not verified for every table row |
| R0458 | Users receive only notifications relevant to their account and role responsibilities (Secretary, Chairman, Treasurer, Property Custodian,… | Done | NS getNotifications (userId, permissions) |  |
| R0459 | Avoid duplicate/unnecessary notifications and accidental duplicate email sending (all events incl. announcements); keep notification… | Partial | ANS publish (notifiedAt), AS remindersSent | No global dedupe; no preferences |
| R0460 | Never generate notifications without recording them | Partial | src/mocks/notifications.ts | Recorded in memory only; lost on reload |
| R0461 | Record email delivery state as sent, failed, or pending; allow authorized personnel to resend failed notifications. | Partial | ES EmailStatus, AP EmailStatus | Resend only for registration emails |
| R0462 | Never claim or mark email/SMS sent or delivered unless the service is configured and delivery is confirmed; do not simulate success; keep… | Done | ES sendEmail (not_configured) |  |
| R0463 | If no email service is configured, implement the email integration interface and clearly document the configuration needed. | Done | ES |  |
| R0464 | Generate email notifications if email integration is available | Frontend only | ES | Needs a real email provider |
| R0465 | Add 8-10 realistic sample notifications covering registrations, info updates, clearance requests, approvals, ready for printing, equipment… | Done | src/mocks/demoNotifications.ts | Dev builds only |
| R0466 | Demo notifications kept in a separate removable dataset; no hardcoded counts; real notifications replace demo when available | Done | NS getNotifications (demo only when DEV) |  |
| R0467 | Apply notification design to desktop and mobile using real data; no demo labels or fake notifications in production | Done | NS getNotifications |  |
| R0468 | Each notification shows icon, title, short description, date/time, unread indicator, status/priority where relevant, action link | Superseded | NI | Replaced by R0469/R0471 |
| R0469 | Collapsed notification card: small icon, bold short title, one short info line, subtle relative timestamp, small unread indicator; remove… | Done | NI NotificationItem |  |
| R0470 | Tap to expand smoothly showing reference number, related resident/document/request/case (subject) and one action (View Request, Review,… | Partial | NI NotificationItem | Tap navigates; no expanded reference/subject/action view |
| R0471 | Remove All/Unread/Read tabs, unread/read count badges, "Demo" labels, excess status indicators, subtitles, repeated date/status,… | Done | src/pages/NotificationsPage.tsx |  |
| R0472 | Notification visuals: white/neutral background, soft rounded cards, minimal borders/shadows, no excess colors or badges, not table rows | Done | NI |  |
| R0473 | Group notifications under subtle headings Today, Yesterday, Earlier; no extra tabs or filters | Done | NI (Today/Yesterday/Earlier) |  |
| R0474 | Mobile notifications: full-width compact cards, thumb-friendly, no tables or extra nav | Done | NI |  |
| R0475 | Empty state: subtle icon, "No notifications yet", "You'll see updates here when something needs your attention.", centered | Done | NI NoNotifications |  |
| R0476 | Mark one/all as read, click opens record, unread highlighted, dynamic unread counter, All/Unread/Read filters, newest first | Superseded | NS markRead, markAllRead | Filters dropped per R0471 |
| R0477 | Support mark as read on open, mark all as read, dismiss, open related record/module, preserve history, correct auto-updating unread counts… | Partial | NS markRead, markAllRead, dismiss | Read state and history in memory only |
| R0478 | Do not mark notifications read merely because the panel was opened, unless intended | Done | NI activate |  |
| R0479 | Clicking a notification opens its relevant page / exact transaction; readable messages link to the correct page and transaction | Done | NI (n.link) |  |
| R0480 | Dropdown: heading, unread count, Mark all as read, latest 5, read/unread distinction, View All Notifications link | Done | src/components/layout/NotificationMenu.tsx |  |
| R0481 | Full "Notifications" page with total/unread counts, filters, chronological list, mark-as-read, record navigation, empty states | Superseded | src/pages/NotificationsPage.tsx | Counts/filters dropped per R0471 |
| R0482 | Notifications must be short and say what happened, what to do, and when/where; e.g. "We received your document request.", "Please bring… | Done | AS visitMessage |  |
| R0483 | Do not overwhelm residents with unnecessary reference numbers, technical statuses, or lengthy explanations in notifications. | Done | AS visitMessage | Conflicts with R0488 |
| R0484 | Notify residents when request is received, enters review, needs info, approved, ready, completed, or has an authorized delay; skip… | Partial | src/services/documentService.ts notify | "Enters review" and "completed" notices not confirmed |
| R0485 | Status changes reflected correctly in resident notifications and transaction histories | Done | src/services/documentService.ts |  |
| R0486 | Resident registration notifications use simple messages: received, being reviewed, please visit Barangay 181, submit requested documents,… | Done | src/services/registrationService.ts |  |
| R0487 | Do not expose internal technical verification details to residents in registration notifications. | Done | src/services/registrationService.ts |  |
| R0488 | Each registration notification must include the relevant reference number. | Needs policy |  | Conflicts with R0483 on reference numbers |
| R0489 | On in-person request, generate an email to the applicant's registered email, send via the configured email service, create an in-app… | Frontend only | src/services/registrationService.ts, ES | Email recorded "not sent"; needs provider |
| R0490 | In-person email template: subject "Action Required: Please Visit Barangay 181 for Your Resident Registration"; includes Reason, Please… | Done | src/services/registrationService.ts ("Action Required: Please Visit") |  |
| R0491 | Emails must use actual applicant data and Secretary-provided instructions; never send placeholder values. | Done | src/services/registrationService.ts |  |
| R0492 | If no applicant email exists, show the Secretary an alternative notification option instead of pretending the email was sent. | Done | src/pages/residents/ReviewPages.tsx |  |
| R0493 | Allow the Secretary to preview personalized emails before sending. | Done | src/pages/residents/ReviewPages.tsx |  |
| R0494 | Correction notifications: requester on receipt and on approve/reject; affected adult when someone files on their behalf (where safe);… | Partial | src/services/residentService.ts notifyUserOfResident | Affected-adult and completion notices partly covered |
| R0495 | Notify residents when a correction is received, auto-processed, needs documents, needs in-person visit, appointment scheduled, approved,… | Partial | src/services/residentService.ts | Auto-processed and needs-documents notices not confirmed |
| R0496 | Notify both old and new contact number (and old/new email) on change when appropriate | Not built | none | No notice to old and new contact number/email |
| R0497 | Auto-processed notifications explain what was processed, what changed, when, and next steps | Partial | src/services/residentService.ts ("Your record was updated") | Content not detailed (what/when/next steps) |
| R0498 | In-person notices in simple language: reason, documents to bring, originals needed, location, dates/available times, expected processing… | Done | AS visitMessage, src/services/registrationService.ts |  |
| R0499 | Notify affected personnel of role/permission changes ("Your account permissions have been updated", date, [Review changes]): previous/new… | Partial | src/services/userService.ts approveAccessRequest | No previous/new role detail or [Review changes] |
| R0500 | Also email the affected user about permission changes if a verified email is registered. | Not built | src/services/userService.ts | No email on permission change |
| R0501 | Notify initiating admin on approval with affected account, previous role, new role, approver, date/time, security reference number; also… | Partial | src/services/userService.ts | Approval notice yes; expiry notice not confirmed |
| R0502 | Notify second approver when approval assigned, already approved/rejected by another admin, expired, or cancelled | Partial | src/services/userService.ts createRequest | Assigned/closed yes; expired/cancelled not confirmed |
| R0503 | Permission-change notifications must not reveal OTPs, credentials, confidential security details, or unrelated personal info | Done | src/services/userService.ts |  |
| R0504 | Support in-app and email (where configured); on email failure preserve event, record failure, retry with controlled mechanism, notify… | Frontend only | src/services/userService.ts | Email retry needs backend |
| R0505 | Concern notifications to resident: linked ("Your concern has been linked to an existing community issue..."), action started, resolved;… | Done | src/services/concernService.ts |  |
| R0506 | Announcement notifications: in-app, email when valid email exists, optional SMS when a supported provider is configured | Partial | ANS publish | In-app for all; email only for urgent; no SMS |
| R0507 | On scheduling, resident gets "In-person verification required" notification with date, time, expected duration, location (Barangay 181… | Done | AS visitMessage |  |
| R0508 | On confirmation, auto-generate email to resident with name, reason, date, time, location, docs, duration, rescheduling instructions,… | Frontend only | AS tellResident, ES | Email recorded not sent |
| R0509 | Resident appointment notifications: scheduled, confirmation reminder, approaching, rescheduled/changed, cancelled, verification completed,… | Done | AS visitMessage, runAppointmentJobs |  |
| R0510 | Personnel notifications: new appointment scheduled/assigned, resident confirmed, reschedule requested, resident arrived, appointment… | Partial | AS notify | Missed and confirm yes; resident-arrived notice not confirmed |
| R0511 | Configurable appointment reminders with defaults of one day before and one hour before | Superseded | SS ServiceRule.reminders | Replaced by R0512 |
| R0512 | Appointment reminders: immediately after confirmation, 24h before, 2h before when supported; via in-app, email, SMS if configured | Partial | SS DEFAULT_RULES | Per-service defaults 1d/day/1h, not 24h/2h; no email/SMS |
| R0513 | Reminder copy e.g. "Reminder: Your appointment is tomorrow."; confirmation includes "Please arrive 10 minutes early" | Done | AS visitMessage |  |
| R0514 | Notify borrowers and personnel of late equipment returns | Done | src/services/equipmentService.ts |  |
| R0515 | Pickup notice includes date, time, location, equipment, quantity, instructions, ID/documents to bring | Partial | src/services/equipmentService.ts | Pickup notice contents not fully verified |
| R0516 | Equipment reminders: submission, approval, ready, before pickup, release, 48h before, 24h before, on deadline, immediately overdue | Done | src/services/equipmentService.ts DEFAULT_POLICY |  |
| R0517 | Send via in-app and email where supported; record notification delivery status | Frontend only | ES | Email delivery needs provider |
| R0518 | Hearing reminders with configurable intervals (do not assume an interval) | Needs policy | src/pages/admin/AdminPages.tsx (KP.reminderDaysBefore) | Interval fixed at 1 day until confirmed |

## Security/permissions/2-person/step-up

Done: 57 · Frontend only: 38 · Partial: 24 · Not built: 10 · Needs policy: 8 · Superseded: 4

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R0519 | Centralized granular RBAC: per-module actions (View, Create, Edit, Delete, Submit, Verify, Process, Approve, Reject, Issue, Export, Print,… | Frontend only | PERM | Server-side enforcement needed |
| R0520 | Reviewable role-permission matrix on the system side where admins set what each role can do, using permission ids (residents.view,… | Done | src/pages/admin/AdminPages.tsx (role manager) |  |
| R0521 | Apply permission scopes: own, assigned, department, barangay-wide, restricted records | Partial | AS mayHandle, case assignment | No department scope |
| R0522 | Deny by default: new accounts have no permissions until role assigned; no role auto-receives permissions; unknown/undefined permissions… | Frontend only | SS can | Deny-by-default in mock only |
| R0523 | Mandatory controls: least-privilege RBAC with specific permission checks, server-side authorization, secure sessions and passwords,… | Frontend only | src/services/stepUp.ts | No OTP/MFA, rate limiting |
| R0524 | Least privilege: do not assume every official or personnel needs every module; each gets only the modules and information required for… | Done | PERM |  |
| R0525 | Every staff account must have an explicitly assigned role; apply least privilege with a specific responsibility per role | Done | src/types/auth.ts RoleId |  |
| R0526 | Distinct experiences for Chairman, Secretary, seven Kagawads, SK Chairman, Property Custodian, Resident, System Administrator; role… | Superseded |  | Replaced by R0529 |
| R0527 | Separate permissions for Chairman, Secretary, Authorized Personnel, Kagawads, Treasurer, Property Custodian, Residents | Superseded |  | Replaced by R0529, R0530 |
| R0528 | Audit all 8 roles (System Admin, Chairman, Secretary, Kagawad, Treasurer, Property Custodian, Authorized Personnel, Resident):… | Done | docs/PERMISSION_MATRIX.md |  |
| R0529 | Use only seven roles: System Administrator, Barangay Chairman, Barangay Secretary, Barangay Kagawad, Barangay Treasurer, Property… | Partial | src/types/auth.ts RoleId | Six roles; Treasurer deliberately removed (PATCH_NOTES), not by a requirement ID |
| R0530 | Remove "Authorized Personnel" role everywhere (login, account creation, user management, role dropdowns, role switching, permission… | Done | src/types/auth.ts |  |
| R0531 | Authorized Personnel has configurable permissions assigned by admin, empty by default until an assignment specifies department/function,… | Superseded |  | Replaced by R0530 |
| R0532 | Identify roles (Chairman, Secretary, Treasurer, Kagawad, Property Custodian, Authorized Case Handler/Personnel, System Admin, Resident);… | Superseded |  | Replaced by R0529 |
| R0533 | Do not expose unnecessary roles in the interface | Done | PERM |  |
| R0534 | Validate role responsibilities against Philippine law and local procedures; do not fabricate official responsibilities, government… | Needs policy |  | Legal validation of role duties |
| R0535 | Document any permissions that require formal barangay authorization | Needs policy |  |  |
| R0536 | System Administrator manages user accounts (create/edit, activate/deactivate, disable compromised), role/permission assignment,… | Done | src/pages/admin/UserAccountsPage.tsx |  |
| R0537 | System Administrator gets no operational authority by default: cannot approve… | Done | PERM system_admin |  |
| R0538 | Chairman can view operational dashboards, barangay-wide/resident and financial summaries, reports, executive analytics, personnel activity… | Done | src/pages/dashboard/ChairmanDashboard.tsx |  |
| R0539 | Chairman cannot edit official resident master records unless explicitly authorized, change technical settings/DB config or receive System… | Done | PERM chairman |  |
| R0540 | Secretary manages resident masterlists/households within authority, verifies registrations, processes document requests and issues… | Done | PERM secretary |  |
| R0541 | Secretary has no System Administrator functions: cannot manage admin accounts, change other users' roles or security settings/admin… | Done | PERM secretary |  |
| R0542 | Secretary must not accidentally receive Chairman permissions; do not give every personnel account same privileges | Done | PERM |  |
| R0543 | Kagawad permissions are configurable by committee/assigned responsibility per barangay-confirmed duties; no unrestricted access to… | Needs policy | US setExtraPermissions | Committee duties to be confirmed |
| R0544 | Kagawad can view relevant community statistics and concerns, assigned committee info/programs/projects, review… | Partial | PERM kagawad | No committee reports/programs |
| R0545 | Kagawad cannot access full resident database, unrestricted PII or private documents, approve document requests, issue certificates, manage… | Done | PERM kagawad |  |
| R0546 | Kagawad and other authorized personnel access only analytics/reports permitted by their assigned roles | Done | PERM |  |
| R0547 | Add "Barangay Kagawad" account type on the account-type page, separate from Authorized Personnel | Done | src/config/accountTypes.ts |  |
| R0548 | Treasurer manages financial records, collections/payments and official receipts, authorized expenses, income/expenditure, financial… | Not built | none | Treasurer role removed (PATCH_NOTES); confirm decision |
| R0549 | Treasurer cannot edit resident masterlists, approve registrations, approve/issue certificates or clearances, manage complaints, modify… | Not built | none | Same as R0548 |
| R0550 | Property Custodian can add/update equipment and property records, record borrowing, process returns, record damaged/missing items, track… | Done | src/services/equipmentService.ts |  |
| R0551 | Property Custodian sees only resident data needed for borrowing; no access to master records/PII, treasury/finance, document approvals,… | Done | PERM property_custodian |  |
| R0552 | Resident can view own profile and household (within privacy rules), update permitted info, request eligible documents, file… | Done | src/pages/resident/ |  |
| R0553 | Residents access only own records: cannot search masterlist, view other residents/households, internal dashboards/analytics/admin reports,… | Frontend only | services ownership checks | Needs RLS |
| R0554 | Residents only access own records and authorized household information; verify household-level access separately from resident-level | Frontend only | src/services/residentService.ts | Needs RLS |
| R0555 | Protect confidential case info; residents see only case information they are authorized to access | Done | src/services/caseService.ts | Mock-level |
| R0556 | Prevent applicants from accessing another person's registration. | Done | src/services/registrationService.ts | Mock-level |
| R0557 | Role responsibilities: Secretary creates/submits announcements, processes documents, manages resident records, admin updates; Chairman… | Done | PERM |  |
| R0558 | Restrict sensitive complaints to authorized personnel; do not expose all complaint details to every barangay role | Done | src/services/caseService.ts (Kagawad assigned only) |  |
| R0559 | Restrict access to sensitive records; give special attention to VAWC records, health information, identity documents | Partial | PERM | No specific VAWC/health record handling |
| R0560 | Chairman or authorized administrator can assign personnel and manage permissions | Needs policy | SEC | Conflicts with admin-only role management |
| R0561 | Role assignment controlled by authorized admins; role changes logged and approved | Done | US createRequest, approveAccessRequest |  |
| R0562 | Migrate existing account permissions safely and require revalidation of existing privileged accounts | Not built | none | No revalidation of existing privileged accounts |
| R0563 | Frontend role simulation with mock users only as a dev-only Role Preview: hidden from ordinary users, test env only, labeled simulation,… | Done | src/components/layout/TestAccountBar.tsx |  |
| R0564 | Remove "Viewing as" role switching for ordinary users in production; show user's actual assigned role; no selecting a more privileged role | Done | src/components/layout/TestAccountBar.tsx | Test accounts only |
| R0565 | Role switching must not grant permissions beyond the selected role | Done | src/components/layout/TestAccountBar.tsx |  |
| R0566 | No per-role credentials or auth rules unless confirmed; role selection is not authorization, which must be verified by backend | Frontend only | src/services/authService.ts |  |
| R0567 | Remove all demo accounts: heading, instructions, buttons, auto sign-in, hardcoded credentials, bypass shortcuts; no replacement test… | Done | src/pages/public/RoleLoginPage.tsx |  |
| R0568 | Login form has frontend validation; no fake success messages or auto-redirect to dashboards until backend auth exists | Frontend only | src/services/authService.ts | Mock credential store |
| R0569 | No user can promote themselves or grant beyond their own administrative scope, change own role via profile settings, modify own approval… | Frontend only | US setRole ("cannot change your own role") |  |
| R0570 | Enforce authorization server-side on every protected endpoint and at nav, route, API, database-query, file-storage and sensitive-action… | Frontend only | src/auth/guards.tsx |  |
| R0571 | Protected routes and record ownership checks: typing another module/admin URL or sending a modified frontend request grants no access;… | Frontend only | src/auth/guards.tsx |  |
| R0572 | Navigation (incl. mobile) is generated from the user's actual permissions and never displays modules the user is not authorized to access | Done | src/components/layout/Sidebar.tsx, BottomNav.tsx |  |
| R0573 | Every protected/privileged operation verifies authenticated requester, active account, valid session, role and exact-action permission,… | Frontend only |  |  |
| R0574 | Deny-by-default authorization; derive identity from verified session/token; never trust frontend-submitted role/permission values; reject… | Frontend only |  |  |
| R0575 | API endpoints prevent unauthorized access, IDOR, privilege escalation, unauthorized modification/deletion, parameter tampering, forged… | Frontend only |  |  |
| R0576 | When Supabase is connected: RLS policies on protected tables, residents limited to own records, personnel to authorized records,… | Frontend only | docs/supabase/ | SQL designs not applied |
| R0577 | Residents get an authorization error on direct URL/API/manipulated requests for the five restricted services | Frontend only | src/services/documentService.ts | Service-layer refusal only |
| R0578 | Status changes are permission-controlled per role; residents may submit, respond to info requests, cancel eligible pending requests;… | Done | src/services/documentService.ts | Mock-level |
| R0579 | Only authorized admins modify service configuration; changes audit-logged | Done | src/pages/admin/ServiceStandardsPanel.tsx |  |
| R0580 | Deny cases: Kagawad opens full resident DB; Treasurer edits resident; Custodian views finance; Resident views another profile; Secretary… | Frontend only |  |  |
| R0581 | Test every role independently with direct API requests, modified client requests, direct URLs/route manipulation, exports and record… | Not built | none | No role/API tests |
| R0582 | Login with username/password, secure logout, password change, and password reset via approved secure process that works end to end | Partial | src/pages/public/ForgotPasswordPage.tsx | Reset is a request to admin; no end-to-end reset |
| R0583 | Role-aware redirect after login to the correct dashboard | Done | src/auth/AuthContext.tsx |  |
| R0584 | Track login attempts; temporarily lock account after repeated failures but never permanently lock users out after a few accidental… | Partial | src/services/authService.ts | Lock after 5 failures is permanent until admin reset |
| R0585 | Server-side authentication: secure sessions (validation, expiry, fixation prevention, expiring tokens, replay protection), password… | Frontend only |  |  |
| R0586 | Automatic logout after configurable inactivity, session-expiration handling with a clear expiry notice, secure handling of multiple… | Partial | src/auth/AuthContext.tsx | 30 min fixed in config, not admin-configurable |
| R0587 | Logout shows a confirmation dialog "Log out?" / "Are you sure you want to log out of your account?" with Cancel and Log Out; destructive… | Done | src/components/layout/Sidebar.tsx ("Log out?") |  |
| R0588 | On logout: invalidate session via auth provider, clear sensitive client data and protected cache, block back-navigation to protected… | Frontend only | src/auth/AuthContext.tsx |  |
| R0589 | Revoke or revalidate existing sessions after critical permission changes; role changes take effect consistently across all sessions | Frontend only | US approveAccessRequest | Users told to sign in again |
| R0590 | Protect against repeated failed logins, wrong OTPs, unusual permission changes, unauthorized page/record access, suspicious sessions,… | Partial | src/services/authService.ts | Lockout only; no rate limits or alerts |
| R0591 | Classify all actions into three levels: Level 1 normal (no OTP, no extra confirmation), Level 2 important (confirmation), Level 3 critical… | Partial | src/components/ui/StepUpDialog.tsx | Level 3 uses password, not OTP |
| R0592 | Level 2 actions (approve/reject, forward to Chairman, change resident info, update records, mark complete, issue documents) show a short… | Done | src/components/ui/ConfirmDialog.tsx |  |
| R0593 | Require a reason for sensitive rejections or corrections. | Done | services (reason required) |  |
| R0594 | Level 3 critical actions (role changes, granting privileged rights, removing privileges, sensitive access changes, disabling… | Frontend only | src/services/stepUp.ts | Password step-up instead of OTP |
| R0595 | OTP is cryptographically secure, verified server-side, never stored in plaintext or logged, expires within ~5 minutes, single-use… | Frontend only | src/services/stepUp.ts | OTP not implemented |
| R0596 | Bind OTP challenge to acting user, target account, intended action, requested changes, expiry, and unique challenge ID; changing the… | Frontend only | src/services/stepUp.ts fingerprint | Bound challenge done for password |
| R0597 | Never reveal whether a guessed OTP is partially correct; OTP cannot be bypassed via direct navigation or API requests. | Frontend only |  |  |
| R0598 | OTP screen: "Verify it's you", "Enter the verification code to confirm this security change.", input, [Verify and continue], resend code,… | Partial | src/components/ui/StepUpDialog.tsx | Asks password, not a code |
| R0599 | Prefer phishing-resistant MFA (passkeys/security keys or authenticator) for System Admins/privileged accounts, with email OTP only as… | Not built | none | No passkeys/authenticator MFA |
| R0600 | Require two-person approval for: granting System Admin, promotion to higher role, sensitive resident data access, restricted records… | Partial | US | Two-person only for role/permission changes |
| R0601 | Two-person flow: initiating admin completes fresh re-auth + server-side OTP and submits; pending record created; second admin notified,… | Frontend only | US, SEC | Password not OTP |
| R0602 | Make the list of two-person-approval operations configurable via a protected security policy; no ordinary permission change can remove the… | Not built | SEC (read-only config) | List not configurable |
| R0603 | Privileged change is not applied immediately: create pending approval record, preserve current permissions, show pending state in security… | Done | US createRequest | Mock-level |
| R0604 | Second approver authenticates independently with fresh OTP, reviews requester, affected account, current/requested permissions and reason,… | Frontend only | SEC StepUpDialog |  |
| R0605 | Initiator cannot approve own request; affected account cannot approve own permission change/escalation; two accounts of the same identity… | Done | US approveAccessRequest |  |
| R0606 | Apply approved permission change atomically (approval record, permission change, audit event consistent); roll back on any failure | Frontend only |  |  |
| R0607 | Show clear success/rejection result; do not claim permission change succeeded until backend confirms | Frontend only |  |  |
| R0608 | Approval requests expire automatically; initiator can cancel before approval; rejection requires a reason; prevent duplicate approvals and… | Done | US cancelAccessRequest, rejectAccessRequest |  |
| R0609 | Apply similar safeguards to other high-risk permission changes based on sensitivity; critical changes require confirmation from affected… | Partial | US | Only role/permission changes covered |
| R0610 | High-impact automation rule changes require two-person approval, OTP/strong auth, notification to affected personnel, immutable audit log | Not built | SS saveSchedulingRules | Rule changes saved without second approver |
| R0611 | Separation of duties: no self-approval of sensitive transactions; separate sysadmin from operational authority; independent approval for… | Done | US approveAccessRequest, ANS approveAnnouncement |  |
| R0612 | Prevent unauthorized removal of the last active System Administrator; admin cannot remove own last effective admin access; safeguards… | Partial | US setStatus, setRole | Self-blocks only; no last-admin check |
| R0613 | Admin cannot silently alter approval rules; suspicious escalation attempts logged; repeated failed OTP triggers protection; disabled… | Partial | US (self-approval logged) | No repeated-failure protection for approvals |
| R0614 | Emergency/break-glass privileged access requires documented justification, limited records, expiration, alerting/admin notification, full… | Not built | none |  |
| R0615 | Provide secure admin recovery procedures that cannot bypass verification | Not built | none |  |
| R0616 | Provide an "I don't recognize this change" option leading to a secure account-security reporting process. | Not built | none |  |
| R0617 | Build Access Management page: accounts, roles, status, departments, permission overview, role assignment history, pending access requests,… | Partial | src/pages/admin/UserAccountsPage.tsx, SEC | No departments or assignment history view |
| R0618 | Admin user view shows full name, current role, current permissions, account status, last login and available changes, so admin sees… | Done | src/pages/admin/UserAccountsPage.tsx |  |
| R0619 | Permission change screen/flow: select user, show current vs requested role and permissions as Before/After highlighting added/removed,… | Partial | SEC, src/pages/admin/AdminPages.tsx | Before/after and reason yes; password not OTP |
| R0620 | User and role management: concise role names, clear permission controls, no technical security info shown to unauthorized users | Done | src/pages/admin/UserAccountsPage.tsx |  |
| R0621 | System Admin security dashboard: pending approvals (requester, affected account, permission, date, review action) and recent permission… | Done | SEC |  |
| R0622 | Security dashboard shows security activity (failed logins, failed OTPs, suspicious privilege changes, disabled accounts, expired… | Partial | SEC | No failed-OTP data; limited security activity |
| R0623 | Confirmation dialogs are short, Apple-style, with large buttons (e.g. "Change user permissions?", "Delete this record? This action cannot… | Done | src/components/ui/ConfirmDialog.tsx |  |
| R0624 | Audit log covers logins/logouts and failures, record views and changes, create/update/approve/reject, registration decisions, document… | Partial | src/services/auditService.ts | In-memory, tab only |
| R0625 | Centralized security audit log records login success/failure, logout, session expiry, OTP requested/verified/failed,… | Partial | src/services/auditService.ts | No OTP events (no OTP) |
| R0626 | Each audit event records acting user ID and role at the time, affected user, action, module, record reference, previous/new values,… | Partial | src/services/auditService.ts | No previous/new values or request id |
| R0627 | Audit logs are append-only: nobody (incl. admins and ordinary operational users) can edit/delete entries or erase own actions; ordinary… | Frontend only | src/services/auditService.ts | Needs append-only server log |
| R0628 | Never log passwords, OTP values, tokens, ID images, or unnecessary sensitive document contents | Done | src/services/auditService.ts |  |
| R0629 | Audit-log viewing and modification of identity documents and access to sensitive documents (e.g. submitted IDs); only staff with… | Frontend only | src/pages/residents/ReviewPages.tsx (reveal logged) |  |
| R0630 | Record every registration review action (approval, rejection, verification request, in-person completion) in the audit history. | Done | src/services/registrationService.ts |  |
| R0631 | Audit trail for appointments: requester, scheduler, original date, rescheduled dates, confirmation, arrival time, verification result,… | Done | AS history |  |
| R0632 | Correction audit record: resident ID, request ID, field, previous/new value, auto or manual, staff/system ID, verification results,… | Partial | src/services/residentService.ts | Field-level before/after record not confirmed |
| R0633 | Audit: submitter, verifier, auto or not, rule applied, passed/failed conditions, changes, time, manual approver, system vs human;… | Partial | src/services/residentService.ts | Rule/conditions not stored |
| R0634 | Any equipment staff override is audit-logged with reason and responsible user | Partial | src/services/equipmentService.ts | Override reason logging not confirmed |
| R0635 | Data Privacy Act (RA 10173): privacy notice and consent at registration (record acceptance and version), lawful basis, data minimization,… | Needs policy | src/pages/public/RegisterPage.tsx (consent) | Retention, DPO, NPC items need barangay |
| R0636 | Collect only data needed for the selected service; no duplicate IDs, unrelated details, unnecessary family info or repeated addresses;… | Done | src/pages/resident/RequestFormPage.tsx |  |
| R0637 | Apply data minimization; protect PII in transit and storage; unauthorized users cannot export or download personal information; no… | Frontend only |  | Encryption needs backend |
| R0638 | Protect IDs, birthdates, addresses, contacts, household, financial, complaint and blotter data; never store sensitive data or secrets in… | Frontend only |  |  |
| R0639 | Do not expose mobile numbers, complete birthdates or other PII in aggregate charts; restrict identifiable records to authorized personnel | Done | src/analytics/compute.ts |  |
| R0640 | Never expose resident records through public-facing dashboard views | Done | src/pages/public/HomePage.tsx |  |
| R0641 | Do not geocode addresses or show exact household locations on a public-facing map | Done | none (no map/geocoding) |  |
| R0642 | Mask ID numbers by default (incl. registration review) with authorized reveal; store ID type, expiry, upload date, verification… | Done | src/components/identity/IdOnFile.tsx |  |
| R0643 | Integrate analytics with existing RBAC; do not create duplicate roles | Done | PERM |  |
| R0644 | Secretary can view full registration submissions, inspect IDs, review verification, compare with records, request in-person verification,… | Done | src/pages/residents/ReviewPages.tsx |  |
| R0645 | Chairman can view registration decisions, review escalated/disputed applications, and has extra approval authority only if configured; not… | Needs policy |  |  |
| R0646 | Kagawad accesses only committee-assigned records/tasks and authorized case info; cannot approve registrations by default or browse all… | Done | PERM kagawad |  |
| R0647 | Appointment RBAC: Secretary reviews/schedules/verifies; Chairman only permitted actions; System Admin manages config and permissions but… | Done | AS mayHandle, kindsFor | Mock-level |
| R0648 | Unauthorized personnel cannot mark sensitive proceedings completed | Done | AS mayHandle | Mock-level |
| R0649 | Appointment security: RLS, server authz, RBAC, validated creation, secure assignment, conflict prevention, audit, residents own/household… | Frontend only | docs/supabase/scheduling.sql |  |
| R0650 | Server-side authorization per role for corrections: residents own records, clerks assigned tasks, Secretary within authority, Chairman per… | Frontend only |  |  |
| R0651 | Sensitive correction actions require appropriate authentication; record all admin actions; prevent direct API/database updates | Frontend only |  |  |
| R0652 | Unauthorized approval attempts are rejected by the server and recorded as security events | Frontend only | US (failure audited) |  |
| R0653 | Enforce contact-number uniqueness at database level with atomic transaction to block simultaneous claims | Frontend only |  |  |
| R0654 | RA 10173 review before automated decisions: document purpose, data minimization, resident notice, retention, human review path,… | Needs policy |  |  |
| R0655 | Do not implement automated decisions with legal effects solely through automation without meeting legal requirements | Needs policy |  |  |
| R0656 | Equipment RBAC: Custodian inventory/release/return/damage; Secretary relevant requests and approvals; Admin rules, schedules,… | Frontend only |  |  |
| R0657 | Conduct security review against RA 10173, NPC guidelines, OWASP ASVS 5.0, NIST CSF 2.0 (authN, authZ, permissions, privilege escalation,… | Partial | docs/SECURITY_REPORT.md | Review document exists; not a full ASVS/NIST audit |
| R0658 | Do not introduce fake OTP verification, fake notifications, or frontend-only security simulations; identify missing backend dependencies… | Done | src/services/stepUp.ts |  |
| R0659 | Do not claim production security readiness until real auth, backend authorization, database policies and verification flows are tested,… | Frontend only |  |  |

## Uploads/storage/Supabase

Done: 26 · Frontend only: 22 · Partial: 11 · Not built: 4 · Needs policy: 2

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R0660 | Audit and optimize every document upload feature across the system for minimal storage use; do not assume unlimited storage | Done | UC, UP |  |
| R0661 | Avoid unnecessary file uploads; store only necessary information; never expose sensitive resident records through public endpoints | Frontend only | FS | No public endpoints exist yet; needs backend |
| R0662 | Only a de-identified (no-names) masterlist snapshot may be bundled in the app | Done | src/analytics/snapshot.ts |  |
| R0663 | Encrypt ID photos and selfies in transit and at rest; restrict image access and block unauthorized downloads; delete temporary… | Frontend only | FS | Encryption at rest needs backend; retention needs policy |
| R0664 | Accept only feature-needed formats: PDF, JPG/JPEG and PNG (PDF for official documents/scanned IDs; JPG/PNG for ID photos and supporting… | Done | UC UPLOAD_TYPES |  |
| R0665 | Reject DOC/DOCX, XLS/XLSX, PPT/PPTX, ZIP/RAR, EXE, SVG, GIF, MP4/MOV, HEIC/HEIF, JS, HTML and any unsupported, executable, script or… | Done | UP sniff, checkUpload |  |
| R0666 | Purpose-based allowlist: accept only necessary formats per document type/purpose, not merely what the browser supports; no arbitrary file… | Partial | UC | One global allowlist, not per document purpose |
| R0667 | Any additional format genuinely required by an official workflow must be justified and configured separately per workflow | Not built | UC | No per-workflow format config |
| R0668 | When a resident selects an unsupported format, explain which formats are accepted | Done | UP checkUpload |  |
| R0669 | Offer a simple option to convert HEIC photos to JPEG before upload, if technically feasible | Partial | UP checkUpload (HEIC message) | HEIC rejected with instructions; no conversion |
| R0670 | File size limits: PDF max 5 MB, JPG/JPEG max 2 MB, PNG max 2 MB, total attachments max 10 MB per transaction | Done | UC (PDF 5 MB, images 2 MB, 10 MB total) | Conflicts with R0671/R0672 |
| R0671 | Recommended starting limits: individual image max 5 MB, individual PDF max 5 MB, total per submission max 10 MB; limit attachment count… | Needs policy | UC | Conflicting limits (R0670 vs R0671 vs R0672) |
| R0672 | Configurable per-feature size limits: ID photos 2 MB, supporting photos 3 MB each, PDFs 5 MB each | Partial | UC | ID 2 MB yes; no separate 3 MB supporting-photo limit |
| R0673 | Make file size limits configurable in one central location (per feature); do not scatter hardcoded limits across pages | Partial | UC | Central yes; not per feature |
| R0674 | Reject files exceeding the limit before uploading, with message "File is too large. Maximum size is 5 MB." using the format-appropriate… | Done | UP checkUpload |  |
| R0675 | Validate extension, real MIME type/file signature, size and count on client and repeat on server; never trust browser metadata or filename… | Frontend only | UP sniff | Server re-validation needed |
| R0676 | Sanitize filenames and prevent path traversal; use secure storage paths | Done | UP sanitizeName |  |
| R0677 | Before upload, resize oversized images and compress JPEGs while preserving readability and enough resolution for ID verification and OCR | Done | UP optimizeImage |  |
| R0678 | Strip unnecessary image metadata, including GPS information, before upload | Done | UP optimizeImage (re-encode drops EXIF) |  |
| R0679 | Do not aggressively compress text/ID details, alter official document contents, or compress PDFs in a way that damages readability | Done | UP optimizeImage (PDFs untouched) |  |
| R0680 | Prevent duplicate uploads of the same file where possible | Done | FS saveUpload (sha256 dedupe) |  |
| R0681 | Avoid creating unnecessary image thumbnails or duplicate copies of files | Done | FS |  |
| R0682 | Upload UI is minimal: e.g. "Valid ID" with badge "Valid ID on file" / "No upload required"; or "Upload valid ID", "PDF, JPG or PNG ·… | Done | src/components/identity/IdOnFile.tsx, UC UPLOAD_HINT |  |
| R0683 | Allow preview before submitting: after selecting a file, show filename, file size, preview, a remove option, and clear validation errors | Done | src/components/ui/FileField.tsx |  |
| R0684 | Show clear upload progress and clear upload error messages | Partial | src/components/ui/FileField.tsx ("Preparing…") | No byte-level progress (no real upload) |
| R0685 | Upload UI avoids long explanations, multiple unnecessary upload boxes, technical storage terms, repeated instructions and unnecessary badges | Done | src/components/ui/FileField.tsx |  |
| R0686 | On mobile, allow selecting a photo from the device or taking a picture when supported | Partial | src/pages/public/RegisterPage.tsx (capture) | Camera capture only in registration |
| R0687 | Reuse a resident's verified valid ID on file instead of requesting repeated uploads; do not store another ID copy per transaction | Done | src/components/identity/IdOnFile.tsx |  |
| R0688 | Request ID upload/replacement only when ID is missing, expired, invalid, unreadable, failed verification, rejected (explain why), or no… | Done | src/config/idTypes.ts, IdOnFile.tsx |  |
| R0689 | Display only a simple indicator "Valid ID on file" or "Updated ID required" without exposing sensitive document details | Done | src/components/identity/IdOnFile.tsx |  |
| R0690 | For ID documents without an expiration date, do not invent one; use the document's actual validity rules | Done | src/config/idTypes.ts |  |
| R0691 | Upload pre-screening: format, size, readability, required info, OCR, compare to record, expiry, inconsistencies, duplicate submissions,… | Partial | src/lib/idOcr.ts, src/services/identityService.ts | Format/size/OCR/expiry yes; record-mismatch and duplicate screening partial |
| R0692 | Pre-screen outcomes: accepted, needs clearer image, expired, missing info, does not match record, possible duplicate, requires manual… | Partial | src/services/identityService.ts | Not all seven outcomes present |
| R0693 | Do not auto-approve high-risk identity changes on OCR, image recognition or AI confidence scores alone | Done | src/services/identityService.ts |  |
| R0694 | Never store file binaries or base64 contents in PostgreSQL/database records; use Supabase Storage for files and the DB for metadata only | Frontend only | FS | Browser storage stands in for Supabase Storage |
| R0695 | Store resident IDs and sensitive documents in private Supabase Storage buckets with authenticated uploads, server-side validation,… | Frontend only | FS openFile (short-lived URL) |  |
| R0696 | Document metadata stores only: document ID, resident ID, category, original filename, storage path, MIME type, file size, upload date,… | Frontend only | FS StoredFile, docs/supabase/documents.sql |  |
| R0697 | Enable RLS restricting document access by authenticated user and assigned personnel role; residents see only their own documents,… | Frontend only | docs/supabase/documents.sql | Not applied |
| R0698 | Prevent unauthorized file replacement, deletion and retrieval | Frontend only | FS |  |
| R0699 | Delete abandoned temporary uploads after a configurable period, and clean up orphaned files when a transaction is cancelled or deleted,… | Partial | FS cleanupAbandoned | 24 h cleanup yes; cancelled-transaction cleanup not confirmed |
| R0700 | Preserve documents attached to active or legally required records; never auto-delete official records without an approved retention policy | Needs policy |  | Approved retention policy |
| R0701 | Implement retention and deletion rules through a centralized document lifecycle management process; preserve audit records; do not store… | Partial | FS | No central lifecycle/retention rules |
| R0702 | Provide lightweight admin storage monitoring: total storage used, document count, largest files, usage by category, failed uploads,… | Done | src/pages/admin/StoragePanel.tsx |  |
| R0703 | Warn administrators at configurable storage thresholds: 70% monitor, 85% warning, 95% critical; do not assume capacity auto-increases | Done | UC STORAGE_THRESHOLDS |  |
| R0704 | Audit existing upload implementation and where files are stored before changing it; do not break existing functionality or lose existing… | Done | FS |  |
| R0705 | Build a storage abstraction layer so the backend can later switch to Supabase Storage; keep validation independent of storage provider;… | Frontend only | FS | Abstraction exists; Supabase adapter not written |
| R0706 | Do not claim Supabase integration is complete, assume Supabase is active, or pretend backend protections/secure storage are operational… | Done | src/pages/admin/AdminPages.tsx (Health: "Not connected") |  |
| R0707 | Do not rely on browser storage/test data/local-only behavior as permanent storage for resident records | Frontend only |  | Records still in memory/localStorage |
| R0708 | Verify current Supabase Free Tier storage/upload limits against official docs before implementing; do not hardcode plan quotas in app logic | Frontend only | UC (capacity entered by admin) | No hardcoded quota; check docs at backend phase |
| R0709 | Enable RLS with explicit identity-based SELECT/INSERT/UPDATE/DELETE policies on every exposed sensitive table (resident profiles,… | Frontend only | docs/supabase/ | Not applied |
| R0710 | Never expose Supabase service-role keys or private storage credentials in frontend JS, bundles, public repos, client env vars or public… | Done | no service keys in src |  |
| R0711 | Use Supabase-compatible schema separating: resident account, registration application, ID documents, verification results, Secretary… | Frontend only | docs/supabase/ |  |
| R0712 | Use database transactions for registration approval to prevent duplicates or partial approvals. | Frontend only |  |  |
| R0713 | Add foreign keys, indexes, validation, and row-level security policies for registration tables. | Frontend only | docs/supabase/ |  |
| R0714 | DB-level safeguards (normalized, unique) for contact numbers, emails, resident IDs, active account links, conflicting pending requests;… | Frontend only | docs/supabase/identifiers.sql |  |
| R0715 | Design Supabase relational structures for appointments, schedules/availability, status history, required documents, verification results,… | Frontend only | docs/supabase/scheduling.sql |  |
| R0716 | Use foreign keys, prevent duplicate appointments and conflicting slots, validate dates/availability server-side, apply RLS and backend RBAC | Frontend only |  |  |
| R0717 | Data model entities: appointments, appointment_types, appointment_slots, staff_availability, staff_assignments, appointment_requirements,… | Frontend only | docs/supabase/scheduling.sql |  |
| R0718 | Appointments link to their transaction via proper relationship; one scheduling engine for all service types | Frontend only | AS subjectId | Linked in mock only |
| R0719 | Equipment backend: server-side auth, DB-level inventory consistency, RLS, secure transactions, double-booking protection, timestamped… | Frontend only |  |  |
| R0720 | Audit/review Supabase readiness: schema, relationships, foreign keys, unique constraints, indexing, validation, storage… | Frontend only | docs/supabase/ | Designs only |
| R0721 | Backup strategy, recovery procedures, DB error monitoring, integrity checks and recovery testing; never claim or fabricate backup… | Not built | none | No backups (needs backend) |
| R0722 | Test every upload flow: registration, initial ID, profile/ID updates, document requests, business clearance, equipment borrowing,… | Not built | none | No upload tests recorded |
| R0723 | Test scenarios: valid PDF/JPG/PNG, oversize, unsupported format, renamed executable, corrupted PDF, duplicate, expired ID, missing ID,… | Not built | none | No upload test scenarios |
| R0724 | All upload workflows must work on desktop and mobile; fix actual validation, storage architecture, security and lifecycle, not just the… | Partial | src/components/ui/FileField.tsx | Works on desktop and phone; storage/security lifecycle needs backend |

## Analytics/reports

Done: 76 · Partial: 10 · Superseded: 4 · Not built: 2 · Needs policy: 1

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R0725 | Integrate the Analytics and Reports module into the existing BMIS; do not build a separate application or redesign unrelated modules | Done | src/pages/analytics/AnalyticsPage.tsx |  |
| R0726 | Base analytics on the actual uploaded masterlist "UPDATED MASTERLIST OF BRGY 181 ZONE 16 FOR THE MONTH OF JULY 30 2025.xlsx"; never invent… | Done | src/analytics/parseMasterlist.ts |  |
| R0727 | Treat the uploaded spreadsheet as a senior citizen/OSCA masterlist, never as the complete barangay resident database or population | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0728 | Auto-derive senior citizens and other analytics from ages and raw data in the uploaded masterlist | Done | src/analytics/compute.ts |  |
| R0729 | Do not treat ~6,000 residents/2,000 voters (study background) and 1,000-2,000 target population (FR) as interchangeable; no hardcoded… | Done | src/analytics/compute.ts |  |
| R0730 | Support the masterlist columns: NO, BRGY, ZONE, LAST/FIRST/MIDDLE NAME, SUFFIX, BIRTH MONTH/DAY/YEAR, BIRTHDATE, AGE, FULL ADDRESS,… | Done | src/analytics/parseMasterlist.ts |  |
| R0731 | Ignore completely blank spreadsheet rows; count only records with actual names as residents (never use spreadsheet row counts) | Done | src/analytics/parseMasterlist.ts |  |
| R0732 | Do not use the existing AGE column without validation (it has formula errors); calculate age from BIRTHDATE | Done | src/analytics/compute.ts |  |
| R0733 | Use a clearly defined reporting date for age calculation; do not silently treat file date and current date as interchangeable | Done | src/analytics/AnalyticsContext.tsx (reportingDate) |  |
| R0734 | Normalize formatting for analysis without changing original source records; keep original values and make data-cleaning changes traceable | Done | src/analytics/parseMasterlist.ts |  |
| R0735 | Do not invent missing information or automatically classify unknown values | Done | src/analytics/parseMasterlist.ts |  |
| R0736 | Load and parse the Excel file dynamically in the frontend; calculate analytics from actual records; do not hardcode figures from the… | Done | src/pages/analytics/DataSource.tsx |  |
| R0737 | Allow uploading an updated masterlist later and recalculate all metrics on load; show import success, warnings and validation errors | Done | src/pages/analytics/DataSource.tsx |  |
| R0738 | Never create fake records or decorative hardcoded metrics to populate dashboards; when data is unavailable or incomplete, show an honest,… | Done | src/pages/analytics/SeniorTab.tsx ("No masterlist loaded") |  |
| R0739 | Validate every metric against its source: no duplicate residents, unique household IDs, correct denominators, birthdate-based ages,… | Done | src/analytics/compute.ts |  |
| R0740 | Clearly distinguish actual statistics from estimates if estimates are introduced; clearly identify missing and invalid data; never… | Done | src/analytics/compute.ts |  |
| R0741 | Clearly identify prototype sample statistics as demonstration data | Needs policy |  | Conflicts with removal of demo/prototype labels |
| R0742 | Do not invent data; explain where analytics area data comes from | Superseded |  | Explanation text removed per R0803 |
| R0743 | Make no unsupported conclusions about poverty, medical conditions, eligibility or assistance requirements | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0744 | Data quality section flags: missing/invalid birthdates, missing address, gender, civil status, OSCA ID, OSCA issue date; duplicate OSCA… | Done | src/pages/analytics/SeniorTab.tsx (Data quality) |  |
| R0745 | Never auto-delete duplicate-looking records; flag them for authorized personnel review | Done | src/analytics/parseMasterlist.ts |  |
| R0746 | Senior Citizen Overview KPI cards: total records, male, female, active, inactive, bedridden, records with OSCA ID, records requiring… | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0747 | Interactive age distribution chart with groups 60-64, 65-69, 70-74, 75-79, 80-84, 85-89, 90+; show count and percentage of valid records… | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0748 | Show oldest recorded age and average age computed only from valid birthdates | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0749 | Gender distribution: male, female, percentages, comparison chart; use only valid gender values and show missing/unclassified separately | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0750 | Geographic distribution from FULL ADDRESS: count and percentage per address, most frequent area, top 10 addresses, searchable breakdown,… | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0751 | Do not assume each unique address is a separate household | Done | src/analytics/compute.ts |  |
| R0752 | Civil status distribution: Married, Single, Widow, Separated, other recorded values, missing/unclassified, with totals and percentages | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0753 | OSCA analytics: records with/without OSCA IDs, registrations by year (where issue date is reliably interpretable), missing issue dates,… | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0754 | Do not assume an OSCA ID is valid solely because the field is populated | Done | src/analytics/compute.ts |  |
| R0755 | Resident status analytics: Active, Inactive, Bedridden, other, missing; normalize variants (e.g. BED RIDDEN to Bedridden) while preserving… | Done | src/analytics/parseMasterlist.ts |  |
| R0756 | Voter analytics: YES, NO, missing; label it as voter info within the senior citizen records, not total barangay voter population | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0757 | Community Planning Insights section: areas with more seniors, more bedridden seniors, records needing updates, seniors without OSCA IDs,… | Done | src/pages/analytics/SeniorTab.tsx (Area Summary) |  |
| R0758 | Dashboard filters: reporting date, age group, gender, civil status, address, OSCA status, resident status, voter status; plus search and… | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0759 | All charts, KPI cards, tables and reports update to the selected filters; dashboard totals reconcile with filtered records and report… | Done | src/analytics/compute.ts |  |
| R0760 | Clickable KPI cards and interactive charts (e.g. clicking an age group) drill down to the corresponding filtered records, subject to user… | Done | src/pages/analytics/SeniorTab.tsx (Kpi onClick, exportFiltered) |  |
| R0761 | Dashboard analytics categories: total residents, households, senior citizens, solo parents, PWDs, 4Ps members, program beneficiaries,… | Partial | src/pages/analytics/CommunityTab.tsx | PWD/4Ps/solo parent from prototype resident records; real datasets missing |
| R0762 | Chairman dashboard shows population, households, seniors, solo parents, PWD, 4Ps, program beneficiaries, ayuda planning stats and recent… | Partial | src/pages/dashboard/ChairmanDashboard.tsx | Ayuda stats conflict (R0775); program data missing |
| R0763 | Executive dashboard: total residents, households, population distribution, seniors, PWD, pending registrations, pending requests,… | Partial | src/pages/dashboard/ChairmanDashboard.tsx | No service-performance or program-participation views |
| R0764 | Dashboard counts (pending registrations/documents, attention items, open complaints, mediations, appointments, overdue equipment,… | Done | src/pages/dashboard/SecretaryDashboard.tsx |  |
| R0765 | Secretary Overview metrics (Pending registrations, Pending document requests, Under verification, Forwarded to Chairman, Completed… | Done | src/pages/dashboard/SecretaryDashboard.tsx |  |
| R0766 | Give Secretary Overview (summary), Needs attention (actionable navigation), and Your work queue (individual tasks) distinct purposes;… | Done | src/pages/dashboard/SecretaryDashboard.tsx |  |
| R0767 | Place the Reports button in the Secretary Overview header row, vertically aligned, with a chart icon, primary navy, consistent height,… | Done | src/pages/dashboard/SecretaryDashboard.tsx |  |
| R0768 | Support where data exists: total residents, households, pending registrations, docs by status, avg processing time, overdue, complaints by… | Partial | src/pages/analytics/ServiceReports.tsx | No average processing time, concerns by location, resolution time |
| R0769 | Concern analytics: most reported, top locations, increasing concerns, avg time to action, avg resolution time, % resolved, recurring… | Not built | none | No concern analytics |
| R0770 | Trend analytics (frequent concerns, service demand, population change, recurring infrastructure, repeat areas, participation) from… | Not built | none | No trend analytics |
| R0771 | Prepare for future datasets (General Resident Masterlist, Household, PWD, Solo Parent, 4Ps, Service Transactions, Complaints/KP cases,… | Done | src/pages/analytics/DatasetsTab.tsx |  |
| R0772 | Never estimate household, PWD, 4Ps or solo parent counts from the senior citizen masterlist | Done | src/pages/analytics/CommunityTab.tsx |  |
| R0773 | Support future cross-category analytics (total residents, population/households/seniors per area, PWD, solo parent, 4Ps, program… | Partial | src/pages/analytics/CommunityTab.tsx | Awaits real datasets |
| R0774 | Disaster/ayuda planning: filter by area/address; identify seniors, PWD, solo parents, 4Ps and other vulnerable groups in affected areas;… | Partial | src/pages/analytics/CommunityTab.tsx (Affected Areas) | Uses prototype resident records |
| R0775 | Remove ayuda; keep analytics only | Superseded |  | Replaced by R0774 (ayuda planning restored) |
| R0776 | Chairman can view overall analytics, authorized reports and community planning insights | Done | PERM chairman |  |
| R0777 | Secretary can view senior analytics, generate authorized reports, and review/manage data quality issues | Done | PERM secretary |  |
| R0778 | Secretary accesses consolidated resident info, prepares recurring reports in supplied formats, and reviews statistics before exporting | Done | src/pages/analytics/ReportsPage.tsx |  |
| R0779 | Role-based access to sensitive reports; no confidential individual case details in general analytics; exports only for authorized users | Done | PERM | Mock-level |
| R0780 | Recurring reports organized by destination categories DILG, OSCA, MADAO, Barangay Bureau via configurable templates: clean-up activities,… | Partial | src/config/reportTemplates.ts | Exact official formats need barangay files |
| R0781 | Reports UI: report selection, categories, date/data filters, data selection, preview, generate, PDF/Excel export, history/download states;… | Partial | src/pages/analytics/ReportsPage.tsx | No report history |
| R0782 | Report selector with concise names: Senior Citizen Masterlist, Population Summary, Age, Gender and Address Distribution, OSCA Registration… | Done | src/analytics/reports.ts |  |
| R0783 | Analytics sidebar short names: Population, Age Distribution, Gender, Address, OSCA Registration, Civil Status, Senior Citizen Status,… | Superseded |  | Replaced by R0782 names |
| R0784 | Operational reports: document requests by status, document transactions, complaints, concerns, incidents, mediation outcomes, equipment… | Partial | src/pages/analytics/ServiceReports.tsx | No concerns, incidents or service-performance report |
| R0785 | Export reports to PDF and Excel (where appropriate) using actual filtered data and respecting permissions; exports and download actions… | Done | src/analytics/exporters.ts |  |
| R0786 | Every report includes title, reporting period/date, date generated, barangay and zone, source dataset, filters, generating account, totals… | Superseded |  | Metadata moved to "Report details" per R0787 |
| R0787 | Analytics report header shows only title, reporting period, PDF export, Excel export; move barangay/dataset/dates/generated-by/filters… | Done | src/pages/analytics/ReportsPage.tsx ("Report details") |  |
| R0788 | Remove repeated barangay name, excessive generated-by info, redundant dates, filter descriptions, repeated dataset names, per-report… | Done | src/pages/analytics/ReportsPage.tsx |  |
| R0789 | Report layout priority: title, essential figures, relevant visualization, data table when needed, export actions | Done | src/pages/analytics/ReportsPage.tsx |  |
| R0790 | Show only the 3-4 key metrics per report, grouped compactly (e.g. Age Summary: Valid records, Average age, Oldest); layout driven by data,… | Done | src/pages/analytics/ReportsPage.tsx |  |
| R0791 | Report contents: Population (total, M/F, age, civil status, record status); Age (avg, groups, chart); Gender (M/F/Unclassified); Address… | Done | src/analytics/reports.ts |  |
| R0792 | Do not invent or redesign official government report formats; wait for user-supplied templates and follow their exact title, section… | Done | src/config/reportTemplates.ts |  |
| R0793 | Find the official report template files in the provided Google Drive folder; if none exist, create them | Done | src/config/reportTemplates.ts | Official files used |
| R0794 | Clearly distinguish official government submission formats from internal analytics; without an official template label output as internal… | Done | src/pages/analytics/ReportsPage.tsx |  |
| R0795 | Remove the repeated orange disclaimer banner from every report; show official/non-official distinction subtly only where necessary | Done | src/pages/analytics/ReportsPage.tsx |  |
| R0796 | Report Templates (DILG, OSCA, MADAO, others) stacked vertically, each one full-width row; remove "No template yet. Upload the official… | Done | src/pages/analytics/ReportsPage.tsx |  |
| R0797 | Barangay Reports page Official Forms section: DILG BOIS Form; OSCA Senior Citizen Social Pension Transmittal; MADAO BADAC Monthly Report… | Done | src/pages/analytics/ReportsPage.tsx |  |
| R0798 | Barangay Reports page Regular Reports section: Clean-up Activities Report, Senior Citizen Masterlist, Katarungang Pambarangay Report,… | Done | src/pages/analytics/ReportsPage.tsx |  |
| R0799 | Report-to-prepare cards show only name, frequency (Clean-up: Weekly / Monthly; Senior masterlist: Monthly; KP report: As required;… | Done | src/pages/analytics/ReportsPage.tsx |  |
| R0800 | Recurring report schedules must be actually configured workflows, not decorative labels | Partial | src/pages/analytics/ReportsPage.tsx | Schedules are labels, not configured reminders/workflows |
| R0801 | Barangay Reports separates official templates, recurring reports and internal analytics; each row shows only name, agency when relevant,… | Done | src/pages/analytics/ReportsPage.tsx |  |
| R0802 | Remove "Official file", "Prepared format", "Format ready" badges, yellow backgrounds, warning-like borders and schedule explanations from… | Done | src/pages/analytics/ReportsPage.tsx |  |
| R0803 | Remove client-facing methodology text: address grouping explanations (street parsing, merged variants, "Unparsed"), "N values were… | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0804 | Remove "Internal analytics report" labels, repeated "Total records", redundant % explanations, single-value cards, text restating charts;… | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0805 | Refine entire Community Analytics: concise, government-style, BMIS navy/light blue/white/gray palette, no AI-like insights | Done | src/pages/analytics/AnalyticsPage.tsx |  |
| R0806 | Stat cards show only title and value (e.g. "Senior Citizens 353", "Below 60", "Turning 60 Within a Year"); percentages only when… | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0807 | Charts with concise titles (Age Distribution, Gender Distribution, Residents by Area, Civil Status, Resident Status, Voter Registration,… | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0808 | Breakdown tables use concise headers (e.g. Area, Records, Percentage), aligned numbers, keep search/sort/filter/pagination | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0809 | Layout order: header and dataset navigation, data selection, search/filters/record count/export, key stats, charts, breakdowns, detailed… | Done | src/pages/analytics/SeniorTab.tsx |  |
| R0810 | Apply standards to all analytics (Senior Citizens, Community Planning, Other Datasets); do not copy senior-specific metrics into other… | Done | src/pages/analytics/CommunityTab.tsx |  |
| R0811 | Preserve calculations, date-based ages, dataset switching, filters, PDF/Excel exports, counts, permissions and dataset connections; fix… | Done | src/analytics/compute.ts |  |
| R0812 | Review every analytics report and keep the main Analytics dashboard consistent with the redesigned reports | Done | src/pages/analytics/AnalyticsPage.tsx |  |
| R0813 | Mobile analytics: sidebar becomes a compact report selector; one-column stacked cards, key metrics first, simplified legible resizing… | Done | src/pages/analytics/ReportsPage.tsx (phone selector) |  |
| R0814 | Analytics tabs: remove horizontal scroll on the tab bar | Done | src/pages/analytics/AnalyticsPage.tsx | Not visually re-checked |
| R0815 | Reports: organize "Senior Citizen Population Summary" preview layout (list too far to the side) | Done | src/pages/analytics/ReportsPage.tsx | Not visually re-checked |
| R0816 | Dashboard "Population by street" header (Kagawad/Chairman): fix squeezed text and button positioning | Done | src/pages/dashboard/shared.tsx | Not visually re-checked |
| R0817 | Recent Transactions: compact feed showing more items in same space, light blue header kept; transaction ID primary with right badge, name… | Done | src/pages/dashboard/CustodianDashboard.tsx |  |

## UI/mobile/accessibility/font/watermark

Done: 121 · Partial: 50 · Superseded: 12 · Not built: 2 · Needs policy: 1

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R0818 | Follow the Figma "SE - BMIS" file (node 249-3847, "Final Inspo (light)" frame) as the visual source of truth; do not replace it with a… | Done | src/index.css | Tokens marked "(figma)"; visual match to Figma not re-checked |
| R0819 | Apply Figma node 276-63 design to BMIS 01 Public & Auth, 02 Resident Portal, 03 System Administrator only | Superseded | src/index.css | Scope widened to whole system by R0833 |
| R0820 | Do not redesign modules outside the three scoped ones; no page left on the old design within scope | Superseded | src/components/ui/ | Scope widened to all pages by R0833/R0864 |
| R0821 | Apple-inspired (not copied) direction across all pages: content first, minimal text, clear hierarchy, generous whitespace, subtle… | Done | src/index.css |  |
| R0822 | Combine Apple simplicity with Microsoft-style structured, predictable layouts and consistent components; do not copy either interface. | Done | src/components/ui/Panel.tsx |  |
| R0823 | Avoid generic AI SaaS look: no unnecessary gradients, glassmorphism, oversized headings, excessive rounded/pill cards, cards inside cards,… | Partial | src/pages/public/HomePage.tsx | Uppercase eyebrow labels (label-caps, 88 uses) and icon tiles remain |
| R0824 | Landing/auth screens consistent with app typography, colors, buttons, radii, spacing, icons; avoid excessive gradients, glassmorphism,… | Done | src/pages/public/PortalPage.tsx |  |
| R0825 | Use cards only when they improve grouping; prefer tables/lists/structured layouts over repetitive card grids; no card-per-item, no nested… | Partial | src/components/ui/Panel.tsx | Boxed containers restored per R0828, so pages stay card-heavy |
| R0826 | Visual system: light neutral/light gray page background, white surfaces, deep navy primary actions, subtle blue-gray separators and very… | Done | src/index.css |  |
| R0827 | Do not add too much corner radius anywhere | Done | src/index.css | Cards 8px, controls 6px |
| R0828 | Containers: bring back all containers as before while keeping the removed text/stuff; earlier requests to remove all containers (msg 58)… | Done | src/components/ui/Panel.tsx |  |
| R0829 | Container title bars use a consistent header fill in a lighter shade than navy (navy hard to read); delete unnecessary subtitles | Done | src/index.css | Light blue --color-bar; conflicts with R0823 "no repeated blue header bars" |
| R0830 | Authorized Personnel gets the same UI fixes; Chairman dashboard header colors consistent | Done | src/pages/dashboard/ChairmanDashboard.tsx | Authorized Personnel role later removed |
| R0831 | Consistent spacing system (headings to content, sections, labels/values, form fields, buttons, dashboard components): sections clearly… | Done | src/index.css |  |
| R0832 | Desktop: use space intelligently, balanced columns, no stretched content; mobile: stack vertically, cards expand naturally, important… | Done | src/pages/dashboard/SecretaryDashboard.tsx |  |
| R0833 | One shared design system reused across all roles and both portals: consistent colors, type, spacing scale, radius, icons, status colors,… | Done | src/components/ui/Button.tsx |  |
| R0834 | Audit placement of all components (navigation, headings, actions, search, filters, forms, metrics, tables, cards, pagination, modals,… | Partial | src/components/layout/AppShell.tsx | No record of a full placement audit across both portals |
| R0835 | Each role gets its own interface, dashboard, navigation and permitted actions organized by responsibility; dashboards must not look the… | Done | src/config/navigation.ts |  |
| R0836 | Personnel nav groups: Overview, Residents, Registrations, Document Requests, Complaints and Cases, Appointments and Queue, Equipment and… | Partial | src/config/navigation.ts | Groups differ (Resident Records, Services, Community, KP, Insights); no "Appointments and Queue" group |
| R0837 | Chairman portal prioritizes approvals, overview, important concerns, reports, emergency info, project progress | Partial | src/pages/dashboard/ChairmanDashboard.tsx | Approvals and cases shown; no emergency info or project progress |
| R0838 | Treasurer portal prioritizes financial transactions, payments, financial reports, relevant records | Superseded | docs/PATCH_NOTES.md | Treasurer role removed by later user decision |
| R0839 | System Admin portal prioritizes user, role, permission management, security events, config, audit logs, system health | Done | src/pages/dashboard/OtherDashboards.tsx |  |
| R0840 | Show actual names in context (e.g. "For review by Robert Atad", "Assigned to Ana Manila Salvador"); no generic "Welcome, Admin" | Done | src/components/ui/GreetingCard.tsx |  |
| R0841 | User profile shows full name, official position, image or initials, role, permissions, account status; use initials, never fake photos of… | Partial | src/components/layout/Sidebar.tsx | Initials and position shown; own permissions/status not shown on profile |
| R0842 | Secretary profile reads "Ana Manila Salvador / Barangay Secretary", never generic "Staff" or "Administrator" | Done | src/config/barangay.ts |  |
| R0843 | Replace generic labels (Company Overview, Employee Management, Sales Analytics, Customer Tickets etc.) with Barangay 181 terms (Resident… | Done | src/config/navigation.ts |  |
| R0844 | Analytics follows the existing BMIS design system: clear KPI cards, readable charts, responsive desktop/tablet, accessible colors and… | Done | src/pages/analytics/AnalyticsPage.tsx |  |
| R0845 | Implement clear hover, focus, active/pressed, disabled, loading and error states on interactive components | Done | src/components/ui/Button.tsx |  |
| R0846 | Descriptive button labels: Submit Request, View Details, Approve, Reject, Forward to Chairman, Print Document, Mark as Completed | Superseded | src/components/ui/Button.tsx | Short-label rule R0848 is later |
| R0847 | Buttons: clear action names, prominent primary action, consistent sizes; no buttons that do nothing | Done | src/components/ui/Button.tsx |  |
| R0848 | Button system has only Primary, Secondary, Destructive and Text/tertiary variants, with short labels (Save, Approve, Reject, Submit, View,… | Partial | src/components/ui/Button.tsx | Variants match; many labels still long ("Submit Request", "Review and confirm") |
| R0849 | Every on/off setting uses a toggle switch in the referenced style | Partial | src/components/ui/Toggle.tsx | Toggle only in AdminPages; settings panels still use checkboxes |
| R0850 | Important touch targets at least ~44-48 CSS px; primary buttons min 48x48px, important action buttons 48-56px high, large primary buttons;… | Done | src/components/ui/Button.tsx |  |
| R0851 | Avoid tiny icons and icon-only buttons when the action is not obvious; small icons are never the only way to do important actions; use… | Partial | src/components/layout/Sidebar.tsx | Some icon-only controls remain (log out, inventory pencil), with aria-labels |
| R0852 | Do not place dangerous actions (Delete, Cancel, Approve) too close together; make important actions visually distinguishable. | Done | src/components/ui/ActionStack.tsx |  |
| R0853 | Make the whole card or row clickable where appropriate and provide visible tap feedback; never require precise tapping. | Done | src/components/ui/RowList.tsx |  |
| R0854 | Remove unnecessary text system-wide: subtitles, intro paragraphs, subtext (e.g. "Fees paid for barangay documents. Record each… | Done | src/components/ui/Panel.tsx | Subtitles hidden unless keepSubtitle |
| R0855 | Remove repeated section descriptions, duplicate references, redundant dates, decorative labels and repeated metadata app-wide | Partial | src/components/ui/Panel.tsx | No evidence of an app-wide sweep for repeated metadata |
| R0856 | Remove developer-facing/system-generated text app-wide (e.g. "SET BY the system" under Document Details): internal explanations of how… | Done | docs/PATCH_NOTES.md |  |
| R0857 | Remove AI-like and conversational phrases ("The system automatically...", "Based on the available data...", "AI-powered insights", "Here… | Done | src/ | Listed phrases not found by grep |
| R0858 | Content standard: short headings; descriptions max one sentence only when needed; stats = label + value; concise charts, tables, buttons,… | Done | src/components/ui/StatCard.tsx |  |
| R0859 | Remove helper subtexts under fields (e.g. "Number only"); examples allowed only as input placeholders; keep real validation and needed… | Superseded | src/lib/validation.ts | Later R0984 asks for examples in messages |
| R0860 | Settings/profile: group related settings, straightforward labels, no unnecessary descriptions | Done | src/pages/AccountPage.tsx |  |
| R0861 | Never remove legally required, operationally necessary, decision-relevant or accessibility-essential info when simplifying: keep… | Done | src/pages/residents/ImportPage.tsx |  |
| R0862 | Give short contextual guidance and clear next steps only when needed; no long paragraphs | Done | src/pages/resident/ResidentHome.tsx |  |
| R0863 | Show visible progress indicators and short instructions in resident flows | Done | src/pages/public/RegisterPage.tsx |  |
| R0864 | Audit ALL listed pages (Resident Dashboard, Profile, Document Requests/Details, My Transactions, My Complaints and Reports, Equipment… | Partial | docs/PATCH_NOTES.md | Audit claimed in notes; not every listed page verifiable |
| R0865 | For every page apply the 5 questions (needed immediately? shown elsewhere? can be after click? needed for this role? can system automate… | Partial | docs/PATCH_NOTES.md | No per-page record of the 5 questions |
| R0866 | One page, one clear purpose; one primary action per screen; feedback only when needed | Partial | src/pages/dashboard/SecretaryDashboard.tsx | Dashboards still carry several equal-weight panels |
| R0867 | Every screen answers: What am I looking at? What do I need to do? What happens next? | Partial | src/components/ui/PageHeader.tsx | Not verified per screen |
| R0868 | Progressive disclosure on every page: Primary/Secondary/Additional hierarchy, never equal weight; essentials first (title, one short line,… | Partial | src/components/ui/RowList.tsx | Lists simplified; not applied uniformly (Document Requests rows show dates) |
| R0869 | Statuses (Submitted, Ready to Pickup, Need Additional Information, Pending, Approved, Rejected, Overdue): remove decorative dots and… | Done | src/components/ui/StatusLabel.tsx |  |
| R0870 | Show a status only when it reflects real dynamic data the user needs (current state, affects next action, restriction, meaningful… | Done | src/components/ui/StatusLabel.tsx |  |
| R0871 | Show overview statuses only when they signal needed attention, using short labels (e.g. Needs review, In progress, Ready, Completed,… | Partial | src/lib/residentStatus.ts | Resident labels short; personnel lists still use long workflow labels |
| R0872 | Staff status controls live inside each transaction; no global dropdowns of unrelated statuses; distinguish performable actions from… | Done | src/components/documents/TransitionPanel.tsx |  |
| R0873 | Restrained color system: dark navy primary actions, white surfaces, light gray background, muted/restrained blue for selection and info,… | Done | src/index.css |  |
| R0874 | Do not communicate important information (incl. statuses) through color alone; status indicators color-independent; action icons have… | Done | src/components/ui/StatusLabel.tsx | Statuses are text labels |
| R0875 | Replace generic Lucide/Material/Font Awesome/emoji icons with distinctive researched icons (Phosphor, Tabler, Material Symbols, Iconify,… | Done | src/icons/index.tsx | Phosphor adopted |
| R0876 | Use official brand logos (Google, Apple, Microsoft, Gmail, Maps) only when representing those brands; never for unrelated BMIS features | Done | src/icons/index.tsx | No brand logos |
| R0877 | Icons are SVG, stored locally, properly licensed, consistent size/weight/stroke, with accessible labels | Done | src/icons/index.tsx |  |
| R0878 | Use one consistent line icon library (e.g. Lucide, SF Symbols-like) with consistent size, stroke, proportions and containers; no emojis,… | Partial | src/icons/index.tsx | Mixes duotone and bold weights, not pure line icons |
| R0879 | Colorful Apple-inspired icon system with soft-colored rounded-square backgrounds and colored symbols; map:… | Superseded | src/icons/tones.ts | Replaced by R0881 |
| R0880 | Use colored meaningful icons: Home blue, Residents blue/teal, Documents blue, Complaints orange/coral, Equipment orange toolbox,… | Superseded | src/icons/tones.ts | Replaced by R0881 |
| R0881 | Remove colorful pastel square backgrounds behind icons; icons default navy/charcoal; selected nav item subtle blue-tinted background,… | Done | src/icons/tones.ts |  |
| R0882 | Icon size 20-22px, stroke ~1.75-2px, no colored tile, vertically centered, consistent icon-label spacing, left padding and row height;… | Done | src/index.css | icon-line standard |
| R0883 | Mobile icon/nav: no oversized backgrounds, balanced alignment, no awkward label wrapping, large touch targets, obvious selected state, not… | Done | src/components/layout/BottomNav.tsx |  |
| R0884 | Apply the icon system via a centralized icon component everywhere: every sidebar item for all roles and Resident Portal, mobile nav,… | Done | src/icons/index.tsx |  |
| R0885 | Icon QA: inspect every page/role on desktop, tablet, mobile; check selected/hover/focus/disabled/active states, contrast; confirm no… | Partial | docs/PATCH_NOTES.md | Checks at 375/1280 recorded; tablet and state QA not recorded |
| R0886 | Use the supplied barangay logo (BRGY LOGO.png) | Done | src/components/layout/BarangaySeal.tsx |  |
| R0887 | Use a logo image with a real white background instead of the uneven CSS white disc | Done | src/components/layout/BarangaySeal.tsx |  |
| R0888 | Use the provided seal image as a super-low-opacity logo on the homepage card | Done | src/pages/public/HomePage.tsx |  |
| R0889 | Use the existing official Barangay 181 seal asset for the watermark via one reusable component; do not redraw, stretch, distort, crop,… | Partial | src/pages/public/HomePage.tsx | Hero seal bypasses SealWatermark and applies grayscale (recolors the seal) |
| R0890 | Watermark appearance: large oversized seal, subtle low opacity (~3-7% on light, ~5-10% on dark), no shadows/gradients/borders, positioned… | Done | src/components/layout/SealWatermark.tsx |  |
| R0891 | Watermark is decorative: pointer-events none, not focusable, no handlers, aria-hidden="true", interactive elements stacked above it | Done | src/components/layout/SealWatermark.tsx |  |
| R0892 | Place watermark on login, resident registration, password recovery, account verification, welcome panels | Done | src/pages/public/RoleLoginPage.tsx | Also Portal, Register, ForgotPassword |
| R0893 | Place watermark only in welcome sections of Resident, Secretary, Chairman, Treasurer, System Admin dashboards, not behind every card | Not built | src/components/ui/GreetingCard.tsx | No watermark in any dashboard welcome section |
| R0894 | Use subtle watermark in empty states (no pending requests, complaints, transactions, notifications, records) only when whitespace allows | Done | src/components/ui/EmptyState.tsx |  |
| R0895 | Barangay logo watermark on announcement detail must be low opacity, never interfere with text, overlap buttons, cover interactive… | Done | src/pages/announcements/AnnouncementPages.tsx | Seal-use rules still need barangay policy |
| R0896 | Never place the watermark behind dense tables, resident personal info, forms/inputs, buttons, clickable cards, links, nav items, charts,… | Done | src/components/layout/SealWatermark.tsx |  |
| R0897 | Watermark responsive: check desktop, tablet, mobile, small mobile, font-size settings, expanded/collapsed nav; on mobile reduce size, keep… | Partial | src/components/layout/SealWatermark.tsx | No recorded QA across sizes/font settings |
| R0898 | Watermark QA on every role/page: consistent logo, subtle, text readable, buttons clickable, fields usable, no overlap, no blocked… | Partial | docs/PATCH_NOTES.md | No per-role watermark QA record |
| R0899 | Do not assume seal watermark usage is legally permitted; review PH rules and flag for barangay confirmation; do not claim compliance | Needs policy | src/components/layout/SealWatermark.tsx | Flagged "to be confirmed by the barangay" |
| R0900 | Smooth iOS-like transitions (fade, small movement, gentle scale, 350-600ms, ease or spring) between homepage, role selection and login in… | Done | src/lib/transition.ts |  |
| R0901 | Use existing animation library or lightweight CSS; no large dependency | Done | src/lib/transition.ts |  |
| R0902 | Respect reduced-motion preference; ensure keyboard navigation, focus states, contrast and mobile interactions | Done | src/index.css |  |
| R0903 | Microinteractions: smooth transitions, card press feedback, bottom sheets, loading skeletons, success/error feedback, confirmation… | Partial | src/components/layout/BottomNav.tsx | Skeletons and sheets exist; no sticky action buttons |
| R0904 | Swipe only where discoverable and safe; confirmation dialogs for destructive actions; one-handed forms; no multi-screen trips for simple… | Done | src/components/ui/ConfirmDialog.tsx | No swipe gestures used |
| R0905 | Fix literal Unicode escapes (e.g. "You’ll"), mojibake, raw HTML entities, broken Filipino/currency/symbol characters at the root cause; no… | Done | docs/PATCH_NOTES.md | Live sweep recorded |
| R0906 | Fix rendering defects: overflow, clipping, misaligned icons, overlaps, dropdown positioning, broken modals, stray scrollbars, inconsistent… | Partial | docs/PATCH_NOTES.md | Only sweep claims; no automated visual checks |
| R0907 | Consistent date/time/number/currency/percentage formatting; never show undefined, null, NaN, [object Object] or raw JSON; use friendly… | Done | src/lib/format.ts |  |
| R0908 | Never show stack traces or raw technical/database/developer errors (especially to residents); errors explain what happened and what to do,… | Done | src/services/mockApi.ts |  |
| R0909 | Use plain language in resident messages instead of technical errors (e.g. "We are checking your request.", "The email or password is… | Done | src/services/authService.ts |  |
| R0910 | Duplicate number message: "This contact number is already registered to another account. Please check the number and try again." | Partial | src/services/residentService.ts | Says "another resident" not "another account" |
| R0911 | Manual review message: "Your request is being reviewed by the Barangay Secretary." | Done | src/services/registrationService.ts |  |
| R0912 | Use simple words instead of technical terms; replace "OCR verification", "Masterlist reconciliation", "Pending administrative processing",… | Done | src/pages/public/RegisterPage.tsx | Technical terms not shown in UI |
| R0913 | Elderly-friendly: plain language, no technical terms, avoid unnecessary instructions, predictable back navigation, avoid dense tables,… | Partial | src/pages/resident/ResidentHome.tsx | Not verified across all resident flows |
| R0914 | Success/error messages after actions; clear confirmation before important, destructive or irreversible actions | Done | src/components/ui/ConfirmDialog.tsx |  |
| R0915 | Remove unnecessary confirmation messages and excessive borders/dividers | Done | docs/PATCH_NOTES.md |  |
| R0916 | Success confirms important actions ("Your request has been submitted.") with reference number and next step; no success banners for… | Done | src/pages/resident/RequestFormPage.tsx |  |
| R0917 | Error prevention: clear validation messages, confirm destructive actions, autosave form progress where appropriate, explain upload… | Done | src/hooks/useDraft.tsx |  |
| R0918 | Every page provides clear empty, loading and error states | Partial | src/components/ui/EmptyState.tsx | Error states not present on every page |
| R0919 | Loading feedback when opening records, submitting, generating reports, uploading, saving | Done | src/components/ui/Button.tsx |  |
| R0920 | Empty states use one short friendly sentence (e.g. "No active requests.", "No recent activity.", "No announcements.") plus a next action… | Done | src/components/ui/EmptyState.tsx |  |
| R0921 | Tables have search, filters, sorting, pagination, empty states | Partial | src/components/ui/Pagination.tsx | Pagination in 6 files; sorting only on some tables |
| R0922 | Design the whole system so elderly and first-time smartphone users can understand, navigate and complete every task (especially major… | Partial | src/components/layout/TextSizeControl.tsx | No usability test with elderly users |
| R0923 | Apply accessibility to every page: resident and personnel portals, login/registration, verification, documents, complaints, equipment,… | Partial | src/components/ui/Button.tsx | Shared components help; not audited per page |
| R0924 | Meet WCAG 2.2 AA minimum: contrast, keyboard navigation, visible focus, screen-reader labels/names, semantic headings, form labels,… | Partial | src/index.css | No contrast/axe audit; WCAG 2.2 AA unverified |
| R0925 | Audit all pages for font sizes, scaling, contrast, touch targets, form simplicity, navigation, error messages, loading/empty states,… | Partial | docs/PATCH_NOTES.md | Partial audit (targets, overflow); no full a11y audit |
| R0926 | Senior-friendly assistance mode: larger text, clear buttons, simple instructions, optional guided assistance, plain errors, progress… | Partial | src/components/layout/TextSizeControl.tsx | Only text size; no guided assistance mode |
| R0927 | Elderly-friendly concern flow: large text, clear labels, no jargon, short forms, obvious buttons, clear submission confirmation,… | Done | src/pages/resident/ConcernForm.tsx |  |
| R0928 | Elderly principles: large text/buttons, clear date/time formats, minimal steps, obvious confirmations, high contrast, easy navigation | Done | src/pages/appointments/AppointmentPages.tsx |  |
| R0929 | Bigger, elderly-friendly readable fonts by default: no tiny text or metadata, no thin weights, no unnecessary uppercase, sufficient line… | Partial | src/index.css | Uppercase label-caps widely used |
| R0930 | Consistent typographic hierarchy with a readable sans-serif (page title, section title, important info, supporting info, labels,… | Done | src/index.css |  |
| R0931 | Use SF-style typography where available | Partial | src/index.css | Inter/Manrope; SF only as system fallback |
| R0932 | Mobile type scale: body ~17-18px; main headings 25-28px (noticeably larger), section 19-22px, buttons 16-18px, important numbers 30-36px | Done | src/index.css | Mobile base ~17px |
| R0933 | Desktop type scale: page headings 28–32px, section 20–24px, card headings 18–20px, body 16–18px, labels 16–17px, supporting 14–16px,… | Done | src/index.css |  |
| R0934 | Lists: minimum 16px body text, comfortable row spacing, large clickable areas, clear focus and pressed states, support existing font-size… | Done | src/components/ui/RowList.tsx |  |
| R0935 | Global font-size setting with three options (Small, Default, Large) available to residents and personnel throughout the system, as a… | Done | src/components/layout/TextSizeControl.tsx |  |
| R0936 | Font-size controls: decrease, default, increase, larger accessibility setting; persisted; applied portal-wide; no broken layouts; not… | Superseded | src/components/layout/TextSizeControl.tsx | Three options per R0935/R0939 |
| R0937 | Font-size setting applies consistently system-wide (forms, tables, notifications, buttons, menus, modals, dashboard metrics, work queue,… | Done | src/index.css | --fs variable |
| R0938 | Changing font size must not break layouts, overlap buttons, hide content, or cause horizontal scrolling; all pages usable at largest size. | Done | docs/PATCH_NOTES.md | Checked at 375/1280 with Large |
| R0939 | Font-size control is one compact "Aa" header control opening a popover or bottom sheet with A−, Default, A+ and the selected size shown,… | Done | src/components/layout/TextSizeControl.tsx |  |
| R0940 | Support font-size adjustment via existing accessibility settings on appointment screens | Done | src/components/layout/AppShell.tsx |  |
| R0941 | Responsive desktop/tablet/mobile: mobile nav, stacked layouts, touch-friendly controls, no horizontal overflow, mobile-friendly tables,… | Done | src/components/layout/AppShell.tsx |  |
| R0942 | Design mobile independently as a premium native-feeling app, not compressed desktop: whitespace, hierarchy, consistent radius, subtle… | Done | src/components/layout/BottomNav.tsx |  |
| R0943 | Do not achieve mobile layouts by shrinking fonts/everything, compressing column widths, hiding overflow or sacrificing readability to fit… | Done | src/components/ui/RowList.tsx |  |
| R0944 | Breakpoints: mobile 320-767px (dedicated layouts, no horizontal overflow), tablet 768-1023px (adaptive, two-column cards), desktop 1024px+… | Partial | src/components/layout/AppShell.tsx | Wide tables switch to cards below 1280, not 1024 |
| R0945 | Design separate responsive layouts for small phones (320–359px), standard (360–390px), large phones (391–430px), tablets, and desktop. | Partial | src/components/layout/AppShell.tsx | No distinct small/standard/large phone layouts |
| R0946 | Every module (dashboard, residents, registration, profiles, documents, blotter, complaints, cases, analytics, reports, notifications,… | Partial | src/components/ui/RowList.tsx | Not every module has a dedicated mobile layout |
| R0947 | Apply mobile list/detail pattern to every data-dense page: Masterlist, Households, Senior Citizens, Registrations, Personnel,… | Partial | src/components/ui/RowList.tsx | Applied to main lists; analytics tables not confirmed |
| R0948 | Adapt each page's mobile list to its content (essential info only, secondary info in detail views, contextual actions); do not blindly… | Done | src/pages/residents/ResidentsPage.tsx |  |
| R0949 | Fix the shared responsive table architecture at the source rather than patching individual screens | Done | src/components/ui/RowList.tsx |  |
| R0950 | Mobile nav: bottom navigation bar for frequent sections with icons and short labels, active highlight, one-handed use | Done | src/components/layout/BottomNav.tsx |  |
| R0951 | Secondary modules via a More menu or slide-up/full-screen navigation sheet; profile, notifications, account controls easily reachable | Done | src/components/layout/BottomNav.tsx |  |
| R0952 | Mobile bottom navigation prioritizes the most important resident functions; less frequent items live in the menu | Done | src/components/layout/BottomNav.tsx |  |
| R0953 | Mobile navigation shows recognizable labels (no icon-only); bottom nav only if it helps and not duplicating every desktop item | Done | src/components/layout/BottomNav.tsx |  |
| R0954 | Mobile nav: compact top bar with barangay identity/logo, notification icon, menu or bottom nav, clear active state; no oversized headers,… | Done | src/components/layout/AppShell.tsx |  |
| R0955 | Mobile header: left side hamburger, Barangay 181 logo, and name; right side "Aa" text-size control and notification bell with unread… | Partial | src/components/layout/AppShell.tsx | No hamburger on phones; menu is in bottom-bar More |
| R0956 | Display "Barangay 181" without truncation at ~16–18px semibold; keep logo recognizable; hide/simplify subtitle on very narrow screens;… | Done | src/components/layout/AppShell.tsx |  |
| R0957 | Notification bell: always visible, minimum 44–48px touch target, consistently at right, unread indicator preserved, never compressed. | Done | src/components/layout/NotificationMenu.tsx |  |
| R0958 | Mobile header fits logo, system name, account controls, notifications and font controls with no overlap, truncated branding, crowding,… | Done | src/components/layout/AppShell.tsx |  |
| R0959 | Icons have accessible labels; controls give visible feedback; screen readers can identify interactive elements; large text must not break… | Done | src/components/layout/AppShell.tsx |  |
| R0960 | Bottom navigation must not cover the last list item; provide bottom safe-area padding; compact header; independent natural scroll; no… | Done | src/components/layout/BottomNav.tsx |  |
| R0961 | Mobile dashboard: personalized greeting, stacked stat cards (never 5+ in one row), pending tasks first, status indicators, prominent… | Partial | src/pages/dashboard/SecretaryDashboard.tsx | No collapsible secondary info on mobile |
| R0962 | Dashboard: prioritize pending work and important statistics; simplify cards; remove redundant info | Done | src/pages/dashboard/SecretaryDashboard.tsx |  |
| R0963 | On mobile, replace desktop tables with stacked tappable list cards showing essentials first (e.g. name, reference no./request type,… | Done | src/components/ui/RowList.tsx |  |
| R0964 | Mobile list views show only essentials; default view hides info not needed for the immediate decision/task while keeping it on demand via… | Done | src/components/ui/RowList.tsx |  |
| R0965 | Mobile: full-screen detail views, bottom sheets for secondary actions; no horizontal scrolling, squeezed columns, multi-column squeeze or… | Done | src/components/layout/BottomNav.tsx |  |
| R0966 | Mobile Resident Directory: replace the table with tappable list rows showing only full name (primary), Resident ID in small muted text… | Done | src/pages/residents/ResidentsPage.tsx |  |
| R0967 | Tapping a resident opens a dedicated detail view (page or bottom sheet) with back navigation, clear section hierarchy, comfortable… | Done | src/pages/residents/ResidentProfilePage.tsx |  |
| R0968 | Mobile detail: user can open a record, review details, perform permitted actions and return to the list without losing context | Done | src/hooks/useStickyState.ts |  |
| R0969 | Resident detail sections: Personal Information (name, ID, birthdate, age, sex, civil status, contact); Address (address, purok/zone,… | Partial | src/pages/residents/ResidentProfilePage.tsx | Section grouping differs from the four named sections |
| R0970 | Detail views display only fields that exist in the data; do not invent information or display empty fields | Done | src/pages/admin/UserAccountsPage.tsx |  |
| R0971 | Preserve editing, viewing, verification and authorized personnel actions within the redesigned mobile resident views | Done | src/pages/residents/ResidentProfilePage.tsx |  |
| R0972 | Desktop keeps the existing table layout with sortable columns, filters, pagination and search; mobile uses a structurally different list… | Done | src/pages/residents/ResidentsPage.tsx |  |
| R0973 | Keep search/filters accessible on mobile via a compact interface (bottom sheets for advanced filters) instead of oversized desktop… | Partial | src/pages/residents/ResidentsPage.tsx | Filters are inline selects, no bottom sheet |
| R0974 | Request overview lists show only request name, applicant name, and a contextual status indicator only when needed. | Partial | src/pages/documents/DocumentRequestsPage.tsx | Work queue complies; Document Requests rows add Ready by/Pickup |
| R0975 | Do not show reference numbers or submission dates in default request lists; do not repeat document type and applicant name in multiple… | Partial | src/pages/documents/DocumentRequestsPage.tsx | Dates shown on default request list |
| R0976 | Mobile request list: spacious touch-friendly items with bold request name and applicant below, small indicator only if attention needed,… | Done | src/components/ui/RowList.tsx |  |
| R0977 | Apply list simplification to Secretary dashboard, registration, document, complaint, equipment, Chairman approval, Treasurer transaction,… | Partial | src/components/ui/RowList.tsx | Not confirmed on every listed list |
| R0978 | On mobile, show borrowing requests as cards with request name, status, most important date; tap for details | Done | src/pages/equipment/BorrowingPages.tsx |  |
| R0979 | Apple design philosophy for appointments: clear hierarchy, spacious layout, large type, simple language, subtle borders, minimal colors,… | Done | src/pages/appointments/AppointmentPages.tsx |  |
| R0980 | Do not compress desktop appointment tables on mobile; show appointments as simple cards (name, date, time, purpose, [View Appointment]) | Done | src/pages/appointments/AppointmentPages.tsx |  |
| R0981 | On mobile, show simple list of available dates/times instead of a dense desktop calendar | Done | src/pages/appointments/AppointmentPages.tsx |  |
| R0982 | Mobile forms: single column, full-width inputs, grouped sections in logical order, clear labels, correct keyboard types, large… | Done | src/components/ui/Field.tsx |  |
| R0983 | Long registration/application forms use steps or collapsible sections without removing fields; Save/Submit/Cancel easily reachable | Done | src/pages/public/RegisterPage.tsx |  |
| R0984 | Forms: clearly mark required fields, give short examples, explain accepted file formats and why documents are needed, flag missing info… | Done | src/lib/validation.ts |  |
| R0985 | QA every page at real viewport widths 320, 360, 375, 390, 414, 430, 768, 1024, 1366, 1440px (mobile, tablet, laptop, desktop) for… | Partial | docs/PATCH_NOTES.md | 390, 430, 1366 not recorded |
| R0986 | Responsive QA verifies every row is tappable, every detail accessible, back navigation works, and search, filtering, pagination and… | Partial | docs/PATCH_NOTES.md | No recorded QA of every row/permission |
| R0987 | Keep registration review UI clean and Apple-inspired: minimal text, clear labels; avoid unnecessary badges, decorative statuses, redundant… | Done | src/pages/residents/ReviewPages.tsx |  |
| R0988 | Work Queue rows: primary = document/service and resident name; secondary = transaction ID and date; compact status badge on right | Superseded | src/pages/dashboard/SecretaryDashboard.tsx | Replaced by R0974/R0975 (no ID/date in lists) |
| R0989 | Work Queue dates shown as "Nov 5, 2026" without time unless needed; keep original timestamps stored | Superseded | src/pages/dashboard/SecretaryDashboard.tsx | Dates removed per R0975 |
| R0990 | Work Queue status badges: Pending Review amber, Under Verification blue, Approved by Secretary green, Ready for Printing green, Needs… | Superseded | src/pages/dashboard/SecretaryDashboard.tsx | Badges removed per R0869/R0871 |
| R0991 | Work Queue: reduced padding, subtle dividers, refined blue header with subtle "View All"; badges wrap on small screens without overlap | Superseded | src/pages/dashboard/SecretaryDashboard.tsx | Padding replaced by R0992 |
| R0992 | Work queue: increase container height/padding, align with surrounding components, avoid unnecessary borders/decoration. | Done | src/pages/dashboard/SecretaryDashboard.tsx |  |
| R0993 | Work queue header "Your work queue" ~20–22px semibold; "View All" readable and easy to click; heading and action vertically centered. | Partial | src/components/ui/Panel.tsx | Panel title is 19px, below 20-22px |
| R0994 | Optional Work Queue summary (Total Requests, Needs Action, Completed Stages) only if meaningful, counts computed from real records | Done | src/pages/dashboard/SecretaryDashboard.tsx |  |
| R0995 | Work queue metric labels (e.g. "Needs your action", "Open requests", "Completed this week") 16–17px medium weight with sufficient contrast. | Done | src/pages/dashboard/SecretaryDashboard.tsx |  |
| R0996 | Work queue metric numbers are the primary focus: ~30–36px (suggested 34px) bold/semibold, consistently aligned, readable at larger font… | Done | src/pages/dashboard/SecretaryDashboard.tsx |  |
| R0997 | Work queue spacing: more space between labels and numbers, balanced three columns with adequate width/padding, subtle dividers, responsive. | Done | src/pages/dashboard/SecretaryDashboard.tsx |  |
| R0998 | Preserve all queue requests, IDs, names, statuses, View All navigation; no fabricated records or counts | Partial | src/pages/dashboard/SecretaryDashboard.tsx | IDs/statuses dropped from queue rows (on detail only) |
| R0999 | Recent Transactions follows the format of a user-supplied reference image while keeping BMIS design | Partial | src/pages/dashboard/CustodianDashboard.tsx | Reference image not available to compare |
| R1000 | Metric cards: equal heights, balanced final row, consistent padding (20–24px desktop), labels 16–17px, numbers 30–36px semibold/bold,… | Done | src/components/ui/StatCard.tsx |  |
| R1001 | Secretary metric icon colors: neutral navy for pending registrations, pending documents, forwarded to Chairman; muted blue for under… | Not built | src/pages/dashboard/SecretaryDashboard.tsx | Secretary stat cards have no icons |
| R1002 | Redesign secondary cards as one "Needs attention" section of action rows: Registrations to verify, Resident update requests, Complaints… | Done | src/pages/dashboard/SecretaryDashboard.tsx |  |
| R1003 | Needs attention rows: one icon, short label, right-aligned count, subtle chevron, consistent heights, subtle separators, whole row… | Done | src/pages/dashboard/SecretaryDashboard.tsx |  |

## Landing page

Done: 18 · Superseded: 3 · Partial: 2 · Needs policy: 1 · Not built: 1

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R1004 | Public homepage shown first (not login) identifying "BARANGAY 181 / Zone 16, District II / City of Manila, Philippines" as official… | Done | src/pages/public/HomePage.tsx |  |
| R1005 | Homepage is government-appropriate (not SaaS), clean, easy for all ages, fully responsive desktop/tablet/mobile | Done | src/pages/public/HomePage.tsx |  |
| R1006 | Do not invent an official seal or logo; use provided visual assets only | Done | src/components/layout/BarangaySeal.tsx |  |
| R1007 | No generic stock imagery or invented barangay photos; use typography-based layout if no authentic photos | Done | src/pages/public/HomePage.tsx |  |
| R1008 | Navbar/header: seal and Barangay 181 identity, Home, About (Barangay 181 / Us), Services, Contact Information, prominent Login/Access… | Done | src/pages/public/PublicLayout.tsx |  |
| R1009 | Hero: "Welcome to the Digital Portal of Barangay 181" with CTAs "Access the Portal" and "Explore Services" | Superseded | src/pages/public/HomePage.tsx | Replaced by R1010/R1011 |
| R1010 | Remove the "Explore Services" button on the homepage | Done | src/pages/public/HomePage.tsx |  |
| R1011 | Hero: "Welcome to Barangay 181", short intro, prominent Create Account and Resident Login buttons | Partial | src/pages/public/HomePage.tsx | Buttons present; title still "Welcome to the Digital Portal of Barangay 181" |
| R1012 | Stretch landing page content horizontally (including "What you can do through the portal" section) to use the empty space while keeping… | Done | src/pages/public/HomePage.tsx |  |
| R1013 | Center the big Barangay logo background on the public landing page; it currently sits too far left behind centered content | Partial | src/pages/public/HomePage.tsx | Seal sits right of text, not centred; hidden below 1024px |
| R1014 | Fix mobile landing page so users can scroll and read all content clearly without confusion | Done | docs/PATCH_NOTES.md | Phone fixes at 320-768 recorded |
| R1015 | About section uses only verified study info (Barangay 181, Zone 16, District II, Manila) | Done | src/pages/public/HomePage.tsx |  |
| R1016 | Barangay information: address, officials, contact details, office information | Done | src/pages/public/HomePage.tsx |  |
| R1017 | Services section lists only documented services (Residency, Indigency, Clearance, First Time Job Seeker, Incident Reporting, Complaint… | Done | src/pages/public/HomePage.tsx |  |
| R1018 | Services cards (Document Requests, Complaints and Incident Reports, Equipment Borrowing) each with icon, title, description and action… | Done | src/pages/public/HomePage.tsx |  |
| R1019 | Contact section: never fabricate phone, email, hours or social accounts; show only documented details | Superseded | src/config/barangay.ts | Replaced by R1020 filler contacts |
| R1020 | Home "Need Assistance": position "View contact information" properly; replace "to be provided" with editable filler contact info | Done | src/config/barangay.ts | Placeholder contacts (example.com) await real values |
| R1021 | Footer: identity, Zone 16 District II Manila, quick navigation, services, verified contact, copyright | Done | src/pages/public/PublicLayout.tsx |  |
| R1022 | Public transparency portal without login: announcements, programs, events, office schedules, project updates, public reports,… | Needs policy | src/pages/public/HomePage.tsx | Nothing built; public-disclosure scope needs barangay decision |
| R1023 | Help Center with FAQs, service requirements, processing times, office schedules, contacts, first-time user instructions in plain language | Not built | src/pages/public/HomePage.tsx | No Help Center or FAQ |
| R1024 | Login/Access the Portal leads to a role selection page ("Welcome to Barangay 181 / How would you like to access the portal?") with 6… | Done | src/config/accountTypes.ts | Kagawad replaces removed Authorized Personnel |
| R1025 | Each role card has icon, title, one-line description, selection state, hover and press animation | Done | src/pages/public/PortalPage.tsx |  |
| R1026 | Selected role carries into its login screen without reselecting; Back returns to role selection | Done | src/pages/public/RoleLoginPage.tsx |  |
| R1027 | Role-specific login page title (e.g. "Barangay Secretary Login") with Username or Email, Password, show/hide, Remember me (if supported),… | Done | src/pages/public/RoleLoginPage.tsx |  |
| R1028 | Enforce sequence Homepage, Login, Select Account Type, Role-Specific Login; no shortcut opens a dashboard | Superseded | src/pages/public/HomePage.tsx | R1011 Resident Login goes straight to resident login |

## Other

Partial: 93 · Done: 59 · Frontend only: 14 · Not built: 12 · Superseded: 5 · Needs policy: 3

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| R1029 | FRONTEND ONLY: no production database, migrations, APIs, real/server auth or authorization, real OCR/face recognition, email or file… | Partial | package.json | No backend, but in-browser OCR (tesseract.js) and face check built |
| R1030 | Push the project to https://github.com/MaeVisionary/brgy-181 only; never push to the other (shoeboxmoses) account; confirm no push… | Done | .git/config | Remote is MaeVisionary/brgy-181 |
| R1031 | Every push must appear authored as Mae; remove Claude as GitHub contributor; no Claude attribution in commits | Done | git log | All 56 commits by Mae; no Claude trailers |
| R1032 | Ask before history-rewriting or force pushes | Done | git log | No sign of force pushes; not fully verifiable |
| R1033 | Do not show open questions in the app; decide sensible defaults and work autonomously | Done | src/ | No "Pending Barangay Confirmation" or open questions in UI |
| R1034 | Implement, do not just plan, suggest, mock up or give snippets; do not stop at the first fix, milestone, audit, redesign or build; fix… | Partial | docs/PATCH_NOTES.md | Ongoing; many requirements still open |
| R1035 | Resume and complete the briefs/implementation prompt that were interrupted when the user clicked stop | Partial | docs/PATCH_NOTES.md | Interrupted brief not identifiable; cannot verify |
| R1036 | Free, always-up hosting that auto-updates on every push (GitHub Pages chosen, Vercel rejected) | Done | .github/workflows/deploy.yml | GitHub Pages |
| R1037 | Advise a free, safe, lifetime-free stack for database and other parts | Done | docs/supabase/ |  |
| R1038 | Groupmates can pull from GitHub in VS Code and run the app; VS Code set up to run locally | Partial | README.md | README run steps tracked; .vscode tasks not committed |
| R1039 | VS Code should always update when GitHub is updated | Partial | .vscode/settings.json | Autofetch/pull task exists only locally (.vscode/* ignored) |
| R1040 | Test account ruffamaesilorio01@gmail.com that can switch to every role level including resident | Done | src/config/testAccount.ts |  |
| R1041 | Second test account testaccount@gmail.com working like the first | Done | src/config/testAccount.ts |  |
| R1042 | Create separate test accounts for every role (Resident, Secretary, Chairman, Treasurer, Kagawad, Property Custodian, System Administrator)… | Partial | src/mocks/users.ts | Seed account per role; no allowed/prohibited test suite |
| R1043 | Produce a concise design system reference before building pages | Partial | src/components/ui/Button.tsx | Standards in code comments; no standalone design-system reference |
| R1044 | Phase 1 deliverables: architecture doc, database diagram, role-permission matrix, module breakdown, roadmap, open questions | Partial | docs/PERMISSION_MATRIX.md | No database diagram; roadmap in SYSTEM_AUDIT doc |
| R1045 | Project identity: "Barangay 181, Zone 16, District II, Manila Information Management System (BMIS)" | Done | src/config/app.ts |  |
| R1046 | Use the masterlist "UPDATED MASTERLIST OF BRGY 181 ZONE 16 ... JULY 30 2025" as the barangay list | Done | src/analytics/snapshot.ts |  |
| R1047 | Follow the final paper SE Group 4 (11).docx; add patch notes for features not in the paper | Done | docs/PATCH_NOTES.md |  |
| R1048 | Implement the items in "SE Group 4.pdf" | Partial | docs/PATCH_NOTES.md | Source PDF not available; cannot verify |
| R1049 | Validate dashboard figures against the uploaded Excel file before finalizing | Partial | src/analytics/compute.ts | No recorded validation against the Excel file |
| R1050 | Personalize the whole system to Barangay 181 (officials, structure, roles, resident structure, documents, procedures, KP, equipment,… | Done | src/config/barangay.ts |  |
| R1051 | Audit current implementation against source documents (study, FR1-FR24, NFR1-NFR16, workflows, templates, Figma) and list generic labels,… | Done | docs/SYSTEM_AUDIT_AND_ROADMAP.md |  |
| R1052 | Centralized Barangay 181 config: name, zone/district, city, personnel, positions, roles, document types, workflows, equipment categories,… | Done | src/config/barangay.ts |  |
| R1053 | QA pass: names, role labels, distinct dashboards, workflows, forms, consistent sample data, templates, no placeholders, no invented… | Partial | docs/REDESIGN_REPORT.md | No complete QA record |
| R1054 | Add all barangay officials with actual names: Chairman Robert Atad; Secretary Ana Manila Salvador; Kagawads Angelito Dela Cruz, Renz… | Done | src/config/barangay.ts |  |
| R1055 | Do not use generic names (John Doe, Admin User, Barangay Staff 1, Personnel A) for primary personnel accounts | Done | src/mocks/users.ts |  |
| R1056 | Display the seven Kagawad members individually | Done | src/pages/public/HomePage.tsx |  |
| R1057 | Do not invent departments, committees, Kagawad portfolios or responsibilities | Done | src/config/barangay.ts |  |
| R1058 | Property Custodian role shown by position title with configurable name; do not invent a person; other authorized personnel configurable,… | Done | src/mocks/users.ts | Custodian named by title only |
| R1059 | Distinct SK Chairman profile/role (Kriscelli Ann Reyes); no invented SK programs, events, budgets or obligations; not a duplicate of… | Superseded | src/config/barangay.ts | Replaced by R1060 |
| R1060 | Remove SK Chairman from the officials/roles list ("we don't have that sk") | Done | src/config/barangay.ts |  |
| R1061 | Do not invent or fabricate data, information the system does not collect, functionality, permissions, workflows, official requirements,… | Partial | src/config/barangay.ts | Placeholder contacts and sample records appear on live site |
| R1062 | Do not invent fees, penalties, approval steps, document requirements/templates, hearing dates, case outcomes, official statistics; do not… | Partial | src/config/serviceStandards.ts | Processing times are flagged "initial estimate" defaults |
| R1063 | Do not promise exact processing times unless supported by actual barangay procedures | Needs policy | src/pages/admin/ServiceStandardsPanel.tsx | Estimates labelled until barangay sets times |
| R1064 | Mark missing or unclear information as "Pending Barangay Confirmation"; source documents override existing implementation | Superseded | src/ | R1033 (no questions in app) is later |
| R1065 | Do not change approved barangay policies on assumptions; document assumptions and make unclear policy configurable | Done | src/pages/admin/BorrowingPolicyPanel.tsx |  |
| R1066 | Use a small, clearly labeled, internally consistent sample dataset; no hundreds of fabricated residents; never present samples as verified… | Done | src/mocks/residents.ts |  |
| R1067 | Mock data is consistent across modules (same resident in request details, tracking and history); do not reuse one sample record everywhere | Done | src/mocks/documentRequests.ts |  |
| R1068 | Dashboard statistics computed from mock datasets, not random or hardcoded | Done | src/analytics/compute.ts |  |
| R1069 | Keep mock data separated from UI behind a modular service layer replaceable by APIs; separate application logic, data access, file… | Done | src/services/mockApi.ts |  |
| R1070 | Clearly distinguish implemented, simulated/mock, backend-ready and future-integration features; never claim data persists/syncs, Supabase… | Frontend only | src/services/emailService.ts | Emails marked "not sent"; approvals are local only |
| R1071 | When an external service/integration is not configured: build the integration boundary/architecture, identify the dependency, never… | Done | src/services/emailService.ts | OTP intentionally not simulated |
| R1072 | Do not stop at UI/button/mock email/status label/hardcoded data/frontend-only permission; inspect codebase, use actual data fields and… | Frontend only | src/services/ | Mock services stand in for backend |
| R1073 | Preserve existing working functionality, records, workflows and features (auth, registration, portal, search, filters, pagination, forms,… | Partial | docs/PATCH_NOTES.md | No regression tests to prove preservation |
| R1074 | Redesign preserves DB connections, APIs, auth, RBAC, CRUD, validation, routes; no mock data in production workflows; no duplicate… | Frontend only | src/services/mockApi.ts | Conflicts with frontend-only scope |
| R1075 | Cleanup is UI-only: preserve records, imported files, normalization/grouping logic, calculations, exports, permissions, audit logs; keep… | Done | docs/PATCH_NOTES.md |  |
| R1076 | Test the full homepage-to-login navigation on desktop and mobile; do not break existing modules or dashboards | Partial | docs/PATCH_NOTES.md | Manual checks only |
| R1077 | Before changing anything, perform full discovery: inventory every page, route, role, nav item, table, form, modal, upload, CRUD op,… | Done | docs/SYSTEM_AUDIT_AND_ROADMAP.md |  |
| R1078 | Evaluate each page against 10 questions: necessary, correct role, unnecessary info, redundant statuses, clear primary action, mobile,… | Partial | docs/SYSTEM_AUDIT_AND_ROADMAP.md | No per-page 10-question record |
| R1079 | Page-by-page audit of every module and page (dashboards, analytics, residents, households, documents, blotter, complaints, equipment,… | Partial | docs/PATCH_NOTES.md | Not every page/state audited |
| R1080 | Visually inspect every page after implementation against 12 quality questions; redesign pages that feel crowded or AI-generated; a page is… | Partial | docs/PATCH_NOTES.md | No 12-question inspection record |
| R1081 | Inspect every page in both Personnel and Resident portals for typography, spacing, alignment, responsiveness, and large-font behavior;… | Partial | docs/PATCH_NOTES.md |  |
| R1082 | Test header and major pages at 320, 360, 375, 390, 430px, tablet, desktop; with default/increased/max font, open menus/notifications, long… | Partial | docs/PATCH_NOTES.md | Orientations and 390/430 not recorded |
| R1083 | Audit icons, create a replacement plan, then implement and test (not just recommend) | Done | src/icons/index.tsx |  |
| R1084 | Perform contradiction audit: find where two parts of system disagree and resolve; document every discrepancy | Partial | docs/REQUIREMENTS_INVENTORY.md | Conflicts listed, not all resolved |
| R1085 | Cross-reference matrix per module: Feature, Resident side, Personnel side, Permission, Backend, Notification, Tested (expand to every… | Not built | docs/ | No cross-reference matrix |
| R1086 | Produce a feature inventory classifying every feature as: existing and working, existing but incomplete, broken, duplicated, missing,… | Partial | docs/SYSTEM_AUDIT_AND_ROADMAP.md | Not every feature classified |
| R1087 | Benchmark BRGY 181 against DILG LGU support system, BIMS, Citizen's Charter implementations, public service portals, Apple HIG, Microsoft… | Partial | docs/SYSTEM_AUDIT_AND_ROADMAP.md | DILG, OWASP covered; not all benchmarks |
| R1088 | Investigate whether the barangay should adopt, complement, or integrate with the official DILG system rather than duplicate it | Needs policy | docs/SYSTEM_AUDIT_AND_ROADMAP.md | LGUSS-BIMS question raised |
| R1089 | For each barangay service workflow (registration, corrections, households, documents, certificates, clearances, complaints, incidents,… | Partial | docs/SYSTEM_AUDIT_AND_ROADMAP.md | Not documented per workflow |
| R1090 | Assess need for DRRM, emergency response, evacuation, relief distribution, archives, document verification, deadline monitoring, data… | Partial | docs/SYSTEM_AUDIT_AND_ROADMAP.md |  |
| R1091 | Non-functional targets: records retrieved < 1 min, reports < 5 min, status visible < 1 min, ~1,000-2,000 residents, desktop backup process… | Frontend only | docs/SYSTEM_AUDIT_AND_ROADMAP.md | Performance/backup need backend |
| R1092 | Evaluate reliability: poor internet, draft saving, failed submissions, duplicate-submission prevention, notification delivery, background… | Frontend only | src/lib/idempotency.ts | Drafts and duplicate prevention done; backups/monitoring need backend |
| R1093 | Provide a fallback process for when the system is unavailable | Partial | docs/SYSTEM_AUDIT_AND_ROADMAP.md | Fallback listed in roadmap only |
| R1094 | Modules share data: residents link to document requests, complaints to hearings, borrowing to inventory, reports to records, audit across… | Done | src/services/ | Linked in mock layer |
| R1095 | Cross-module integration: registration approval updates status and unlocks services; document requests create transactions in history;… | Partial | src/services/registrationService.ts | Permission changes not backend-applied |
| R1096 | Single source of truth for resident information: all resident modules read from the centralized profile; no duplicate resident records,… | Done | src/services/residentService.ts |  |
| R1097 | One source of truth for residents, requests, appointments, announcements, schedules, permissions, statuses; no disconnected duplicates,… | Done | src/services/ |  |
| R1098 | Do not add features that duplicate existing functionality or create multiple versions of the same feature | Done | src/config/navigation.ts |  |
| R1099 | Do not introduce unnecessary features that complicate the system | Done | src/config/navigation.ts |  |
| R1100 | Review and fix data integrity: duplicate residents/households, invalid birthdates, age calculation, addresses, resident numbers, missing… | Partial | src/pages/residents/ImportPage.tsx | Duplicates flagged; no full integrity review |
| R1101 | Calculate age from birthdate when needed; never hardcode it | Done | src/pages/residents/common.tsx |  |
| R1102 | Backend-ready design: PostgreSQL, Supabase Auth, Storage, RLS, server functions, constraints, indexes, audit; unique IDs, no duplicate… | Frontend only | docs/supabase/ | SQL designed, not applied |
| R1103 | Enforce foreign keys, required fields, unique constraints, referential integrity, safe updates, consistent timestamps, Philippine… | Frontend only | docs/supabase/ |  |
| R1104 | Database failures and interrupted auto-approvals must not leave inconsistent resident records | Frontend only | docs/supabase/ |  |
| R1105 | Resident directory for authorized personnel: search, view profiles, filter/sort, household info, registration/verification status;… | Done | src/pages/residents/ResidentsPage.tsx |  |
| R1106 | Support assisted service: personnel can create and process a request on behalf of a resident who cannot use the app | Done | src/pages/documents/NewAssistedRequestPage.tsx |  |
| R1107 | Record assisted-service indicator, encoding personnel, resident, date/time and supporting documents on assisted requests | Partial | src/types/document.ts | Records encoder and time; supporting documents not confirmed |
| R1108 | Each module/workflow has its own status lifecycle (defined statuses, valid transitions, authorized actions, history, notifications,… | Done | src/documents/workflows.ts |  |
| R1109 | Centralized status mapping: store real workflow statuses in DB, map labels at presentation layer, keep status history with who/when,… | Frontend only | src/lib/residentStatus.ts | Backend transition validation needed |
| R1110 | Preserve historical statuses; never silently convert existing records to incorrect statuses; never use CSS alone to hide wrong options | Done | src/lib/residentStatus.ts |  |
| R1111 | Audit every page, filter, dashboard, notification, report, DB mapping and endpoint for universal dropdowns, irrelevant/duplicate/unused… | Partial | src/documents/listStatus.ts | No recorded full audit |
| R1112 | Preserve existing filters, search, pagination, sorting, records, relationships, and approval/rejection/forwarding actions in request… | Done | src/hooks/useStickyState.ts |  |
| R1113 | Role dashboards: Admin (users, roles, activity, backup), Chairman (approvals, hearings, stats), Secretary (registrations, changes,… | Done | src/pages/dashboard/DashboardPage.tsx | Treasurer dashboard removed |
| R1114 | Personnel portal modules: Dashboard, Residents, Households, Document Requests, Complaints and Cases, Equipment and Property, Reports,… | Superseded | src/config/navigation.ts | Replaced by R1115 |
| R1115 | Personnel portal includes: dashboard, secretary overview, registration verification, resident mgmt, household mgmt, correction mgmt,… | Done | src/App.tsx |  |
| R1116 | Feature ownership matrix: Announcements (Secretary creates, Chairman approves); Calendar (authorized personnel); Documents… | Done | src/config/permissions.ts |  |
| R1117 | Every resident-facing feature must have a personnel workflow that manages it, reflects changes to resident, notifies, enforces… | Partial | src/services/ | Not verified for every feature |
| R1118 | Personnel actions with no resident-facing outcome: investigate necessity and whether resident should be updated | Partial | src/services/ |  |
| R1119 | Distinct routes such as /resident/document-requests(/new, /:id) and /resident/complaints(/new, /:id), adapted to existing routing; no… | Done | src/App.tsx |  |
| R1120 | Every action leads to its intended workflow: Borrow equipment not to documents, File a report not to documents, Request certificate not to… | Done | src/App.tsx |  |
| R1121 | Implement financial approval and verification workflows; separate financial preparation from approval | Superseded | src/config/permissions.ts | Treasurer removed; Secretary records receipts |
| R1122 | Personnel task management: create, assign, prioritize, deadline, instructions, progress, complete; show requiring action, overdue,… | Not built | src/ | No personnel task management |
| R1123 | Personnel attendance, duty schedules, shifts, availability, leave records managed by Secretary/admin; no unnecessary employee info exposure | Partial | src/pages/admin/SchedulingRulesPanel.tsx | Staff leave/hours only; no attendance or shifts |
| R1124 | Social welfare monitoring (senior, PWD, 4Ps, aid programs) with strict permissions | Partial | src/pages/analytics/SeniorTab.tsx | Sector tags and seniors; no aid-program monitoring |
| R1125 | Emergency management: flood reports, fire incidents, emergency concerns, evacuation centers, emergency contacts, resources, response… | Not built | src/ | Release 3 |
| R1126 | Personnel can record emergency incidents, assign responders, monitor progress, record actions, track affected households, generate… | Not built | src/ | Release 3 |
| R1127 | Community needs surveys analyzing needs, satisfaction, zone concerns, program demand; avoid unnecessary personal data | Not built | src/ | Release 3 |
| R1128 | Project monitoring: name, location, responsible personnel, timeline, budget (authorized), progress, docs, completion records | Not built | src/ | Release 3 |
| R1129 | Citizen satisfaction feedback on completed services (satisfaction, processing, responsiveness, difficulties) with privacy and… | Not built | src/ | Release 3 |
| R1130 | Preserve historical records of restricted services; personnel keep access to internal workflows | Done | src/services/documentService.ts |  |
| R1131 | QA: resident sees none of five restricted services, direct URL/endpoint denied, permitted certificates and complaints still work,… | Partial | src/services/documentService.ts | Restriction built; no recorded QA |
| R1132 | No non-functional/dead/placeholder buttons, fake interactions, fake statistics, static fake tables, non-saving forms, dead links, mock… | Partial | src/services/announcementService.ts | Sample records shown on live site |
| R1133 | Verify every interactive element works with correct action, record, permissions, validation, feedback, errors, no duplication (add, edit,… | Partial | docs/PATCH_NOTES.md | No automated interaction tests |
| R1134 | No dead navigation links: every button, link, menu, tab and nav item reaches a working page with correct destination, data, permissions… | Done | src/App.tsx | No pending-module routes remain |
| R1135 | Search, filters, clear filters, pagination and sorting must work, respect permissions and handle empty results; keep resident filters… | Done | src/pages/residents/ResidentsPage.tsx |  |
| R1136 | Each form only requests info relevant to its purpose (document, complaint, equipment, correction); do not use one universal form for… | Done | src/pages/resident/RequestFormPage.tsx |  |
| R1137 | Form validation: required fields, appropriate input types, dates, files, duplicate submission prevention, clear errors, confirm… | Done | src/lib/validation.ts |  |
| R1138 | Find and fix: wrong redirects, wrong shared forms, wrong tables, duplicate refs, wrong counts, unrelated status filters, unauthorized… | Partial | docs/PATCH_NOTES.md | 20-item checklist not recorded |
| R1139 | Fix root causes in shared components rather than patching individual screens; prioritize security and data integrity before cosmetics | Done | src/components/ui/Button.tsx |  |
| R1140 | Review performance: duplication, rerenders, large datasets, repeated calls, oversized images/assets, unused deps/CSS, dead code; use… | Partial | src/services/mockApi.ts | All records loaded into browser |
| R1141 | Use reusable components and centralized configs; avoid complicated architecture when a simpler solution suffices | Done | src/config/ |  |
| R1142 | Implement a centralized request processing engine all resident requests pass through before reaching the Secretary | Partial | src/services/processingService.ts | No single engine for every request type |
| R1143 | Engine classifies requests: auto-processable, waiting resident verification, waiting docs, Secretary review, Chairman approval, in-person… | Partial | src/pages/dashboard/SecretaryDashboard.tsx | Classes shown as counts, not an engine |
| R1144 | Automation decision classes: Automatically approved (low-risk, explicit rules, verified, policy permits); Automatically rejected… | Needs policy | src/services/registrationService.ts | Auto-approval needs barangay rules |
| R1145 | Engine 9-step sequence: identify type, fetch record, check duplicates, validate, apply rules, decide automation, act, notify, audit; never… | Partial | src/services/processingService.ts |  |
| R1146 | Automation rule stops processing if any required condition fails | Partial | src/services/registrationService.ts |  |
| R1147 | Automation rules module: rule name, request type, conditions, validation steps, action, responsible role, risk class, enabled flag,… | Not built | src/pages/admin/ | No automation rules module |
| R1148 | Every automated decision is traceable; store rule applied, decision, timestamp, evidence, system version, human override | Partial | src/services/auditService.ts | Rule/version/evidence not stored |
| R1149 | Secretary work queue sections: Needs My Attention, Automatically Processed, Waiting for Resident, Waiting for Chairman, Processing… | Done | src/pages/dashboard/SecretaryDashboard.tsx | "Who needs to act" panel |
| R1150 | Processing Exceptions shows failed automation, DB conflicts, duplicates, verification failures, system errors, with reason automation… | Partial | src/pages/dashboard/SecretaryDashboard.tsx | Only "past expected date" exceptions |
| R1151 | Dashboard counts: requiring action, auto-processed, waiting residents, awaiting Chairman, processing errors; pending count excludes… | Done | src/pages/dashboard/SecretaryDashboard.tsx |  |
| R1152 | Integrate automation into existing Resident, Secretary, Chairman, and System Admin portals; no disconnected feature | Partial | src/services/ | Not in Chairman/Admin portals |
| R1153 | Audit every manual personnel task and automate when safe: scheduled announcement publish/notify/archive, appointment… | Partial | src/services/appointmentService.ts | Many jobs automated; not all listed |
| R1154 | Secretary workload reduced through safe automation (verified) | Partial | src/pages/dashboard/SecretaryDashboard.tsx | Not measured |
| R1155 | Do not implement AI or automated decisions on legal, identity, disciplinary or sensitive matters without validation and human review;… | Done | src/lib/idOcr.ts | Inconclusive goes to manual review |
| R1156 | Never use AI confidence alone as authorization to approve or reject a transaction | Done | src/lib/faceVerify.ts |  |
| R1157 | Follow the 15-step security implementation order from auditing auth/roles through hardening, testing, fixing, and retesting | Frontend only | docs/SECURITY_REPORT.md |  |
| R1158 | Run security QA: logout cases, permission management (expired/reused OTP rejected, rate limits, payload change invalidates challenge),… | Frontend only | docs/SECURITY_REPORT.md | OTP not implemented |
| R1159 | Automated security tests (Playwright + API) covering the 20-scenario table: pending approval, self-approval rejected, escalation rejected,… | Not built | package.json | No Playwright/API tests |
| R1160 | Perform horizontal/vertical escalation, session fixation, CSRF, IDOR, API authorization, RLS, rate-limit, concurrent approval, and… | Not built | package.json | No security tests |
| R1161 | Security QA: unauthorized access, direct URLs, API authZ, resident isolation, personnel boundaries, escalation, unauthorized approvals,… | Frontend only | src/auth/guards.tsx |  |
| R1162 | Release gate: no real resident data until 15 checklist items verified (two-person, self-approval, server OTP, notifications, backend… | Frontend only | docs/SECURITY_REPORT.md |  |
| R1163 | Do not declare the system production-ready or claim production security until backend protections, security, privacy, data integrity,… | Done | docs/SECURITY_REPORT.md | Not claimed production-ready |
| R1164 | Run usability scenarios: registration, Indigency request, Business Clearance with ocular inspection, complaint and mediation, equipment… | Partial | docs/REDESIGN_REPORT.md |  |
| R1165 | Test scenarios A-H: new resident, existing resident autofill, expired ID, no-expiry ID, missing info, failed verification, mobile, security | Partial | docs/PATCH_NOTES.md | No recorded A-H results |
| R1166 | Test submitted, under review, approved, ready, downloadable, info-needed, delayed, cancelled, pre-weekend/holiday, incomplete requests;… | Partial | src/services/serviceStandardService.ts | No recorded test run |
| R1167 | Test the full registration workflow with realistic test accounts across 24 listed scenarios (valid ID, mismatch, expired, unreadable, face… | Partial | docs/PATCH_NOTES.md | 24 scenarios not recorded |
| R1168 | Confirm the 18-item registration quality-control checklist (view all fields, inspect IDs, expiry check, accurate verification,… | Partial | src/pages/residents/ReviewPages.tsx | Email delivery and backend RBAC missing |
| R1169 | QA the app with 10 user scenarios (elderly first-time user, low vision, largest font, small Android, non-technical, wrong input, ID… | Partial | docs/PATCH_NOTES.md | No 10-scenario record |
| R1170 | Test matrix: Authentication, Account Setup, Role Mgmt, Dashboard, Residents, Households, Document Requests, Complaints, Reports,… | Not built | package.json | No test matrix or test runner |
| R1171 | Functional QA of registration, login/logout, ID verification, profile, corrections, documents, complaints, concern grouping, tracking,… | Partial | docs/PATCH_NOTES.md |  |
| R1172 | Cross-role end-to-end journey tests: document request; complaint filing through personnel processing to resident progress;… | Partial | docs/PATCH_NOTES.md |  |
| R1173 | Regression-test after each fix; never use production resident data for destructive tests | Partial | package.json | No regression suite |
| R1174 | Data QA with synthetic data: duplicates, missing info, invalid dates, expired IDs, invalid uploads, calculations, status transitions,… | Partial | src/mocks/ |  |
| R1175 | Backend audit: schema, foreign keys, ownership, unique refs, transitions, validation, APIs, auth, uploads, notification generation, audit… | Frontend only | docs/supabase/ |  |
| R1176 | QA the in-person verification flow from both portals: 17 checks incl. conflicts blocked, reschedule notice, failed verification not… | Partial | src/pages/appointments/AppointmentPages.tsx |  |
| R1177 | Test edge cases: no-show, late arrival, Secretary unavailable, cancellation, reschedule, missing documents, expired ID, mismatched ID, two… | Partial | src/services/appointmentService.ts | No-show, conflicts handled; not all tested |
| R1178 | Empty, loading, error and success states work correctly in appointment flows | Done | src/pages/appointments/AppointmentPages.tsx |  |
| R1179 | Test 20 appointment scenarios plus loading, empty, errors, network failures, duplicates, cancellations, time zones, persistence,… | Partial | docs/PATCH_NOTES.md |  |
| R1180 | Run 25 test scenarios incl. OTP, duplicate number/email, concurrency, name/ID cases, address in/out, document requests, complaints,… | Partial | docs/PATCH_NOTES.md |  |
| R1181 | Test announcement workflow end-to-end (create, draft, preview, submit, Chairman notified/opens/approves, publish, residents notified/read,… | Partial | docs/PATCH_NOTES.md | Some cases tested |
| R1182 | Final QA: review every page desktop and mobile, test every button/link/role permission/announcement state/notification; check no long… | Partial | docs/PATCH_NOTES.md |  |
| R1183 | Add/improve automated tests: unit, integration, API authorization, DB policies, role permissions, form validation, status transitions,… | Not built | package.json | No unit/integration tests |
| R1184 | Run project build, linting, type checks, existing tests; do not hide failures by disabling tests or weakening validation/security | Partial | package.json | Build and lint exist; no tests |
| R1185 | Do not claim a feature or fix complete without testing; do not assume a feature works because its interface exists, code was written or it… | Partial | docs/PATCH_NOTES.md | Visual checks only |
| R1186 | Produce a checklist of issues, root causes, fixes and verification results; never claim a fix without testing (incl. console errors) | Partial | docs/REDESIGN_REPORT.md |  |
| R1187 | Final deliverables: audit summary, redesigned pages, new features, preserved features, backend changes, security, test results,… | Partial | docs/REDESIGN_REPORT.md |  |
| R1188 | Provide final QA report: pages inspected, bugs found, bugs fixed, tests performed/passed/failed, remaining issues, unverifiable items;… | Partial | docs/REDESIGN_REPORT.md |  |
| R1189 | Final delivery report: completed improvements, role/security changes, mobile improvements, workflow corrections, storage improvements, QA… | Partial | docs/PATCH_NOTES.md |  |
| R1190 | Deliver 16 security deliverables (audit, vulnerabilities, architecture, role/permission matrix, two-person workflow, schema/migrations,… | Partial | docs/SECURITY_REPORT.md | Some deliverables need backend |
| R1191 | Mark every requirement as Completed and tested / Implemented but not tested / Pending / Blocked / Not applicable with justification | Superseded | docs/ | Replaced by R1208 |
| R1192 | Final report: inspected, improved, implemented, fixed, active security, Supabase-ready items, external config needed, tests… | Partial | docs/PATCH_NOTES.md |  |
| R1193 | Before declaring completion, report: modules updated, features, automated workflows, DB changes, security controls, test results, known… | Partial | docs/PATCH_NOTES.md |  |
| R1194 | Provide implementation report: pages updated, components simplified, announcement workflow, automations, security checks,… | Partial | docs/PATCH_NOTES.md |  |
| R1195 | Produce audit/fix report: issues (page, description, severity, root cause, roles, correction), features implemented with files,… | Partial | docs/SYSTEM_AUDIT_AND_ROADMAP.md |  |
| R1196 | Final report: audit findings, contradictions, corrections, modules tested, security improvements, limitations, failed tests, items needing… | Partial | docs/SYSTEM_AUDIT_AND_ROADMAP.md |  |
| R1197 | Satisfy Part 28 acceptance checklist across Design, Mobile, Security, Resident Experience, Workflows, Data and Storage, Reports and… | Partial | docs/ | Checklist not satisfied (security, tests) |
| R1198 | Release acceptance checklist (20 items) must be satisfied before declaring completion, e.g. all pages inspected, announcements/calendar… | Partial | docs/ | Backend items open |
| R1199 | Follow 7-phase process: discovery, audit, shared architecture fixes, role/workflow implementation, module-by-module redesign, QA (build,… | Partial | docs/ | QA phase lacks tests |
| R1200 | Produce prioritized roadmap; each item lists problem, why, solution, roles, pages, backend reqs, DB changes, security, legal validation,… | Partial | docs/SYSTEM_AUDIT_AND_ROADMAP.md | Not all fields per item |
| R1201 | Implement approved high-priority improvements in phases, test every affected page/role/workflow, and maintain a list of completed,… | Partial | docs/PATCH_NOTES.md |  |
| R1202 | Organize work into Release 1 (essentials/security), Release 2 (operations), Release 3 (advanced); advanced features must not delay… | Partial | docs/SYSTEM_AUDIT_AND_ROADMAP.md |  |
| R1203 | Priority order: P0 auth/data isolation/backend permissions/privileged changes/integrity/security; P1… | Partial | docs/SYSTEM_AUDIT_AND_ROADMAP.md | P0 items need backend |
| R1204 | Execution rules: do not redesign without understanding, do not remove working features, do not fabricate data, no fake integrations, no… | Done | docs/PATCH_NOTES.md |  |
| R1205 | Implementation rules: no duplicate modules, don't combine unrelated services, no new manual tasks, no fake functionality, no hardcoded… | Partial | src/ | Sample data on live site |
| R1206 | Double-check that everything previously sent has been implemented accurately | Partial | docs/REQUIREMENTS_INVENTORY.md | In progress |
| R1207 | Create historical requirements inventory of every prior requirement with module, role, expected behavior, dependencies, status,… | Partial | docs/REQUIREMENTS_INVENTORY.md | No status/evidence columns yet |
| R1208 | Categorize each requirement: Not implemented / Partially / Implemented not verified / Verified and working / Blocked by infrastructure or… | Partial | docs/REQUIREMENTS_INVENTORY.md | This assessment in progress |
| R1209 | Compare every prior requirement against actual code; do not mark complete because a page/button/design/mockup exists or frontend state… | Partial | docs/REQUIREMENTS_INVENTORY.md | In progress |
| R1210 | Treat repeated corrections as high-priority acceptance criteria | Partial | docs/REQUIREMENTS_INVENTORY.md |  |
| R1211 | For each outstanding requirement: investigate root cause, identify modules, implement, check side effects, test feature and cross-module… | Partial | docs/PATCH_NOTES.md |  |
| R1212 | Definition of done: every applicable requirement from all prior prompts implemented, integrated, tested, QC-approved with explicit… | Partial | docs/ | Not met |
| R1213 | Final system-wide regression audit of every role, page, nav item, form, button, modal, dropdown, status, notification, permission,… | Partial | docs/PATCH_NOTES.md |  |
| R1214 | Deliver historical requirements completion matrix (ID, requirement, module, implementation, test performed, evidence, final status) plus… | Partial | docs/REQUIREMENTS_INVENTORY.md | Matrix being built |

## Standing constraints

Done: 10 · Partial: 4

| ID | Requirement | Status | Evidence | Gap or note |
|---|---|---|---|---|
| C01 | Frontend only. Do not build a backend, database, APIs, real OCR or face processing, email or file storage until the user explicitly… | Partial | package.json | No backend; in-browser OCR and face check built |
| C02 | Push only to github.com/MaeVisionary/brgy-181. Never push to the other (shoeboxmoses) account, and confirm no push request goes there. | Done | .git/config |  |
| C03 | Every commit and push is authored as Mae. No Claude co-author line, no Claude logo, no Claude attribution. | Done | git log |  |
| C04 | Ask before any force push or history rewrite. | Done | git log | No violation seen |
| C05 | No fake or invented data: no hardcoded stats, no invented report formats, contact details, legal requirements, fees or names. Demo data is… | Partial | src/services/announcementService.ts | Sample records and placeholder contacts on live site |
| C06 | No demo accounts or credential shortcuts on the public login. The test accounts (ruffamaesilorio01@gmail.com, testaccount@gmail.com) come… | Done | .github/workflows/deploy.yml |  |
| C07 | Never commit the real masterlist PII. Only the approved de-identified (no-names) snapshot may be bundled. | Done | src/analytics/snapshot.ts |  |
| C08 | Never store secrets or sensitive resident data in public frontend code, and never treat a hidden frontend element as security. | Partial | .github/workflows/deploy.yml | Test password hashes built into bundle; RBAC client-side only |
| C09 | Work autonomously: don't show open questions in the app, choose sensible Philippine-context defaults, and don't keep asking the user. | Done | src/ |  |
| C10 | Preserve existing working functionality, and don't remove features while redesigning. | Partial | package.json | No regression tests |
| C11 | Don't claim a feature or integration works, or that the system is production-ready, until it has been tested. | Done | docs/SECURITY_REPORT.md |  |
| C12 | Official documents must reproduce the supplied templates exactly. A missing template is marked pending, never invented. | Done | src/config/reportTemplates.ts | Missing templates shown "Awaiting official file" |
| C13 | Remove developer-facing, AI-sounding and internal explanatory text and subtext from the UI. | Done | docs/PATCH_NOTES.md |  |
| C14 | Use 2026 for dates and the real officials' names. There is no SK Chairman. | Done | src/config/barangay.ts |  |
