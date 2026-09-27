import RolePlaceholder from '../../components/RolePlaceholder'

/*
  Guarded placeholder. An admin sees every listing in every state, which is what
  donations_select_admin in migration 0003 grants.
*/
export default function ListingsOverview() {
  return (
    <RolePlaceholder
      title="All listings"
      description="Every listing across the platform in any state, for support requests and for removing anything abusive."
    />
  )
}
