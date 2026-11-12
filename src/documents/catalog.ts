import type { DocumentRequirement, DocumentTypeId, FieldDef, WorkflowId } from '@/types/document'
import type { Slot, TemplateSpec } from './templateTypes'
import { nonResidencyFlow } from './flows/nonResidency.tsx'

/**
 * One entry per official document supplied by the barangay team.
 * Template images are the supplied PDFs rendered as-is (public/templates/<id>/).
 * Slot positions were measured from those PDFs in millimetres.
 * Wording and typos in the originals are preserved on purpose.
 */
export interface DocumentTypeDef {
  id: DocumentTypeId
  name: string
  /** Title exactly as printed on the document. */
  printedTitle: string
  category: 'certificate' | 'clearance' | 'case'
  workflow: WorkflowId
  /** Residents may request it online (from the workflows docx). */
  online: boolean
  onlineNote?: string
  requirements: DocumentRequirement[]
  fields: FieldDef[]
  template: TemplateSpec
  /** How the request is handled, in plain words (shown to residents and personnel). */
  process?: string[]
  /**
   * Check personnel record before the Secretary approves (Chairman interview,
   * 10 Nov 2026). The barangay decides what the check involves; the system only
   * records who did it, when, and what they found.
   */
  verification?: { title: string; help: string }
  /** A fee is paid to the Barangay Treasurer before release. */
  fee?: boolean
}

const WORKFLOW_DOC = 'SE Group 4 workflows docx'

/**
 * Services residents may request themselves. Everything else (non-residency
 * certification, summons, incident and blotter records, notices of hearing) is
 * prepared by barangay personnel; residents report concerns through the
 * separate complaint workflow instead.
 */
export const RESIDENT_SERVICES: ReadonlySet<DocumentTypeId> = new Set<DocumentTypeId>([
  'clearance-person',
  'business-clearance',
  'residency',
  'indigency',
  'first-time-job-seeker',
  'no-partner',
  'cohabitation',
  'barangay-certificate',
])

const VALID_ID: DocumentRequirement = { label: 'Valid ID', source: WORKFLOW_DOC }

const A4 = { widthMm: 210.3, heightMm: 297, name: 'A4' } as const
const LETTER = { widthMm: 215.9, heightMm: 279.4, name: 'Letter' } as const
const LEGAL = { widthMm: 215.9, heightMm: 355.6, name: 'Legal' } as const
const FOLIO = { widthMm: 215.9, heightMm: 330.2, name: 'Folio (8.5 × 13 in)' } as const

const pages = (id: string, n = 1) => Array.from({ length: n }, (_, i) => `${import.meta.env.BASE_URL}templates/${id}/page-${i + 1}.png`)

/** Values every "Given/Issued this __ day of __" document computes from the issue date. */
const issueFields: FieldDef[] = [
  { key: 'issueDay', label: 'Day issued', kind: 'text', by: 'system', help: 'Set automatically when the document is issued.' },
  { key: 'issueMonth', label: 'Month issued', kind: 'text', by: 'system', help: 'Set automatically when the document is issued.' },
]

const t = (field: string, x1: number, x2: number, y: number, extra: Partial<Slot> = {}): Slot =>
  ({ kind: 'text', field, page: 1, x1, x2, y, ...extra }) as Slot
const c = (field: string, x1: number, x2: number, y: number, extra: Partial<Slot> = {}): Slot =>
  ({ kind: 'text', field, page: 1, x1, x2, y, align: 'center', ...extra }) as Slot
const check = (field: string, option: string, x: number, y: number, page = 1): Slot => ({ kind: 'check', field, option, x, y, page })

// ── Incident Record Form helpers: values sit inside table cells under their labels.
const cell = (field: string, page: number, x1: number, x2: number, labelTop: number, extra: Partial<Slot> = {}): Slot =>
  ({ kind: 'text', field, page, x1: x1 + 0.6, x2: x2 - 0.6, y: labelTop + 7.6, size: 8.5, ...extra }) as Slot

const personRowFields = (prefix: string, group: string, opts: { requiredName?: boolean; by?: FieldDef['by'] } = {}): FieldDef[] => [
  { key: `${prefix}LastName`, label: 'Last name', kind: 'text', by: opts.by ?? 'applicant', group, required: opts.requiredName },
  { key: `${prefix}GivenName`, label: 'Given name', kind: 'text', by: opts.by ?? 'applicant', group, required: opts.requiredName },
  { key: `${prefix}MiddleName`, label: 'Middle name', kind: 'text', by: opts.by ?? 'applicant', group },
  { key: `${prefix}Extension`, label: 'Extension (Jr., Sr., II…)', kind: 'text', by: opts.by ?? 'applicant', group },
  { key: `${prefix}Nickname`, label: 'Nickname', kind: 'text', by: opts.by ?? 'applicant', group },
  { key: `${prefix}Citizenship`, label: 'Citizenship', kind: 'text', by: opts.by ?? 'applicant', group },
  { key: `${prefix}Gender`, label: 'Gender', kind: 'choice', options: ['Male', 'Female'], by: opts.by ?? 'applicant', group },
  { key: `${prefix}CivilStatus`, label: 'Civil status', kind: 'text', by: opts.by ?? 'applicant', group },
  { key: `${prefix}BirthDate`, label: 'Date of birth (MM/DD/YYYY)', kind: 'text', by: opts.by ?? 'applicant', group },
  { key: `${prefix}Age`, label: 'Age', kind: 'number', by: opts.by ?? 'applicant', group },
  { key: `${prefix}BirthPlace`, label: 'Place of birth', kind: 'text', by: opts.by ?? 'applicant', group },
  { key: `${prefix}Education`, label: 'Educational attainment', kind: 'text', by: opts.by ?? 'applicant', group },
  { key: `${prefix}Occupation`, label: 'Occupation', kind: 'text', by: opts.by ?? 'applicant', group },
  { key: `${prefix}Address`, label: 'Current address (house no., street)', kind: 'text', by: opts.by ?? 'applicant', group },
  { key: `${prefix}Barangay`, label: 'Barangay', kind: 'text', by: opts.by ?? 'applicant', group },
  { key: `${prefix}Town`, label: 'Town/City', kind: 'text', by: opts.by ?? 'applicant', group },
  { key: `${prefix}Province`, label: 'Province', kind: 'text', by: opts.by ?? 'applicant', group },
]

const personRowSlots = (prefix: string, page: number, nameTop: number, detailTop: number, addressTop: number): Slot[] => [
  cell(`${prefix}LastName`, page, 6, 49.5, nameTop),
  cell(`${prefix}GivenName`, page, 50, 93.5, nameTop),
  cell(`${prefix}MiddleName`, page, 94, 138.5, nameTop),
  cell(`${prefix}Extension`, page, 139, 178.5, nameTop),
  cell(`${prefix}Nickname`, page, 179, 208.5, nameTop),
  cell(`${prefix}Citizenship`, page, 6, 22.5, detailTop),
  cell(`${prefix}Gender`, page, 23, 40.5, detailTop),
  cell(`${prefix}CivilStatus`, page, 41, 57.5, detailTop),
  cell(`${prefix}BirthDate`, page, 58, 93.5, detailTop),
  cell(`${prefix}Age`, page, 94, 106.5, detailTop),
  cell(`${prefix}BirthPlace`, page, 107, 138.5, detailTop),
  cell(`${prefix}Education`, page, 139, 178.5, detailTop),
  cell(`${prefix}Occupation`, page, 179, 208.5, detailTop),
  cell(`${prefix}Address`, page, 6, 106.5, addressTop),
  cell(`${prefix}Barangay`, page, 107, 138.5, addressTop),
  cell(`${prefix}Town`, page, 139, 178.5, addressTop),
  cell(`${prefix}Province`, page, 179, 208.5, addressTop),
]

const INCIDENT_TYPES = ['VAWC', 'BCPC', 'TRAFFICKING', 'OTHERS']

const residentName: FieldDef = { key: 'fullName', label: 'Full name', kind: 'text', required: true, by: 'applicant', help: 'Taken from the resident record.' }
const residentAge: FieldDef = { key: 'age', label: 'Age', kind: 'number', required: true, by: 'applicant', help: 'Computed from the birthdate on record.' }
const residentAddress: FieldDef = { key: 'address', label: 'Address', kind: 'text', required: true, by: 'applicant', help: 'Taken from the resident record.' }

const NARRATION_P1 = [195.8, 203.3, 210.8, 218.2, 225.6, 233.1, 240.6, 248.1, 255.5, 263.0, 270.4]
const NARRATION_P2 = [31.6, 39.1, 46.5, 53.9, 61.4, 68.9, 76.4, 83.9, 91.2, 98.7]
const ACTION_P2 = [128.6, 136.1, 143.6, 151.1, 158.4, 165.9]
const NOTICE_ROWS = [156.1, 162.6, 169.1, 175.6, 182.1, 188.5, 195.0, 201.5, 208.0, 214.6, 221.0, 227.5]

export const DOCUMENT_TYPES: DocumentTypeDef[] = [
  {
    id: 'first-time-job-seeker',
    name: 'Certificate of First Time Job Seeker',
    printedTitle: 'BARANGAY CERTIFICATE (First Time Job Seeker Assistance Act - RA 11261)',
    category: 'certificate',
    workflow: 'standard',
    online: true,
    requirements: [VALID_ID],
    fields: [
      residentName,
      residentAddress,
      { key: 'yearsResident', label: 'Years as a resident', kind: 'number', required: true, by: 'applicant' },
      ...issueFields,
      { key: 'validUntil', label: 'Valid until', kind: 'text', by: 'system', help: 'One (1) year from issuance, as printed on the certificate.' },
    ],
    template: {
      source: 'FIRST TIME JOB SEEKER (CERT).docx',
      pageSize: A4,
      pages: pages('first-time-job-seeker'),
      font: 'Arial, Helvetica, sans-serif',
      size: 12,
      bold: true,
      slots: [
        t('fullName', 127.6, 202.6, 88.1),
        t('address', 83.4, 203, 94.6),
        c('yearsResident', 62.2, 69, 100.7),
        c('issueDay', 98.6, 112.1, 151),
        c('issueMonth', 131.1, 161.3, 151),
        c('validUntil', 148.6, 187.8, 169.9),
      ],
    },
  },
  {
    id: 'non-residency',
    verification: { title: 'Residency verification', help: 'Check the resident records and, if needed, confirm with the street leader that the person does not live in Barangay 181.' },
    name: 'Certification of Non-Resident',
    printedTitle: 'BARANGAY CERTIFICATION OF NON- RESIDENCY',
    category: 'certificate',
    workflow: 'standard',
    online: false,
    onlineNote: 'Requested for 4Ps (DSWD) records of a former resident, so it is encoded by barangay staff at the Barangay Hall.',
    requirements: [
      { label: 'Request or referral from the 4Ps / DSWD (or authorization letter if requested on behalf of the former resident)', source: 'Certificate wording: issued upon the request of 4Ps under DSWD' },
      { label: 'Valid ID of the person requesting', source: 'Standard practice' },
    ],
    process: [
      'The 4Ps beneficiary, a representative or the DSWD municipal link requests it at the Barangay Hall.',
      'The Barangay Secretary checks the resident records and household records to confirm the person no longer lives in Barangay 181 and notes the former address.',
      'The Punong Barangay approves and signs; the certification is sealed and released.',
    ],
    fields: [
      { key: 'fullName', label: 'Name', kind: 'text', required: true, by: 'staff' },
      { key: 'formerAddress', label: 'Former address', kind: 'text', required: true, by: 'staff' },
      ...issueFields,
    ],
    template: {
      source: 'CERTIFICATION OF NON RESIDENTS.docx',
      pageSize: A4,
      pages: pages('non-residency'),
      font: 'Calibri, Carlito, sans-serif',
      size: 14,
      slots: [],
      flow: nonResidencyFlow,
    },
  },
  {
    id: 'cohabitation',
    verification: { title: 'Cohabitation verification', help: 'Confirm that both persons live together at the stated address (records check or home visit).' },
    name: 'Certification of Cohabitation of Residents',
    printedTitle: 'CERTIFICATE OF COHABITATION',
    category: 'certificate',
    workflow: 'standard',
    online: true,
    requirements: [
      { label: 'Valid ID of both applicants', source: `${WORKFLOW_DOC}: "upload the required IDs and supporting documents"` },
      { label: 'Supporting documents', source: WORKFLOW_DOC },
    ],
    fields: [
      { key: 'partner1Name', label: 'Name', kind: 'text', required: true, by: 'applicant', group: 'First applicant' },
      { key: 'partner1Age', label: 'Age', kind: 'number', required: true, by: 'applicant', group: 'First applicant' },
      { key: 'partner2Name', label: 'Name', kind: 'text', required: true, by: 'applicant', group: 'Second applicant' },
      { key: 'partner2Age', label: 'Age', kind: 'number', required: true, by: 'applicant', group: 'Second applicant' },
      { key: 'houseStreet', label: 'House no. and street', kind: 'text', required: true, by: 'applicant', help: 'Printed before "Gagalangin Tondo, Manila".' },
      { key: 'duration', label: 'Living together for (years/months)', kind: 'text', required: true, by: 'applicant', help: 'Number only, e.g. 3. The form prints "years/months" after it.' },
      { key: 'sinceFrom', label: 'Living together since (month)', kind: 'text', required: true, by: 'applicant', help: 'e.g. March' },
      { key: 'sinceTo', label: 'Living together since (year)', kind: 'text', required: true, by: 'applicant', help: 'e.g. 2022' },
      ...issueFields,
    ],
    template: {
      source: 'CERTIFICATION FOR COHABITATION OF RESIDENTS.docx',
      pageSize: LETTER,
      pages: pages('cohabitation'),
      font: 'Calibri, Carlito, sans-serif',
      size: 14,
      bold: true,
      slots: [
        c('partner1Name', 90.2, 132.1, 80.1),
        c('partner1Age', 134.4, 143.9, 80.1),
        c('partner2Name', 25.4, 64.1, 88.5),
        c('partner2Age', 66.4, 75.9, 88.5),
        c('houseStreet', 59.1, 90.8, 96.9),
        c('duration', 97.3, 103.6, 164),
        c('sinceFrom', 159.5, 172.2, 164),
        c('sinceTo', 175.5, 188.2, 164),
        c('issueDay', 100.1, 106.4, 205.7),
        c('issueMonth', 127, 140.3, 205.7),
      ],
    },
  },
  {
    id: 'no-partner',
    verification: { title: 'Civil status verification', help: 'Confirm the applicant’s civil status from the resident record and the documents presented.' },
    name: 'Certificate of Singleness',
    printedTitle: 'CERTIFICATE OF NO PARTNER',
    category: 'certificate',
    workflow: 'standard',
    online: false,
    onlineNote: 'Proposed process: the applicant personally visits the Barangay Hall.',
    // Used for solo parent applications (RA 11861, Expanded Solo Parents Welfare Act).
    requirements: [
      { label: 'Valid ID of the applicant', source: 'Standard practice' },
      { label: 'PSA birth certificate of the child', source: 'RA 11861 solo parent application practice' },
    ],
    fields: [
      residentName,
      residentAge,
      residentAddress,
      { key: 'childName', label: "Child's name", kind: 'text', required: true, by: 'staff' },
      { key: 'childAge', label: "Child's age", kind: 'number', required: true, by: 'staff' },
      ...issueFields,
    ],
    template: {
      source: 'CERTIFICATE OF SINGLENESS.docx',
      pageSize: LETTER,
      pages: pages('no-partner'),
      font: 'Arial, Helvetica, sans-serif',
      size: 12,
      slots: [
        c('fullName', 101.5, 153.5, 89.7),
        c('age', 156, 162.6, 89.7),
        t('address', 67.2, 130, 101.8),
        c('childName', 60.8, 107.7, 151.6),
        c('childAge', 124.3, 129.9, 151.6),
        c('issueDay', 105.4, 114.3, 189.8),
        c('issueMonth', 131.6, 142.6, 189.8),
      ],
    },
  },
  {
    id: 'residency',
    name: 'Certificate of Residency',
    printedTitle: 'CERTIFICATE OF RESIDENCY',
    category: 'certificate',
    workflow: 'standard',
    online: true,
    requirements: [VALID_ID],
    fields: [
      residentName,
      residentAge,
      residentAddress,
      {
        key: 'purposes',
        label: 'Application for',
        kind: 'multi',
        required: true,
        by: 'applicant',
        options: [
          'Local Employment',
          'Hospital / Medical',
          'Bank Transaction',
          'Education Requirement',
          'School Admission',
          'Solo Parent',
          'Postal ID Requirement',
          'Vending Permit',
          'Travel / Transfer of Residence',
          'Calamity Loan',
          'SSS Loan',
          'Others',
        ],
      },
      { key: 'purposeOthers', label: 'Others (specify)', kind: 'text', by: 'applicant', help: 'Printed in the box under the list.' },
      ...issueFields,
    ],
    template: {
      source: 'CERTIFICATE OF RESIDENCY.docx',
      pageSize: A4,
      pages: pages('residency'),
      font: 'Arial, Helvetica, sans-serif',
      size: 14,
      bold: true,
      slots: [
        t('fullName', 106.6, 198, 82.5),
        c('age', 17.1, 30.1, 89.7),
        t('address', 17.3, 170.4, 97.1),
        ...[
          ['Local Employment', 120.7],
          ['Hospital / Medical', 128],
          ['Bank Transaction', 135.2],
          ['Education Requirement', 142.5],
          ['School Admission', 149.7],
          ['Solo Parent', 157],
        ].map(([o, y]) => check('purposes', o as string, 33.5, y as number)),
        ...[
          ['Postal ID Requirement', 120.7],
          ['Vending Permit', 128],
          ['Travel / Transfer of Residence', 135.2],
          ['Calamity Loan', 142.5],
          ['SSS Loan', 149.7],
          ['Others', 157],
        ].map(([o, y]) => check('purposes', o as string, 106.2, y as number)),
        { kind: 'area', field: 'purposeOthers', page: 1, x1: 32, x2: 184.5, y1: 179, y2: 186.2, size: 12 },
        c('issueDay', 51.8, 62.2, 201.2),
        c('issueMonth', 90.7, 128, 201.2),
      ],
    },
  },
  {
    id: 'indigency',
    verification: { title: 'Indigency verification', help: 'Confirm the applicant’s circumstances as the barangay requires (records check or home visit).' },
    name: 'Certificate of Indigency',
    printedTitle: 'CERTIFICATE OF INDIGENCY',
    category: 'certificate',
    workflow: 'standard',
    online: true,
    requirements: [VALID_ID],
    fields: [
      residentName,
      residentAge,
      residentAddress,
      {
        key: 'assistance',
        label: 'Assistance',
        kind: 'multi',
        required: true,
        by: 'applicant',
        options: ['Medical Assistance', 'Educational Assistance', 'Burial Asssistance', 'Others'],
        help: '"Burial Asssistance" is spelled as printed on the form.',
      },
      { key: 'assistanceOthers', label: 'Others (specify)', kind: 'text', by: 'applicant' },
      ...issueFields,
    ],
    template: {
      source: 'CERTIFICATE OF INDIGENCY.docx',
      pageSize: A4,
      pages: pages('indigency'),
      font: 'Arial, Helvetica, sans-serif',
      size: 14,
      bold: true,
      slots: [
        t('fullName', 96.2, 197, 90.2),
        c('age', 17.7, 30.6, 97.6),
        t('address', 45.3, 186.8, 104.8),
        check('assistance', 'Medical Assistance', 29.2, 149.4),
        check('assistance', 'Educational Assistance', 29.2, 156.7),
        check('assistance', 'Burial Asssistance', 29.2, 163.9),
        check('assistance', 'Others', 29.2, 171.2),
        t('assistanceOthers', 52.5, 190, 172.6),
        c('issueDay', 52.2, 62.5, 188.4),
        c('issueMonth', 90.7, 127.8, 188.4),
      ],
    },
  },
  {
    id: 'summon',
    name: 'Barangay Summon',
    printedTitle: 'OFFICE OF THE LUPONG TAGAPAMAYAPA (Summon)',
    category: 'case',
    workflow: 'summon',
    online: true,
    requirements: [],
    process: [
      'The complainant files online or at the Barangay Hall; the Barangay Secretary reviews it.',
      'The Punong Barangay assesses the complaint. If a summons is needed, the Secretary prepares it for approval and signature.',
      'The summons is served on the respondent, who appears for mediation within the 15-day period (RA 7160 Sec. 410).',
    ],
    fields: [
      { key: 'complainantName', label: 'Complainant', kind: 'text', required: true, by: 'applicant', group: 'Parties' },
      { key: 'respondentName', label: 'Respondent', kind: 'text', required: true, by: 'applicant', group: 'Parties' },
      { key: 'respondentAddress', label: "Respondent's address", kind: 'text', required: true, by: 'applicant', group: 'Parties' },
      { key: 'complaintDetails', label: 'Details of the complaint', kind: 'textarea', required: true, by: 'applicant', help: 'For review only. This is not printed on the summons.' },
      { key: 'caseNo', label: 'Barangay Case No.', kind: 'text', required: true, by: 'staff', staffOnly: true, group: 'Case' },
      { key: 'caseFor', label: 'For', kind: 'text', required: true, by: 'staff', staffOnly: true, group: 'Case' },
      { key: 'hearingDay', label: 'Hearing day', kind: 'text', required: true, by: 'staff', staffOnly: true, group: 'Mediation schedule', help: 'e.g. 12th' },
      { key: 'hearingMonth', label: 'Hearing month', kind: 'text', required: true, by: 'staff', staffOnly: true, group: 'Mediation schedule' },
      { key: 'hearingTime', label: 'Time', kind: 'text', required: true, by: 'staff', staffOnly: true, group: 'Mediation schedule', help: 'Printed before "in the Morning/Afternoon/Evening".' },
      ...issueFields,
    ],
    template: {
      source: 'BRGY SUMMON.docx',
      pageSize: A4,
      pages: pages('summon'),
      font: '"Bookman Old Style", "URW Bookman", Bookman, Georgia, serif',
      size: 11,
      slots: [
        t('caseNo', 73, 140, 62.4),
        t('caseFor', 42, 140, 67.6),
        t('complainantName', 30.4, 120, 77.6),
        t('respondentName', 30.4, 120, 104.3),
        t('respondentName', 34.5, 150, 131),
        t('respondentAddress', 32.9, 150, 136.2),
        c('hearingDay', 42.8, 51.3, 160.7),
        c('hearingMonth', 84.5, 106.7, 160.7),
        c('hearingTime', 145.3, 156, 160.7),
        c('issueDay', 52.6, 59.1, 191.3),
        c('issueMonth', 74.2, 94.2, 191.3),
      ],
    },
  },
  {
    id: 'incident-record',
    name: 'Barangay Incident Record Form',
    printedTitle: 'BARANGAY INCIDENT RECORD FORM',
    category: 'case',
    workflow: 'record',
    online: true,
    requirements: [],
    fields: [
      { key: 'blotterNo', label: 'Blotter entry number', kind: 'text', required: true, by: 'staff', staffOnly: true, group: 'Record' },
      { key: 'reportedAt', label: 'Date and time reported', kind: 'text', by: 'system', group: 'Record' },
      { key: 'idPresented', label: 'ID presented', kind: 'text', by: 'staff', staffOnly: true, group: 'Record' },
      { key: 'incidentTypes', label: 'Type of incident', kind: 'multi', options: INCIDENT_TYPES, required: true, by: 'applicant', group: 'Incident' },
      { key: 'incidentTypeOther', label: 'Others (specify)', kind: 'text', by: 'applicant', group: 'Incident' },
      { key: 'incidentDate', label: 'Date of incident', kind: 'text', required: true, by: 'applicant', group: 'Incident' },
      { key: 'incidentTime', label: 'Time of incident', kind: 'text', required: true, by: 'applicant', group: 'Incident' },
      { key: 'incidentPlace', label: 'Place of incident', kind: 'text', required: true, by: 'applicant', group: 'Incident' },
      { key: 'narrative', label: 'Narrative of the incident', kind: 'textarea', required: true, by: 'applicant', group: 'Incident', help: 'Who, what, when, where, why and how.' },
      { key: 'reporterContact', label: 'Contact number', kind: 'text', by: 'applicant', group: 'A. Reporting person' },
      ...personRowFields('reporter', 'A. Reporting person', { requiredName: true }),
      { key: 'suspectContact', label: 'Contact number', kind: 'text', by: 'applicant', group: 'B. Suspect' },
      { key: 'suspectRelation', label: 'Relationship to victim', kind: 'text', by: 'applicant', group: 'B. Suspect' },
      ...personRowFields('suspect', 'B. Suspect'),
      { key: 'suspectFeatures', label: 'Other distinguishing features', kind: 'textarea', by: 'applicant', group: 'B. Suspect' },
      { key: 'reporterIsVictim', label: 'The reporting person is the victim', kind: 'check', by: 'applicant', group: 'C. Victim' },
      ...personRowFields('victim', 'C. Victim'),
    ],
    template: {
      source: 'BRGY INCIDENT RECORD FORM.pptx',
      pageSize: FOLIO,
      pages: pages('incident-record', 2),
      font: 'Calibri, Carlito, sans-serif',
      size: 8.5,
      slots: [
        // Header
        { kind: 'text', field: 'blotterNo', page: 1, x1: 6, x2: 37, y: 16, size: 9 },
        { kind: 'text', field: 'reportedAt', page: 1, x1: 6, x2: 37, y: 27, size: 8 },
        check('incidentTypes', 'VAWC', 41.3, 12.4),
        check('incidentTypes', 'BCPC', 41.3, 15.4),
        check('incidentTypes', 'TRAFFICKING', 41.3, 19.3),
        check('incidentTypes', 'OTHERS', 41.3, 22.3),
        { kind: 'text', field: 'incidentTypeOther', page: 1, x1: 41, x2: 76, y: 27.4, size: 7.5 },
        // A. Reporting person
        { kind: 'text', field: 'incidentDateTime', page: 1, x1: 79.6, x2: 117.4, y: 41.6, size: 8.5 },
        cell('reporterContact', 1, 118, 163.5, 34),
        cell('idPresented', 1, 164, 208.5, 34),
        ...personRowSlots('reporter', 1, 44, 55, 65),
        // B. Suspect
        cell('suspectContact', 1, 118, 163.5, 89),
        cell('suspectRelation', 1, 164, 208.5, 89),
        ...personRowSlots('suspect', 1, 100, 110, 121),
        { kind: 'area', field: 'suspectFeatures', page: 1, x1: 7, x2: 208, y1: 199, y2: 273, size: 9 },
        // Receipt (page 1)
        cell('blotterNo', 1, 6, 52, 282),
        cell('reportedAt', 1, 152, 208.5, 282),
        cell('reporterFullName', 1, 40, 128.5, 296.5, { y: 301.4, size: 8 }),
        cell('reporterFullAddress', 1, 129, 208.5, 296.5, { y: 301.4, size: 8 }),
        check('incidentTypes', 'VAWC', 41.3, 307.4),
        check('incidentTypes', 'BCPC', 53.3, 307.4),
        check('incidentTypes', 'TRAFFICKING', 65.3, 307.4),
        check('incidentTypes', 'OTHERS', 41.3, 311.3),
        cell('incidentDateTime', 1, 40, 84.5, 313),
        cell('incidentPlace', 1, 85, 128.5, 313),
        // C. Victim (page 2)
        check('reporterIsVictim', 'true', 79.1, 10.2, 2),
        ...personRowSlots('victim', 2, 20, 30, 40),
        // D. Narrative (page 2)
        cell('blotterNo', 2, 79, 141.5, 65),
        check('incidentTypes', 'VAWC', 143.1, 68.3, 2),
        check('incidentTypes', 'BCPC', 152.9, 68.3, 2),
        check('incidentTypes', 'TRAFFICKING', 162.7, 68.3, 2),
        check('incidentTypes', 'OTHERS', 143.1, 72.2, 2),
        cell('incidentDate', 2, 6, 78.5, 75),
        cell('incidentTime', 2, 79, 141.5, 75),
        cell('incidentPlace', 2, 142, 208.5, 75),
        { kind: 'area', field: 'narrative', page: 2, x1: 7, x2: 208, y1: 90, y2: 212, size: 10 },
      ],
    },
  },
  {
    id: 'clearance-person',
    name: 'Barangay Clearance (Person)',
    printedTitle: 'BARANGAY CLEARANCE',
    category: 'clearance',
    workflow: 'standard',
    online: true,
    requirements: [VALID_ID],
    fields: [
      residentName,
      residentAge,
      { key: 'birthDate', label: 'Born on', kind: 'text', required: true, by: 'applicant', help: 'Taken from the resident record.' },
      residentAddress,
      { key: 'residingSince', label: 'Residing since', kind: 'text', required: true, by: 'applicant', help: 'Year, e.g. 2015.' },
      { key: 'purpose', label: 'Purpose', kind: 'text', required: true, by: 'applicant' },
      ...issueFields,
    ],
    template: {
      source: 'BRGY CLEARANCE (PERSON).docx',
      pageSize: LETTER,
      pages: pages('clearance-person'),
      font: 'Arial, Helvetica, sans-serif',
      size: 13,
      bold: true,
      slots: [
        c('fullName', 109.9, 181.6, 83.9),
        c('age', 183.5, 190.9, 83.9),
        c('birthDate', 80.4, 122.8, 90.7),
        t('address', 80.6, 205, 97.7),
        c('residingSince', 63.5, 80.6, 104.5),
        t('purpose', 86.4, 205, 138.7),
        c('issueDay', 84.2, 96.5, 173.4),
        c('issueMonth', 113.7, 150.4, 173.4),
        // The printed "2024" was removed from the page image; the current year is printed instead.
        { kind: 'static', text: '2026', page: 1, x1: 149.6, x2: 168.5, y: 174.9, size: 15, bold: true },
      ],
    },
  },
  {
    id: 'business-clearance',
    verification: { title: 'Ocular inspection', help: 'Visit the business location and record what was found (location, nature of business, safety).' },
    fee: true,
    name: 'Barangay Business Clearance',
    printedTitle: 'BARANGAY BUSINESS CLEARANCE',
    category: 'clearance',
    workflow: 'standard',
    online: true,
    // Standard Philippine practice: LGC (RA 7160) Sec. 152(c) and the Ease of Doing Business Act (RA 11032).
    requirements: [
      { label: 'DTI business name registration (sole proprietor) or SEC / CDA registration', source: 'RA 7160 Sec. 152(c) practice' },
      { label: 'Proof of business location: contract of lease, or land title / tax declaration', source: 'RA 7160 Sec. 152(c) practice' },
      { label: 'Community Tax Certificate (cedula)', source: 'Business clearance form (CTC No.)' },
      { label: 'Valid ID of the owner', source: 'Standard practice' },
      { label: 'For renewal: previous Barangay Business Clearance or Mayor’s Permit', source: 'Standard practice' },
    ],
    process: [
      'The owner applies online (or at the Barangay Hall) and uploads the requirements.',
      'The Barangay Secretary checks the documents and that the business is located within Barangay 181.',
      'The clearance fee set by the barangay’s revenue ordinance is paid to the Barangay Treasurer, who issues an official receipt.',
      'The Barangay Chairman approves and signs; the clearance is sealed and ready for pickup. It is valid for one (1) year from the date of issue.',
      'Simple transactions are processed within 3 working days (RA 11032).',
    ],
    fields: [
      { key: 'ownerName', label: 'Name (This is to certify that)', kind: 'text', required: true, by: 'applicant' },
      { key: 'businessAddress', label: 'Business located at', kind: 'text', required: true, by: 'applicant' },
      { key: 'businessName', label: 'Business name', kind: 'text', required: true, by: 'applicant' },
      { key: 'businessNature', label: 'To operate the business of', kind: 'text', required: true, by: 'applicant' },
      { key: 'permitFor', label: 'Business permit application', kind: 'choice', options: ['NEW', 'RENEWAL'], required: true, by: 'applicant', help: 'Printed after "BUSINESS PERMIT".' },
      { key: 'clearanceNo', label: 'Clearance No.', kind: 'text', required: true, by: 'staff', staffOnly: true },
      { key: 'ctcNo', label: 'CTC No.', kind: 'text', by: 'staff', staffOnly: true, group: 'Community Tax Certificate' },
      { key: 'ctcIssuedOn', label: 'Issued on', kind: 'text', by: 'staff', staffOnly: true, group: 'Community Tax Certificate' },
      { key: 'ctcIssuedAt', label: 'Issued at', kind: 'text', by: 'staff', staffOnly: true, group: 'Community Tax Certificate' },
      { key: 'issueDate', label: 'Date', kind: 'text', by: 'system', help: 'Printed after "DATE:" and "Done in the City of Manila".' },
      { key: 'validUntil', label: 'Valid until', kind: 'text', by: 'system', help: 'One (1) year from date of issue, as printed on the form.' },
    ],
    template: {
      source: 'BRGY BUSINESS CLEARANCE.docx',
      pageSize: LETTER,
      pages: pages('business-clearance'),
      font: 'Arial, Helvetica, sans-serif',
      size: 12,
      slots: [
        t('issueDate', 156, 205, 57.9),
        t('ownerName', 74, 189, 78.2),
        t('businessAddress', 16, 189, 92.2),
        t('businessName', 16, 177.5, 106.2),
        t('businessNature', 16, 88, 120.5),
        t('permitFor', 16, 96.5, 169.9),
        t('issueDate', 77, 137.5, 184),
        t('clearanceNo', 49.2, 104, 190.9),
        t('validUntil', 141.7, 199.2, 199.3),
        t('ctcNo', 42, 67.8, 212, { size: 11 }),
        t('ctcIssuedOn', 41.5, 67.3, 219.3, { size: 11 }),
        t('ctcIssuedAt', 41.5, 67.3, 226.3, { size: 11 }),
      ],
    },
  },
  {
    id: 'barangay-certificate',
    name: 'Barangay Certificate',
    printedTitle: 'BARANGAY CERTIFICATE',
    category: 'certificate',
    workflow: 'standard',
    online: true,
    requirements: [VALID_ID],
    fields: [residentName, residentAge, residentAddress, { key: 'purpose', label: 'Purpose', kind: 'textarea', required: true, by: 'applicant' }, ...issueFields],
    template: {
      source: 'BARANGAY CERTIFICATE.docx',
      pageSize: A4,
      pages: pages('barangay-certificate'),
      font: 'Arial, Helvetica, sans-serif',
      size: 14,
      bold: true,
      slots: [
        t('fullName', 94.8, 196.5, 85.9),
        c('age', 15.7, 28.8, 93.3),
        t('address', 43.5, 186, 100.5),
        {
          kind: 'lines',
          field: 'purpose',
          x1: 16,
          x2: 127.3,
          lines: [
            { page: 1, y: 154.9, x1: 105, x2: 195.5 },
            { page: 1, y: 162.2 },
          ],
        },
        c('issueDay', 50.5, 61, 177),
        c('issueMonth', 89.3, 126.5, 177),
      ],
    },
  },
  {
    id: 'blotter-report',
    name: 'Barangay Blotter Report',
    printedTitle: 'BARANGAY BLOTTER ENTRY FORM',
    category: 'case',
    workflow: 'record',
    online: true,
    requirements: [],
    fields: [
      { key: 'caseNo', label: 'Case No.', kind: 'text', required: true, by: 'staff', staffOnly: true, group: 'Record' },
      { key: 'recordedAt', label: 'Date time recorded', kind: 'text', by: 'system', group: 'Record' },
      { key: 'complainantName', label: 'Name', kind: 'text', required: true, by: 'applicant', group: 'Complainant' },
      { key: 'complainantAge', label: 'Age', kind: 'number', by: 'applicant', group: 'Complainant' },
      { key: 'complainantCivilStatus', label: 'Civil status', kind: 'text', by: 'applicant', group: 'Complainant' },
      { key: 'complainantAddress', label: 'Address', kind: 'text', required: true, by: 'applicant', group: 'Complainant' },
      { key: 'complainantContact', label: 'Contact no.', kind: 'text', by: 'applicant', group: 'Complainant' },
      { key: 'respondentName', label: 'Name', kind: 'text', required: true, by: 'applicant', group: 'Respondent' },
      { key: 'respondentAge', label: 'Age', kind: 'number', by: 'applicant', group: 'Respondent' },
      { key: 'respondentCivilStatus', label: 'Civil status', kind: 'text', by: 'applicant', group: 'Respondent' },
      { key: 'respondentAddress', label: 'Address', kind: 'text', by: 'applicant', group: 'Respondent' },
      { key: 'respondentContact', label: 'Contact no.', kind: 'text', by: 'applicant', group: 'Respondent' },
      { key: 'offense', label: 'For', kind: 'text', required: true, by: 'applicant' },
      { key: 'narration', label: 'Narration of facts', kind: 'textarea', required: true, by: 'applicant' },
      { key: 'actionTaken', label: 'Action taken', kind: 'textarea', by: 'staff', staffOnly: true },
      { key: 'recordedByName', label: 'Recorded by (name)', kind: 'text', required: true, by: 'staff', staffOnly: true, group: 'Recorded by' },
      { key: 'recordedByPosition', label: 'Position', kind: 'text', required: true, by: 'staff', staffOnly: true, group: 'Recorded by' },
    ],
    template: {
      source: 'BARANGAY BLOTTER REPORT 2026.docx',
      pageSize: A4,
      pages: pages('blotter-report', 2),
      font: 'Calibri, Carlito, sans-serif',
      size: 11,
      slots: [
        t('caseNo', 47.2, 86.3, 53.9),
        t('recordedAt', 75.8, 123, 61.4),
        t('complainantName', 42.4, 123.5, 83.9),
        t('complainantAge', 37.3, 56.6, 91.2),
        t('complainantCivilStatus', 126.2, 154, 91.2),
        t('complainantAddress', 47.2, 153.6, 98.7),
        t('complainantContact', 54.4, 110.3, 106.2),
        t('respondentName', 42.4, 134.7, 136.1),
        t('respondentAge', 37.3, 51, 143.6),
        t('respondentCivilStatus', 128.2, 156, 143.6),
        t('respondentAddress', 47.2, 133.9, 151.1),
        t('respondentContact', 53.2, 111.8, 158.4),
        t('offense', 36, 156.5, 173.4),
        { kind: 'lines', field: 'narration', x1: 25.6, x2: 182.6, lines: [...NARRATION_P1.map((y) => ({ page: 1, y })), ...NARRATION_P2.map((y) => ({ page: 2, y }))] },
        { kind: 'lines', field: 'actionTaken', x1: 25.6, x2: 182.6, lines: ACTION_P2.map((y) => ({ page: 2, y })) },
        { kind: 'text', field: 'recordedByName', page: 2, x1: 42.4, x2: 134.7, y: 210.8 },
        { kind: 'text', field: 'recordedByPosition', page: 2, x1: 48.7, x2: 138.2, y: 218.2 },
      ],
    },
  },
  {
    id: 'notice-of-hearing',
    name: 'Notice of Hearing',
    printedTitle: 'NNOTICE OF HEARING (Mediation Proceedings )',
    category: 'case',
    workflow: 'notice',
    online: false,
    onlineNote: 'Prepared by the Secretary from the case record and the approved hearing schedule.',
    requirements: [],
    fields: [
      { key: 'complainantNames', label: 'Complainant name/s', kind: 'text', required: true, by: 'staff', group: 'Complainant' },
      { key: 'complainantAddress', label: 'Address', kind: 'text', required: true, by: 'staff', group: 'Complainant' },
      { key: 'respondentNames', label: 'Respondent name/s', kind: 'text', required: true, by: 'staff', group: 'Respondent' },
      { key: 'respondentAddress', label: 'Address', kind: 'text', required: true, by: 'staff', group: 'Respondent' },
      { key: 'hearingDay', label: 'Hearing day', kind: 'text', required: true, by: 'staff', group: 'Schedule', help: 'e.g. 27th' },
      { key: 'hearingMonth', label: 'Hearing month', kind: 'text', required: true, by: 'staff', group: 'Schedule' },
      { key: 'hearingTime', label: 'Time', kind: 'text', required: true, by: 'staff', group: 'Schedule', help: 'Printed before "in the evening / afternoon".' },
      { key: 'receivedBy', label: 'Received by (one name per line)', kind: 'textarea', by: 'staff', help: 'Usually each party. Signatures and dates are written by hand.' },
    ],
    template: {
      source: 'NOTICE OF HEARING( Mediation Proceedings).docx (page 1 only)',
      pageSize: LEGAL,
      pages: pages('notice-of-hearing'),
      font: '"Times New Roman", Times, serif',
      size: 13,
      bold: true,
      slots: [
        c('complainantNames', 40, 178.6, 64.4),
        c('complainantAddress', 40, 178.6, 69.9),
        c('respondentNames', 40, 178.6, 92.8),
        c('respondentAddress', 40, 178.6, 98.3),
        c('hearingDay', 157.1, 182.6, 117.2, { bold: false }),
        c('hearingMonth', 36.8, 59.4, 123.4, { bold: false }),
        c('hearingTime', 82.8, 99.8, 123.4, { bold: false }),
        { kind: 'list', field: 'receivedBy', page: 1, x1: 25.6, x2: 64.8, ys: NOTICE_ROWS, size: 11 },
      ],
    },
  },
]

export const DOCUMENT_TYPE_MAP = Object.fromEntries(DOCUMENT_TYPES.map((d) => [d.id, d])) as Record<DocumentTypeId, DocumentTypeDef>

const REQ_KEY = 'bmis.requirements'

/** Requirements set by authorized personnel (prototype: saved in this browser). */
export function requirementOverrides(): Partial<Record<DocumentTypeId, DocumentRequirement[]>> {
  try {
    return JSON.parse(localStorage.getItem(REQ_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function writeRequirementOverride(id: DocumentTypeId, list: DocumentRequirement[] | null) {
  const all = requirementOverrides()
  if (list) all[id] = list
  else delete all[id]
  try {
    localStorage.setItem(REQ_KEY, JSON.stringify(all))
  } catch {
    /* storage unavailable: change lasts for this page only */
  }
}

export function getDocumentType(id: DocumentTypeId): DocumentTypeDef {
  const base = DOCUMENT_TYPE_MAP[id]
  const custom = base && requirementOverrides()[id]
  return custom ? { ...base, requirements: custom } : base
}
