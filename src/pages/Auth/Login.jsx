import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import AuthShell, { AuthError, AuthField, AuthSubmit } from '../../components/AuthShell'
import RedirectIfSignedIn from '../../components/RedirectIfSignedIn'
import { useAuth } from '../../context/useAuth'
import { DEMO_ACCOUNTS } from '../../lib/authApi'
import { validateSignIn } from '../../utils/authValidation'
import { homeForRole, ROLE_META } from '../../utils/roles'

/*
  Email and password, against whichever auth backend AuthContext is wired to.

  A wrong-role visitor does not get an error here. If the guard sent them to
  /auth/login they are already signed in and RedirectIfSignedIn sends them on, and
  if they were bounced from someone else's route the `from` they carry is
  re-checked by that route's guard, which knows better than this screen which
  paths a role may use.
*/
export default function Login() {
  return (
    <RedirectIfSignedIn>
      <LoginForm />
    </RedirectIfSignedIn>
  )
}

function LoginForm() {
  const { signIn, isDemoBackend } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [pending, setPending] = useState(false)

  function update(field) {
    return (event) => {
      setValues((current) => ({ ...current, [field]: event.target.value }))
      // Clear the message for a field as soon as it is edited, rather than
      // making someone fix three errors before the first one stops showing.
      setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))
      setFormError(null)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const found = validateSignIn(values)
    setErrors(found)
    if (Object.keys(found).length) return

    setPending(true)
    try {
      const session = await signIn(values)
      // Optional-chained like every other read of session.profile, and for the
      // same reason AuthContext.jsx guards its own. A session with no profile row
      // is reachable the moment this mock is swapped for Supabase Auth - an auth
      // user created outside the signup trigger has no profiles row, so
      // session.profile is null and the unguarded dereference threw before it
      // could route anywhere. homeForRole already answers an unknown role with
      // the public landing page, so a profileless session lands somewhere safe
      // instead of failing at the exact moment the user expects to be signed in.
      navigate(location.state?.from ?? homeForRole(session?.profile?.role), { replace: true })
    } catch (error) {
      setFormError(error.message)
    } finally {
      setPending(false)
    }
  }

  function fillDemoAccount(account) {
    setValues({ email: account.email, password: account.password })
    setErrors({})
    setFormError(null)
  }

  return (
    <AuthShell
      title="Log in"
      subtitle="Post surplus food, claim it as a charity, or keep the platform running."
      footer={
        <>
          New to NaikiApp?{' '}
          <Link to="/auth/signup" className="font-bold text-emerald-700 hover:text-emerald-800">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <AuthError>{formError}</AuthError>

        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={update('email')}
          error={errors.email}
        />

        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={values.password}
          onChange={update('password')}
          error={errors.password}
        />

        <AuthSubmit pending={pending}>Log in</AuthSubmit>
      </form>

      {isDemoBackend && (
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Demo accounts</p>
          <p className="mt-1.5 text-xs leading-relaxed text-amber-800">
            There is no Supabase connection yet, so accounts live in this browser. Pick one to fill the
            form, then log in. The guards behave exactly as they will against the real backend.
          </p>

          <div className="mt-3 grid gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillDemoAccount(account)}
                className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-left transition hover:border-amber-400"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    {account.label}
                    <span className="ml-1.5 font-medium text-slate-500">{ROLE_META[account.role]?.label}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-amber-700">Use</span>
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{account.note}</span>
              </button>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-amber-800/80">
            Every account uses the password <span className="font-bold">{DEMO_ACCOUNTS[0].password}</span>.
          </p>
        </div>
      )}
    </AuthShell>
  )
}
