import type { CivilStatus, Family, Household, Relationship, Resident, ResidentChangeRequest, ResidentRegistration } from '@/types/resident'
import { MOCK_TODAY, isoDaysAgo } from './random'

/**
 * SAMPLE RESIDENTS FOR THE PROTOTYPE. These are fictional people, not verified
 * residents of Barangay 181. Street names are Barangay 181 streets; house numbers
 * are made up. The same people appear across requests, cases and borrowing so
 * the demo stays consistent. Replace with the imported master list later.
 */

export const SAMPLE_DATA_NOTICE = 'Sample data for demonstration. These are not actual verified Barangay 181 residents.'

/** Areas = streets in Barangay 181 (from the senior citizen masterlist's addresses). */
export const AREAS = ['Rosalina St.', 'Victoria St.', 'Benita St.', 'Asa St.', 'Apog St.', 'Gen. Lukban St.', 'Juan Luna St.', 'R. Fernandez St.'] as const

interface P {
  f: string
  m?: string
  l: string
  sx?: string
  sex: 'm' | 'f'
  b: string
  c: CivilStatus
  rel: Relationship
  job?: string
  edu?: string
  tel?: string
  voter?: boolean
  pwd?: boolean
  solo?: boolean
  fourPs?: boolean
  prog?: boolean
  osca?: string
}

interface H {
  houseNo: string
  street: (typeof AREAS)[number]
  since: string
  families: { name: string; members: P[] }[]
}

const HOUSEHOLDS: H[] = [
  {
    houseNo: '2741', street: 'Rosalina St.', since: '2012',
    families: [
      { name: 'Dizon family', members: [
        { f: 'Ramon', m: 'Cruz', l: 'Dizon', sex: 'm', b: '1988-07-02', c: 'married', rel: 'Head', job: 'Tricycle driver', edu: 'High school graduate', tel: '09171230001', voter: true, fourPs: true },
        { f: 'Maria Clara', m: 'Santos', l: 'Dizon', sex: 'f', b: '1991-03-14', c: 'married', rel: 'Spouse', job: 'Sari-sari store owner', edu: 'College level', tel: '09171234567', voter: true, fourPs: true },
        { f: 'Paolo', m: 'Santos', l: 'Dizon', sex: 'm', b: '2014-05-21', c: 'single', rel: 'Son', job: 'Student', edu: 'Elementary', fourPs: true },
        { f: 'Angela', m: 'Santos', l: 'Dizon', sex: 'f', b: '2017-11-02', c: 'single', rel: 'Daughter', job: 'Student', edu: 'Elementary', fourPs: true },
      ] },
      { name: 'Santos family', members: [
        { f: 'Lourdes', m: 'Mendoza', l: 'Santos', sex: 'f', b: '1958-02-11', c: 'widowed', rel: 'Head', job: 'None', edu: 'Elementary graduate', tel: '09181230002', voter: true, prog: true, osca: '181-0012' },
      ] },
    ],
  },
  {
    houseNo: '2765', street: 'Victoria St.', since: '2005',
    families: [{ name: 'Garcia family', members: [
      { f: 'Daniel', m: 'Reyes', l: 'Garcia', sex: 'm', b: '1983-09-10', c: 'married', rel: 'Head', job: 'Construction worker', edu: 'High school graduate', tel: '09191230003', voter: true },
      { f: 'Kristine', m: 'Lopez', l: 'Garcia', sex: 'f', b: '1986-01-25', c: 'married', rel: 'Spouse', job: 'Laundry worker', edu: 'High school graduate', voter: true },
      { f: 'Joshua', m: 'Lopez', l: 'Garcia', sex: 'm', b: '2008-06-30', c: 'single', rel: 'Son', job: 'Student', edu: 'Senior high school', voter: false },
      { f: 'Mika', m: 'Lopez', l: 'Garcia', sex: 'f', b: '2012-12-03', c: 'single', rel: 'Daughter', job: 'Student', edu: 'Junior high school' },
    ] }],
  },
  {
    houseNo: '631', street: 'Benita St.', since: '1990',
    families: [{ name: 'Navarro family', members: [
      { f: 'Rogelio', m: 'Ramos', l: 'Navarro', sex: 'm', b: '1959-04-18', c: 'widowed', rel: 'Head', job: 'Retired', edu: 'Vocational', tel: '09201230004', voter: true, pwd: true, osca: '181-0031' },
      { f: 'Rafael', m: 'Domingo', l: 'Navarro', sex: 'm', b: '1992-08-08', c: 'live_in', rel: 'Son', job: 'Delivery rider', edu: 'College graduate', tel: '09201230005', voter: true },
      { f: 'Elena', m: 'Lopez', l: 'Salazar', sex: 'f', b: '2001-10-12', c: 'live_in', rel: 'Partner', job: 'Call center agent', edu: 'College level', tel: '09201230006', voter: true },
    ] }],
  },
  {
    houseNo: '15', street: 'Asa St.', since: '2019',
    families: [{ name: 'Bautista family', members: [
      { f: 'Angelica', m: 'Torres', l: 'Bautista', sex: 'f', b: '1995-03-27', c: 'single', rel: 'Head', job: 'Market vendor', edu: 'High school graduate', tel: '09211230007', voter: true, solo: true, fourPs: true },
      { f: 'Angelo', m: 'Torres', l: 'Bautista', sex: 'm', b: '2019-09-15', c: 'single', rel: 'Son', job: 'None', edu: 'Pre-school', fourPs: true },
    ] }],
  },
  {
    houseNo: '2776', street: 'Apog St.', since: '2001',
    families: [{ name: 'Tan family', members: [
      { f: 'Wilson', m: 'Go', l: 'Tan', sex: 'm', b: '1970-02-14', c: 'married', rel: 'Head', job: 'Hardware store owner', edu: 'College graduate', tel: '09221230008', voter: true },
      { f: 'Grace', m: 'Diaz', l: 'Tan', sex: 'f', b: '1972-07-19', c: 'married', rel: 'Spouse', job: 'Hardware store owner', edu: 'College graduate', voter: true },
      { f: 'Andrea', m: 'Diaz', l: 'Tan', sex: 'f', b: '2004-04-04', c: 'single', rel: 'Daughter', job: 'Fresh graduate', edu: 'College graduate', tel: '09221230009', voter: true },
    ] }],
  },
  {
    houseNo: '665', street: 'Gen. Lukban St.', since: '2016',
    families: [{ name: 'Flores family', members: [
      { f: 'Jose', m: 'Gomez', l: 'Flores', sex: 'm', b: '2000-01-30', c: 'single', rel: 'Head', job: 'Tricycle owner-driver', edu: 'High school graduate', tel: '09252561566', voter: true },
      { f: 'Camille', m: 'Torres', l: 'Flores', sex: 'f', b: '1998-05-05', c: 'single', rel: 'Sibling', job: 'Online seller', edu: 'College graduate', tel: '09252561567', voter: true },
    ] }],
  },
  {
    houseNo: '2815', street: 'Juan Luna St.', since: '2010',
    families: [
      { name: 'Panganiban family', members: [
        { f: 'Teresa', m: 'Aquino', l: 'Panganiban', sex: 'f', b: '1968-08-22', c: 'widowed', rel: 'Head', job: 'Caregiver', edu: 'High school graduate', tel: '09261230010', voter: true },
        { f: 'John Paul', m: 'Diaz', l: 'Panganiban', sex: 'm', b: '2001-11-11', c: 'single', rel: 'Son', job: 'Bank teller', edu: 'College graduate', tel: '09261230011', voter: true },
      ] },
      { name: 'Domingo family', members: [
        { f: 'Ernesto', m: 'Valdez', l: 'Domingo', sex: 'm', b: '1979-03-03', c: 'married', rel: 'Head', job: 'Jeepney driver', edu: 'High school graduate', voter: true },
        { f: 'Jennifer', m: 'Lopez', l: 'Domingo', sex: 'f', b: '1993-04-24', c: 'married', rel: 'Spouse', job: 'Homemaker', edu: 'College level', tel: '09692042062', voter: true },
        { f: 'Princess', m: 'Lopez', l: 'Domingo', sex: 'f', b: '2024-01-15', c: 'single', rel: 'Daughter', job: 'None', edu: 'None' },
      ] },
    ],
  },
  {
    houseNo: '44', street: 'R. Fernandez St.', since: '2008',
    families: [{ name: 'Lim family', members: [
      { f: 'Nestor', m: 'Salazar', l: 'Lim', sex: 'm', b: '1975-06-16', c: 'married', rel: 'Head', job: 'Mechanic', edu: 'Vocational', tel: '09271230012', voter: true },
      { f: 'Divina', m: 'Cruz', l: 'Lim', sex: 'f', b: '1977-10-09', c: 'married', rel: 'Spouse', job: 'Homemaker', edu: 'High school graduate', voter: true },
    ] }],
  },
  {
    houseNo: '2750', street: 'Rosalina St.', since: '2014',
    families: [{ name: 'Valdez family', members: [
      { f: 'Arnel', m: 'Pascual', l: 'Valdez', sex: 'm', b: '1978-12-01', c: 'married', rel: 'Head', job: 'Security guard', edu: 'High school graduate', voter: true },
      { f: 'Maria', m: 'Ocampo', l: 'Valdez', sex: 'f', b: '1980-09-09', c: 'married', rel: 'Spouse', job: 'Sari-sari store owner', edu: 'High school graduate', tel: '09281230013', voter: true },
    ] }],
  },
  {
    houseNo: '2759', street: 'Victoria St.', since: '1998',
    families: [{ name: 'Castillo family', members: [
      { f: 'Gloria', m: 'Manalo', l: 'Castillo', sex: 'f', b: '1956-06-06', c: 'widowed', rel: 'Head', job: 'None', edu: 'Elementary graduate', voter: true, osca: '181-0047' },
      { f: 'Jasmine', m: 'Manalo', l: 'Castillo', sex: 'f', b: '1990-02-02', c: 'single', rel: 'Daughter', job: 'Teacher', edu: 'College graduate', tel: '09291230014', voter: true },
    ] }],
  },
  {
    houseNo: '70', street: 'Asa St.', since: '2020',
    families: [{ name: 'Mercado family', members: [
      { f: 'Carlo', m: 'Javier', l: 'Mercado', sex: 'm', b: '1987-08-17', c: 'married', rel: 'Head', job: 'Welder', edu: 'Vocational', tel: '09301230015', voter: true },
      { f: 'Patricia', m: 'Soriano', l: 'Mercado', sex: 'f', b: '1989-01-21', c: 'married', rel: 'Spouse', job: 'Saleslady', edu: 'High school graduate', voter: true },
    ] }],
  },
]

function ageOn(birth: string, on = MOCK_TODAY) {
  const b = new Date(birth)
  let a = on.getFullYear() - b.getFullYear()
  if (on.getMonth() < b.getMonth() || (on.getMonth() === b.getMonth() && on.getDate() < b.getDate())) a--
  return a
}

function build() {
  const residents: Resident[] = []
  const households: Household[] = []
  let r = 0
  HOUSEHOLDS.forEach((h, hi) => {
    const householdId = `hh-${String(hi + 1).padStart(3, '0')}`
    const families: Family[] = h.families.map((fam, fi) => {
      const familyId = `${householdId}-f${fi + 1}`
      const ids = fam.members.map((p) => {
        r++
        const id = `res-${String(r).padStart(3, '0')}`
        residents.push({
          id,
          residentNo: `181-2026-${String(r).padStart(4, '0')}`,
          firstName: p.f,
          middleName: p.m,
          lastName: p.l,
          suffix: p.sx,
          sex: p.sex === 'm' ? 'male' : 'female',
          birthDate: p.b,
          civilStatus: p.c,
          houseNo: h.houseNo,
          street: h.street,
          householdId,
          familyId,
          relationship: p.rel,
          contactNo: p.tel,
          residentSince: h.since,
          voter: !!p.voter,
          employment: p.job ?? 'Not recorded',
          education: p.edu ?? 'Not recorded',
          oscaId: p.osca,
          sectors: {
            seniorCitizen: ageOn(p.b) >= 60,
            pwd: !!p.pwd,
            soloParent: !!p.solo,
            fourPs: !!p.fourPs,
            programBeneficiary: !!p.prog,
          },
          registrationStatus: id === 'res-002' ? 'verified' : ageOn(p.b) >= 18 && r % 3 === 0 ? 'verified' : 'not_registered',
          createdAt: isoDaysAgo(400 + r * 3),
          updatedAt: isoDaysAgo(10 + r),
        })
        return id
      })
      return { id: familyId, name: fam.name, headResidentId: ids[0], memberIds: ids }
    })
    households.push({
      id: householdId,
      householdNo: `HH-181-${String(hi + 1).padStart(3, '0')}`,
      houseNo: h.houseNo,
      street: h.street,
      address: `${h.houseNo} ${h.street}, Gagalangin, Tondo, Manila`,
      families,
    })
  })
  return { residents, households }
}

const built = build()
export const mockResidents: Resident[] = built.residents
export const mockHouseholds: Household[] = built.households

/** The sample resident linked to the demo resident account (Maria Clara Dizon). */
export const DEMO_RESIDENT_ID = 'res-002'

export const residentById = (id: string) => mockResidents.find((r) => r.id === id)
const R = (first: string, last: string) => mockResidents.find((r) => r.firstName === first && r.lastName === last)!.id

export const SAMPLE_IDS = {
  mariaDizon: DEMO_RESIDENT_ID,
  lourdesSantos: R('Lourdes', 'Santos'),
  danielGarcia: R('Daniel', 'Garcia'),
  rogelioNavarro: R('Rogelio', 'Navarro'),
  rafaelNavarro: R('Rafael', 'Navarro'),
  elenaSalazar: R('Elena', 'Salazar'),
  angelicaBautista: R('Angelica', 'Bautista'),
  andreaTan: R('Andrea', 'Tan'),
  joseFlores: R('Jose', 'Flores'),
  camilleFlores: R('Camille', 'Flores'),
  johnPaulPanganiban: R('John Paul', 'Panganiban'),
  jenniferDomingo: R('Jennifer', 'Domingo'),
  nestorLim: R('Nestor', 'Lim'),
  mariaValdez: R('Maria', 'Valdez'),
  jasmineCastillo: R('Jasmine', 'Castillo'),
  carloMercado: R('Carlo', 'Mercado'),
  gloriaCastillo: R('Gloria', 'Castillo'),
}

export const mockRegistrations: ResidentRegistration[] = [
  {
    id: 'reg-001', referenceNo: 'REG-2026-0148', submittedAt: isoDaysAgo(0, 8),
    applicant: { firstName: 'Camille', lastName: 'Flores', birthDate: '1998-05-05', address: '665 Gen. Lukban St.' },
    matchedResidentId: SAMPLE_IDS.camilleFlores,
    verification: { ocr: 'passed', masterListMatch: 'inconclusive', faceMatch: 'passed', liveness: 'passed' },
    status: 'manual_review', privacyNoticeVersion: 'v1.0-draft',
  },
  {
    id: 'reg-002', referenceNo: 'REG-2026-0147', submittedAt: isoDaysAgo(1, 15),
    applicant: { firstName: 'Nestor', lastName: 'Lim', birthDate: '1975-06-16', address: '44 R. Fernandez St.' },
    matchedResidentId: SAMPLE_IDS.nestorLim,
    verification: { ocr: 'inconclusive', masterListMatch: 'passed', faceMatch: 'passed', liveness: 'passed' },
    status: 'manual_review', privacyNoticeVersion: 'v1.0-draft',
  },
  {
    id: 'reg-003', referenceNo: 'REG-2026-0146', submittedAt: isoDaysAgo(1, 10),
    applicant: { firstName: 'Elena', lastName: 'Salazar', birthDate: '2001-10-12', address: '631 Benita St.' },
    matchedResidentId: SAMPLE_IDS.elenaSalazar,
    verification: { ocr: 'passed', masterListMatch: 'passed', faceMatch: 'failed', liveness: 'passed' },
    status: 'manual_review', privacyNoticeVersion: 'v1.0-draft',
  },
  {
    id: 'reg-004', referenceNo: 'REG-2026-0145', submittedAt: isoDaysAgo(2, 11),
    applicant: { firstName: 'Mark Anthony', lastName: 'Rivera', birthDate: '1996-02-29', address: '12 Apog St.' },
    verification: { ocr: 'passed', masterListMatch: 'failed', faceMatch: 'passed', liveness: 'inconclusive' },
    status: 'manual_review', privacyNoticeVersion: 'v1.0-draft',
  },
  {
    id: 'reg-005', referenceNo: 'REG-2026-0144', submittedAt: isoDaysAgo(3, 9),
    applicant: { firstName: 'Andrea', lastName: 'Tan', birthDate: '2004-04-04', address: '2776 Apog St.' },
    matchedResidentId: SAMPLE_IDS.andreaTan,
    verification: { ocr: 'passed', masterListMatch: 'passed', faceMatch: 'passed', liveness: 'passed' },
    status: 'auto_approved', privacyNoticeVersion: 'v1.0-draft',
  },
]

export const mockChangeRequests: ResidentChangeRequest[] = [
  {
    id: 'chg-001', residentId: SAMPLE_IDS.johnPaulPanganiban, submittedAt: isoDaysAgo(0, 10), field: 'Civil status',
    originalValue: 'Single', requestedValue: 'Married', reason: 'Married last September; marriage certificate attached.', status: 'pending',
  },
  {
    id: 'chg-002', residentId: SAMPLE_IDS.danielGarcia, submittedAt: isoDaysAgo(1, 13), field: 'Contact number',
    originalValue: '09191230003', requestedValue: '09275554411', reason: 'Changed SIM.', status: 'pending',
  },
  {
    id: 'chg-003', residentId: SAMPLE_IDS.mariaValdez, submittedAt: isoDaysAgo(2, 16), field: 'Employment',
    originalValue: 'Sari-sari store owner', requestedValue: 'Sari-sari store owner and online seller', reason: 'Started selling online.', status: 'pending',
  },
  {
    id: 'chg-004', residentId: SAMPLE_IDS.andreaTan, submittedAt: isoDaysAgo(6, 9), field: 'Educational attainment',
    originalValue: 'College level', requestedValue: 'College graduate', reason: 'Graduated in June.', status: 'approved',
    decidedBy: 'usr-sec', decidedAt: isoDaysAgo(5, 10),
  },
]
