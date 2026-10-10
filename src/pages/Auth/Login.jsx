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
      navigate(location.state?.from ?? homeForRole(session.profile.role), { replace: true })
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
          New to DastarKhan?{' '}
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
        <section className="demo-account-picker" aria-label="Fill demo account credentials">
          <p>Demo accounts <span>Fill credentials</span></p>
          <div className="demo-account-buttons">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillDemoAccount(account)}
                aria-label={`Fill ${ROLE_META[account.role]?.label ?? account.label} demo credentials`}
              >
                {ROLE_META[account.role]?.label ?? account.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </AuthShell>
  )
}
