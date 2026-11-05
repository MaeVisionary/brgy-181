import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { CommunityTab } from './CommunityTab'
import { DatasetsTab } from './DatasetsTab'
import { SeniorTab } from './SeniorTab'

const TABS = [
  { id: 'senior', label: 'Senior citizens (OSCA masterlist)' },
  { id: 'community', label: 'Community planning' },
  { id: 'datasets', label: 'Other datasets' },
] as const

/** Barangay 181 community analytics (FR15–FR16). */
export function AnalyticsPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as (typeof TABS)[number]['id']) ?? 'senior'
  return (
    <>
      <PageHeader title="Community Analytics" subtitle="Figures are calculated from loaded records only. Nothing is estimated or hardcoded." />
      <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams({ tab: t.id })}
            className={cn(
              '-mb-px border-b-2 px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors',
              tab === t.id ? 'border-navy-900 text-navy-900' : 'border-transparent text-ink-muted hover:text-navy-900',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'senior' && <SeniorTab />}
      {tab === 'community' && <CommunityTab />}
      {tab === 'datasets' && <DatasetsTab />}
    </>
  )
}
