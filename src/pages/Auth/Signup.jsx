import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import AuthShell, { AuthError, AuthField, AuthSubmit } from '../../components/AuthShell'
import RedirectIfSignedIn from '../../components/RedirectIfSignedIn'
import { useAuth } from '../../context/useAuth'
import { validateSignUp } from '../../utils/authValidation'
import { homeForRole, isRole } from '../../utils/roles'

/*
  Two account types, because those are the only two a person can create for
  themselves.

  Admin is not an option, and that is not a UI oversight - it is the rule. The
  role column on profiles is not writable by the account that owns the row (see
  the column-level grant in migration 0001), so there is no request this form
  could send that would create an admin, and authApi throws if one is attempted.
  Platform staff are promoted out of band.

  Charities can browse and claim available food as soon as they create an
  account.
*/
const ACCOUNT_TYPES = [
  {
    value: 'donor',
    label: 'I have surplus food',
    blurb: 'Restaurants, wedding halls, grocers, households.',
  },
  {
    value: 'ngo',
    label: 'I represent a charity',
    blurb: 'Browse and claim available food for your community.',
  },
]

const EMPTY = {
  full_name: '',
  organisation: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'donor',
}

export default function Signup() {
  return (
    <RedirectIfSignedIn>
      <SignupForm />
    </RedirectIfSignedIn>
  )
}

function SignupForm() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // Lets the landing page's "Register Charity" button land on this form with the
  // charity option already chosen. Anything unrecognised falls back to donor,
  // because an unvalidated query string must never be able to pick a role.
  const requested = searchParams.get('role')
  const [values, setValues] = useState({ ...EMPTY, role: isRole(requested) ? requested : 'donor' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [pending, setPending] = useState(false)

  const isNgo = values.role === 'ngo'

  function update(field) {
    return (event) => {
      setValues((current) => ({ ...current, [field]: event.target.value }))
      setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))
      setFormError(null)
    }
  }

  function chooseRole(next) {
    setValues((current) => ({ ...current, role: next }))
    setErrors((current) => ({ ...current, role: undefined, organisation: undefined }))
    setFormError(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const found = validateSignUp(values)
    setErrors(found)
    if (Object.keys(found).length) return

    setPending(true)
    try {
      const session = await signUp(values)
      navigate(location.state?.from ?? homeForRole(session.profile.role), { replace: true })
    } catch (error) {
      setFormError(error.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell
      title="Create an account"
      subtitle="One account, one role. You can post food or claim it, not both."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/auth/login" className="font-bold text-emerald-700 hover:text-emerald-800">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <AuthError>{formError}</AuthError>

        <fieldset>
          <legend className="text-sm font-bold text-slate-800">What are you here to do?</legend>
          <div className="mt-2 grid gap-2">
            {ACCOUNT_TYPES.map((type) => (
              <label
                key={type.value}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                  values.role === type.value
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={type.value}
                  checked={values.role === type.value}
                  onChange={() => chooseRole(type.value)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
                />
                <span className="text-sm">
                  <span className="block font-bold text-slate-900">{type.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-600">{type.blurb}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.role && <p className="mt-1.5 text-xs font-semibold text-rose-600">{errors.role}</p>}
        </fieldset>

        <AuthField
          id="full_name"
          label="Your name"
          autoComplete="name"
          placeholder="Imran Shah"
          value={values.full_name}
          onChange={update('full_name')}
          error={errors.full_name}
        />

        <AuthField
          id="organisation"
          label={isNgo ? 'Charity name' : 'Organisation (optional)'}
          placeholder={isNgo ? 'Lahore Relief Trust' : 'Shah Caterers'}
          value={values.organisation}
          onChange={update('organisation')}
          error={errors.organisation}
          hint={isNgo ? 'The name your charity uses publicly.' : undefined}
        />

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
          id="phone"
          label="Phone (optional)"
          type="tel"
          autoComplete="tel"
          placeholder="0300 1234567"
          value={values.phone}
          onChange={update('phone')}
          error={errors.phone}
          hint="Not published on your listings. Pickup contact details are entered per listing."
        />

        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={values.password}
          onChange={update('password')}
          error={errors.password}
        />

        <AuthField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Type it again"
          value={values.confirmPassword}
          onChange={update('confirmPassword')}
          error={errors.confirmPassword}
        />

        <AuthSubmit pending={pending}>Create account</AuthSubmit>

        <p className="text-xs leading-relaxed text-slate-500">
          Platform staff accounts are created by the NaikiApp team rather than signed up for, so there is
          no admin option here.
        </p>
      </form>
    </AuthShell>
  )
}
