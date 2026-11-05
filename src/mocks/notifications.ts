import type { AppNotification } from '@/types/activity'
import { isoDaysAgo } from './random'

/** MOCK NOTIFICATIONS. In the real system these are created by backend events. */
export const mockNotifications: AppNotification[] = [
  {
    id: 'ntf-001', userId: 'usr-sec', category: 'registration', title: 'New registration needs review',
    body: 'REG-2026-0148 (Kristine Navarro): master-list match was inconclusive.', createdAt: isoDaysAgo(0, 8),
    read: false, link: '/residents/registrations',
  },
  {
    id: 'ntf-002', userId: 'usr-sec', category: 'resident_change', title: 'Change request submitted',
    body: 'A resident requested a civil status update.', createdAt: isoDaysAgo(0, 10), read: false,
    link: '/residents/change-requests',
  },
  {
    id: 'ntf-003', userId: 'usr-sec', category: 'registration', title: 'Registration auto-approved',
    body: 'REG-2026-0144 passed all verification checks.', createdAt: isoDaysAgo(3, 9), read: true,
  },
  {
    id: 'ntf-004', userId: 'usr-res', category: 'registration', title: 'Your account is verified',
    body: 'You can now request barangay documents online.', createdAt: isoDaysAgo(20, 10), read: true,
  },
  {
    id: 'ntf-005', userId: 'usr-admin', category: 'system', title: 'Account deactivated',
    body: 'former.staff was deactivated.', createdAt: isoDaysAgo(5, 11), read: true,
  },
]
