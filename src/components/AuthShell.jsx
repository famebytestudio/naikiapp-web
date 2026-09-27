import { Link } from 'react-router-dom'

/*
  The frame both auth screens share: the wordmark, a heading, the form, and a
  link across to the other screen. Two screens with the same chrome is exactly
  the case where inlining it twice guarantees they drift apart.
*/
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
        <Link to="/" className="inline-flex items-center gap-2 font-display text-2xl font-black text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
            N
          </span>
          NaikiApp
        </Link>

        <h1 className="mt-8 font-display text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}

        <div className="mt-8">{children}</div>

        {footer && <div className="mt-8 border-t border-slate-100 pt-6 text-center text-sm text-slate-600">{footer}</div>}
      </div>
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
