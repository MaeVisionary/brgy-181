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
