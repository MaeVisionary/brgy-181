import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Panel } from '@/components/ui/Panel'
import { resetDemoData } from '@/demo/seedDemo'

/** System Settings: what the demo data is, and a reset to start again from it. */
export function DemoDataPanel() {
  const { user } = useAuth()
  const [asking, setAsking] = useState(false)
  if (!user) return null
  return (
    <Panel className="mt-4" title="Demo data">
      <div className="space-y-2 text-[length:calc(15.5px*var(--fs))] text-navy-900">
        <p>This prototype runs on demo data: fictional residents and connected records (requests, complaints, concerns, appointments, equipment borrowing, an office closure, an ID on file and access requests) so every role has something to work with. Records are created through the same steps the system uses, so each one appears for the person who sent it and the person who received it, with its notifications and activity log.</p>
        <p>No real personal data is used and no real e-mail or text message is sent. Records marked "(demo)" are examples.</p>
        <p className="text-ink-nav">Reset clears the records saved on this device (requests, appointments, borrowing, concerns, uploads, drafts and notices) and starts again from the demo data. Settings, holidays and passwords are kept.</p>
      </div>
      <Button className="mt-3" variant="danger" onClick={() => setAsking(true)}>Reset demo data</Button>
      {asking && (
        <ConfirmDialog title="Reset the demo data?" confirmLabel="Reset" destructive onCancel={() => setAsking(false)} onConfirm={() => { resetDemoData(user); window.location.reload() }}>
          Everything recorded on this device since the last reset is removed. This cannot be undone.
        </ConfirmDialog>
      )}
    </Panel>
  )
}
