import type { Gender, IssueCode, SeniorDataset, SeniorRecord, StatusGroup, VoterGroup } from './seniorTypes'

/**
 * Built-in DE-IDENTIFIED senior citizen snapshot (public/data/senior-snapshot.json,
 * made by scripts/make-masterlist-snapshot.ts). It holds no names, house numbers,
 * OSCA ID numbers or contact numbers, so the analytics can load automatically on
 * a public site. Name-level lists still need the full Excel file (or the backend).
 */

type SnapRow = [string | null, Gender | null, string | null, string | null, string, StatusGroup, string, VoterGroup, 0 | 1, number | null, IssueCode[]]

interface Snapshot {
  version: number
  source: string
  fileDate: string | null
  generatedAt: string
  sheetRows: number
  skippedRows: number
  messages: SeniorDataset['messages']
  normalizationCount: number
  records: SnapRow[]
}

export const SNAPSHOT_NAME_PLACEHOLDER = 'Name withheld'

export async function loadSnapshot(): Promise<SeniorDataset | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/senior-snapshot.json`, { cache: 'no-cache' })
    if (!res.ok) return null
    const snap = (await res.json()) as Snapshot
    if (snap.version !== 1 || !Array.isArray(snap.records)) return null
    const fileDate = snap.fileDate ? new Date(`${snap.fileDate}T00:00:00Z`) : null
    const records: SeniorRecord[] = snap.records.map(([birth, gender, civil, street, statusRaw, status, voterRaw, voter, osca, oscaYear, issues], i) => {
      // Day of birth is not kept; mid-month keeps ages correct except within the birth month.
      const birthDate = birth ? new Date(Date.UTC(Number(birth.slice(0, 4)), Number(birth.slice(5, 7)) - 1, 15)) : null
      return {
        sheetRow: i + 1,
        no: String(i + 1),
        lastName: '',
        firstName: '',
        middleName: '',
        suffix: '',
        fullName: SNAPSHOT_NAME_PLACEHOLDER,
        birthDate,
        birthDateRaw: birth ?? '',
        ageColumnRaw: '',
        addressRaw: street ?? '',
        address: street ?? '',
        street,
        contactRaw: '',
        contact: '',
        oscaIdRaw: '',
        oscaId: osca ? 'on file' : '',
        oscaDateRaw: oscaYear ? String(oscaYear) : '',
        oscaDate: oscaYear ? new Date(Date.UTC(oscaYear, 0, 1)) : null,
        genderRaw: gender ?? '',
        gender,
        civilStatusRaw: civil ?? '',
        civilStatus: civil,
        voterRaw,
        voter,
        statusRaw,
        status,
        remarks: '',
        issues,
      }
    })
    return {
      fileName: `${snap.source}${fileDate ? ` (${fileDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })})` : ''}`,
      sheetName: 'Built-in snapshot',
      loadedAt: `${snap.generatedAt}T00:00:00Z`,
      sheetRows: snap.sheetRows,
      skippedRows: snap.skippedRows,
      records,
      normalizations: [],
      messages: [
        ...snap.messages,
        { level: 'info', text: `Built-in data with names, house numbers, OSCA ID numbers and contact numbers removed. ${snap.normalizationCount} value corrections were applied when it was prepared. Load the full Excel file to see names.` },
      ],
      fileDate,
    }
  } catch {
    return null
  }
}
