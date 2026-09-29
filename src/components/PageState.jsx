/*
  The three states every data-backed view needs. Built once here rather than
  inlined per page, so create, list and edit cannot drift into three slightly
  different spinners.
*/

function Panel({ children, className = '' }) {
  return (
    <div className={`rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function LoadingState({ label = 'Loading' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20" role="status" aria-live="polite">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      <p className="text-sm font-semibold text-slate-500">{label}</p>
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  return (
    <Panel role="alert">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <h2 className="mt-5 font-display text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">
        {error?.message ?? 'That request did not go through. Please try again.'}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600 active:scale-95"
        >
          Try again
        </button>
      )}
    </Panel>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <Panel>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2h7m5 0a2 2 0 002-2v-3a2 2 0 00-2-2h-7a2 2 0 00-2 2v3a2 2 0 002 2H7" />
        </svg>
      </div>
      <h2 className="mt-5 font-display text-xl font-bold text-slate-900">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </Panel>
  )
}

/*
  The two states that belong to a whole screen rather than to a panel of content,
  because they are what a route guard renders while it decides.

  They live here rather than inline in the guards so a page that also wants a
  full-screen loader reuses the same one instead of adding another variant.
*/

export function FullPageLoader({ label = 'Checking your session' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50" role="status" aria-live="polite">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      <p className="text-sm font-semibold text-slate-500">{label}</p>
    </div>
  )
}

