/*
  Form validation for the two auth screens. Pure functions returning a map of
  field name to message, so the screens stay declarative:

      const errors = validateSignUp(values)
      if (Object.keys(errors).length) return setErrors(errors)

  Kept out of the components so the same rules can be reused by an admin
  "edit profile" form later without being retyped.

  Role authorization is enforced by src/lib/authApi.js and, on a real database,
  by the grants and policies in the migrations.
*/

import { isRole } from './roles'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD_LENGTH = 8

export function validateEmail(value) {
  const email = value?.trim() ?? ''
  if (!email) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(email)) return 'That does not look like an email address.'
  return null
}

export function validatePassword(value) {
  if (!value) return 'Enter your password.'
  if (value.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  return null
}

export function validateSignIn(values) {
  const errors = {}
  const email = validateEmail(values.email)
  const password = validatePassword(values.password)

  if (email) errors.email = email
  if (password) errors.password = password

  return errors
}

/*
  Mirrors the shape of the signup form. `role` is constrained to the two roles a
  person may actually pick for themselves; admin is not offered, and the
  isRole() check below means a hand-crafted request cannot smuggle it in either
  (authApi throws on it, but failing early with a field message is kinder).
*/
export function validateSignUp(values) {
  const errors = {}
  const name = values.full_name?.trim() ?? ''

  if (!name) errors.full_name = 'Enter your name.'
  else if (name.length < 2) errors.full_name = 'That name looks too short.'

  const organisation = values.organisation?.trim() ?? ''
  if (values.role === 'ngo' && !organisation) {
    errors.organisation = 'Enter the name your charity registers under.'
  }

  const email = validateEmail(values.email)
  if (email) errors.email = email

  const password = validatePassword(values.password)
  if (password) errors.password = password

  if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'The two passwords do not match.'
  }

  if (!isRole(values.role) || values.role === 'admin') {
    errors.role = 'Choose whether you are donating food or registering a charity.'
  }

  return errors
}
