import { createContext, useContext } from 'react'

/*
  The auth context object and its hook live here rather than in
  AuthContext.jsx, which exports only the provider component. Keeping the two
  apart is what lets a page import a hook without pulling a component into a
  module that exports non-components.

  The value is documented in AuthContext.jsx: user, profile, ngo, role,
  isAuthenticated, isAnonymous, ngoVerification, loading, and
  signIn/signUp/signOut/updateProfile.
*/
export const AuthContext = createContext(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
