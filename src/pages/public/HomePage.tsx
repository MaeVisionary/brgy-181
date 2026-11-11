import { ArrowRight, Building2, ClipboardList, FileText, Gavel, MapPin, Package, UserCheck, UserPlus } from 'lucide-react'
import { BarangaySeal } from '@/components/layout/BarangaySeal'
import { BARANGAY, CHAIRMAN, SECRETARY, officialByPosition } from '@/config/barangay'
import { cn } from '@/lib/cn'
import { useSmoothNavigate } from '@/lib/transition'
import { PublicLayout } from './PublicLayout'

/** Public homepage of the Barangay 181 portal. Only documented information is shown. */
export function HomePage() {
  const go = useSmoothNavigate()
  const kagawads = officialByPosition('Barangay Kagawad')
  const treasurer = officialByPosition('Barangay Treasurer')[0]
  const lupon = officialByPosition('Lupon Member')

  return (
    <PublicLayout>
      {/* Hero: large, faint seal behind the text (low opacity so the text stays easy to read) */}
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <img
          aria-hidden
          alt=""
          src={`${import.meta.env.BASE_URL}seal.png`}
          className="bmis-rise pointer-events-none absolute top-1/2 right-[-140px] w-[620px] max-w-none -translate-y-1/2 object-contain opacity-[0.09] grayscale select-none sm:right-[-80px] md:w-[680px] lg:right-[-40px] lg:w-[720px]"
        />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-surface via-surface/85 to-transparent lg:w-[62%]" />
        <div className="relative mx-auto max-w-[1180px] px-4 py-16 sm:px-6 md:py-24">
          <div className="max-w-[620px]">
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
              <button type="button" onClick={() => go('/register')} className="bmis-press inline-flex h-12 items-center gap-2 rounded-full border border-navy-900 bg-surface px-6 text-[15px] font-semibold text-navy-900 hover:bg-sky-50">
                <UserPlus className="size-4" /> Create an account
              </button>
            </div>
            <p className="bmis-rise bmis-rise-4 mt-6 font-display text-[13px] font-bold text-navy-600 italic">“{BARANGAY.motto}”</p>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-20">
        <div className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6">
          <p className="flex flex-wrap items-center gap-2 text-[12px] font-semibold tracking-[0.06em] text-navy-600 uppercase">
            <BarangaySeal className="size-6" /> Tondo, Manila <span className="text-ink-subtle">•</span>
            <span className="tracking-normal text-ink-muted normal-case">Official Public Governance &amp; Resident Services Portal</span>
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Barangay', '181'],
              ['Zone', '16'],
              ['District', 'II'],
              ['City', 'Manila'],
            ].map(([k, v]) => (
              <div key={k} className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4">
                <img aria-hidden alt="" src={`${import.meta.env.BASE_URL}seal.png`} className="pointer-events-none absolute -top-4 -right-6 w-[110px] max-w-none opacity-[0.08] grayscale select-none" />
                <dt className="label-caps relative">{k}</dt>
                <dd className="relative mt-1 font-display text-[28px] leading-none font-extrabold text-navy-900">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 max-w-3xl text-[14.5px] leading-relaxed text-ink-nav">
            Barangay 181 serves its residents in Gagalangin, Tondo, Manila. It is led by the Barangay Chairman, seven Barangay Kagawad and the Barangay
            Secretary. The BMIS study describes a community of around 6,000 residents and about 2,000 registered voters as of 2025. This portal brings resident
            records, document requests, complaints and Katarungang Pambarangay proceedings, equipment borrowing and barangay reports into one place.
          </p>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
                <p className="label-caps">Barangay Council</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Person name={CHAIRMAN.name} position="Barangay Chairman" lead />
                  <Person name={SECRETARY.name} position="Barangay Secretary" lead />
                  {treasurer && <Person name={treasurer.name} position="Barangay Treasurer" />}
                </div>
              </div>
              {lupon.length > 0 && (
                <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
                  <p className="label-caps">Lupong Tagapamayapa members</p>
                  <ul className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {lupon.map((l) => <li key={l.id} className="text-[14px] font-semibold text-navy-900">{l.name}</li>)}
                  </ul>
                  <p className="mt-2 text-[12px] text-ink-muted">Chaired by the Punong Barangay.</p>
                </div>
              )}
            </div>
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
              <p className="label-caps">Barangay Kagawad</p>
              <ul className="mt-3 grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
                {kagawads.map((k) => (
                  <li key={k.id} className="text-[14px] font-semibold text-navy-900">{k.name}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
          <p className="label-caps text-center text-navy-600">Barangay services</p>
          <h2 className="mt-2 text-center font-display text-[28px] font-extrabold text-navy-900">What you can do through the portal</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[14.5px] text-ink-muted">
            If you have no gadget or need help using the portal, you can visit the Barangay 181 Hall and personnel will assist you.
          </p>

          <div className="mx-auto mt-8 grid max-w-[1180px] gap-4 md:grid-cols-3">
            {[
              { icon: FileText, title: 'Certificates and clearances', body: 'Request online, then claim the signed and sealed document at the Barangay Hall.' },
              { icon: Gavel, title: 'Complaints and reports', body: 'Report incidents and request summons. Cases go through the Katarungang Pambarangay process.' },
              { icon: Package, title: 'Equipment borrowing', body: `Borrow barangay equipment for community or family use. Fixed 15-day borrowing period with a 3-day grace period.` },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-[var(--radius-card)] border border-line bg-canvas p-6">
                <p className="flex items-center gap-2.5 font-display text-[15.5px] font-bold text-navy-900">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-100 text-navy-900"><Icon className="size-[18px]" /></span>
                  {title}
                </p>
                <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">{body}</p>
              </div>
            ))}
          </div>

          <h3 className="mt-14 text-center font-display text-[24px] font-extrabold text-navy-900">How a request moves</h3>
          <ProcessSteps
            steps={[
              { icon: ClipboardList, title: 'Submit your request', body: 'Through the portal or at the Barangay Hall.' },
              { icon: UserCheck, title: 'Verification', body: 'The Barangay Secretary checks your information against the records.' },
              { icon: Building2, title: 'Approval', body: 'Documents that need it are approved by the Barangay Chairman, then signed and sealed.' },
              { icon: MapPin, title: 'Pickup', body: 'Claim your document at the Barangay 181 Hall.' },
            ]}
          />
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-20 bg-surface-muted">
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



/** Numbered steps joined by a line: horizontal on wide screens, vertical on phones. */
function ProcessSteps({ steps }: { steps: { icon: typeof FileText; title: string; body: string }[] }) {
  return (
    <div className="mt-2">
      <ol className="relative mt-8 grid gap-8 md:grid-cols-4 md:gap-4">
        {/* Connector line */}
        <span aria-hidden className="absolute top-6 right-[12.5%] left-[12.5%] hidden h-[3px] rounded-full bg-sky-300 md:block" />
        <span aria-hidden className="absolute top-6 bottom-6 left-6 w-[3px] rounded-full bg-sky-300 md:hidden" />
        {steps.map((s, i) => {
          const I = s.icon
          return (
            <li key={s.title} className="relative flex gap-4 md:flex-col md:items-center md:text-center">
              <span className="relative z-10 grid size-12 shrink-0 place-items-center rounded-full border-4 border-surface bg-navy-900 text-white shadow-[0_0_0_3px_var(--color-sky-300)]">
                <I className="size-5" />
              </span>
              <div className="md:mt-3">
                <p className="text-[11.5px] font-semibold tracking-[0.08em] text-ink-muted uppercase">Step {i + 1}</p>
                <p className="font-display text-[15.5px] font-bold text-navy-900">{s.title}</p>
                <p className="mt-1 max-w-[230px] text-[13px] text-ink-muted">{s.body}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
