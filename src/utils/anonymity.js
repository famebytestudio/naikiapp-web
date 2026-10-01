/*
  The anonymity rule, in one place.

  A donor can set is_anonymous on their profile, and every surface that shows a
  donor to somebody else has to honour it. That is easy to get wrong by accident
  because each surface needs the name for a different reason - a navbar, a
  moderation queue, a charity's pickup list - so the temptation is to write the
  check inline each time. Four implementations had already drifted apart, so this
  module exists to give them one answer.

  The rule itself:

    An anonymous donor reads as "Anonymous Donor". Everywhere. With one
    deliberate exception, documented below.

  ---------------------------------------------------------------------------
  What the database guarantees, and what it cannot
  ---------------------------------------------------------------------------

  A row-level policy cannot hide a single column. There is no way to say "this
  donor's name is private" to an RLS USING clause, because the clause decides
  which ROWS you get, not which COLUMNS of each. Every donor's name lives in the
  same column of the same row.

  So the name an NGO actually reads - donations.contact_name - is masked before
  it is ever stored, by a BEFORE INSERT trigger in migration 0013. That is the
  important half, and it lives in the database rather than in this file on
  purpose: a value that is already masked cannot be leaked by any read path,
  whichever client asks for it and however many clients exist later. A check in
  React is one component's good behaviour; a check in a trigger is the platform's.

  Two consequences worth knowing before you touch either layer:

    - It cannot read the flag. donations_select_verified_ngo lets a verified
      charity read available listings, but no policy lets a charity read a
      donor's profiles row at all. So the client could not have honoured this
      even if it wanted to - it does not know whether the donor is anonymous.
      That is the reason the rule has to live in SQL and not here.

    - Masking on write is irreversible per listing. If a donor turns anonymity
      off again, listings published while it was on keep reading "Anonymous
      Donor"; the real name was never written, so there is nothing to restore.
      The trigger re-masks every open listing when the toggle flips on, but it
      deliberately does not walk history backwards. That is the safe direction
      to be wrong in: a charity that respected the preference should not be
      retroactively handed the name it was not given.

  contact_phone is never masked. The donor's own copy on AnonymityToggle says
  "your contact details are still shared so pickup can happen", and a van that
  cannot phone the kitchen does not arrive.
*/

/* The one string. Every surface that renders a hidden donor renders this. */
export const ANONYMOUS_DONOR_LABEL = 'Anonymous Donor'

/*
  True when this donor record has asked not to be named.

  Takes the record rather than a boolean so a caller cannot pass the flag for
  the wrong person, and tolerates a missing record - a donor that did not load is
  not a donor that opted in, so the answer is false and the name is shown.
  Showing a name to someone who was never asked is the less harmful of the two
  mistakes here, and a null check that defaulted the other way would fail open.
*/
export function isAnonymousDonor(donor) {
  return Boolean(donor?.is_anonymous)
}

/*
  What this donor is called on a surface that shows them to other people.

  This is the charity-facing answer and the shared one. An admin queue is a
  different question with a different answer - see donorNameForAdmin.
*/
export function donorDisplayName(donor) {
  if (isAnonymousDonor(donor)) return ANONYMOUS_DONOR_LABEL
  return donor?.full_name ?? ANONYMOUS_DONOR_LABEL
}

/*
  The admin exception, stated rather than smuggled.

  A moderation queue that reads "Anonymous Donor" cannot act on a repeat
  offender, cannot call anybody about a disputed address, and cannot warn a
  donor that their third listing this week is a pattern. So an admin sees the
  real name - and ModerationCard renders the anonymity preference next to it, so
  the override is visible on the card rather than being an invisible exception.

  This is only safe because the surface is genuinely admin-only. On a real
  database donations_select_admin and profiles_select_own both test
  role = 'admin', so no donor and no charity can reach it. The function takes
  the flag as a parameter rather than deciding for itself, which makes the
  override something a caller has to ask for on purpose instead of something
  every caller has to remember to switch off.
*/
export function donorNameForAdmin(donor) {
  return donor?.full_name ?? 'Unknown donor'
}

/*
  The contact name a listing publishes, which is what a charity reads when
  coordinating a pickup.

  On a real database this is already masked by the 0013 trigger before the row
  is stored, so by the time it arrives here it is either the donor's chosen
  name or ANONYMOUS_DONOR_LABEL and there is nothing left to decide. The check is
  still here, and should stay, because the mock's fixtures predate the trigger
  and because a row written before it was applied would otherwise keep showing a
  name. Belt and braces on the one surface where the alternative is a privacy
  failure rather than a wrong label.
*/
export function publishedContactName(listing, donor) {
  if (listing?.contact_name === ANONYMOUS_DONOR_LABEL) return ANONYMOUS_DONOR_LABEL
  if (isAnonymousDonor(donor)) return ANONYMOUS_DONOR_LABEL
  return listing?.contact_name ?? ANONYMOUS_DONOR_LABEL
}
