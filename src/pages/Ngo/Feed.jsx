import RolePlaceholder from '../../components/RolePlaceholder'

/*
  Guarded placeholder. Access rules live in App.jsx (ngo role, plus verified,
  which is why an unapproved charity sees the verification notice instead of
  this page). The feed itself is Rida's slice - see PROJECT.md section 1.
*/
export default function Feed() {
  return (
    <RolePlaceholder
      title="Available food"
      description="Every listing that is still available, soonest to expire first, so a charity picks up what is most urgent rather than what is newest."
    />
  )
}
