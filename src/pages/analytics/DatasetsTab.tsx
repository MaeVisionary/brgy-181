import { Database } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Panel'
import { useAnalytics } from '@/analytics/AnalyticsContext'

/**
 * Datasets the analytics module is prepared for. Populations are never estimated
 * from another list (e.g. PWDs are not derived from the senior citizen masterlist).
 */
const DATASETS = [
  { name: 'Senior Citizen (OSCA) Masterlist', note: 'Excel file supplied by the barangay. Load it in the Senior citizens tab.', key: 'senior' },
  { name: 'General Resident Masterlist', note: 'Census-based master list (CSV import, FR4). The prototype uses labelled sample residents.', key: 'sample' },
  { name: 'Household Records', note: 'Households with one or more families. Sample households only in the prototype.', key: 'sample' },
  { name: 'PWD Masterlist', note: 'Not supplied yet.', key: 'none' },
  { name: 'Solo Parent Masterlist', note: 'Not supplied yet.', key: 'none' },
  { name: '4Ps Beneficiary Masterlist', note: 'Not supplied yet.', key: 'none' },
  { name: 'Barangay Service Transactions', note: 'Document requests in the prototype are sample transactions.', key: 'sample' },
  { name: 'Complaints and Katarungang Pambarangay Cases', note: 'Sample cases in the prototype.', key: 'sample' },
  { name: 'Equipment Inventory and Borrowing Records', note: 'Sample inventory until the Property Custodian encodes the actual records.', key: 'sample' },
] as const

export function DatasetsTab() {
  const { dataset } = useAnalytics()
  return (
    <Card className="divide-y divide-line-soft">
      {DATASETS.map((d) => {
        const status = d.key === 'senior' ? (dataset ? ['Loaded in this tab', 'success'] : ['Not loaded', 'neutral']) : d.key === 'sample' ? ['Sample data only', 'info'] : ['Data not yet available', 'neutral']
        return (
          <div key={d.name} className="flex items-start justify-between gap-4 px-5 py-4">
            <span className="flex items-start gap-3">
              <Database className="mt-0.5 size-4 shrink-0 text-ink-muted" />
              <span>
                <span className="block text-[13.5px] font-semibold text-navy-900">{d.name}</span>
                <span className="block text-[12.5px] text-ink-muted">{d.note}</span>
              </span>
            </span>
            <Badge tone={status[1] as 'success' | 'neutral' | 'info'}>{status[0]}</Badge>
          </div>
        )
      })}
    </Card>
  )
}
