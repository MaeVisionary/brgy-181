import type { Borrowing, Equipment } from '@/types/equipment'
import { SAMPLE_IDS, residentById } from './residents'
import { isoDaysAgo } from './random'

/**
 * SAMPLE equipment and borrowing records. Categories come from the study
 * (chairs, tables, ladders, nebulizers); quantities are sample values until the
 * Property Custodian's actual inventory is encoded.
 */

export const mockEquipment: Equipment[] = [
  { id: 'eq-001', refNo: 'EQ-181-001', name: 'Monobloc chairs', category: 'Chairs', description: 'Plastic chairs for community events', totalQty: 100, damagedQty: 4, missingQty: 0, history: [] },
  { id: 'eq-002', refNo: 'EQ-181-002', name: 'Folding tables', category: 'Tables', description: '6-ft folding tables', totalQty: 12, damagedQty: 1, missingQty: 0, history: [] },
  { id: 'eq-003', refNo: 'EQ-181-003', name: 'Aluminum ladder', category: 'Ladders', description: '8-ft A-type ladder', totalQty: 2, damagedQty: 0, missingQty: 0, history: [] },
  { id: 'eq-004', refNo: 'EQ-181-004', name: 'Nebulizer', category: 'Nebulizers', description: 'Portable nebulizer with mask set', totalQty: 3, damagedQty: 0, missingQty: 0, history: [] },
]

const who = (id: string) => {
  const r = residentById(id)!
  return { residentId: id, borrowerName: `${r.firstName} ${r.lastName}`, address: `${r.houseNo} ${r.street}, Gagalangin, Tondo, Manila` }
}

const plus = (iso: string, days: number) => {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

const released = (daysAgo: number) => {
  const r = isoDaysAgo(daysAgo, 10)
  return { releasedAt: r, dueAt: plus(r, 15), graceEndsAt: plus(r, 18) }
}

export const mockBorrowings: Borrowing[] = [
  {
    id: 'brw-041', refNo: 'BRW-2026-041', ...who(SAMPLE_IDS.mariaDizon),
    items: [{ equipmentId: 'eq-001', qty: 20 }, { equipmentId: 'eq-002', qty: 2 }],
    dateOfUse: '2026-11-15', statedReturnDate: '2026-11-16', requestedAt: isoDaysAgo(0, 9), status: 'pending',
    history: [{ at: isoDaysAgo(0, 9), byUserId: 'usr-res', byRole: 'resident', action: 'Request submitted online' }],
  },
  {
    id: 'brw-040', refNo: 'BRW-2026-040', ...who(SAMPLE_IDS.danielGarcia),
    items: [{ equipmentId: 'eq-003', qty: 1 }],
    dateOfUse: '2026-11-07', statedReturnDate: '2026-11-08', requestedAt: isoDaysAgo(2, 15), status: 'approved',
    history: [
      { at: isoDaysAgo(2, 15), byUserId: 'usr-cust', byRole: 'property_custodian', action: 'Encoded at the Barangay Hall' },
      { at: isoDaysAgo(1, 9), byUserId: 'usr-cust', byRole: 'property_custodian', action: 'Approved: equipment available' },
    ],
  },
  {
    id: 'brw-037', refNo: 'BRW-2026-037', ...who(SAMPLE_IDS.jasmineCastillo),
    items: [{ equipmentId: 'eq-001', qty: 30 }],
    dateOfUse: '2026-10-26', statedReturnDate: '2026-10-27', requestedAt: isoDaysAgo(14, 10), status: 'released', ...released(11),
    conditionOnRelease: 'Good',
    history: [
      { at: isoDaysAgo(14, 10), byUserId: 'usr-res', byRole: 'resident', action: 'Request submitted online' },
      { at: isoDaysAgo(13, 9), byUserId: 'usr-cust', byRole: 'property_custodian', action: 'Approved: equipment available' },
      { at: isoDaysAgo(11, 10), byUserId: 'usr-cust', byRole: 'property_custodian', action: 'Released', remarks: 'Condition: good' },
    ],
  },
  {
    id: 'brw-033', refNo: 'BRW-2026-033', ...who(SAMPLE_IDS.nestorLim),
    items: [{ equipmentId: 'eq-004', qty: 1 }],
    dateOfUse: '2026-10-10', requestedAt: isoDaysAgo(27, 8), status: 'released', ...released(26),
    conditionOnRelease: 'Good, complete with mask set',
    history: [
      { at: isoDaysAgo(27, 8), byUserId: 'usr-cust', byRole: 'property_custodian', action: 'Encoded at the Barangay Hall' },
      { at: isoDaysAgo(27, 9), byUserId: 'usr-cust', byRole: 'property_custodian', action: 'Approved: equipment available' },
      { at: isoDaysAgo(26, 10), byUserId: 'usr-cust', byRole: 'property_custodian', action: 'Released', remarks: 'Condition: good, complete with mask set' },
    ],
  },
  {
    id: 'brw-035', refNo: 'BRW-2026-035', residentId: undefined, borrowerName: 'Arnel Valdez', address: '2750 Rosalina St., Gagalangin, Tondo, Manila',
    items: [{ equipmentId: 'eq-002', qty: 2 }],
    dateOfUse: '2026-10-20', requestedAt: isoDaysAgo(18, 9), status: 'released', ...released(16),
    conditionOnRelease: 'Good',
    history: [
      { at: isoDaysAgo(18, 9), byUserId: 'usr-cust', byRole: 'property_custodian', action: 'Encoded at the Barangay Hall' },
      { at: isoDaysAgo(17, 9), byUserId: 'usr-cust', byRole: 'property_custodian', action: 'Approved: equipment available' },
      { at: isoDaysAgo(16, 10), byUserId: 'usr-cust', byRole: 'property_custodian', action: 'Released' },
    ],
  },
  {
    id: 'brw-029', refNo: 'BRW-2026-029', residentId: undefined, borrowerName: 'Wilson Tan', address: '2776 Apog St., Gagalangin, Tondo, Manila',
    items: [{ equipmentId: 'eq-001', qty: 10, returnedGood: 9, returnedDamaged: 1, missing: 0 }],
    dateOfUse: '2026-10-01', requestedAt: isoDaysAgo(40, 9), status: 'returned', ...released(36), returnedAt: isoDaysAgo(33, 16),
    conditionOnRelease: 'Good', returnNotes: 'One chair with a cracked leg. Handle per barangay policy.',
    history: [
      { at: isoDaysAgo(40, 9), byUserId: 'usr-res', byRole: 'resident', action: 'Request submitted online' },
      { at: isoDaysAgo(39, 9), byUserId: 'usr-cust', byRole: 'property_custodian', action: 'Approved: equipment available' },
      { at: isoDaysAgo(36, 10), byUserId: 'usr-cust', byRole: 'property_custodian', action: 'Released' },
      { at: isoDaysAgo(33, 16), byUserId: 'usr-cust', byRole: 'property_custodian', action: 'Returned and inspected', remarks: '9 good, 1 damaged' },
    ],
  },
]
