import RolePlaceholder from '../../components/RolePlaceholder'

/*
  Guarded placeholder. Rida's slice - see PROJECT.md section 1.

  Note this route is gated on the ngo role but not on verification: a charity
  cannot have claimed anything before it was verified, so there is nothing here
  to protect. The feed, which does gate on it, is the route that needs the
  stronger check.
*/
export default function MyClaims() {
  return (
    <RolePlaceholder
      title="My claims"
      description="Food this charity has claimed, and how far each delivery has progressed through claimed, picked up and delivered."
    />
  )
}
