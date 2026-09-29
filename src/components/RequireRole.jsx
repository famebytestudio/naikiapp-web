import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { homeForRole } from '../utils/roles'
import { FullPageLoader } from './PageState'

/*
  Role guard. The role is read from the profile record, never from user metadata,
  and a user in the wrong place is sent to their own home rather than shown a
  screen they cannot use.

  `roles` is a list because a surface is not always exclusive to one role - an
  admin overview is reachable by an admin, and a shared page would list both.

  Role access is also enforced by the database policies; this guard keeps users
  in the right part of the application and is not a substitute for RLS.
*/
export default function RequireRole({ roles, children }) {
  const { isAuthenticated, loading, role } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader />

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  if (!roles.includes(role)) {
    // Replace, so the forbidden URL does not sit in history waiting for Back to
    // bounce them here again.
    return <Navigate to={homeForRole(role)} replace />
  }

  return children
}
