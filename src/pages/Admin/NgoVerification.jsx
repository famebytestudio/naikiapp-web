import RolePlaceholder from '../../components/RolePlaceholder'

/*
  Guarded placeholder. Verification is an admin action performed outside the
  browser - migration 0002 revokes update on ngo_details from authenticated
  users, so this screen will read the queue rather than write to it.
*/
export default function NgoVerification() {
  return (
    <RolePlaceholder
      title="NGO verifications"
      description="Charity registrations waiting on a decision, so an admin can approve or reject them and unlock the available-food feed."
    />
  )
}
