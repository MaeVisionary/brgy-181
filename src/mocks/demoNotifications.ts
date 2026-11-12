import type { Permission } from '@/types/auth'
import type { NotificationCategory } from '@/types/activity'
/** Relative to the real date, so preview items fall under Today / Yesterday / Earlier. */
const isoDaysAgo = (days: number, hour: number) => {
  const d = new Date(Date.now() - days * 86_400_000)
  d.setHours(hour, 0, 0, 0)
  return (d.getTime() > Date.now() ? new Date(Date.now() - 5 * 60_000) : d).toISOString()
}

/**
 * DEMO NOTIFICATIONS (preview only). Shown only when an account has no real
 * notifications, only to accounts holding the listed permission, and always
 * labelled "Demo". They refer to the sample records already in the prototype.
 * Delete this file (and its import in notificationService) to remove them.
 */
export interface DemoNotification {
  id: string
  permission: Permission
  category: NotificationCategory
  title: string
  body: string
  createdAt: string
  priority?: 'high'
  reference?: string
  subject?: string
  /** Reference number of a sample document request; resolved to its page at runtime. */
  documentRef?: string
  link?: string
}

export const DEMO_NOTIFICATIONS: DemoNotification[] = [
  // Barangay Secretary
  { id: 'demo-01', subject: 'Camille Flores', permission: 'residents.verify', category: 'registration', title: 'New resident registration', body: 'REG-2026-0148 · Camille Flores submitted an online registration.', createdAt: isoDaysAgo(0, 9), link: '/residents/registrations' },
  { id: 'demo-02', subject: 'John Paul Diaz Panganiban', permission: 'residents.approve', category: 'resident_change', title: 'Record update needs verification', body: 'John Paul Diaz Panganiban · civil status change with attached proof.', createdAt: isoDaysAgo(0, 8), link: '/residents/change-requests' },
  { id: 'demo-03', subject: 'Maria Clara Dizon', permission: 'documents.process', category: 'document', title: 'New Barangay Clearance application', body: 'CLR-2026-0306 · Maria Clara Dizon.', createdAt: isoDaysAgo(1, 15), documentRef: 'CLR-2026-0306' },
  { id: 'demo-04', subject: 'John Paul Panganiban', permission: 'documents.process', category: 'approval', title: 'Approved by the Barangay Chairman', body: 'CLR-2026-0314 · ready for printing.', createdAt: isoDaysAgo(1, 11), documentRef: 'CLR-2026-0314' },
  { id: 'demo-05', subject: 'Maria Clara Dizon', permission: 'documents.process', category: 'document', title: 'Returned for revision', body: 'IND-2026-0304 · the requester was asked for a clearer valid ID.', createdAt: isoDaysAgo(2, 10), documentRef: 'IND-2026-0304' },
  { id: 'demo-06', subject: 'Camille Flores', permission: 'cases.manage', category: 'complaint', title: 'New complaint submitted', body: 'Barangay Summon request from Camille Flores.', createdAt: isoDaysAgo(2, 9), link: '/documents' },
  { id: 'demo-07', subject: 'Jennifer Domingo', permission: 'complaints.update', category: 'complaint', title: 'Incident report for review', body: 'INC-2026-0326 · Jennifer Domingo.', createdAt: isoDaysAgo(3, 14), documentRef: 'INC-2026-0326' },
  // Barangay Chairman
  { id: 'demo-08', subject: 'Rogelio Navarro', permission: 'documents.approve', category: 'approval', title: 'Forwarded for your approval', body: 'IND-2026-0310 · Certificate of Indigency for Rogelio Navarro.', createdAt: isoDaysAgo(0, 10), documentRef: 'IND-2026-0310' },
  { id: 'demo-09', subject: 'Daniel Garcia', permission: 'documents.approve', category: 'approval', title: 'Forwarded for your approval', body: 'CRT-2026-0312 · Barangay Certificate for Daniel Garcia.', createdAt: isoDaysAgo(1, 9), documentRef: 'CRT-2026-0312' },
  { id: 'demo-10', subject: 'Flores vs. Lim', permission: 'cases.decide', category: 'complaint', title: 'Complaint for assessment', body: 'KP-2026-034 · Flores vs. Lim (unpaid loan).', createdAt: isoDaysAgo(1, 16), link: '/cases/case-034' },
  // Barangay Treasurer
  { id: 'demo-11', subject: 'Maria Valdez', permission: 'documents.payment', category: 'payment', title: 'Fee to collect', body: 'BUS-2026-0320 · Barangay Business Clearance for Maria Valdez.', createdAt: isoDaysAgo(0, 11), documentRef: 'BUS-2026-0320' },
  // Property Custodian
  { id: 'demo-12', subject: 'Maria Clara Dizon', permission: 'borrowing.approve', category: 'borrowing', title: 'Borrowing request submitted', body: 'BRW-2026-041 · 20 monobloc chairs, 2 folding tables.', createdAt: isoDaysAgo(0, 9), link: '/borrowing/brw-041' },
  { id: 'demo-13', subject: 'Nestor Lim', permission: 'borrowing.release', category: 'overdue', title: 'Equipment return overdue', body: 'BRW-2026-033 · Nestor Lim, past the grace period.', createdAt: isoDaysAgo(0, 7), priority: 'high', link: '/borrowing/brw-033' },
  { id: 'demo-14', subject: 'Wilson Tan', permission: 'borrowing.release', category: 'borrowing', title: 'Equipment returned', body: 'BRW-2026-029 · Wilson Tan, returned in good condition.', createdAt: isoDaysAgo(4, 15), link: '/borrowing/brw-029' },
  // Kagawad and other report viewers
  { id: 'demo-15', permission: 'reports.view', category: 'system', title: 'Monthly reports available', body: 'Population and service reports for this month.', createdAt: isoDaysAgo(2, 8), link: '/reports' },
  // Residents
  { id: 'demo-16', permission: 'self.documents', category: 'approval', title: 'Ready for pickup', body: 'RES-2026-0302 · Certificate of Residency. Claim it at the Barangay Hall.', createdAt: isoDaysAgo(0, 10), link: '/my/documents' },
  { id: 'demo-17', permission: 'self.documents', category: 'document', title: 'More information needed', body: 'IND-2026-0304 · please send a clearer photo of your valid ID.', createdAt: isoDaysAgo(1, 13), link: '/my/documents' },
  { id: 'demo-18', permission: 'self.borrowing', category: 'borrowing', title: 'Borrowing request received', body: 'BRW-2026-041 · the Property Custodian will review it.', createdAt: isoDaysAgo(2, 9), link: '/my/borrowing' },
]
