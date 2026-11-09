import { getDocumentType } from '@/documents/catalog'
import { borrowingStatusForResident, caseStageForResident, documentStatusForResident, type ResidentStatus } from '@/lib/residentStatus'
import { itemsText } from '@/pages/equipment/BorrowingPages'
import type { DocActor } from './documentService'
import { listCases } from './caseService'
import { listRequests } from './documentService'
import { listBorrowings } from './equipmentService'

/**
 * A resident's own transactions in one list (Figma "My Transactions"): document
 * requests, complaints and reports, and equipment borrowing. Built from the same
 * services the other pages use, so they always agree.
 */
export type TransactionKind = 'document' | 'complaint' | 'borrowing'

export interface Transaction {
  id: string
  kind: TransactionKind
  /** Small caps label above the title, e.g. "Document request". */
  kindLabel: string
  title: string
  referenceNo: string
  /** ISO date-time the resident submitted it. */
  submittedAt: string
  status: ResidentStatus
  to: string
}

export const KIND_LABEL: Record<TransactionKind, string> = {
  document: 'Document Request',
  complaint: 'Complaints and Reports',
  borrowing: 'Equipment Borrowing',
}

export async function listMyTransactions(actor: DocActor): Promise<Transaction[]> {
  const [docs, cases, borrowings] = await Promise.all([listRequests(actor), listCases(actor), listBorrowings(actor)])
  const out: Transaction[] = []
  for (const d of docs) {
    const t = getDocumentType(d.typeId)
    const complaint = t.category === 'case'
    out.push({
      id: d.id,
      kind: complaint ? 'complaint' : 'document',
      kindLabel: complaint ? 'Report' : 'Document request',
      title: t.name,
      referenceNo: d.referenceNo,
      submittedAt: d.submittedAt,
      status: documentStatusForResident(d.status),
      to: `/my/documents/${d.id}`,
    })
  }
  for (const c of cases) {
    out.push({
      id: c.id,
      kind: 'complaint',
      kindLabel: 'Complaint · Katarungang Pambarangay',
      title: `Complaint: ${c.nature}`,
      referenceNo: c.caseNo,
      submittedAt: c.filedAt,
      status: caseStageForResident(c.stage),
      to: `/my/complaints/${c.id}`,
    })
  }
  for (const b of borrowings) {
    out.push({
      id: b.id,
      kind: 'borrowing',
      kindLabel: 'Equipment borrowing',
      title: `Borrow ${itemsText(b).replace(/ × /g, ' ')}`,
      referenceNo: b.refNo,
      submittedAt: b.requestedAt,
      status: borrowingStatusForResident(b),
      to: `/my/borrowing/${b.id}`,
    })
  }
  return out.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}
