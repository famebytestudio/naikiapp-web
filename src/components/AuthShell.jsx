import Navbar from './Navbar'
import AuthRescueAnimation from './AuthRescueAnimation'

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <Navbar />

      <main className="auth-main">
        <section className="auth-story" aria-labelledby="auth-story-title">
          <div className="auth-story-copy">
            <span className="auth-eyebrow"><span aria-hidden="true" /> Food rescue, made practical</span>
            <h2 id="auth-story-title">Good food can do more.</h2>
            <p>Bring surplus food and local charities together through one simple, thoughtful flow.</p>
          </div>

          <AuthRescueAnimation />

          <div className="auth-story-points">
            <span><b>01</b> Share surplus food</span>
            <span><b>02</b> Connect with a charity</span>
            <span><b>03</b> Follow each rescue</span>
          </div>
        </section>

        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-card">
            <span className="auth-panel-kicker">Welcome to DastarKhan</span>
            <h1 id="auth-title" className="auth-title">{title}</h1>
            {subtitle && <p className="auth-subtitle">{subtitle}</p>}

            <div className="auth-form-content">{children}</div>

            {footer && <div className="auth-card-footer">{footer}</div>}
          </div>
        </section>
      </main>
    </div>
  )
}

/*
  A labelled input with room for its own error message. `id` has to be passed
  rather than derived so the <label> can point at it - an unlabelled input is
  unusable with a screen reader, and these are the two forms on the site where
  that matters most.
*/
export function AuthField({ id, label, type = 'text', value, onChange, error, hint, autoComplete, ...rest }) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-slate-800">
        {label}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
          error
            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
            : 'border-slate-200 focus:border-emerald-400 focus:ring-emerald-100'
        }`}
        {...rest}
      />

      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-semibold text-rose-600">
          {error}
        </p>
      )}
    </div>
  )
}

export function AuthError({ children }) {
  if (!children) return null

  return (
    <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700" role="alert">
      {children}
    </p>
  )
}

export function AuthSubmit({ pending, children }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-slate-900 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-slate-900"
    >
      {pending ? 'Just a moment…' : children}
    </button>
  )
}
