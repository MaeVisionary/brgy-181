import { APP_CONFIG } from '@/config/app'
import { GRANTABLE_STAFF_PERMISSIONS, ROLE_PERMISSIONS } from '@/config/permissions'
import { SAMPLE_IDS, residentById } from '@/mocks/residents'
import { mockUsers } from '@/mocks/users'
import { audit, pauseAuditSaving } from '@/services/auditService'
import { bookAppointment, bookPurposeVisit, ensureSampleVisit, listMyAppointments, staffConfirm, timeOptions } from '@/services/appointmentService'
import { addClosure } from '@/services/calendarService'
import { applyStep, assignCase, stepsFor, submitComplaint } from '@/services/caseService'
import { addIssueNote, assignIssue, listIssues, setIssueStatus, submitConcern } from '@/services/concernService'
import { actOnBorrowing, requestBorrowing } from '@/services/equipmentService'
import { mockBorrowings, mockEquipment } from '@/mocks/equipment'
import { saveUpload } from '@/services/fileStore'
import { decideId, getIdOnFile, stateOf, submitReplacementId } from '@/services/identityService'
import { manilaToday, nextDate } from '@/services/schedulingService'
import { isWorkingDay } from '@/services/serviceStandardService'
import { demoAccessRequest, rejectAccessRequest } from '@/services/userService'
import { recordRecoveryFinding, scheduleRecoveryVisit, submitRecovery } from '@/services/accountRecoveryService'
import type { Permission, User } from '@/types/auth'

/**
 * DEMO DATA. Synthetic, connected records that fill the screens every role
 * opens, created through the same services the app uses, so each record shows
 * for the person who sent it AND the person who receives it (with the
 * notifications and activity-log entries the real flow writes).
 *
 * - People are the fictional sample residents and the officials' accounts; no
 *   real personal data. Text says "(demo)" where a record could be mistaken.
 * - No real message is sent: e-mail and SMS are simulated (emailService).
 * - Fresh each session (dates relative to today), like the rest of the sample
 *   data. Records saved on this device are tracked by id and replaced on the
 *   next start, so they never pile up. Settings and passwords are not touched.
 * - Reset: Settings > Demo data (resetDemoData) clears records and reseeds.
 */

const REG_KEY = 'bmis.demo.ids'
interface Registry { appointments: string[]; borrowings: string[]; concernSubs: string[]; concernIssues: string[]; closures: string[]; accessRequests: string[] }
const empty = (): Registry => ({ appointments: [], borrowings: [], concernSubs: [], concernIssues: [], closures: [], accessRequests: [] })

const read = <T,>(k: string, f: T): T => { try { return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? f } catch { return f } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage full or blocked */ } }

type Rec = { id: string; demo?: boolean; subjectId?: string; reason?: string; details?: string; purpose?: { description?: string } }
const isDemo = (x: Rec) => !!x.demo || [x.reason, x.details, x.purpose?.description].some((t) => typeof t === 'string' && t.includes('(demo)'))

/** Removes demo records saved on this device (marked demo, or by the previous run's ids). Other records stay. */
function purge() {
  const r = read<Registry>(REG_KEY, empty())
  const gone = new Set<string>([...r.appointments, ...r.borrowings, ...r.closures, ...r.accessRequests, ...r.concernSubs, ...r.concernIssues])
  const keep = (x: Rec) => !gone.has(x.id) && !isDemo(x)
  const borrowings = read<Rec[] | null>('bmis.borrowings', null)
  if (borrowings) { for (const x of borrowings) if (!keep(x)) gone.add(x.id); write('bmis.borrowings', borrowings.filter(keep)) }
  // The equipment service already loaded them into memory: take them out there too.
  for (let i = mockBorrowings.length - 1; i >= 0; i--) if (gone.has(mockBorrowings[i].id) || isDemo(mockBorrowings[i] as Rec)) mockBorrowings.splice(i, 1)
  for (const k of ['bmis.calendar.closures', 'bmis.accessRequests', 'bmis.recoveryRequests']) { const l = read<Rec[] | null>(k, null); if (l) write(k, l.filter(keep)) }
  const apps = read<Rec[] | null>('bmis.appointments', null)
  if (apps) write('bmis.appointments', apps.filter((x) => keep(x) && !gone.has(x.subjectId ?? '')))
  const c = read<{ submissions: Rec[]; issues: Rec[] } | null>('bmis.concerns', null)
  if (c) write('bmis.concerns', { ...c, submissions: c.submissions.filter(keep), issues: c.issues.filter(keep) })
  localStorage.removeItem(REG_KEY)
}

/** Marks saved records as demo (so a later start or a reset can find them). */
function mark(reg: Registry) {
  const tag = (k: string, ids: string[]) => { if (!ids.length) return; const l = read<Rec[] | null>(k, null); if (l) write(k, l.map((x) => (ids.includes(x.id) ? { ...x, demo: true } : x))) }
  tag('bmis.appointments', reg.appointments)
  tag('bmis.calendar.closures', reg.closures)
  tag('bmis.accessRequests', reg.accessRequests)
  tag('bmis.borrowings', reg.borrowings)
  for (const b of mockBorrowings) if (reg.borrowings.includes(b.id)) (b as Rec).demo = true
  const c = read<{ submissions: Rec[]; issues: Rec[] } | null>('bmis.concerns', null)
  if (c) write('bmis.concerns', { ...c, submissions: c.submissions.map((x) => (reg.concernSubs.includes(x.id) ? { ...x, demo: true } : x)), issues: c.issues.map((x) => (reg.concernIssues.includes(x.id) ? { ...x, demo: true } : x)) })
}

/** One tab seeds at a time: another tab that is seeding right now is waited for (up to 8 seconds). */
const LOCK = 'bmis.demo.seeding'
async function takeLock(): Promise<boolean> {
  for (let i = 0; i < 40; i++) {
    const held = Number(localStorage.getItem(LOCK) ?? 0)
    if (!held || Date.now() - held > 8000) { localStorage.setItem(LOCK, String(Date.now())); return true }
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

const actor = (u: User) => ({ user: u, permissions: new Set<Permission>([...(ROLE_PERMISSIONS[u.roleId] ?? []), ...(u.extraPermissions ?? [])]) })
const u = (id: string) => mockUsers.find((x) => x.id === id)!
/** Working day `n` office days from today (0 = today when the hall is open). */
function workday(n: number) {
  let d = manilaToday()
  while (!isWorkingDay(d)) d = nextDate(d)
  for (let i = 0; i < n; i++) { d = nextDate(d); while (!isWorkingDay(d)) d = nextDate(d) }
  return d
}
const at = (date: string, time: string) => new Date(`${date}T${time}:00+08:00`).toISOString()
const daysAgo = (n: number, hh = 9) => { const d = new Date(Date.now() - n * 86_400_000); d.setUTCHours(hh - 8, 15, 0, 0); return d.toISOString() }

/** First free time on the earliest open day (today if possible) at or after `after`. */
function slot(kind: Parameters<typeof timeOptions>[0]['kind'], minutes: number, after: string, from = 0) {
  for (let i = from; i < from + 8; i++) {
    const date = workday(i)
    const t = timeOptions({ kind, durationMin: minutes, id: '' }, date).find((x) => x.time >= after)
    if (t) return { date, time: t.time }
  }
  return null
}

let started: Promise<void> | null = null
export function seedDemoData(): Promise<void> {
  if (!started) started = run()
  return started
}

async function run() {
  const cfg = APP_CONFIG as { mockLatencyMs: number }
  const latency = cfg.mockLatencyMs
  // Near-instant, but never two records in the same millisecond (ids use the clock).
  cfg.mockLatencyMs = 4
  pauseAuditSaving(true)
  const locked = await takeLock()
  if (locked) purge()
  const reg = empty()
  const step = async (name: string, fn: () => Promise<unknown>) => { try { await fn() } catch (e) { console.warn(`[demo] ${name} skipped:`, e instanceof Error ? e.message : e) } }
  const maria = u('usr-res'), daniel = u('usr-res-daniel'), lourdes = u('usr-res-lourdes')
  const sec = u('usr-sec'), chair = u('usr-chair'), cust = u('usr-cust'), kag = u('usr-kag-1'), admin = u('usr-admin')
  const me = (x: User) => { const r = residentById(x.residentId!)!; return { residentId: r.id, name: `${r.firstName} ${r.lastName}`, address: `${r.houseNo} ${r.street}, Gagalangin, Tondo, Manila`, contactNo: r.contactNo } }

  try {
    // 1. The Secretary's verification visit for the sample resident (already part of the app).
    ensureSampleVisit()

    // 2. A complaint Maria filed online: reviewed by the Secretary, mediation set by the Punong Barangay, a Kagawad assigned.
    await step('complaint', async () => {
      const r = residentById(SAMPLE_IDS.rogelioNavarro)!
      const c = await submitComplaint({
        category: 'Complaint against a person', nature: 'Loud karaoke late at night',
        details: 'Karaoke from the house beside ours goes on past midnight on weeknights. We asked politely twice. (demo)',
        incidentDate: manilaToday(), incidentPlace: `${r.street}`,
        respondents: [{ residentId: r.id, name: `${r.firstName} ${r.lastName}`, address: `${r.houseNo} ${r.street}, Gagalangin, Tondo, Manila`, contactNo: r.contactNo }],
      }, actor(maria), me(maria))
      const go = async (to: string, who: User, hearingAt: string | null = null) => {
        const s = stepsFor(c, actor(who)).find((x) => x.to === to) ?? stepsFor((await import('@/mocks/cases')).mockCases.find((x) => x.id === c.id)!, actor(who)).find((x) => x.to === to)
        if (s) await applyStep(c.id, s, '', hearingAt, actor(who))
      }
      await go('under_review', sec)
      await go('for_assessment', sec)
      await go('mediation_scheduled', chair, at(workday(3), '10:00'))
      await assignCase(c.id, [kag.id], actor(sec))
      // The assigned Kagawad opens the case record (record access is logged).
      audit(kag, `Opened assigned case ${c.caseNo}`, 'Cases', `${c.caseNo} · demo`)
    })

    // 3. Community concerns from two residents; the Secretary assigns one to a Kagawad, who adds a note.
    await step('concerns', async () => {
      const a = await submitConcern({ category: 'Streetlights and electrical', title: 'Street light out at the corner of Rosalina St.', details: 'The street light near the sari-sari store has been off for about a week. It is very dark at night. (demo)', street: 'Rosalina St.', startedOn: daysAgo(7).slice(0, 10), frequency: 'Every night' }, maria)
      const b = await submitConcern({ category: 'Drainage and flooding', title: 'Clogged drainage along Asa St.', details: 'Water stays on the road for hours after rain because the drain is blocked with garbage. (demo)', street: 'Asa St.', startedOn: daysAgo(10).slice(0, 10), frequency: 'When it rains' }, daniel)
      reg.concernSubs.push(a.submission.id, b.submission.id)
      const issues = await listIssues(sec)
      for (const i of issues) if ([a.submission.issueId, b.submission.issueId].includes(i.id)) reg.concernIssues.push(i.id)
      const c = await submitConcern({ category: 'Stray animals', title: 'Stray dogs near the day care center', details: 'A group of stray dogs gathers by the day care gate every morning; parents are worried for the children. (demo)', street: 'Benita St.', startedOn: daysAgo(14).slice(0, 10), frequency: 'Every morning' }, lourdes)
      reg.concernSubs.push(c.submission.id)
      const third = (await listIssues(sec)).find((i) => i.id === c.submission.issueId)
      if (third) {
        reg.concernIssues.push(third.id)
        await setIssueStatus(third.id, 'in_progress', sec)
        await setIssueStatus(third.id, 'resolved', sec, { description: 'The city veterinary office collected the stray dogs and will check the area again next week. (demo)', actionTaken: 'Coordinated with the Manila veterinary office; barangay tanod posted a reminder for pet owners. (demo)' })
      }
      const first = issues.find((i) => i.id === b.submission.issueId)
      if (first) {
        await assignIssue(first.id, kag.id, workday(5), sec)
        await addIssueNote(first.id, 'Assigned to Kagawad Angelito Dela Cruz. Site checked with the barangay tanod; coordinating with the city engineering office for declogging. (demo)', sec)
      }
    })

    // 4. Visits with a purpose, today when the hall is open: one for the Secretary, one confirmed by the Punong Barangay.
    await step('visits', async () => {
      const s1 = slot('community_concern', 20, '10:00')
      if (s1) {
        const a = await bookPurposeVisit({ kind: 'community_concern', reason: 'Garbage or sanitation', description: 'Neighbors leave garbage bags on the corner before collection day; I would like to ask about the schedule. (demo)', contactNo: daniel.residentId ? residentById(daniel.residentId)?.contactNo ?? '09170000001' : '09170000001', ...s1 }, daniel)
        reg.appointments.push(a.id)
      }
      const s2 = slot('chairman_consult', 20, '14:00')
      if (s2) {
        const a = await bookPurposeVisit({ kind: 'chairman_consult', reason: 'Request for endorsement or recommendation', description: 'I need an endorsement letter for my grandson\'s scholarship application. (demo)', contactNo: residentById(lourdes.residentId!)?.contactNo ?? '09170000002', ...s2 }, lourdes)
        reg.appointments.push(a.id)
        await staffConfirm(a.id, chair)
      }
    })

    // 4b. Earlier today (when the hall is open today): visits already held show as completed, later ones as confirmed.
    await step('today', async () => {
      const today = manilaToday()
      if (!isWorkingDay(today)) return
      const list = read<Record<string, unknown>[]>('bmis.appointments', [])
      const now = Date.now()
      const make = (n: number, kind: string, who: User, staff: User, time: string, minutes: number, title: string, reason: string, outcome: string, subjectId: string, subjectRef?: string) => {
        const start = new Date(`${today}T${time}:00+08:00`)
        const done = start.getTime() + minutes * 60_000 < now
        const created = new Date(start.getTime() - 2 * 86_400_000).toISOString()
        const id = `apt-demo-today-${n}`
        reg.appointments.push(id)
        return {
          id, ref: `APT-DEMO-${n}`, kind, subjectId, subjectRef, title, residentId: who.residentId, userId: who.id, reason, documents: ['Valid government-issued ID'],
          date: today, time, durationMin: minutes, durationEstimate: minutes, assignedTo: staff.id, status: done ? 'completed' : 'confirmed', staffConfirmed: true,
          bookedAt: created, remindersSent: [], createdAt: created, demo: true,
          purpose: kind.endsWith('consult') || kind === 'community_concern' || kind === 'mediation_inquiry' ? { reason, description: `${reason}. (demo)` } : undefined,
          checkedInAt: done ? new Date(start.getTime() + 3 * 60_000).toISOString() : undefined,
          completedAt: done ? new Date(start.getTime() + minutes * 60_000).toISOString() : undefined,
          outcome: done ? { notes: `${outcome} (demo)`, byUserId: staff.id, at: new Date(start.getTime() + minutes * 60_000).toISOString() } : undefined,
          history: [
            { at: created, byUserId: who.id, action: `Booked for ${today} ${time}` },
            ...(done ? [{ at: new Date(start.getTime() + 3 * 60_000).toISOString(), byUserId: staff.id, action: 'Checked in' }, { at: new Date(start.getTime() + minutes * 60_000).toISOString(), byUserId: staff.id, action: `Completed: ${outcome} (demo)` }] : []),
          ],
        }
      }
      const returning = mockBorrowings.find((b) => b.status === 'released')
      write('bmis.appointments', [
        ...list,
        make(1, 'community_concern', lourdes, sec, '08:30', 20, 'Community concern', 'Garbage or sanitation', 'Explained the collection schedule; referred the missed pickups to the city.', `self-${lourdes.residentId}`),
        make(2, 'mediation_inquiry', daniel, chair, '10:30', 30, 'Mediation or dispute', 'Neighbor or boundary dispute', 'Advised to file a complaint so mediation can be scheduled.', `self-${daniel.residentId}`),
        ...(returning ? [make(3, 'equipment_return', mockUsers.find((x) => x.residentId === returning.residentId) ?? ({ id: '', residentId: returning.residentId } as User), cust, '13:30', 15, returning.items.map((i) => `${i.qty} ${mockEquipment.find((e) => e.id === i.equipmentId)?.name ?? 'items'}`).join(', '), 'Return borrowed equipment', 'Equipment received and checked; no damage.', returning.id, returning.refNo)] : []),
      ])
    })

    // 5. Equipment: Daniel borrows chairs and tables, the Property Custodian approves, Daniel books the pickup.
    await step('borrowing', async () => {
      const use = workday(4)
      const b = await requestBorrowing({ residentId: daniel.residentId, borrowerName: me(daniel).name, address: me(daniel).address, items: [{ equipmentId: 'eq-001', qty: 20 }, { equipmentId: 'eq-002', qty: 2 }], dateOfUse: use, statedReturnDate: nextDate(use), assisted: false }, actor(daniel))
      reg.borrowings.push(b.id)
      await actOnBorrowing(b.id, 'approve', actor(cust))
      const pickup = (await listMyAppointments(daniel)).find((x) => x.kind === 'equipment_pickup' && x.subjectId === b.id)
      if (pickup) {
        reg.appointments.push(pickup.id)
        const s = slot('equipment_pickup', pickup.durationMin, '15:00')
        if (s) await bookAppointment(pickup.id, s.date, s.time, daniel)
      }
    })

    // 6. An office closure the Secretary announced (shows on every calendar and in residents' notifications).
    await step('closure', async () => {
      const d = workday(12)
      const r = await addClosure({ from: d, to: d, start: '13:00', end: '17:00', services: [], reason: 'Barangay Assembly at the covered court. The Barangay Hall is closed in the afternoon. (demo)', announce: true }, sec)
      reg.closures.push(r.closure.id)
    })

    // 7. Maria's ID on file: uploaded by her, verified by the Secretary (kept; created once).
    await step('id', async () => {
      if (stateOf(await getIdOnFile(maria.residentId!, sec)) !== 'missing') return
      const file = await demoIdImage()
      const stored = await saveUpload(file, { category: 'id', ownerResidentId: maria.residentId }, maria)
      const exp = new Date(); exp.setFullYear(exp.getFullYear() + 2)
      const doc = await submitReplacementId(maria.residentId!, { idType: 'Postal ID', idNumber: 'PRN-DEMO-0042', expiresAt: exp.toISOString().slice(0, 10), fileId: stored.id }, maria)
      await decideId(doc.id, 'verified', 'Checked against the original card at the counter. (demo)', sec)
    })

    // 8. Access changes need two people: one waiting for the Punong Barangay, one already decided.
    await step('access', async () => {
      const pick = (x: User) => GRANTABLE_STAFF_PERMISSIONS.filter((p) => !(ROLE_PERMISSIONS[x.roleId] as readonly string[]).includes(p) && !x.extraPermissions?.includes(p))
      const p1 = pick(cust)[0]
      if (p1) reg.accessRequests.push(demoAccessRequest(cust.id, [p1], 'Needs this to prepare the monthly equipment report while the Secretary is on leave. (demo)', admin).id)
      // Request ids come from the clock: wait a moment so the two requests never share one.
      await new Promise((r) => setTimeout(r, 5))
      const p2 = pick(kag)[0]
      if (p2) {
        const r = demoAccessRequest(kag.id, [p2], 'Asked to help encode walk-in requests during the clearance rush. (demo)', admin)
        reg.accessRequests.push(r.id)
        await rejectAccessRequest(r.id, 'Not needed: the Secretary will handle the walk-in requests. (demo)', chair)
      }
    })

    // 9a. Account recovery: a resident who lost her e-mail (for the Secretary) and a Kagawad (for the
    // System Administrator, identity checked, visit set). The device's request limit is left as it was.
    await step('recovery', async () => {
      const rate = localStorage.getItem('bmis.recoveryRate')
      try {
        await submitRecovery({ accountType: 'resident', fullName: lourdes.fullName, identifier: lourdes.username, reason: 'My old e-mail account was closed by the provider. (demo)', newMobile: '09171112233' })
        await new Promise((r) => setTimeout(r, 5))
        const { ref } = await submitRecovery({ accountType: 'personnel', fullName: kag.fullName, identifier: kag.username, accountNo: kag.accountNo, reason: 'Lost access to my e-mail after changing phones. (demo)', newEmail: 'kagawad.new@example.test' })
        const q = read<{ id: string; ref: string }[]>('bmis.recoveryRequests', []).find((x) => x.ref === ref)
        if (q) {
          await recordRecoveryFinding(q.id, 'Office ID and EMP number match the personnel file. (demo)', admin)
          await scheduleRecoveryVisit(q.id, { date: workday(1), time: '10:00' }, admin)
        }
      } finally {
        if (rate === null) localStorage.removeItem('bmis.recoveryRate'); else localStorage.setItem('bmis.recoveryRate', rate)
      }
    })

    // 9. Security log: blocked sign-in attempts and a record export (activity log, admin dashboard).
    audit(sec, 'Sign-in blocked: wrong password (3 tries) from a new device', 'Security', 'secretary · demo', 'failure', daysAgo(1, 22))
    audit(admin, 'Sign-in blocked: unknown username "admin181"', 'Security', 'demo', 'failure', daysAgo(2, 3))
    audit(sec, 'Exported report: Document requests (this month)', 'Reports', 'demo', 'success', daysAgo(1, 16))
    audit(cust, 'Updated inventory: 4 monobloc chairs marked damaged', 'Equipment', 'EQ-181-001 · demo', 'success', daysAgo(2, 11))
  } finally {
    mark(reg)
    write(REG_KEY, reg)
    if (locked) localStorage.removeItem(LOCK)
    cfg.mockLatencyMs = latency
    pauseAuditSaving(false)
    window.dispatchEvent(new Event('bmis:notifications-changed'))
  }
}

/** A small generated image labelled as a demo ID (no real ID image is used). */
async function demoIdImage(): Promise<File> {
  const c = document.createElement('canvas')
  c.width = 480; c.height = 300
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = '#eef4f8'; g.fillRect(0, 0, 480, 300)
    g.strokeStyle = '#0b2a3c'; g.lineWidth = 6; g.strokeRect(8, 8, 464, 284)
    g.fillStyle = '#0b2a3c'; g.font = 'bold 28px sans-serif'; g.fillText('DEMO ID - NOT REAL', 40, 80)
    g.font = '20px sans-serif'; g.fillText('Postal ID (sample)', 40, 130); g.fillText('PRN-DEMO-0042', 40, 170); g.fillText('Barangay 181 prototype', 40, 210)
  }
  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? new Blob([], { type: 'image/png' })), 'image/png'))
  return new File([blob], 'demo-id.png', { type: 'image/png' })
}

/**
 * Clears records saved on this device (requests, appointments, borrowings,
 * concerns, closures, uploads, drafts, notices) and starts again from the
 * demo data. Settings, holidays, passwords and the text size stay.
 */
export const RECORD_KEYS = [
  'bmis.appointments', 'bmis.borrowings', 'bmis.equipment', 'bmis.concerns', 'bmis.calendar.closures', 'bmis.calendar.sent', 'bmis.accessRequests',
  'bmis.idDocuments', 'bmis.files', 'bmis.files.failed', 'bmis.emailLog', 'bmis.idempotency', 'bmis.registrations', 'bmis.registeredUsers',
  'bmis.notificationsDismissed', 'bmis.demoNotificationsRead', 'bmis.resetRequests', 'bmis.removedCases', 'bmis.announcements', 'bmis.accountStore', 'bmis.recoveryRequests', REG_KEY,
]
export function resetDemoData(by: User) {
  audit(by, 'Reset demo data', 'Settings', 'records cleared and demo data reloaded')
  for (const k of RECORD_KEYS) localStorage.removeItem(k)
  for (const k of Object.keys(localStorage)) if (k.startsWith('bmis.draft.')) localStorage.removeItem(k)
}
