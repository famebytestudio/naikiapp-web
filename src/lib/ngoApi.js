/*
  ============================================================================
  DEV-ONLY MOCK BACKEND - the charity-lookup half of the seam
  ============================================================================

  One function, one table, one file. ngoApi.js exists because ngo_details is a
  third domain the app reads but neither existing mock owned: authApi.js holds
  the identity store, listingsApi.js holds the donations store, and the charity
  record lives in both (the registration on ngo_details, the contact person on
  profiles).

  The authorization is the whole point of this module, and it is the mirror of
  the two policies added in supabase/migrations/0007_donor_claiming_ngo_visibility.sql:

      ngo_details_select_claiming_donor
      profiles_select_claiming_donor

  A donor may read the charity that claimed one of THEIR donations, and nothing
  else. Not every charity, not their own charity application, and not a charity
  that claimed a listing belonging to someone else.

  How that is enforced, and why it is not just "trust the argument":

  1. The claim is RE-DERIVED, not accepted. The caller passes a donation id, not
     an ngo id. The charity that comes back is the one the stored row actually
     points at, so passing someone else's listing id or forging claimed_by gets
     you nothing - the check reads the store, not the caller's word. This is the
     same discipline as findWritable() in listingsApi.js.

  2. The row is re-read through the donor's own authorized path. getById()
     applies canRead(), so an id the donor may not see comes back null here for
     the same reason it would come back null from a SELECT under RLS. Note that
     a VERIFIED CHARITY also passes canRead() for an available listing - hence
     the explicit donor_id test below, which is what makes this donor-only and
     matches the policy, which is scoped to the donor.

  3. No session, no answer. Anonymous callers get null rather than an error,
     because that is what a real SELECT under RLS returns: the row is invisible,
     not forbidden.

  A donor reading a charity's own record for a listing that is still 'available'
  is refused, and that is intended. Nothing has been claimed, so there is nobody
  to coordinate with, and a donor who could page through charity registrations
  would turn a pickup-coordination feature into a directory.

  SECURITY: none of this is security, exactly as in the other two mock modules.
  The store lives in localStorage and is editable from the devtools console.
  What this module buys is that the app's call sites are already shaped like the
  real thing, so the swap to a .from('ngo_details') query is a body change and
  not a redesign.
  ============================================================================
*/

import { getSession, readNgoAccount } from './authApi'
import { getById } from './listingsApi'

/*
  ---------------------------------------------------------------------------
  THE CLAIMING CHARITY
  ---------------------------------------------------------------------------

  Resolves the charity behind `donationId` for the signed-in donor.

  Returns null - meaning "not visible to you" - for every case where the answer
  should be withheld: no session, a listing that does not exist, a listing the
  caller cannot see, a listing belonging to a different donor, a listing nobody
  has claimed, and a claimed_by pointing at a charity that is no longer on file.

  The shape is deliberately flat and pre-joined. A real implementation gets the
  registration from ngo_details and the contact from profiles in two queries and
  stitches them; doing that here means the component renders one object and does
  not know it came from two tables.
*/
export async function getClaimingNgo(donationId) {
  if (!donationId) return null

  const session = getSession()
  if (!session) return null

  const listing = await getById(donationId)
  if (!listing) return null

  // getById() would also hand back a charity's view of an available listing, and
  // an admin's view of anything. The policy is narrower than either, so the
  // donor test is repeated here rather than inherited.
  if (listing.donor_id !== session.user.id) return null

  if (!listing.claimed_by) return null

  const account = readNgoAccount(listing.claimed_by)
  if (!account) return null

  return {
    id: account.ngo.id,
    profile_id: account.ngo.profile_id,
    organisation: account.ngo.organisation,
    // Not column-filtered. A real SELECT under RLS returns the whole
    // ngo_details row anyway, so the UI renders this from the same field rather
    // than pretending the column does not exist - see the note in 0007.
    registration_number: account.ngo.registration_number,
    verification: account.ngo.verification,
    // The contact person is on profiles, not ngo_details. profiles_select_claiming_donor
    // is what makes these two readable for a donor at all.
    contact_name: account.profile.full_name,
    contact_phone: account.profile.phone,
    claimed_at: listing.claimed_at,
  }
}
