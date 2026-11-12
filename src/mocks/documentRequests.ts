import { prefillFromResident } from '@/documents/fill'
import type { DocumentRequest, DocumentStatus, DocumentTypeId, FieldValue, StatusEvent } from '@/types/document'
import type { RoleId } from '@/types/auth'
import { SAMPLE_IDS, residentById } from './residents'
import { isoDaysAgo } from './random'

/**
 * MOCK DOCUMENT REQUESTS for the frontend demo. All people are the fictional
 * generated residents; no names from the supplied reference documents are used.
 */

let seq = 0
const PREFIX: Record<DocumentTypeId, string> = {
  'first-time-job-seeker': 'FTJ',
  'non-residency': 'NRC',
  cohabitation: 'COH',
  'no-partner': 'SNG',
  residency: 'RES',
  indigency: 'IND',
  summon: 'SUM',
  'incident-record': 'INC',
  'clearance-person': 'CLR',
  'business-clearance': 'BUS',
  'barangay-certificate': 'CRT',
  'blotter-report': 'BLT',
  'notice-of-hearing': 'NOH',
}

export function nextReference(typeId: DocumentTypeId): string {
  seq += 1
  return `${PREFIX[typeId]}-2026-${String(300 + seq).padStart(4, '0')}`
}

const ev = (status: DocumentStatus, daysAgo: number, hour: number, byUserId: string, byRole: RoleId, action: string, remarks?: string): StatusEvent => ({
  status,
  at: isoDaysAgo(daysAgo, hour),
  byUserId,
  byRole,
  action,
  remarks,
})

const RES = 'usr-res'
const SEC = 'usr-sec'
const CHAIR = 'usr-chair'
const STAFF = 'usr-sec'

function make(
  typeId: DocumentTypeId,
  residentId: string | null,
  status: DocumentStatus,
  history: StatusEvent[],
  extra: Record<string, FieldValue> = {},
  opts: { requesterName?: string; assistedBy?: string; issuedDaysAgo?: number; messages?: DocumentRequest['messages']; caseId?: string; requestedItems?: string[] } = {},
): DocumentRequest {
  const resident = residentId === null ? undefined : residentById(residentId)
  const base = resident ? prefillFromResident(typeId, resident) : {}
  const name = opts.requesterName ?? (resident ? `${resident.firstName} ${resident.lastName}` : 'Walk-in')
  return {
    id: `docreq-${String(++seq).padStart(3, '0')}`,
    referenceNo: nextReference(typeId),
    typeId,
    status,
    residentId: resident?.id,
    requesterName: name,
    submittedAt: history[0].at,
    updatedAt: history[history.length - 1].at,
    issuedAt: opts.issuedDaysAgo !== undefined ? isoDaysAgo(opts.issuedDaysAgo, 14) : undefined,
    values: { ...base, ...extra },
    requirements: {},
    requestedItems: opts.requestedItems,
    assisted: opts.assistedBy ? { encodedByUserId: opts.assistedBy, at: history[0].at } : undefined,
    history,
    messages: opts.messages ?? [],
    caseId: opts.caseId,
  }
}

export const mockDocumentRequests: DocumentRequest[] = [
  // ── Demo resident (Maria Reyes, resident index 0)
  make('residency', SAMPLE_IDS.mariaDizon, 'ready_for_pickup', [
    ev('submitted', 6, 9, RES, 'resident', 'Submitted online'),
    ev('under_review', 6, 11, SEC, 'secretary', 'Start review'),
    ev('processing', 5, 10, SEC, 'secretary', 'Mark as verified'),
    ev('pending_approval', 5, 15, SEC, 'secretary', 'Forward to Chairman'),
    ev('approved', 4, 14, CHAIR, 'chairman', 'Approve'),
    ev('ready_for_pickup', 4, 16, SEC, 'secretary', 'Signed and sealed: ready for pickup'),
  ], { purposes: ['Local Employment'] }, { issuedDaysAgo: 4 }),
  make('indigency', SAMPLE_IDS.mariaDizon, 'needs_info', [
    ev('submitted', 2, 8, RES, 'resident', 'Submitted online'),
    ev('under_review', 2, 10, SEC, 'secretary', 'Start review'),
    ev('needs_info', 1, 9, SEC, 'secretary', 'Request more information', 'The uploaded ID is blurred. Please upload a clearer photo of the front of your ID, or bring it to the Barangay Hall.'),
  ], { assistance: ['Medical Assistance'] }, { requestedItems: ['Clearer photo of a valid ID'] }),
  make('clearance-person', SAMPLE_IDS.mariaDizon, 'submitted', [ev('submitted', 0, 8, RES, 'resident', 'Submitted online')], {
    residingSince: '2012',
    purpose: 'Employment requirement',
  }),

  // ── Other residents
  make('first-time-job-seeker', SAMPLE_IDS.andreaTan, 'processing', [
    ev('submitted', 3, 9, 'resident', 'resident', 'Submitted online'),
    ev('under_review', 3, 13, SEC, 'secretary', 'Start review'),
    ev('processing', 2, 9, SEC, 'secretary', 'Mark as verified'),
  ], { yearsResident: '6' }),
  make('indigency', SAMPLE_IDS.rogelioNavarro, 'pending_approval', [
    ev('submitted', 4, 10, 'resident', 'resident', 'Submitted online'),
    ev('under_review', 4, 14, SEC, 'secretary', 'Start review'),
    ev('processing', 3, 10, SEC, 'secretary', 'Mark as verified'),
    ev('pending_approval', 1, 11, SEC, 'secretary', 'Forward to Chairman'),
  ], { assistance: ['Burial Asssistance'] }),
  make('barangay-certificate', SAMPLE_IDS.danielGarcia, 'pending_approval', [
    ev('submitted', 3, 15, 'resident', 'resident', 'Submitted online'),
    ev('under_review', 2, 9, SEC, 'secretary', 'Start review'),
    ev('processing', 2, 11, SEC, 'secretary', 'Mark as verified'),
    ev('pending_approval', 0, 9, SEC, 'secretary', 'Forward to Chairman'),
  ], { purpose: 'Requirement for scholarship application at the city college' }),
  make('clearance-person', SAMPLE_IDS.johnPaulPanganiban, 'approved', [
    ev('submitted', 5, 9, 'resident', 'resident', 'Submitted online'),
    ev('under_review', 5, 10, SEC, 'secretary', 'Start review'),
    ev('processing', 4, 9, SEC, 'secretary', 'Mark as verified'),
    ev('pending_approval', 3, 10, SEC, 'secretary', 'Forward to Chairman'),
    ev('approved', 1, 14, CHAIR, 'chairman', 'Approve'),
  ], { residingSince: '2009', purpose: 'Bank account opening' }, { issuedDaysAgo: 1 }),
  make('cohabitation', SAMPLE_IDS.elenaSalazar, 'under_review', [
    ev('submitted', 1, 16, 'resident', 'resident', 'Submitted online'),
    ev('under_review', 0, 9, SEC, 'secretary', 'Start review'),
  ], { partner2Name: 'Rafael Domingo Navarro', partner2Age: '34', houseStreet: '631 Benita St.', duration: '4', sinceFrom: '2022' }),
  make('no-partner', SAMPLE_IDS.angelicaBautista, 'processing', [
    ev('under_review', 0, 10, STAFF, 'secretary', 'Encoded at the Barangay Hall (assisted)'),
    ev('processing', 0, 11, SEC, 'secretary', 'Mark as verified'),
  ], { childName: 'Angelo Torres Bautista' }, { assistedBy: STAFF }),
  make('business-clearance', SAMPLE_IDS.mariaValdez, 'submitted', [ev('submitted', 0, 7, 'resident', 'resident', 'Submitted online')], {
    businessName: 'Valdez Sari-sari Store',
    businessAddress: '2750 Rosalina St., Gagalangin, Tondo, Manila',
    businessNature: 'Retail (sari-sari store)',
  }),
  make('non-residency', null, 'processing', [
    ev('under_review', 1, 14, SEC, 'secretary', 'Encoded at the Barangay Hall (assisted)'),
    ev('processing', 1, 15, SEC, 'secretary', 'Mark as verified'),
  ], { fullName: 'Ernesto Pascual Ocampo', formerAddress: '18 Apog St., Gagalangin, Tondo, Manila' }, { requesterName: '4Ps (DSWD) request', assistedBy: SEC }),
  make('summon', SAMPLE_IDS.camilleFlores, 'for_assessment', [
    ev('submitted', 2, 18, 'resident', 'resident', 'Submitted online'),
    ev('under_review', 1, 9, SEC, 'secretary', 'Start review'),
    ev('for_assessment', 1, 10, SEC, 'secretary', 'Forward for assessment'),
  ], {
    respondentName: 'Nestor Salazar Lim',
    respondentAddress: '44 R. Fernandez St., Gagalangin, Tondo, Manila',
    complaintDetails: 'Unpaid loan of ₱5,000 since March. Respondent has not answered repeated reminders.',
  }, { caseId: 'case-034' }),
  make('incident-record', SAMPLE_IDS.jenniferDomingo, 'submitted', [ev('submitted', 0, 6, 'resident', 'resident', 'Submitted online')], {
    incidentTypes: ['OTHERS'],
    incidentTypeOther: 'Noise disturbance',
    incidentDate: '11/04/2026',
    incidentTime: '11:30 PM',
    incidentPlace: 'Corner of Juan Luna St. and Rosalina St.',
    narrative: 'Loud karaoke from a neighboring house continued past midnight despite a request to lower the volume. The reporting person asked twice. No one was hurt.',
    reporterIsVictim: true,
    reporterCitizenship: 'Filipino',
  }),
  make('blotter-report', SAMPLE_IDS.joseFlores, 'recorded', [
    ev('submitted', 3, 19, 'resident', 'resident', 'Submitted online'),
    ev('under_review', 2, 9, SEC, 'secretary', 'Start review'),
    ev('recorded', 2, 10, SEC, 'secretary', 'Record entry'),
  ], {
    caseNo: 'BLT-181-0412',
    respondentName: 'Unknown rider',
    offense: 'Damage to property (side mirror)',
    narration: 'A motorcycle rider sideswiped the parked tricycle of the complainant along Gen. Lukban St. at about 4:00 PM and broke the left side mirror. The rider left without stopping. A neighbor saw the incident but did not get the plate number.',
    recordedByName: 'Ana Manila Salvador',
    recordedByPosition: 'Barangay Secretary',
  }, { issuedDaysAgo: 2 }),
  make('notice-of-hearing', null, 'pending_approval', [
    ev('processing', 1, 9, SEC, 'secretary', 'Prepared from case record'),
    ev('pending_approval', 1, 10, SEC, 'secretary', 'Submit for approval'),
  ], {
    complainantNames: 'JASMINE CASTILLO',
    complainantAddress: '2759 Victoria St. Gag. Tdo. Mla.',
    respondentNames: 'CARLO MERCADO',
    respondentAddress: '70 Asa St. Gag. Tdo. Mla.',
    hearingDay: '14th',
    hearingMonth: 'November',
    hearingTime: '7:00',
    receivedBy: 'Jasmine Castillo\nCarlo Mercado',
  }, { requesterName: 'Case KP-2026-031 (Castillo vs. Mercado)', caseId: 'case-031' }),
]
