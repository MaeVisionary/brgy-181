import type { AppNotification } from '@/types/activity'
import { isoDaysAgo } from './random'

/** SAMPLE notifications. In the real system these come from backend events. */
export const mockNotifications: AppNotification[] = [
  {
    id: 'ntf-001', userId: 'usr-sec', category: 'registration', title: 'Registration needs manual review',
    body: 'REG-2026-0148: master-list match was inconclusive.', createdAt: isoDaysAgo(0, 8), read: false, link: '/residents/registrations',
  },
  {
    id: 'ntf-002', userId: 'usr-sec', category: 'resident_change', title: 'Change request submitted',
    body: 'A resident requested a civil status update.', createdAt: isoDaysAgo(0, 10), read: false, link: '/residents/change-requests',
  },
  {
    id: 'ntf-003', userId: 'usr-chair', category: 'complaint', title: 'Case for assessment: KP-2026-034',
    body: 'Flores vs. Lim (unpaid loan). A summons was requested.', createdAt: isoDaysAgo(1, 10), read: false, link: '/cases/case-034',
  },
  {
    id: 'ntf-004', userId: 'usr-chair', category: 'document', title: 'Documents awaiting your approval',
    body: 'Forwarded by Ana Manila Salvador.', createdAt: isoDaysAgo(0, 9), read: false, link: '/documents/approvals',
  },
  {
    id: 'ntf-005', userId: 'usr-cust', category: 'borrowing', title: 'Overdue: BRW-2026-033',
    body: 'Nebulizer borrowed by Nestor Lim is past the 3-day grace period.', createdAt: isoDaysAgo(0, 7), read: false, link: '/borrowing/brw-033',
  },
  {
    id: 'ntf-006', userId: 'usr-res', category: 'document', title: 'RES-2026: ready for pickup',
    body: 'Your Certificate of Residency is ready at the Barangay 181 Hall.', createdAt: isoDaysAgo(4, 16), read: false, link: '/my/documents',
  },
  {
    id: 'ntf-007', userId: 'usr-res', category: 'registration', title: 'Your account is verified',
    body: 'You can now request barangay documents online.', createdAt: isoDaysAgo(20, 10), read: true,
  },
]
