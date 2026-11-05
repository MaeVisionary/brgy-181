import { ArrowRight, Building2, ClipboardList, FileText, Gavel, MapPin, Package, UserCheck } from 'lucide-react'
import { BarangaySeal } from '@/components/layout/BarangaySeal'
import { BARANGAY, CHAIRMAN, SECRETARY, officialByPosition } from '@/config/barangay'
import { DOCUMENT_TYPES } from '@/documents/catalog'
import { cn } from '@/lib/cn'
import { useSmoothNavigate } from '@/lib/transition'
import { PublicLayout } from './PublicLayout'

/** Public homepage of the Barangay 181 portal. Only documented information is shown. */
export function HomePage() {
  const go = useSmoothNavigate()
  const kagawads = officialByPosition('Barangay Kagawad')
  const sk = officialByPosition('SK Chairman')[0]
  const treasurer = officialByPosition('Barangay Treasurer')[0]
  const lupon = officialByPosition('Lupon Member')
  const certificates = DOCUMENT_TYPES.filter((d) => d.category !== 'case')
  const caseDocs = DOCUMENT_TYPES.filter((d) => d.category === 'case' && d.id !== 'notice-of-hearing')

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="bmis-rise label-caps text-navy-600">Official digital portal</p>
            <h1 className="bmis-rise bmis-rise-2 mt-3 font-display text-[34px] leading-[1.08] font-extrabold tracking-tight text-navy-900 sm:text-[46px]">
              Welcome to the Digital Portal of <span className="block">Barangay 181</span>
            </h1>
            <p className="bmis-rise bmis-rise-3 mt-4 max-w-xl text-[16px] leading-relaxed text-ink-nav">
              Your access point to barangay services, resident information, document requests and community assistance.
            </p>
            <p className="bmis-rise bmis-rise-3 mt-2 max-w-xl text-[14px] leading-relaxed text-ink-muted">
              Making barangay services more accessible, organized and convenient for every resident of Zone {BARANGAY.zone}, District {BARANGAY.district}, Manila.
            </p>
            <div className="bmis-rise bmis-rise-4 mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={() => go('/portal')} className="bmis-press inline-flex h-12 items-center gap-2 rounded-full bg-navy-900 px-6 text-[15px] font-semibold text-white hover:bg-navy-800">
                Access the Portal <ArrowRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => document.querySelector('#services')?.scrollIntoView({ behavior: 'smooth' })}
                className="bmis-press inline-flex h-12 items-center rounded-full border border-line bg-surface px-6 text-[15px] font-semibold text-navy-900 hover:bg-surface-muted"
              >
                Explore Services
              </button>
            </div>
          </div>

          {/* Identity card: wording as printed on the barangay's official documents */}
          <div className="bmis-rise bmis-rise-3 relative mx-auto w-full max-w-[440px]">
            <div className="relative overflow-hidden rounded-[28px] bg-navy-900 px-8 pt-10 pb-8 text-center text-white">
              {/* Faint seal watermark behind the card content */}
              <img
                aria-hidden
                alt=""
                src={`${import.meta.env.BASE_URL}seal.png`}
                className="pointer-events-none absolute top-1/2 left-1/2 size-[460px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.06] select-none"
              />
              <BarangaySeal className="relative mx-auto size-36 drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]" />
              <p className="relative mt-6 text-[13px] tracking-wide text-white/75">Republic of the Philippines · City of Manila</p>
              <p className="relative mt-1 font-display text-[22px] font-extrabold">Barangay 181</p>
              <p className="relative text-[14px] text-white/85">Zone 16, District II</p>
              <div className="relative mx-auto my-5 h-px w-16 bg-[#f2c94c]" />
              <p className="relative font-display text-[13px] font-bold text-[#f2c94c] italic">“{BARANGAY.motto}”</p>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-20">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
          <p className="label-caps text-navy-600">About Barangay 181</p>
          <h2 className="mt-2 font-display text-[28px] font-extrabold text-navy-900">A community in Gagalangin, Tondo, Manila</h2>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <dl className="grid grid-cols-2 gap-3">
                {[
                  ['Barangay', '181'],
                  ['Zone', '16'],
                  ['District', 'II'],
                  ['City', 'Manila'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4">
                    <dt className="label-caps">{k}</dt>
                    <dd className="mt-1 font-display text-[26px] leading-none font-extrabold text-navy-900">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-[14.5px] leading-relaxed text-ink-nav">
                Barangay 181 is led by the Barangay Chairman, seven Barangay Kagawad, the SK Chairman and the Barangay Secretary. The BMIS study describes a
                community of around 6,000 residents and about 2,000 registered voters as of 2025.
              </p>
              <p className="mt-3 text-[14.5px] leading-relaxed text-ink-nav">
                This portal brings resident records, document requests, complaints and Katarungang Pambarangay proceedings, equipment borrowing and barangay
                reports into one place, so residents spend less time going back and forth and personnel spend less time searching records.
              </p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
              <p className="label-caps">Barangay Council</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Person name={CHAIRMAN.name} position="Barangay Chairman" lead />
                <Person name={SECRETARY.name} position="Barangay Secretary" lead />
              </div>
              <p className="label-caps mt-5 mb-2">Barangay Kagawad</p>
              <ul className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {kagawads.map((k) => (
                  <li key={k.id} className="text-[14px] font-semibold text-navy-900">{k.name}</li>
                ))}
              </ul>
              <div className="mt-5 grid gap-4 border-t border-line-soft pt-4 sm:grid-cols-2">
                <Person name={sk.name} position="SK Chairman" />
                {treasurer && <Person name={treasurer.name} position="Barangay Treasurer" />}
              </div>
              {lupon.length > 0 && (
                <div className="mt-4 border-t border-line-soft pt-4">
                  <p className="label-caps mb-2">Lupong Tagapamayapa members</p>
                  <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {lupon.map((l) => <li key={l.id} className="text-[14px] font-semibold text-navy-900">{l.name}</li>)}
                  </ul>
                  <p className="mt-2 text-[12px] text-ink-muted">Chaired by the Punong Barangay.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
          <p className="label-caps text-navy-600">Barangay services</p>
          <h2 className="mt-2 font-display text-[28px] font-extrabold text-navy-900">What you can do through the portal</h2>
          <p className="mt-2 max-w-2xl text-[14.5px] text-ink-muted">
            If you have no gadget or need help using the portal, you can visit the Barangay 181 Hall and personnel will assist you.
          </p>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <ServiceGroup icon={FileText} title="Certificates and clearances" body="Request online, then claim the signed and sealed document at the Barangay Hall.">
              {certificates.map((d) => (
                <ServiceItem key={d.id} name={d.name} online={d.online} />
              ))}
            </ServiceGroup>
            <ServiceGroup icon={Gavel} title="Complaints and reports" body="Report incidents and request summons. Cases go through the Katarungang Pambarangay process.">
              {caseDocs.map((d) => (
                <ServiceItem key={d.id} name={d.id === 'summon' ? 'Complaint submission (Barangay Summon)' : d.name} online={d.online} />
              ))}
            </ServiceGroup>
            <ServiceGroup icon={Package} title="Equipment borrowing" body="Borrow barangay equipment for community or family use.">
              {['Chairs', 'Tables', 'Ladders', 'Nebulizers'].map((n) => (
                <ServiceItem key={n} name={n} online />
              ))}
              <li className="pt-2 text-[12.5px] text-ink-muted">Fixed 15-day borrowing period with a 3-day grace period.</li>
            </ServiceGroup>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-4">
            {[
              [ClipboardList, 'Submit your request', 'Through the portal or at the Barangay Hall.'],
              [UserCheck, 'Verification', 'The Barangay Secretary checks your information against the records.'],
              [Building2, 'Approval', 'Documents that need it are approved by the Barangay Chairman, then signed and sealed.'],
              [MapPin, 'Pickup', 'Claim your document at the Barangay 181 Hall.'],
            ].map(([Icon, title, body], i) => {
              const I = Icon as typeof ClipboardList
              return (
                <div key={title as string} className="rounded-[var(--radius-card)] border border-line bg-canvas p-5">
                  <span className="flex items-center gap-2 text-[12px] font-semibold text-ink-muted">
                    <span className="grid size-6 place-items-center rounded-full bg-navy-900 text-[11px] text-white">{i + 1}</span>
                    <I className="size-4" />
                  </span>
                  <p className="mt-3 font-display text-[15px] font-bold text-navy-900">{title as string}</p>
                  <p className="mt-1 text-[13px] text-ink-muted">{body as string}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-20">
        <div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="label-caps text-navy-600">Contact and assistance</p>
            <h2 className="mt-2 font-display text-[28px] font-extrabold text-navy-900">Visit the Barangay 181 Hall</h2>
            <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-ink-nav">
              For walk-in requests, personal appearances for blotter entries, hearings, and claiming documents or equipment, go to the Barangay 181 Hall in{' '}
              {BARANGAY.locality}.
            </p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
            <dl className="space-y-4 text-[14px]">
              <div>
                <dt className="label-caps">Location</dt>
                <dd className="mt-1 font-semibold text-navy-900">Barangay 181 Hall, Zone 16, District II, {BARANGAY.locality}</dd>
              </div>
              <div>
                <dt className="label-caps">Assistance</dt>
                <dd className="mt-1 text-ink-nav">Residents without a gadget, or who find the portal hard to use, can be assisted at the Barangay Hall.</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}

function Person({ name, position, lead }: { name: string; position: string; lead?: boolean }) {
  return (
    <div>
      <p className={cn('font-display font-extrabold text-navy-900', lead ? 'text-[17px]' : 'text-[15px]')}>{name}</p>
      <p className="text-[12.5px] text-ink-muted">{position}</p>
    </div>
  )
}

function ServiceGroup({ icon: Icon, title, body, children }: { icon: typeof FileText; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-canvas p-6">
      <span className="grid size-10 place-items-center rounded-xl bg-sky-100 text-navy-900">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 font-display text-[17px] font-extrabold text-navy-900">{title}</h3>
      <p className="mt-1 text-[13px] text-ink-muted">{body}</p>
      <ul className="mt-4 space-y-1.5">{children}</ul>
    </div>
  )
}

function ServiceItem({ name, online }: { name: string; online: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line-soft pb-1.5 text-[13.5px] last:border-0">
      <span className="text-navy-900">{name}</span>
      <span className={cn('shrink-0 text-[11px] font-semibold', online ? 'text-info' : 'text-ink-muted')}>{online ? 'Online' : 'At the Hall'}</span>
    </li>
  )
}
