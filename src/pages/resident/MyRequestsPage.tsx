import { ChevronRight, FilePlus2, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/documents/DocParts'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { getDocumentType } from '@/documents/catalog'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDateTime } from '@/lib/format'
import { listRequests } from '@/services/documentService'

/** Resident portal: only the signed-in resident's own requests (filtered by the service). */
export function MyRequestsPage() {
  const actor = useDocActor()
  const { data, loading } = useAsync(() => listRequests(actor!), [actor])

  return (
    <>
      <PageHeader
        title="My Requests"
        subtitle="Documents and reports you've requested, and where each one is."
        actions={
          <ButtonLink to="/my/documents/new" icon={<FilePlus2 className="size-4" />}>
            New request
          </ButtonLink>
        }
      />
      <Card>
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-surface-muted" />
            ))}
          </div>
        ) : !data?.length ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="No requests yet"
            body="Request a certificate or clearance online, then claim it at the Barangay Hall."
            action={<ButtonLink to="/my/documents/new">New request</ButtonLink>}
          />
        ) : (
          <ul>
            {data.map((r) => (
              <li key={r.id} className="border-b border-line-soft last:border-0">
                <Link to={`/my/documents/${r.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-sky-50">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-navy-900">{getDocumentType(r.typeId).name}</span>
                    <span className="block text-[12px] text-ink-muted">
                      {r.referenceNo} · updated {formatDateTime(r.updatedAt)}
                    </span>
                  </span>
                  <StatusBadge status={r.status} />
                  <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
