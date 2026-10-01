/*
  Moderation rules that both the admin screens and the data layer need, kept in
  one place so the queue cannot offer an action the database would refuse.

  The two that matter are canRemove() and isRemoved():

  - canRemove() mirrors the status list in the donations_update_admin_removal
    policy in supabase/migrations/0006. A listing stops being removable once
    the food has been collected, because from picked_up onward the row is real
    history and it is the only place the delivered weight is recorded. Letting a
    moderator delete it would quietly reduce the platform's impact total, which
    is the one number the project exists to report honestly.

  - isRemoved() reads the removal columns rather than a status, because
    removal is deliberately not a seventh status value - that contract is
    shared with the NGO-side branch and must not drift.

  REMOVAL_PRESETS are shortcuts into a free-text field, not an enum. An admin
  needs to write what is actually wrong with a listing, and a fixed list would
  make "other" the most useful answer available.
*/

const REMOVABLE = ['available', 'claimed']

export const REMOVAL_PRESETS = [
  { value: 'Not food, or unsafe to eat', hint: 'Expired or spoiled food offered as fresh' },
  { value: 'Fake or misleading listing', hint: 'Quantity, weight or condition does not match the description' },
  { value: 'Spam or scam', hint: 'Advertising, links, or a contact number that is not the donor' },
  { value: 'Abusive or discriminatory content', hint: 'Harassment, abuse, or content aimed at a group of people' },
  { value: 'Pickup point does not exist', hint: 'The address cannot be collected from' },
  { value: 'Duplicate of another listing', hint: 'The same food posted twice' },
  { value: 'Other', hint: 'Say what is wrong in your own words' },
]

/* The column is a check (char_length <= 200), so the UI refuses at the same point. */
export const REMOVAL_REASON_MAX = 200

export function canRemove(status) {
  return REMOVABLE.includes(status)
}

export function isRemoved(listing) {
  return Boolean(listing?.removed_at)
}

export function isDecided(verification) {
  return verification === 'verified' || verification === 'rejected'
}

/*
  Why a listing cannot be moderated or cancelled, as one sentence keyed on the
  actual status.

  This lives here rather than being written at each call site because the wrong
  version of it was already the bug: both listingsApi.js and this file used to
  say "this food has already been collected" for every non-removable status,
  which is only true of picked_up and delivered. A cancelled listing was refused
  on the grounds that a charity had collected food the donor had already pulled,
  and an expired one for a pickup that never happened. A moderator reading that
  cannot tell whether the button is broken or the queue has the wrong row, which
  is the outcome the rest of this module exists to prevent.

  So each closed status gets the reason that is actually true of it. A listing
  that no charity ever saw can still be left up for the record - it is not
  "unsafe", just closed - and saying so is more useful than inventing a
  collection that did not happen.
*/
export function closedReason(status) {
  switch (status) {
    case 'delivered':
      return 'Delivered food is reported history and cannot be moderated.'
    case 'picked_up':
      return 'This food has already been collected, so the listing cannot be moderated.'
    case 'expired':
      return 'The pickup window lapsed, so this listing is closed. Nothing to take down.'
    case 'cancelled':
      return 'The donor cancelled this listing, so it is closed. Nothing to take down.'
    default:
      return 'This listing is closed and cannot be moderated.'
  }
}

/*
  Why an action is unavailable, in words a moderator can act on. Rendering
  "disabled" with no explanation is how a queue ends up with a button nobody
  trusts.
*/
export function removalBlockReason(listing) {
  if (isRemoved(listing)) return 'Already removed. Restore it to put the listing back on the feed.'
  if (!canRemove(listing.status)) return closedReason(listing.status)
  return null
}
