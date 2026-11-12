import { toneForPath } from '@/icons/tones'
import { ArrowRight, Building2, ClipboardList, FileText, Gavel, LogIn, MapPin, Package, UserCheck, UserPlus } from '@/icons'
import { BarangaySeal } from '@/components/layout/BarangaySeal'
import { BARANGAY, BARANGAY_CONTACT, CHAIRMAN, SECRETARY, officialByPosition } from '@/config/barangay'
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
            <h1 className="bmis-rise bmis-rise-2 mt-3 font-display text-[length:calc(34px*var(--fs))] leading-[1.08] font-extrabold tracking-tight text-navy-900 sm:text-[length:calc(46px*var(--fs))]">
              Welcome to the Digital Portal of <span className="block">Barangay 181</span>
            </h1>
            <p className="bmis-rise bmis-rise-3 mt-4 max-w-xl text-[length:calc(18px*var(--fs))] leading-relaxed text-ink-nav">
              Your access point to barangay services, resident information, document requests and community assistance.
            </p>
            <p className="bmis-rise bmis-rise-3 mt-2 max-w-xl text-[length:calc(16px*var(--fs))] leading-relaxed text-ink-muted">
              Making barangay services more accessible, organized and convenient for every resident of Zone {BARANGAY.zone}, District {BARANGAY.district}, Manila.
            </p>
            <div className="bmis-rise bmis-rise-4 mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={() => go('/login/resident')} className="bmis-press inline-flex h-12 items-center gap-2 rounded-[var(--radius-control)] bg-navy-900 px-6 text-[length:calc(17px*var(--fs))] font-semibold text-white hover:bg-navy-800">
                <LogIn className="size-4" /> Resident Login
              </button>
              <button type="button" onClick={() => go('/register')} className="bmis-press inline-flex h-12 items-center gap-2 rounded-[var(--radius-control)] border border-navy-900 bg-surface px-6 text-[length:calc(17px*var(--fs))] font-semibold text-navy-900 hover:bg-sky-50">
                <UserPlus className="size-4" /> Create Account
              </button>
            </div>
            <button type="button" onClick={() => go('/portal')} className="bmis-rise bmis-rise-4 mt-3 inline-flex min-h-11 items-center gap-1.5 text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-600 hover:text-navy-900 hover:underline">
              Barangay personnel: access the portal <ArrowRight className="size-4" />
            </button>
            <p className="bmis-rise bmis-rise-4 mt-6 font-display text-[length:calc(15px*var(--fs))] font-bold text-navy-600 italic">“{BARANGAY.motto}”</p>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-20">
        <div className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6">
          <p className="flex flex-wrap items-center gap-2 text-[length:calc(14px*var(--fs))] font-semibold tracking-[0.06em] text-navy-600 uppercase">
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
                <dt className="label-caps relative">{k}</dt>
                <dd className="relative mt-1 font-display text-[length:calc(30px*var(--fs))] leading-none font-extrabold text-navy-900">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 max-w-3xl text-[length:calc(16.5px*var(--fs))] leading-relaxed text-ink-nav">
            Barangay 181 serves its residents in Gagalangin, Tondo, Manila. It is led by the Barangay Chairman, seven Barangay Kagawad and the Barangay
            Secretary. The BMIS study describes a community of around 6,000 residents and about 2,000 registered voters as of 2025. This portal brings resident
            records, document requests, complaints and Katarungang Pambarangay proceedings, equipment borrowing and barangay reports into one place.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
                <p className="label-caps">Barangay Council</p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Person name={CHAIRMAN.name} position="Barangay Chairman" lead />
                  <Person name={SECRETARY.name} position="Barangay Secretary" lead />
                  {treasurer && <Person name={treasurer.name} position="Barangay Treasurer" />}
                </div>
              </div>
              {lupon.length > 0 && (
                <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
                  <p className="label-caps">Lupong Tagapamayapa members</p>
                  <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                    {lupon.map((l) => <li key={l.id} className="text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{l.name}</li>)}
                  </ul>
                  <p className="mt-2 text-[length:calc(14px*var(--fs))] text-ink-muted">Chaired by the Punong Barangay.</p>
                </div>
              )}
            </div>
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
              <p className="label-caps">Barangay Kagawad</p>
              <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
                {kagawads.map((k) => (
                  <li key={k.id} className="text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{k.name}</li>
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
          <h2 className="mt-2 text-center font-display text-[length:calc(30px*var(--fs))] font-extrabold text-navy-900">What you can do through the portal</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[length:calc(16.5px*var(--fs))] text-ink-muted">
            If you have no gadget or need help using the portal, you can visit the Barangay 181 Hall and personnel will assist you.
          </p>

          <div className="mx-auto mt-8 grid grid-cols-1 max-w-[1180px] gap-4 md:grid-cols-3">
            {[
              { icon: FileText, title: 'Document Requests', body: 'Request certificates and clearances online, track each step, then claim the signed and sealed document at the Barangay Hall.', action: 'Request a Document', to: '/my/documents/new' },
              { icon: Gavel, title: 'Complaints and Incident Reports', body: 'Report incidents and file complaints. Cases go through the Katarungang Pambarangay process: blotter, hearing and mediation.', action: 'File a Complaint', to: '/my/complaints/new' },
              { icon: Package, title: 'Equipment Borrowing', body: `Borrow chairs, tables, ladders and other barangay equipment. Fixed 15-day borrowing period with a 3-day grace period.`, action: 'Borrow Equipment', to: '/my/borrowing' },
            ].map(({ icon: Icon, title, body, action, to }) => (
              <div key={title} className="flex flex-col rounded-[var(--radius-card)] border border-line bg-canvas p-6">
                <p className="flex items-center gap-2.5 font-display text-[length:calc(17.5px*var(--fs))] font-bold text-navy-900">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-[10px] ${toneForPath(to)}`}><Icon className="size-5" /></span>
                  {title}
                </p>
                <p className="mt-2.5 flex-1 text-[length:calc(15.5px*var(--fs))] leading-relaxed text-ink-nav">{body}</p>
                <button type="button" onClick={() => go(to)} className="bmis-press mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-navy-900 px-5 py-2 text-center text-[length:calc(15.5px*var(--fs))] font-semibold text-white hover:bg-navy-800">
                  {action} <ArrowRight className="size-4" />
                </button>
              </div>
            ))}
          </div>

          <h3 className="mt-14 text-center font-display text-[length:calc(26px*var(--fs))] font-extrabold text-navy-900">How a request moves</h3>
          <ProcessSteps
            steps={[
              { icon: ClipboardList, title: 'Submit your request', body: 'Through the portal or at the Barangay Hall.' },
              { icon: UserCheck, title: 'Verification', body: 'The Barangay Secretary checks your information against the records.' },
              { icon: Building2, title: 'Approval', body: 'The Barangay Chairman approves it. The document is printed, signed and sealed.' },
              { icon: MapPin, title: 'Pickup', body: 'Claim your document at the Barangay 181 Hall.' },
            ]}
          />
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-20 bg-surface-muted">
        <div className="mx-auto grid grid-cols-1 max-w-[1180px] gap-6 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="label-caps text-navy-600">Contact and assistance</p>
            <h2 className="mt-2 font-display text-[length:calc(30px*var(--fs))] font-extrabold text-navy-900">Visit the Barangay 181 Hall</h2>
            <p className="mt-3 max-w-lg text-[length:calc(16.5px*var(--fs))] leading-relaxed text-ink-nav">
              For walk-in requests, personal appearances for blotter entries, hearings, and claiming documents or equipment, go to the Barangay 181 Hall in{' '}
              {BARANGAY.locality}.
            </p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
            <dl className="space-y-4 text-[length:calc(16px*var(--fs))]">
              <div>
                <dt className="label-caps">Location</dt>
                <dd className="mt-1 font-semibold text-navy-900">Barangay 181 Hall, Zone 16, District II, {BARANGAY.locality}</dd>
              </div>
              <div>
                <dt className="label-caps">Phone</dt>
                <dd className="mt-1 font-semibold text-navy-900">
                  <a href={`tel:${BARANGAY_CONTACT.phone.replace(/[^\d+]/g, '')}`} className="text-info hover:underline">{BARANGAY_CONTACT.phone}</a>
                  {' · '}
                  <a href={`tel:${BARANGAY_CONTACT.mobile.replace(/[^\d+]/g, '')}`} className="text-info hover:underline">{BARANGAY_CONTACT.mobile}</a>
                </dd>
              </div>
              <div>
                <dt className="label-caps">Email</dt>
                <dd className="mt-1 font-semibold break-all"><a href={`mailto:${BARANGAY_CONTACT.email}`} className="text-info hover:underline">{BARANGAY_CONTACT.email}</a></dd>
              </div>
              <div>
                <dt className="label-caps">Office hours</dt>
                <dd className="mt-1 text-navy-900">{BARANGAY_CONTACT.officeHours}<span className="block">{BARANGAY_CONTACT.saturdayHours}</span></dd>
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
      <p className={cn('font-display font-extrabold text-navy-900', lead ? 'text-[length:calc(19px*var(--fs))]' : 'text-[length:calc(17px*var(--fs))]')}>{name}</p>
      <p className="text-[length:calc(14.5px*var(--fs))] text-ink-muted">{position}</p>
    </div>
  )
}



/** Numbered steps joined by a line: horizontal on wide screens, vertical on phones. */
function ProcessSteps({ steps }: { steps: { icon: typeof FileText; title: string; body: string }[] }) {
  return (
    <div className="mt-2">
      <ol className="relative mt-8 grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-4">
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
                <p className="text-[length:calc(13.5px*var(--fs))] font-semibold tracking-[0.08em] text-ink-muted uppercase">Step {i + 1}</p>
                <p className="font-display text-[length:calc(17.5px*var(--fs))] font-bold text-navy-900">{s.title}</p>
                <p className="mt-1 max-w-[230px] text-[length:calc(15px*var(--fs))] text-ink-muted">{s.body}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
