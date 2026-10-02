import { NGO_VERIFICATION_META } from '../utils/roles'

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

/*
  Shown to a charity that is not verified yet. This is a state rather than a
  refusal, so it explains the way through instead of bouncing. It mirrors the
  donations_select_verified_ngo policy, which hides available listings from
  anyone who is not 'verified'.
*/
export function PendingVerificationState({ verification, organisation, reviewNote }) {
  const meta = NGO_VERIFICATION_META[verification] ?? NGO_VERIFICATION_META.pending

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-6">
        <Panel>
          <span className={`inline-block rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${meta.tone}`}>
            {meta.label}
          </span>

          <h1 className="mt-5 font-display text-2xl font-black tracking-tight text-slate-900">
            {verification === 'rejected' ? 'Your charity is not verified' : 'Your registration is being checked'}
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">{meta.blurb}</p>

          {/*
            The reason an admin was required to write, shown to the charity that
            has to act on it. VerificationCard makes a rejection note mandatory
            precisely because "not approved" on its own is not something a
            charity can act on or appeal - so without this the admin writes
            something the applicant can never read, and the generic "contact the
            platform team" is all they get. Reviewed verbatim rather than
            re-worded: the admin chose those words for this charity.
          */}
          {verification === 'rejected' && reviewNote && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-700">What the reviewer said</p>
              <p className="mt-2 text-sm leading-relaxed text-rose-900">{reviewNote}</p>
            </div>
          )}

          {organisation && (
            <p className="mt-4 text-sm font-semibold text-slate-700">
              Registered as <span className="text-slate-900">{organisation}</span>
            </p>
          )}

          <p className="mt-6 border-t border-slate-100 pt-5 text-xs leading-relaxed text-slate-500">
            Browsing available food is limited to verified charities, which is what keeps unsafe or
            misrepresented pickups off the platform. Sign out and back in at any time to check on the
            status.
          </p>
        </Panel>
      </div>
    </div>
  )
}
