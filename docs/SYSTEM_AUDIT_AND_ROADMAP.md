# BRGY 181 BMIS: System Audit and Improvement Roadmap

Date: 12 November 2026 · Scope: the code in this repository (React frontend, no backend) · Status of the live site: commit `20594fb` (two later commits are local, not pushed)

This document separates **what was verified in the code or by testing** from **what still needs legal, operational or backend validation**. Nothing here claims production readiness.

---

## 1. The finding that changes the plan

**DILG now requires every barangay to use its own free system, LGUSS-BIMS** (DILG Memorandum Circular No. 2025-104, *Guidelines on the Implementation of the LGUSS-BIMS*). It covers resident profiles, barangay property, financial transactions, ordinances and disaster information, with data shared up to the city/municipality. Adoption was about 23% of barangays at the end of 2025.

What this means for BRGY 181:

| Area | LGUSS-BIMS covers it? | Recommendation for BRGY 181 |
|---|---|---|
| Resident registry (official profiles) | Yes | **Do not build a competing official registry.** Keep the BMIS resident record as the working copy for online services, and plan an import/export or reconciliation with BIMS once the barangay's BIMS access and data format are confirmed. |
| Barangay property | Yes | Same: equipment borrowing (a resident-facing service) stays; the official property register should match BIMS. |
| Financial transactions | Yes | **Do not build a treasury module here.** Keep only document-fee receipts (OR number) and reconcile with BIMS. |
| Disaster information | Yes | **Do not build DRRM here** until the barangay confirms what BIMS already provides. |
| Online resident services (requests, tracking, complaints, borrowing, notifications) | Not described in the public material | **This is BRGY 181's real value.** Focus here. |

**Validation needed before any build in the "Yes" rows:** the barangay's BIMS login status, the module list in MC 2025-104 itself (public articles mention "11 interconnected subsystems" but do not name them), and whether BIMS offers export/import.

---

## 2. Feature inventory

Legend: ✅ working (tested in this prototype) · 🟡 working but frontend-only (resets or lives in one browser) · 🟠 incomplete · 🔴 broken or risky · ➖ missing · ⚖️ needs legal/operational validation

| Module | State | Notes |
|---|---|---|
| Sign-in, roles, route guards | 🟡 | Seven roles only. Checks run in the browser; anyone with developer tools can change local data. |
| Role and permission management | 🟡 | Staged changes, before/after review, reason, password re-entry bound to the exact change, no self-change, notifications, audit (tested). Real OTP needs a server. |
| Session handling | 🟡 | 30-min idle sign-out, confirmed logout. No server session to revoke. |
| Resident registration + ID checks | 🟡 | OCR/face/liveness run in the browser; Secretary review, in-person visit, decision (tested). |
| Email | 🟠 | Integration boundary only; every email is recorded as "not sent". |
| Resident profile, ID on file, corrections | 🟡 | Own / minor dependent / authorized representative / household rules (tested). |
| Document requests + processing time | 🟡 | RA 11032 maximums until the Citizen's Charter is entered (tested date maths). ⚖️ Charter times and fees. |
| Complaints → KP cases | 🟡 | Separate from document requests (tested). 🔴 **VAWC risk, see §4.** |
| Equipment borrowing / inventory | 🟡 | Counts reconcile; mismatch warning. |
| Uploads | 🟡 | Type checked by content, limits, image optimisation, dedupe, cleanup (tested). Stored in IndexedDB only. |
| Notifications | 🟡 | Real in-app notifications per account; demo items only in development. |
| Reports and analytics | 🟡 | Official formats downloadable; analytics from the July 2025 OSCA masterlist snapshot. |
| Announcements | 🟠 | Three hard-coded examples; **no screen for staff to post one.** |
| Activity log | 🟡 | In memory; lost on reload; not tamper-proof. |
| Backups, restore, monitoring | ➖ | Health page correctly shows "Not yet set up". |
| Draft saving / offline | ➖ | Long forms lose input on reload. |
| Deceased / moved-out residents, address history | ➖ | Only "household update" requests exist. |
| Document verification (QR on issued certificates) | ➖ | — |
| Treasury beyond fees, DRRM | ➖ | Deliberately not built: overlaps BIMS (see §1). |

**Biggest structural gap:** there is no backend. Every rule is enforced in the browser, and most data is sample data in memory or `localStorage`. Until a server enforces the same rules, the system must not hold real resident data.

---

## 3. Service workflows (as implemented)

| Service | Starts | Verifies | Approves | Issues / closes | On incomplete | On rejection | Deadline basis |
|---|---|---|---|---|---|---|---|
| Resident registration | Resident (online) | Secretary (+ automated checks) | Secretary | System activates account | In-person visit request | Reason recorded, resident told at sign-in | ⚖️ none set |
| Record correction | Resident (own / minor / representative) | Secretary | Secretary (`residents.approve`) | Record updated, old value kept | — | Reason sent to requester | ⚖️ none set |
| Certificates / clearances | Resident or walk-in (staff encodes) | Secretary (+ inspection where set) | Secretary or Chairman per document | Secretary releases; Treasurer records fee | "Needs more information"; clock restarts on reply | Reason shown to resident | RA 11032: simple ≤ 3 working days ⚖️ Charter |
| Complaint / report | Resident (online) or walk-in | Secretary | Chairman assesses (`cases.decide`) | Settled / referred to Lupon / closed | — | Closed with reason | RA 7160 KP periods (15-day Chairman mediation, Lupon) |
| Borrowing | Resident | Property Custodian | Property Custodian | Released / returned | — | Reason | 15 days + 3-day grace (barangay rule) |

⚖️ Every "who approves" above follows what the barangay told us in the Chairman interview; it should be confirmed against the barangay's approved Citizen's Charter and any Sangguniang Barangay resolution.

---

## 4. Legal and privacy risks found

1. 🔴 **VAWC cases can enter barangay mediation.** The incident form has a VAWC type and any case can be scheduled for mediation. RA 9262 (Sec. 33) prohibits barangay officials from mediating or conciliating VAWC cases; the barangay's role is the Barangay Protection Order and referral. **Fix:** VAWC (and other non-mediable matters under RA 7160 Sec. 408) must be blocked from the mediation steps in the service, routed to a restricted "referral / BPO" path, and visible only to the Punong Barangay and the assigned VAW desk officer. ⚖️ Confirm with the barangay's VAW desk process.
2. 🟠 **Sensitive data in the browser.** ID images from registration are still stored inline in local data (the newer ID replacements use the file store). Acceptable only for the prototype.
3. 🟠 **Privacy notice and consent text** exist at registration, but there is no retention schedule, no Data Protection Officer contact, and no breach procedure. NPC Circular 2023-06 (in force for government and private sectors) expects a privacy impact assessment per system, access limits, storage limited to what is necessary, and incident handling.
4. 🟠 **Audit log is in memory** and can be lost; it must be server-side and append-only.

---

## 5. Benchmarks used

- **DILG LGUSS-BIMS / MC 2025-104:** scope and the duplication question (§1).
- **RA 11032 (Ease of Doing Business):** processing-time classes and one-time extension, already implemented.
- **RA 7160 Katarungang Pambarangay; RA 9262 VAWC:** case routing (§4).
- **RA 10173 + NPC Circular 2023-06:** privacy controls (§4, Phase 1).
- **OWASP ASVS 5.0 (May 2025):** target **Level 2** for this system (it holds sensitive personal data). Most L2 controls need the backend: server-side access control, session management, logging.
- **NIST CSF 2.0:** organises the operational work: Govern (owners, policies), Identify (data inventory), Protect (access, encryption), Detect (logging), Respond and Recover (breach plan, tested restores).
- **WCAG 2.2 AA, Apple HIG, Microsoft Fluent:** text scaling, 44–48 px targets, phone layouts and confirmations are in place; a full keyboard and screen-reader pass has **not** been done.

---

## 6. Roadmap

Priorities: **P0** must happen before any real resident data · **P1** high value, next · **P2** useful later. Each item lists what "done" means.

### Phase 0: Decide scope with the barangay (no code) · P0
| Item | Why | Acceptance |
|---|---|---|
| Confirm LGUSS-BIMS status and modules | Avoid building what DILG already provides | Written list: what BIMS does for Brgy 181, what BMIS does |
| Approve Citizen's Charter times, fees, approvers | Deadlines and fees must not be invented | Values entered in System Settings; signed charter on file |
| Name owners: DPO, system admin, VAW desk officer | NIST CSF "Govern"; NPC requirement | Names and duties recorded |

### Phase 1: Legal and safety fixes in the current code · P0 (can start now)
| Item | Affected | Backend? | Acceptance / tests |
|---|---|---|---|
| Block mediation for VAWC and non-mediable cases; restricted referral path | Cases, incident form, Chairman, Secretary | Enforced in service now; server later | A VAWC case cannot be scheduled for mediation by any role; only Punong Barangay + VAW desk can open it |
| Announcements management (Secretary posts, residents read) | Secretary, residents, home page | Same pattern as other services | Post, edit, unpublish; no hard-coded items |
| Draft saving on long forms (registration, requests, complaints) | Residents | No | Reload keeps entries; submit clears draft; no ID images stored in drafts |
| Duplicate-submit protection everywhere | All forms | No | Double-tap creates one record (test each form) |
| Deceased / moved-out status with history (no deletion) | Secretary, resident record | Later server | Status change audited; record kept; excluded from active counts |

### Phase 2: Backend (Supabase) · P0 before real data
| Item | Acceptance / tests |
|---|---|
| Auth with server sessions and MFA (TOTP) for staff; email OTP fallback | Sessions revocable; OTP single-use, 5-minute, rate-limited, bound to the action |
| Tables + Row Level Security for every module (start from `docs/supabase/documents.sql`) | Direct API calls as each role return only permitted rows (scripted tests per role) |
| Server functions for approvals, role changes, decisions | Same rules as today's services, now unbypassable |
| Private storage bucket + signed URLs | No public file URLs; resident cannot fetch another resident's file |
| Append-only audit log | No update/delete for any role; log reads are logged |
| Email provider via server function | Real "sent/failed" status; resend works |
| Daily backups + a tested restore | A restore drill completed and written up |

### Phase 3: Service quality · P1
| Item | Acceptance |
|---|---|
| QR verification on issued certificates (reference + checksum, no personal data in the QR) | Scanning shows "valid / revoked" only |
| Service deadline monitor for staff (due today / overdue) | Uses charter times; no fixed numbers |
| BIMS import/export or reconciliation report | Agreed format; mismatches listed, never auto-overwritten |
| Data-quality queue (duplicates, missing birthdates) | Merge needs Secretary approval; audit kept |
| Resident feedback after a completed request (one question) | Optional; no personal data required |

### Phase 4: Accessibility and reliability checks · P1
| Item | Acceptance |
|---|---|
| WCAG 2.2 AA pass: keyboard, screen reader, contrast, focus order | Checklist completed per page; issues fixed |
| Usability session with 3–5 elderly residents | Each completes a request without help; findings fixed |
| Offline / outage fallback: printable walk-in forms, later encoding | Written procedure; staff trained |

### Not recommended now
Treasury module, DRRM / evacuation / relief, asset lifecycle accounting: these overlap LGUSS-BIMS or lack a confirmed owner. Revisit after Phase 0.

---

## 7. Status list

| Status | Items |
|---|---|
| Completed and tested (prototype) | Roles cleanup, confirmed role changes, logout/idle, registration review and visits, ID on file, corrections rules, complaints separation, resident service limits, processing-time maths, uploads, phone layouts, text size |
| Pending | Phase 0–4 above |
| Blocked | Real OTP, email delivery, backups, server-side enforcement (need backend) · Charter values (need barangay) |
| Failed / known risk | VAWC mediation path (§4.1) |

Sources: [DILG CALABARZON on LGUSS-BIMS adoption](https://calabarzon.dilg.gov.ph/dilg-pushes-full-digital-shift-in-barangays-through-nationwide-lguss-bims-adoption/) · [Daily Tribune, Dec 2025](https://tribune.net.ph/2025/12/27/dilg-pushes-digital-shift-in-barangays-with-lguss-bims) · [DILG R3 on MC 2025-104](https://region3.dilg.gov.ph/dilg-r3-assesses-progress-on-2025-barangay-information-management-system-bims-implementation/) · [LGUSS official site](https://bims.dilg.gov.ph) · [NPC FAQ on Circular 2023-06](https://privacy.gov.ph/wp-content/uploads/2024/12/v12-19-2024_FAQ-NPC-Circular-2023-06_NNJ_JDN.pdf) · [OWASP ASVS](https://quality.arc42.org/standards/owasp-asvs)
