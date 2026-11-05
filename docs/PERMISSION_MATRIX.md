# BMIS Role–Permission Matrix (DRAFT for review)

Status: **proposed**. Source in code: `src/config/permissions.ts`. The **Roles and Permissions** page in the Admin Console always shows the current matrix.

**Update (Barangay 181 personalization):** the **Barangay Kagawad** role was added and gets community analytics and reports by default. The SK Chairman role was removed because Barangay 181 has no SK Chairman. Kagawad accounts can receive extra permissions per account. The Chairman also has `cases.decide`: assess complaints, record a settlement or a Lupon referral.
In this frontend phase the matrix only controls what each role *sees*. The backend must enforce the same rules later.

Legend: ✅ granted · ⬜ not granted · ⚙️ grantable per account by the System Administrator · ❓ needs your decision

| Permission | Admin | Chairman | Secretary | Custodian | Other Personnel | Resident |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| **Residents** | | | | | | |
| residents.view: view resident records | ⬜ | ⬜ ❓1 | ✅ | ⬜ | ⚙️ | ⬜ |
| residents.search: search master list | ⬜ | ⬜ | ✅ | ⬜ | ⚙️ | ⬜ |
| residents.import: CSV import | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| residents.create / update: official records | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| residents.verify: manual registration review | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| residents.approve / reject: registrations, change requests | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| residents.lookup_borrower: name and address only | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ |
| **Documents** | | | | | | |
| documents.view | ⬜ | ✅ | ✅ | ⬜ | ⚙️ | ⬜ |
| documents.create: assisted service (walk-in) | ⬜ | ⬜ | ✅ | ⬜ | ⚙️ | ⬜ |
| documents.process: verify and process | ⬜ | ⬜ | ✅ | ⬜ | ⚙️ | ⬜ |
| documents.approve / reject: official decision | ⬜ | ✅ | ⬜ ❓2 | ⬜ | ⬜ | ⬜ |
| documents.release: record pickup | ⬜ | ⬜ | ✅ | ⬜ | ⚙️ | ⬜ |
| **Complaints, cases, hearings** | | | | | | |
| complaints.view | ⬜ | ✅ | ✅ | ⬜ | ⚙️ | ⬜ |
| complaints.create: encode for walk-ins | ⬜ | ⬜ | ✅ | ⬜ | ⚙️ | ⬜ |
| complaints.update | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| cases.view: case summaries | ⬜ | ✅ | ✅ | ⬜ | ⬜ | ⬜ |
| cases.manage: cases and blotter | ⬜ | ⬜ ❓3 | ✅ | ⬜ | ⬜ | ⬜ |
| hearings.view | ⬜ | ✅ | ✅ | ⬜ | ⚙️ | ⬜ |
| hearings.manage: schedule, attendance | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| **Inventory** | | | | | | |
| inventory.view | ⬜ | ⬜ | ⬜ | ✅ | ⚙️ | ⬜ |
| inventory.manage | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ |
| borrowing.approve | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ |
| borrowing.release: release and return | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ |
| **Reports and analytics** | | | | | | |
| analytics.view: population, ayuda planning | ⬜ | ✅ | ✅ | ⬜ | ⬜ | ⬜ |
| reports.view | ⬜ | ✅ | ✅ | ⬜ ❓4 | ⚙️ | ⬜ |
| reports.export: PDF, Excel | ⬜ | ⬜ ❓5 | ✅ | ⬜ | ⬜ | ⬜ |
| **System** | | | | | | |
| users.manage | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| roles.manage | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| audit_logs.view | ✅ | ⬜ ❓6 | ⬜ | ⬜ | ⬜ | ⬜ |
| system.settings | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| system.health: backups | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **Resident self-service (own records only)** | | | | | | |
| self.profile, self.documents, self.complaints, self.borrowing, self.change_requests | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ |

The demo "Other Personnel" account (Front Desk Staff) has: residents.search, residents.view, documents.view, documents.create.

## Questions that change the matrix

1. **Chairman and resident records:** dashboard figures only, or can the Chairman open individual resident profiles (read-only)?
2. **Who can reject a document:** the spec gives rejection to the Chairman. Can the Secretary also reject at the verification step (e.g. not a resident), or only "request additional information"?
3. **Summons and Notice of Hearing:** the docx says "authorized official". Is that the Chairman, the Lupon chair, or another official? Does that person need their own role?
4. **Custodian reports:** should the Custodian see inventory reports? (Spec says "authorized inventory reports"; this matrix waits for the report list.)
5. **Chairman exports:** may the Chairman export PDF and Excel reports, or only view them?
6. **Audit log access:** only the Admin, or should the Chairman also see activity related to barangay operations?
7. **Kagawads, Lupon, Tanod:** should any of these get their own role, or use "Other Personnel" with per-account permissions?
8. **Announcements:** residents "view announcements", but who posts them? No role has this yet.

## Rules already built into the simulation

- The Admin has **no** access to resident data or official approvals (technical and official authority stay separate).
- Residents see only their own records. There's no resident search in their portal.
- The Custodian sees borrower name and address only, not full resident profiles.
- Every route checks the same permission as its sidebar link, so typing a URL shows "no access".
