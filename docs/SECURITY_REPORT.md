# BRGY 181 BMIS: Security Report and Release Gate

Date: 12 November 2026 · **Release gate: NOT PASSED.** No real resident information may be entered until every "Blocked" item below is done and tested on a real backend.

## 1. Where protection lives today

The app is **frontend-only**. Every rule below runs in the browser's service layer. Someone with developer tools can edit local data, so these checks prove the *design*, not real protection. The same rules are written for the database in `docs/supabase/security.sql` and `docs/supabase/documents.sql` (not applied, not tested).

## 2. Findings

| # | Finding | Severity | Status |
|---|---|---|---|
| F1 | No server: all authorization is client-side | Critical | **Blocked** (needs backend; SQL written) |
| F2 | No real OTP / MFA | Critical | **Blocked**. Password re-entry, bound to the exact change, is used meanwhile. Plan: Supabase Auth TOTP; privileged functions require `aal2` |
| F3 | One person could change roles alone | High | **Fixed and tested**: two-person approval |
| F4 | Confirmation fingerprint ignored nested details (a confirmed change could be swapped) | High | **Fixed and tested** |
| F5 | Saved role changes dropped permissions added in later releases | Medium | **Fixed and tested** |
| F6 | Audit log kept on the device (local storage), editable in principle | High | **Blocked** (append-only table + trigger written) |
| F7 | VAWC cases can be scheduled for barangay mediation (RA 9262) | High (legal) | **Pending** (Roadmap Phase 1) |
| F8 | Registration ID photos stored inline in browser data | Medium | **Pending** (moves to private bucket with backend) |
| F9 | No backups or tested restore | High | **Blocked** |
| F10 | Email not connected | Medium | **Blocked**. Messages are recorded as "not sent", never faked |
| F11 | Sessions cannot be revoked server-side after a role change | Medium | **Blocked** (server function signs affected users out) |

## 3. Two-person approval (implemented)

1. A System Administrator requests a role or permission change → before/after table, reason, password.
2. A **pending request** is created (`SEC-YYYY-NNNN`). Nothing changes yet. Approvers are notified.
3. A **second person** (another System Administrator or the Barangay Chairman ⚖️ confirm with the barangay) reviews it on the Security page and approves with their own password, or rejects with a reason.
4. Only then is the change applied, all at once (rolled back on error), audited, and the initiator, affected accounts and other approvers notified.

Rules: initiator cannot approve; the affected account cannot approve; one pending request per subject; 24-hour expiry; cancel by initiator only; no decision after expiry, cancellation or a previous decision; nobody changes their own role or access.

## 4. Test results (prototype service layer, 12 Nov 2026)

| Test | Result |
|---|---|
| Secretary requests a role change | Rejected ✅ |
| Administrator requests a change | Pending; role unchanged ✅ |
| Second request for the same account while one is pending | Rejected ✅ |
| Initiator approves own request | Rejected ✅ |
| Kagawad approves | Rejected ✅ |
| Affected user approves own change | Rejected ✅ |
| Approver without password confirmation | Rejected ✅ |
| Chairman approves with confirmation | Applied; initiator and affected user notified ✅ |
| Approve twice | Rejected ✅ |
| Approve after expiry | Rejected; nothing changed ✅ |
| Cancel by someone else / reject without reason | Rejected ✅ |
| Approve after cancellation | Rejected ✅ |
| Wrong password ×5, then correct password | Locked ✅ |
| Confirmation reused / for a different change | Rejected ✅ |
| Direct database update, RLS, private storage, session fixation, CSRF | **Not tested: no backend** |
| Email failure and retry | **Not tested: no email provider** |

## 5. Release gate checklist

| Requirement | Status |
|---|---|
| Two-person approval | Completed and tested (prototype) |
| Initiator cannot approve own request | Completed and tested (prototype) |
| OTP verified server-side | Blocked |
| Notifications to all parties; email failures retried | In-app: completed and tested · Email: blocked |
| Backend authorization | Blocked (SQL written) |
| RLS policies tested | Blocked |
| Private storage | Blocked (SQL written) |
| Sessions revoked after critical changes | Blocked |
| Audit log protected | Blocked (SQL written) |
| Secure account recovery | Done in the prototype (single-use hashed reset links, 15-minute expiry, rate limits, reviewed recovery requests, sessions ended after a reset); e-mail delivery and server enforcement pending |
| Privilege escalation tests | Prototype: passed · Backend: blocked |
| Unauthorized API tests | Blocked |
| Backup and restore verified | Blocked |
| No privileged secrets in frontend | Passed: no service keys in the code; test-account hashes only via CI secrets |
| Findings resolved or formally accepted | Pending (needs the barangay's responsible official) |

## 6. To connect the backend (when approved)

1. Create the Supabase project (owner: barangay; admins with hardware-key or TOTP MFA).
2. Apply `docs/supabase/security.sql`, then `documents.sql`; seed roles from `src/config/permissions.ts`.
3. Turn on Auth MFA (TOTP) for every staff account.
4. Replace the prototype services with calls to the SQL functions; keep the same error messages.
5. Run the full test table above against the real API with test accounts only.
6. Set up daily backups and perform a restore drill.
7. Re-run this checklist; only a fully passed gate allows real data.
