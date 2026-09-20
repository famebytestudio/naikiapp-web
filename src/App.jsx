import { useEffect, useState } from 'react'

/*
  NaikiApp Web - landing page (Premium Styled)
*/

const MINUTE = 60_000
const START = Date.now()

const DEMO_LISTINGS = [
  {
    id: 1,
    donor: 'Al-Noor Wedding Hall',
    food: 'Chicken biryani and qorma',
    type: 'Cooked',
    plates: 120,
    kg: 60,
    city: 'Lahore',
    area: 'Gulberg',
    window: '9:00 to 10:30 pm',
    expiresAt: START + 135 * MINUTE,
  },
  {
    id: 2,
    donor: 'Anonymous Donor',
    food: 'Fresh bread and rusk',
    type: 'Packaged',
    plates: 40,
    kg: 18,
    city: 'Karachi',
    area: 'Clifton',
    window: '8:30 to 9:30 pm',
    expiresAt: START + 52 * MINUTE,
  },
  {
    id: 3,
    donor: 'Chaudhry Grocers',
    food: 'Mixed vegetables and fruit',
    type: 'Fresh produce',
    plates: 0,
    kg: 25,
    city: 'Islamabad',
    area: 'G-9 Markaz',
    window: '8:00 to 8:45 pm',
    expiresAt: START + 24 * MINUTE,
  },
]

const DEMO_IMPACT = { kg: 12480, deliveries: 391, donors: 74, ngos: 26 }

const STEPS = [
  ['Available', 'A donor posts surplus food with quantity, expiry time and pickup window.', 'M12 4v16m8-8H4'],
  ['Claimed', 'One verified charity claims it. The listing locks, so nobody else can take it.', 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'],
  ['Picked up', 'The charity collects the food during the pickup window.', 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4'],
  ['Delivered', 'The charity enters the actual kg delivered and the impact numbers update.', 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'],
]

const ROLES = [
  {
    name: 'Donor',
    who: 'Restaurants, wedding halls, grocers and households',
    points: ['Post surplus food in under a minute', 'Track who claimed it and where pickup stands', 'See your own kg donated', 'Hide your name with the anonymity toggle'],
    color: 'from-orange-400 to-red-500'
  },
  {
    name: 'NGO or charity',
    who: 'Registered local charities',
    points: ['Browse live listings by city, area and food type', 'Claim food once the admin verifies your registration', 'Update pickup status through to delivered', 'Open the pickup address in Google Maps'],
    color: 'from-emerald-400 to-teal-500'
  },
  {
    name: 'Admin',
    who: 'FameByte Studio supervisors',
    points: ['Approve or reject NGO registrations', 'Remove fake or abusive listings', 'View platform-wide impact'],
    color: 'from-blue-400 to-indigo-500'
  },
]

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function CountdownTag({ expiresAt, now }) {
  const left = expiresAt - now
  if (left <= 0) return null
  const h = Math.floor(left / 3_600_000)
  const m = Math.floor((left % 3_600_000) / MINUTE)
  const label = h > 0 ? `${h}h ${m}m left` : m > 0 ? `${m}m left` : 'Under 1m left'
  const tone =
    left < 30 * MINUTE
      ? 'bg-red-500/10 text-red-600 border-red-500/20'
      : left < 60 * MINUTE
        ? 'bg-orange-500/10 text-orange-600 border-orange-500/20'
        : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
  
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider tabular-nums backdrop-blur-sm ${tone} shadow-sm transition-all duration-300`}>
      {label}
    </span>
  )
}

function ListingCard({ listing, now }) {
  const [claimed, setClaimed] = useState(false)
  if (listing.expiresAt <= now) return null
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${listing.area}, ${listing.city}`)}`

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/40 bg-white/60 p-6 shadow-xl shadow-slate-200/50 backdrop-blur-md transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-200/50">
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-['Outfit'] text-xl font-bold text-slate-800 transition-colors group-hover:text-emerald-700">{listing.food}</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">{listing.donor}</p>
        </div>
        {claimed ? (
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">Claimed</span>
        ) : (
          <CountdownTag expiresAt={listing.expiresAt} now={now} />
        )}
      </div>
      
      <div className="relative z-10 mt-6 grid grid-cols-2 gap-4 rounded-2xl bg-slate-50/50 p-4 backdrop-blur-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Quantity</p>
          <p className="mt-1 text-sm font-medium text-slate-700">
            {listing.type}, {listing.plates > 0 ? `${listing.plates} plates, ` : ''}~{listing.kg}kg
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Location</p>
          <p className="mt-1 text-sm font-medium text-slate-700">{listing.area}, {listing.city}</p>
        </div>
      </div>

      <div className="relative z-10 mt-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setClaimed(true)}
          disabled={claimed}
          className="relative overflow-hidden rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:bg-emerald-600 hover:shadow-emerald-500/30 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
        >
          {claimed ? 'Waiting for pickup' : 'Claim Food'}
        </button>
        <a 
          href={mapsUrl} 
          target="_blank" 
          rel="noreferrer" 
          className="group/link flex items-center gap-1.5 text-sm font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
        >
          View Map
          <svg className="h-4 w-4 transition-transform group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </article>
  )
}

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-center p-4">
      <div className="flex w-full max-w-6xl items-center justify-between rounded-full border border-white/20 bg-white/70 px-6 py-4 shadow-lg shadow-slate-200/20 backdrop-blur-xl transition-all duration-300">
        <a href="#top" className="flex items-center gap-2 font-['Outfit'] text-2xl font-black tracking-tight text-slate-900">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md">
            N
          </div>
          NaikiApp
        </a>
        <nav className="hidden gap-8 text-sm font-bold text-slate-600 md:flex">
          <a href="#how" className="transition-colors hover:text-emerald-600">How it works</a>
          <a href="#roles" className="transition-colors hover:text-emerald-600">Who it's for</a>
          <a href="#impact" className="transition-colors hover:text-emerald-600">Impact</a>
        </nav>
        <div className="flex items-center gap-4 text-sm font-bold">
          <a href="#" className="hidden text-slate-600 transition-colors hover:text-slate-900 sm:block">Log in</a>
          <a href="#" className="rounded-full bg-slate-900 px-6 py-2.5 text-white shadow-md transition-all hover:scale-105 hover:bg-emerald-600 hover:shadow-emerald-500/30 active:scale-95">Sign up</a>
        </div>
      </div>
    </header>
  )
}

function Hero({ now }) {
  return (
    <section id="top" className="relative flex min-h-screen items-center justify-center overflow-hidden pt-24 pb-12">
      {/* Background decoration */}
      <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-teal-300/30 blur-3xl" />
      
      <div className="relative mx-auto grid w-full max-w-6xl gap-16 px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="flex flex-col items-start pt-10 lg:pt-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
            Live Food Rescue Platform
          </div>
          
          <h1 className="mt-8 font-['Outfit'] text-5xl font-black leading-[1.1] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
            Surplus food from <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">Pakistan's kitchens</span>, to those in need.
          </h1>
          
          <p className="mt-8 max-w-xl text-lg font-medium leading-relaxed text-slate-600">
            NaikiApp connects restaurants, wedding halls, grocers and households with verified local charities. 
            Donors post what's left over, a charity claims it, and every delivery is counted.
          </p>
          
          <div className="mt-10 flex w-full flex-col gap-4 sm:flex-row">
            <a href="#" className="flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-8 py-4 font-bold text-white shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 hover:bg-emerald-500 active:scale-95">
              Donate Food
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
            <a href="#" className="flex items-center justify-center gap-2 rounded-full border-2 border-slate-200 bg-white/50 px-8 py-4 font-bold text-slate-700 shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:border-slate-300 hover:bg-white active:scale-95">
              Register Charity
            </a>
          </div>
        </div>

        <div aria-label="Sample live feed" className="relative flex flex-col gap-5">
          <div className="absolute -inset-x-10 -inset-y-10 z-0 bg-gradient-to-b from-transparent via-white/50 to-transparent blur-xl" />
          {DEMO_LISTINGS.map((l, index) => (
            <div key={l.id} className="relative z-10 animate-[fade-in-up_0.8s_ease-out_forwards]" style={{ animationDelay: `${index * 150}ms`, opacity: 0 }}>
              <ListingCard listing={l} now={now} />
            </div>
          ))}
          <p className="mt-2 text-center text-sm font-bold text-slate-400">Live sample listings from your area.</p>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden bg-slate-900 py-32 text-white">
      {/* Decorative blobs */}
      <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-emerald-500/20 blur-[120px]" />
      <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-blue-500/20 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="font-['Outfit'] text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Every donation follows <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">one clear path</span>.
          </h2>
          <p className="mt-6 text-lg font-medium text-slate-400">Both sides can see exactly where the food is at all times.</p>
        </div>

        <div className="mt-20 grid gap-8 md:grid-cols-4">
          {STEPS.map(([title, text, iconPath], i) => (
            <div key={title} className="group relative rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:bg-white/10 hover:shadow-2xl hover:shadow-emerald-500/10">
              <div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-emerald-500/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              
              <div className="relative">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
                  </svg>
                </div>
                <div className="mb-2 text-sm font-bold uppercase tracking-wider text-emerald-400">Step {i + 1}</div>
                <h3 className="font-['Outfit'] text-2xl font-bold text-white">{title}</h3>
                <p className="mt-4 leading-relaxed text-slate-300">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Roles() {
  return (
    <section id="roles" className="bg-slate-50 py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="font-['Outfit'] text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Three roles, <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">one shared feed</span>.
          </h2>
          <p className="mt-6 text-lg font-medium text-slate-600">Built specifically for the needs of each participant in the rescue chain.</p>
        </div>

        <div className="mt-20 grid gap-8 md:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.name} className="group rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-slate-300/50">
              <div className={`mb-6 inline-block rounded-xl bg-gradient-to-br ${r.color} p-4 text-white shadow-lg`}>
                {/* Generic icon placeholder */}
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="font-['Outfit'] text-2xl font-bold text-slate-900">{r.name}</h3>
              <p className="mt-2 text-sm font-semibold uppercase tracking-wider text-slate-500">{r.who}</p>
              <ul className="mt-8 space-y-4">
                {r.points.map((p) => (
                  <li key={p} className="flex gap-4">
                    <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${r.color} shadow-sm`}>
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="font-medium text-slate-700">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Impact() {
  const stats = [
    ['Deliveries completed', DEMO_IMPACT.deliveries, '+12%'],
    ['Active donors', DEMO_IMPACT.donors, '+5%'],
    ['Verified charities', DEMO_IMPACT.ngos, '+18%'],
  ]
  return (
    <section id="impact" className="relative overflow-hidden bg-emerald-900 py-32 text-white">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
      <div className="absolute top-0 right-0 h-[800px] w-[800px] -translate-y-1/2 translate-x-1/3 rounded-full bg-emerald-500/30 blur-[120px]" />
      
      <div className="relative mx-auto grid max-w-6xl gap-16 px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <h2 className="font-['Outfit'] text-xl font-bold uppercase tracking-widest text-emerald-300">Platform Impact</h2>
          <div className="mt-6 flex items-baseline gap-4">
            <span className="font-['Outfit'] text-7xl font-black tabular-nums tracking-tighter sm:text-9xl">
              {DEMO_IMPACT.kg.toLocaleString()}
            </span>
            <span className="text-3xl font-bold text-emerald-300">kg</span>
          </div>
          <p className="mt-6 text-2xl font-medium text-emerald-100/90">
            of perfectly good food rescued and delivered to those who need it most.
          </p>
        </div>
        
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
          {stats.map(([label, value, growth]) => (
            <div key={label} className="group relative overflow-hidden rounded-3xl border border-emerald-700/50 bg-emerald-800/50 p-8 backdrop-blur-sm transition-all hover:bg-emerald-700/50">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-400/10 to-emerald-500/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative flex items-center justify-between">
                <div>
                  <dt className="text-sm font-bold uppercase tracking-wider text-emerald-300">{label}</dt>
                  <dd className="mt-2 font-['Outfit'] text-4xl font-black tabular-nums tracking-tight">{value}</dd>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-emerald-400/20 px-3 py-1 text-sm font-bold text-emerald-300">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  {growth}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-slate-950 py-12 text-slate-400">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <div className="flex items-center gap-2 font-['Outfit'] text-xl font-bold text-white">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs">
            N
          </div>
          NaikiApp
        </div>
        <p className="text-sm font-medium">Built with purpose by FameByte Studio interns Iqra and Rida.</p>
        <p className="text-xs font-semibold text-slate-500">No payments collected. Web application demo.</p>
      </div>
    </footer>
  )
}

export default function App() {
  const now = useNow()
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-200 selection:text-emerald-900">
      <Header />
      <main>
        <Hero now={now} />
        <HowItWorks />
        <Roles />
        <Impact />
      </main>
      <Footer />
      
      {/* Required for the stagger animation in Hero */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  )
}