import { Printer } from '@/icons'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { BackLink } from '@/components/ui/BackLink'
import { Button } from '@/components/ui/Button'
import { BARANGAY, CHAIRMAN, SECRETARY } from '@/config/barangay'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDate, formatDateTime } from '@/lib/format'
import { getCase } from '@/services/caseService'
import type { KPCase } from '@/types/case'
import { NotFound } from '@/pages/system/NotFound'

const TITLES: Record<string, string> = {
  mediation: 'Record of Mediation Proceedings',
  settlement: 'Amicable Settlement',
  cfa: 'Certificate to File Action',
}

/**
 * Outcome records generated from the case. The layout is a working draft: the
 * barangay's official KP forms replace it once supplied (Document Templates).
 */
export function CaseRecordPrintPage() {
  const { id = '', kind = '' } = useParams()
  const actor = useDocActor()!
  const [c, setC] = useState<KPCase | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    getCase(id, actor).then(setC).catch(() => setMissing(true))
  }, [id, actor])
  if (missing || !TITLES[kind]) return <NotFound />
  if (!c) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  const ok = kind === 'mediation' ? c.hearings.some((h) => h.status === 'held') : kind === 'settlement' ? c.outcome?.type === 'settled' : c.outcome?.type === 'not_settled'
  if (!ok) return <NotFound />
  const names = (side: 'complainants' | 'respondents') => c[side].map((p) => p.name).join(', ')

  const doc = (
      <article className="mx-auto max-w-[800px] bg-white px-10 py-12 font-serif text-[15px] leading-relaxed text-black shadow-sm print:shadow-none">
      <header className="text-center">
        <p>Republic of the Philippines</p>
        <p>{BARANGAY.fullName}</p>
        <p className="font-bold">OFFICE OF THE LUPONG TAGAPAMAYAPA</p>
      </header>
      <div className="mt-6 flex justify-between gap-4">
        <div>
          <p>{names('complainants')}</p>
          <p className="italic">Complainant/s</p>
          <p className="my-2">— against —</p>
          <p>{names('respondents')}</p>
          <p className="italic">Respondent/s</p>
        </div>
        <div className="text-right">
          <p>Barangay Case No. {c.caseNo}</p>
          {c.blotterNo && <p>Blotter No. {c.blotterNo}</p>}
          <p>For: {c.nature}</p>
        </div>
      </div>
      <h1 className="mt-8 text-center text-[20px] font-bold tracking-wide uppercase">{TITLES[kind]}</h1>

      {kind === 'mediation' && (
        <section className="mt-6 space-y-4">
          {c.hearings.filter((h) => h.status === 'held').map((h) => (
            <div key={h.id}>
              <p className="font-bold">{formatDateTime(h.scheduledAt)} · {h.kind === 'lupon_mediation' ? 'Lupon mediation' : 'Mediation under the Punong Barangay'} · {h.place}</p>
              <p>Present: {h.attendance.filter((a) => a.present).map((a) => a.name).join(', ') || 'none recorded'}</p>
              <p>Absent: {h.attendance.filter((a) => a.present === false).map((a) => a.name).join(', ') || 'none'}</p>
              {h.notes && <p>Proceedings: {h.notes}</p>}
            </div>
          ))}
          {c.outcome && <p><span className="font-bold">Result:</span> {c.outcome.summary}</p>}
        </section>
      )}

      {kind === 'settlement' && (
        <section className="mt-6 space-y-3">
          <p>We, the complainant/s and respondent/s in the above-captioned case, do hereby agree to settle our dispute as follows:</p>
          <p className="rounded border border-black/30 px-4 py-3 whitespace-pre-wrap">{c.outcome!.summary}</p>
          <p>and bind ourselves to comply honestly and faithfully with the above terms of settlement.</p>
          <p>Entered into this {formatDate(c.outcome!.at)}.</p>
          <div className="mt-10 grid grid-cols-2 gap-10">
            <p className="border-t border-black pt-1 text-center">Complainant/s</p>
            <p className="border-t border-black pt-1 text-center">Respondent/s</p>
          </div>
          <p className="mt-8">Attested by:</p>
          <p className="mt-8 w-72 border-t border-black pt-1 text-center">{CHAIRMAN.name}<br />Punong Barangay / Lupon Chairman</p>
        </section>
      )}

      {kind === 'cfa' && (
        <section className="mt-6 space-y-3">
          <p>This is to certify that:</p>
          <p>1. There has been a personal confrontation between the parties before the Punong Barangay / Pangkat ng Tagapagkasundo, but mediation and conciliation failed;</p>
          <p>2. Therefore, the corresponding complaint for the dispute may now be filed in court or government office.</p>
          <p>Record: {c.outcome!.summary}</p>
          <p>Issued this {formatDate(c.outcome!.at)}.</p>
          <div className="mt-10 grid grid-cols-2 gap-10">
            <p className="border-t border-black pt-1 text-center">{SECRETARY.name}<br />Barangay Secretary / Lupon Secretary</p>
            <p className="border-t border-black pt-1 text-center">{CHAIRMAN.name}<br />Punong Barangay / Lupon Chairman</p>
          </div>
        </section>
      )}
    </article>
  )

  return (
    <>
      <div className="print:hidden">
        <BackLink fallbackTo={`/cases/${c.id}`} fallbackLabel={c.caseNo} />
        <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
          <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>Print</Button>
        </div>
      </div>
      {doc}
      {createPortal(<div className="bmis-print-root">{doc}</div>, document.body)}
    </>
  )
}
