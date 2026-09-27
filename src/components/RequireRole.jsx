import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { homeForRole } from '../utils/roles'
import { FullPageLoader, PendingVerificationState } from './PageState'

/*
  Role guard. The role is read from the profile record, never from user metadata,
  and a user in the wrong place is sent to their own home rather than shown a
  screen they cannot use.

  `roles` is a list because a surface is not always exclusive to one role - an
  admin overview is reachable by an admin, and a shared page would list both.

  `requireVerifiedNgo` adds the second half of the NGO check. Holding the ngo
  role is not enough to browse available food: the charity also has to be
  verified, which is the donations_select_verified_ngo policy in migration 0003.
  Without that prop a 'pending' charity would reach the feed and simply see
  nothing, which reads as a bug rather than as a rule.

  The client guard is a convenience, not the control. Every one of these rules
  is enforced again by RLS, so removing this component would not open anything up.
*/
export default function RequireRole({ roles, requireVerifiedNgo = false, children }) {
  const { isAuthenticated, loading, role, ngo, ngoVerification } = useAuth()
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

  if (requireVerifiedNgo && ngoVerification !== 'verified') {
    return <PendingVerificationState verification={ngoVerification} organisation={ngo?.organisation} />
  }

  return children
}
