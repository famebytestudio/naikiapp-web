import Navbar from './Navbar'

/*
  Placeholder for a role surface that is guarded but not built yet.

  The route guard around this is the real feature - it is what proves a donor
  cannot reach the moderation queue. The screen inside it is deliberately thin, so whoever picks
  the page up next replaces this file's body rather than working around it.
*/
export default function RolePlaceholder({ title, description, children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl font-black tracking-tight text-slate-900">{title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">{description}</p>

        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-bold text-slate-800">This screen is not built yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            The route and its access rules are in place, so this page is reachable by the right role and
            nobody else.
          </p>
          {children}
        </div>
      </main>
    </div>
  )
}
