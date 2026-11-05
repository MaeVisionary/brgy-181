# Master list file: structure notes (no personal data)

Source: `UPDATED MASTERLIST OF BRGY 181 ZONE 16 FOR THE MONTH OF JULY 30 2025 (1).xlsx`, received 2026-11-05.
The file itself is **not** stored in this project. These notes only describe its structure, for the CSV import (Phase 4).

## Columns (Sheet1, header row 1)

| Column | Notes |
|---|---|
| NO | Row number. ~4,600 rows contain only this number and nothing else |
| BRGY, ZONE | 181 / 16 |
| LAST NAME, FIRST NAME, MIDDLE NAME, SUFFIX | Suffix values: JR., SR. |
| BIRTH MONTH, BIRTH DAY, BIRTH YEAR, BIRTHDATE | Birthdate also split into three columns |
| AGE | Stored value. It goes stale, so the system should compute age from the birthdate |
| FULL ADDRESS | Free text, e.g. "house no. -STREET , TONDO II". About 20 street spellings, with variants of the same street ("ASA" / "ASA ST.", "GEN.LUKBAN" / "GEN.LUBAN", "JUAN LUNA" / "J.LUNA") |
| MOBILE / CONTACT NO. | Often typed with the letter **O** instead of zero (~326 rows); some stored as numbers, losing the leading 0 |
| OSCA ID NO., OSCA DATE ISSUED | Senior citizen ID. Dates are mixed: Excel serials, real dates and free text ("JANUARY 31,2024", "1O/10/2022") |
| GENDER | MALE / FEMALE |
| CIVIL STATUS | MARRIED, WIDOW, SINGLE, SEPARATED |
| VOTER | YES / NO |
| STATUS | ACTIVE, INACTIVE, BEDRIDDEN, "BED RIDDEN" |
| REMARKS | Free text: RENEW, transfers from other barangays, notes |

Sheet2 only holds the lookup values MALE / FEMALE.

## What this means for the system

1. **This is the senior citizen (OSCA) list:** about 352 filled records, all aged 60–92. It is not the full resident master list. The full list (all ages and households) is still needed for document requests and analytics.
2. The CSV import must:
   - skip number-only rows
   - normalise "O" → "0" in phone numbers and IDs, but show the change for review
   - accept several date formats and flag the ones it can't read
   - normalise street name spellings through a reviewable mapping
   - map STATUS values ("BED RIDDEN" = "BEDRIDDEN")
3. New resident fields suggested by this file: OSCA ID no., OSCA date issued, voter (yes/no), living status (active, inactive, bedridden), remarks.
4. There's no purok column. Addresses use streets, so the Purok 1–6 grouping in the Figma and the mock data needs confirming: does the barangay group by street instead?
