import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { homeForRole } from '../utils/roles'
import { FullPageLoader } from './PageState'

/*
  Keeps a signed-in user out of the login and sign-up screens. Without it, an
  authenticated person who navigates to /auth/login would get a working form that
  signs them in as somebody else, and the role they land on afterwards would not
  match the session they already had.

  The destination is the page a guard originally turned them away from, carried in
  location state, falling back to the home for the role they already hold.

  It is exported rather than inlined in both auth screens because "am I already
  signed in, and where do I go if so" is one decision, and the moment it is
  written twice the two copies start to disagree.
*/
export default function RedirectIfSignedIn({ children }) {
  const { isAuthenticated, loading, role } = useAuth()
  const location = useLocation()

  // Deciding before the session is read would flash the login form at someone who
  // is in fact signed in.
  if (loading) return <FullPageLoader />

  if (isAuthenticated) {
    return <Navigate to={location.state?.from ?? homeForRole(role)} replace />
  }

  return children
}
