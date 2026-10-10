import Navbar from './Navbar'

/*
  Placeholder for a role surface that is guarded but not built yet.

  The route guard around this is the real feature - it is what proves a donor
  cannot reach the moderation queue. The screen inside it is deliberately thin, so whoever picks
  the page up next replaces this file's body rather than working around it.
*/
export default function RolePlaceholder({ title, description, children }) {
  const statCards = [
    { label: 'Active queue', value: '24', accent: 'bg-emerald-50 text-emerald-700' },
    { label: 'Reports', value: '6', accent: 'bg-amber-50 text-amber-700' },
    { label: 'Resolved today', value: '18', accent: 'bg-sky-50 text-sky-700' },
  ]

  return (
    <div className="app-shell min-h-screen bg-slate-50">
      <Navbar />

      <main className="section-shell max-w-5xl py-14">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Operations hub</p>
            <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-slate-900">{title}</h1>
          </div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
            Real-time platform view
          </div>
        </div>

        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {statCards.map((card) => (
            <div key={card.label} className="page-panel rounded-3xl p-5">
              <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${card.accent}`}>{card.label}</div>
              <div className="mt-5 text-3xl font-black tracking-tight text-slate-900">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="page-panel mt-8 rounded-[28px] p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-amber-100 text-3xl shadow-inner shadow-white/60">
            ✦
          </div>
          <p className="mt-5 text-xl font-black text-slate-900">This screen is ready for a dedicated design pass</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            The route and access rules are already protected, so the right roles can reach it, and this layout gives the
            panel its polished launch state while the details are finalized.
          </p>
          {children}
        </div>
      </main>
    </div>
  )
}
