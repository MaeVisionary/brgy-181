import type {
  CivilStatus,
  Household,
  Resident,
  ResidentChangeRequest,
  ResidentRegistration,
} from '@/types/resident'
import { MOCK_TODAY, createRng, isoDaysAgo } from './random'

/**
 * MOCK RESIDENT DATA. Fictional people, generated deterministically.
 * Purok names follow the Figma reference and must be confirmed with Barangay 181.
 */

export const PUROKS = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5', 'Purok 6'] as const

const STREETS: Record<string, string[]> = {
  'Purok 1': ['Mabini St.', 'Kalaw Ave.'],
  'Purok 2': ['Rizal St.', 'Del Pilar St.'],
  'Purok 3': ['Luna St.', 'Bonifacio St.'],
  'Purok 4': ['Jacinto St.', 'Aguinaldo St.'],
  'Purok 5': ['Burgos St.', 'Gomez St.'],
  'Purok 6': ['Zamora St.', 'Silang St.'],
}

const SURNAMES = [
  'Dela Cruz', 'Santos', 'Reyes', 'Garcia', 'Mendoza', 'Bautista', 'Villanueva', 'Ramos', 'Aquino', 'Castillo',
  'Navarro', 'Torres', 'Flores', 'Gonzales', 'Rivera', 'Domingo', 'Mercado', 'Pascual', 'Salazar', 'Fernandez',
  'Soriano', 'Valdez', 'Lim', 'Tan', 'Cruz', 'Manalo', 'Ocampo', 'Javier', 'Dizon', 'Panganiban',
]
const MALE = [
  'Jose', 'Juan', 'Mark', 'John Paul', 'Christian', 'Rafael', 'Miguel', 'Antonio', 'Carlo', 'Paolo',
  'Daniel', 'Joshua', 'Ramon', 'Eduardo', 'Ernesto', 'Rogelio', 'Nestor', 'Arnel', 'Kevin', 'Angelo',
]
const FEMALE = [
  'Maria', 'Ana', 'Kristine', 'Jasmine', 'Angelica', 'Patricia', 'Liza', 'Rosario', 'Teresita', 'Cristina',
  'Jennifer', 'Michelle', 'Andrea', 'Camille', 'Nicole', 'Lourdes', 'Gloria', 'Elena', 'Divina', 'Princess',
]
const MIDDLE = ['Santos', 'Reyes', 'Cruz', 'Lopez', 'Garcia', 'Ramos', 'Torres', 'Gomez', 'Diaz', 'Perez']

function birthDateForAge(age: number, rng: ReturnType<typeof createRng>): string {
  const d = new Date(MOCK_TODAY)
  d.setFullYear(d.getFullYear() - age)
  d.setMonth(rng.int(0, 11), rng.int(1, 28))
  if (d > MOCK_TODAY) d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

function generate() {
  const rng = createRng(181)
  const residents: Resident[] = []
  const households: Household[] = []
  let residentSeq = 1

  const HOUSEHOLD_COUNT = 312
  for (let h = 0; h < HOUSEHOLD_COUNT; h++) {
    const purok = PUROKS[h % PUROKS.length]
    const street = rng.pick(STREETS[purok])
    const houseNo = String(rng.int(1, 240))
    const surname = rng.pick(SURNAMES)
    const isFourPs = rng.chance(0.11)
    const size = rng.int(1, 7)
    const householdId = `hh-${String(h + 1).padStart(4, '0')}`
    const memberIds: string[] = []

    for (let m = 0; m < size; m++) {
      const isHead = m === 0
      const isSpouse = m === 1 && size > 2
      const age = isHead
        ? rng.int(24, 82)
        : isSpouse
          ? rng.int(22, 78)
          : m === size - 1 && rng.chance(0.15)
            ? rng.int(60, 88)
            : rng.int(0, 34)
      const sex = isSpouse ? 'female' : rng.chance(0.5) ? 'male' : 'female'
      const civilStatus: CivilStatus =
        age < 18 ? 'single' : isHead || isSpouse ? rng.pick(['married', 'married', 'live_in', 'widowed'] as const) : rng.pick(['single', 'single', 'married'] as const)
      const id = `res-${String(residentSeq).padStart(5, '0')}`
      const registered = age >= 18 && rng.chance(0.42)

      residents.push({
        id,
        residentNo: `181-${String(residentSeq).padStart(5, '0')}`,
        firstName: rng.pick(sex === 'male' ? MALE : FEMALE),
        middleName: rng.pick(MIDDLE),
        lastName: surname,
        sex,
        birthDate: birthDateForAge(age, rng),
        civilStatus,
        purok,
        street,
        houseNo,
        householdId,
        contactNo: age >= 18 ? `09${rng.int(10, 99)}${String(rng.int(0, 9999999)).padStart(7, '0')}` : undefined,
        sectors: {
          seniorCitizen: age >= 60,
          pwd: rng.chance(0.035),
          soloParent: age >= 18 && (isHead && size > 1 ? rng.chance(0.09) : false),
          fourPs: isFourPs,
          programBeneficiary: rng.chance(0.07),
        },
        registrationStatus: registered ? 'verified' : 'not_registered',
        createdAt: isoDaysAgo(rng.int(200, 900)),
        updatedAt: isoDaysAgo(rng.int(1, 199)),
      })
      memberIds.push(id)
      residentSeq++
    }

    households.push({
      id: householdId,
      householdNo: `HH-181-${String(h + 1).padStart(4, '0')}`,
      purok,
      address: `${houseNo} ${street}, ${purok}`,
      headResidentId: memberIds[0],
      memberIds,
    })
  }

  // Fixed demo resident linked to the mock resident account.
  const demo = residents[0]
  Object.assign(demo, {
    firstName: 'Maria',
    middleName: 'Santos',
    lastName: 'Reyes',
    sex: 'female',
    birthDate: '1991-03-14',
    civilStatus: 'married',
    contactNo: '09171234567',
    registrationStatus: 'verified',
  } satisfies Partial<Resident>)

  return { residents, households }
}

const generated = generate()
export const mockResidents: Resident[] = generated.residents
export const mockHouseholds: Household[] = generated.households
export const DEMO_RESIDENT_ID = mockResidents[0].id

export const mockRegistrations: ResidentRegistration[] = [
  {
    id: 'reg-001', referenceNo: 'REG-2026-0148', submittedAt: isoDaysAgo(0, 8),
    applicant: { firstName: 'Kristine', lastName: 'Navarro', birthDate: '1998-07-02', address: '45 Rizal St., Purok 2' },
    verification: { ocr: 'passed', masterListMatch: 'inconclusive', faceMatch: 'passed', liveness: 'passed' },
    status: 'manual_review', privacyNoticeVersion: 'v1.0-draft',
  },
  {
    id: 'reg-002', referenceNo: 'REG-2026-0147', submittedAt: isoDaysAgo(1, 15),
    applicant: { firstName: 'Ramon', lastName: 'Pascual', birthDate: '1975-11-20', address: '12 Luna St., Purok 3' },
    verification: { ocr: 'inconclusive', masterListMatch: 'passed', faceMatch: 'passed', liveness: 'passed' },
    status: 'manual_review', privacyNoticeVersion: 'v1.0-draft',
  },
  {
    id: 'reg-003', referenceNo: 'REG-2026-0146', submittedAt: isoDaysAgo(1, 10),
    applicant: { firstName: 'Angelica', lastName: 'Soriano', birthDate: '2001-01-09', address: '88 Burgos St., Purok 5' },
    verification: { ocr: 'passed', masterListMatch: 'passed', faceMatch: 'failed', liveness: 'passed' },
    status: 'manual_review', privacyNoticeVersion: 'v1.0-draft',
  },
  {
    id: 'reg-004', referenceNo: 'REG-2026-0145', submittedAt: isoDaysAgo(2, 11),
    applicant: { firstName: 'Paolo', lastName: 'Domingo', birthDate: '1989-05-30', address: '7 Zamora St., Purok 6' },
    verification: { ocr: 'passed', masterListMatch: 'failed', faceMatch: 'passed', liveness: 'inconclusive' },
    status: 'manual_review', privacyNoticeVersion: 'v1.0-draft',
  },
  {
    id: 'reg-005', referenceNo: 'REG-2026-0144', submittedAt: isoDaysAgo(3, 9),
    applicant: { firstName: 'Lourdes', lastName: 'Valdez', birthDate: '1960-08-16', address: '30 Mabini St., Purok 1' },
    verification: { ocr: 'passed', masterListMatch: 'passed', faceMatch: 'passed', liveness: 'passed' },
    status: 'auto_approved', privacyNoticeVersion: 'v1.0-draft',
  },
  {
    id: 'reg-006', referenceNo: 'REG-2026-0143', submittedAt: isoDaysAgo(4, 14),
    applicant: { firstName: 'Christian', lastName: 'Ocampo', birthDate: '1994-12-03', address: '19 Jacinto St., Purok 4' },
    verification: { ocr: 'passed', masterListMatch: 'passed', faceMatch: 'passed', liveness: 'passed' },
    status: 'auto_approved', privacyNoticeVersion: 'v1.0-draft',
  },
]

export const mockChangeRequests: ResidentChangeRequest[] = [
  {
    id: 'chg-001', residentId: mockResidents[14].id, submittedAt: isoDaysAgo(0, 10), field: 'Civil status',
    originalValue: 'Single', requestedValue: 'Married', reason: 'Married last September; marriage certificate attached.', status: 'pending',
  },
  {
    id: 'chg-002', residentId: mockResidents[52].id, submittedAt: isoDaysAgo(1, 13), field: 'Contact number',
    originalValue: '09181112233', requestedValue: '09275554411', reason: 'Changed SIM.', status: 'pending',
  },
  {
    id: 'chg-003', residentId: mockResidents[101].id, submittedAt: isoDaysAgo(2, 16), field: 'Address',
    originalValue: '22 Rizal St., Purok 2', requestedValue: '5 Del Pilar St., Purok 2', reason: 'Moved within the barangay.', status: 'pending',
  },
  {
    id: 'chg-004', residentId: mockResidents[230].id, submittedAt: isoDaysAgo(6, 9), field: 'Middle name',
    originalValue: 'Lopez', requestedValue: 'Lopes', reason: 'Spelling on PSA birth certificate.', status: 'approved',
  },
]
