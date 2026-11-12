import { Building2 } from '@/icons'
import { useNavigate } from 'react-router-dom'
import { BackLink } from '@/components/ui/BackLink'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { RESIDENT_SERVICES } from '@/documents/catalog'
import { activeDocumentTypes } from '@/services/templateService'
import { SelectionCard, SelectionGrid } from '@/components/ui/SelectionCard'

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
            <SelectionGrid>
              {docs.map((d) => (
                <SelectionCard key={d.id} title={d.name} disabled={!d.online} onClick={() => navigate(`/my/documents/new/${d.id}`)} note={!d.online && <><Building2 /> At the Barangay Hall only</>} />
              ))}
            </SelectionGrid>
          </Panel>
        ))}
      </div>
    </>
  )
}
