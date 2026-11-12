import { Building2, ChevronRight } from '@/icons'
import { useNavigate } from 'react-router-dom'
import { BackLink } from '@/components/ui/BackLink'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { RESIDENT_SERVICES } from '@/documents/catalog'
import { activeDocumentTypes } from '@/services/templateService'
import { cn } from '@/lib/cn'

const CATEGORY_LABEL = { certificate: 'Certificates', clearance: 'Clearances' } as const

/** Step 1: pick a document. Its form opens on its own page (RequestFormPage). */
export function NewRequestPage() {
  const navigate = useNavigate()
  const groups = (['certificate', 'clearance'] as const).map((cat) => [cat, activeDocumentTypes().filter((d) => d.category === cat && RESIDENT_SERVICES.has(d.id))] as const)
  return (
    <>
      <BackLink fallbackTo="/my/documents" fallbackLabel="Document Requests" />
      <PageHeader title="What do you need?" />
      <div className="space-y-4">
        {groups.map(([cat, docs]) => (
          <Panel key={cat} title={CATEGORY_LABEL[cat]}>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {docs.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    disabled={!d.online}
                    onClick={() => navigate(`/my/documents/new/${d.id}`)}
                    className={cn('flex min-h-14 w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border px-4 py-3 text-left transition-colors', d.online ? 'border-line hover:border-navy-600 hover:bg-sky-50' : 'cursor-not-allowed border-line-soft bg-surface-muted')}
                  >
                    <span className="min-w-0">
                      <span className="block text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900">{d.name}</span>
                      {!d.online && <span className="mt-0.5 flex items-center gap-1 text-[length:calc(14.5px*var(--fs))] text-ink-nav"><Building2 className="size-4" /> At the Barangay Hall only</span>}
                    </span>
                    {d.online && <ChevronRight className="size-5 shrink-0 text-ink-subtle" />}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </>
  )
}
