import type { KPCase } from '@/types/case'
import { SAMPLE_IDS, residentById } from './residents'
import { isoDaysAgo } from './random'

/**
 * SAMPLE Katarungang Pambarangay cases between fictional sample residents.
 * Dates and outcomes are demonstration data, not real cases.
 */

const party = (id: string) => {
  const r = residentById(id)!
  return { residentId: id, name: `${r.firstName} ${r.lastName}`, address: `${r.houseNo} ${r.street}, Gagalangin, Tondo, Manila`, contactNo: r.contactNo }
}

const HALL = 'Barangay 181 Hall'

export const mockCases: KPCase[] = [
  {
    id: 'case-031',
    caseNo: 'KP-2026-031',
    title: 'Castillo vs. Mercado',
    nature: 'Unpaid debt',
    complainants: [party(SAMPLE_IDS.jasmineCastillo)],
    respondents: [party(SAMPLE_IDS.carloMercado)],
    details: 'Complainant lent ₱8,000 in June for the respondent\'s welding equipment. Payment was promised by August and has not been made.',
    filedAt: isoDaysAgo(9, 10),
    filedVia: 'walk_in',
    stage: 'mediation_scheduled',
    mediationStartedAt: isoDaysAgo(3, 10),
    hearings: [
      {
        id: 'hr-031-1', kind: 'chairman_mediation', scheduledAt: isoDaysAgo(-9, 19), place: HALL, status: 'scheduled', remindersSentAt: [],
        attendance: [
          { name: 'Jasmine Castillo', side: 'complainant', present: null },
          { name: 'Carlo Mercado', side: 'respondent', present: null },
        ],
      },
    ],
    history: [
      { at: isoDaysAgo(9, 10), byUserId: 'usr-sec', byRole: 'secretary', action: 'Complaint recorded (walk-in)', stage: 'filed' },
      { at: isoDaysAgo(8, 9), byUserId: 'usr-sec', byRole: 'secretary', action: 'Start review', stage: 'under_review' },
      { at: isoDaysAgo(7, 14), byUserId: 'usr-sec', byRole: 'secretary', action: 'Forward to the Barangay Chairman for assessment', stage: 'for_assessment' },
      { at: isoDaysAgo(3, 10), byUserId: 'usr-chair', byRole: 'chairman', action: 'Schedule mediation under the Barangay Chairman', stage: 'mediation_scheduled' },
    ],
    documentIds: [],
    internalNotes: ['Respondent asked by phone to settle in installments. Raise during mediation.'],
  },
  {
    id: 'case-034',
    caseNo: 'KP-2026-034',
    title: 'Flores vs. Lim',
    nature: 'Unpaid loan',
    complainants: [party(SAMPLE_IDS.camilleFlores)],
    respondents: [party(SAMPLE_IDS.nestorLim)],
    details: 'Unpaid loan of ₱5,000 since March. Respondent has not answered repeated reminders.',
    filedAt: isoDaysAgo(2, 18),
    filedVia: 'online',
    stage: 'for_assessment',
    hearings: [],
    history: [
      { at: isoDaysAgo(2, 18), byUserId: 'usr-res', byRole: 'resident', action: 'Summons requested online', stage: 'filed' },
      { at: isoDaysAgo(1, 9), byUserId: 'usr-sec', byRole: 'secretary', action: 'Start review', stage: 'under_review' },
      { at: isoDaysAgo(1, 10), byUserId: 'usr-sec', byRole: 'secretary', action: 'Forward to the Barangay Chairman for assessment', stage: 'for_assessment' },
    ],
    documentIds: [],
    internalNotes: [],
  },
  {
    id: 'case-027',
    caseNo: 'KP-2026-027',
    title: 'Panganiban vs. Navarro',
    nature: 'Damage to property (fence)',
    complainants: [party(SAMPLE_IDS.johnPaulPanganiban)],
    respondents: [party(SAMPLE_IDS.rafaelNavarro)],
    details: 'Complainant states the respondent\'s delivery motorcycle repeatedly hit and bent the front fence. Asks for repair.',
    filedAt: isoDaysAgo(30, 9),
    filedVia: 'walk_in',
    stage: 'lupon_mediation',
    mediationStartedAt: isoDaysAgo(27, 9),
    luponStartedAt: isoDaysAgo(10, 9),
    hearings: [
      {
        id: 'hr-027-1', kind: 'chairman_mediation', scheduledAt: isoDaysAgo(24, 19), place: HALL, status: 'held', remindersSentAt: [isoDaysAgo(25, 9)],
        attendance: [
          { name: 'John Paul Panganiban', side: 'complainant', present: true },
          { name: 'Rafael Navarro', side: 'respondent', present: true },
        ],
        notes: 'Parties disagree on the repair cost.',
      },
      {
        id: 'hr-027-2', kind: 'chairman_mediation', scheduledAt: isoDaysAgo(15, 19), place: HALL, status: 'held', remindersSentAt: [isoDaysAgo(16, 9)],
        attendance: [
          { name: 'John Paul Panganiban', side: 'complainant', present: true },
          { name: 'Rafael Navarro', side: 'respondent', present: false },
        ],
        notes: 'Respondent did not attend. No settlement within the Chairman\'s mediation period.',
      },
      {
        id: 'hr-027-3', kind: 'lupon_mediation', scheduledAt: isoDaysAgo(-15, 18), place: HALL, status: 'scheduled', remindersSentAt: [],
        attendance: [
          { name: 'John Paul Panganiban', side: 'complainant', present: null },
          { name: 'Rafael Navarro', side: 'respondent', present: null },
        ],
      },
    ],
    history: [
      { at: isoDaysAgo(30, 9), byUserId: 'usr-sec', byRole: 'secretary', action: 'Complaint recorded (walk-in)', stage: 'filed' },
      { at: isoDaysAgo(29, 9), byUserId: 'usr-sec', byRole: 'secretary', action: 'Forward to the Barangay Chairman for assessment', stage: 'for_assessment' },
      { at: isoDaysAgo(27, 9), byUserId: 'usr-chair', byRole: 'chairman', action: 'Schedule mediation under the Barangay Chairman', stage: 'mediation_scheduled' },
      { at: isoDaysAgo(24, 20), byUserId: 'usr-sec', byRole: 'secretary', action: 'First hearing held', stage: 'ongoing_mediation' },
      { at: isoDaysAgo(11, 10), byUserId: 'usr-chair', byRole: 'chairman', action: 'Not settled: refer to the Lupon', stage: 'referred_to_lupon', remarks: 'No settlement within the 15-day mediation period.' },
      { at: isoDaysAgo(10, 9), byUserId: 'usr-sec', byRole: 'secretary', action: 'Lupon mediation scheduled', stage: 'lupon_mediation' },
    ],
    documentIds: [],
    internalNotes: [],
  },
  {
    id: 'case-019',
    caseNo: 'KP-2026-019',
    title: 'Tan vs. Flores',
    nature: 'Parking dispute',
    complainants: [party(SAMPLE_IDS.andreaTan)],
    respondents: [party(SAMPLE_IDS.joseFlores)],
    details: 'Respondent\'s tricycle is parked in front of the complainant\'s store entrance every morning.',
    filedAt: isoDaysAgo(48, 10),
    filedVia: 'online',
    stage: 'closed',
    mediationStartedAt: isoDaysAgo(45, 10),
    hearings: [
      {
        id: 'hr-019-1', kind: 'chairman_mediation', scheduledAt: isoDaysAgo(41, 18), place: HALL, status: 'held', remindersSentAt: [isoDaysAgo(42, 9)],
        attendance: [
          { name: 'Andrea Tan', side: 'complainant', present: true },
          { name: 'Jose Flores', side: 'respondent', present: true },
        ],
        notes: 'Agreed parking spot across the street.',
      },
    ],
    history: [
      { at: isoDaysAgo(48, 10), byUserId: 'usr-res', byRole: 'resident', action: 'Complaint submitted online', stage: 'filed' },
      { at: isoDaysAgo(46, 10), byUserId: 'usr-sec', byRole: 'secretary', action: 'Forward to the Barangay Chairman for assessment', stage: 'for_assessment' },
      { at: isoDaysAgo(45, 10), byUserId: 'usr-chair', byRole: 'chairman', action: 'Schedule mediation under the Barangay Chairman', stage: 'mediation_scheduled' },
      { at: isoDaysAgo(41, 19), byUserId: 'usr-chair', byRole: 'chairman', action: 'Settled', stage: 'settled', remarks: 'Amicable settlement signed by both parties.' },
      { at: isoDaysAgo(40, 9), byUserId: 'usr-sec', byRole: 'secretary', action: 'Close case', stage: 'closed' },
    ],
    outcome: { type: 'settled', summary: 'Amicable settlement: the respondent parks across the street from the store.', at: isoDaysAgo(41, 19) },
    documentIds: [],
    internalNotes: [],
  },
]
