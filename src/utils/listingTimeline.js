/*
  The status timeline a donor reads to answer "where is my food right now".

  On a real database this comes from status_log (migration 0004), which is
  append-only and written by triggers - so it is a table to select from, with one
  row per transition, in order, and it cannot be edited by anybody including the
  client.

  There is no status_log in the mock, so the steps are derived here from the
  timestamps already on the donation row: created_at, claimed_at, picked_up_at,
  delivered_at, cancelled_at. Every column the trigger would have written a row
  for is already a column on donations, so the derivation is not a guess about
  what happened - it is the same facts, read from a different place. Swap the
  body of this function for a `.from('status_log')` select and no component
  changes.

  Two honest gaps, both handled rather than hidden:

  - 'expired' has no timestamp column. The expiry transition is performed by the
    expire-listings Edge Function, which writes the status_log row and nothing
    else, so there is no column on donations to derive a time from. The entry is
    still emitted, with at: null, and the UI prints "time not recorded". A real
    status_log select would fill it in, and this is the one place the two
    implementations visibly differ.

  - A row is only ever walked forward. A listing that somehow carries a later
    timestamp without the status to match (a cancelled listing that was claimed
    first) shows both, which is a truer history than quietly hiding one.

  Both of those are the same rule, and it is applied once at the bottom of
  buildTimeline rather than special-cased per status: the row's own status is
  the fact, and the timestamps are only how we date it. A status missing from
  the derived history gets appended with at: null, so the timeline can never end
  on a step the listing has already left behind.
*/

import { formatDateTime } from './formatDate'
import { statusLabel } from './listingStatus'
import { formatKg } from './formatKg'

/*
  The steps, in workflow order. Each is skipped unless its timestamp is present,
  so an available listing shows one entry and a delivered one shows all four.
  `at` is the column that proves the step happened.
*/
const STEPS = [
  { status: 'available', at: 'created_at', detail: 'Posted and visible to verified charities.' },
  { status: 'claimed', at: 'claimed_at', detail: 'A charity claimed this food and is planning the pickup.' },
  { status: 'picked_up', at: 'picked_up_at', detail: 'Collected from the pickup point.' },
  { status: 'delivered', at: 'delivered_at', detail: 'Delivered to people who needed it.' },
  { status: 'cancelled', at: 'cancelled_at', detail: 'The donor called this listing off.' },
  // No timestamp column exists for the expiry transition - see the note above.
  { status: 'expired', at: null, detail: 'The pickup window lapsed, so the listing expired.' },
]

/*
  The delivered weight is part of the story, not a separate fact, so it rides on
  the delivered step. Falls back to nothing rather than to estimated_kg: a
  timeline entry that reads "delivered 15kg" when 15kg was only ever an estimate
  is the kind of small untruth that compounds into a wrong impact figure.
*/
function deliveredDetail(listing) {
  if (listing.delivered_kg == null) return 'Delivered to people who needed it.'
  return `Delivered to people who needed it. ${formatKg(listing.delivered_kg, { precise: true })} counted towards your impact.`
}

export function buildTimeline(listing) {
  if (!listing) return []

  const entries = []

  for (const step of STEPS) {
    if (step.status === 'delivered' && listing.status === 'delivered' && listing.delivered_at) {
      entries.push({ ...step, detail: deliveredDetail(listing), at: listing.delivered_at })
      continue
    }

    // Handled by the reconciliation at the bottom rather than here, because
    // 'expired' is not the only status that can arrive without its timestamp.
    if (step.status === 'expired') continue

    if (!listing[step.at]) continue
    entries.push({ ...step, at: listing[step.at] })
  }

  /*
    The row's own status is the fact; the timestamps are only how we date it. If
    the status is not the last thing we derived, append it rather than letting
    the timeline stop early.

    Two shapes reach here, and one of them is a bug worth naming. A cancelled
    listing that was claimed first has two genuine steps and legitimately ends on
    'claimed' - the walk-forward behaviour documented at the top. A cancelled
    listing with no cancelled_at is a row that says one thing and timestamps
    another, and donations_cancel_own permits it, because that policy checks
    status = 'cancelled' and nothing else. Before this, such a row rendered a
    Cancelled badge above a timeline whose last line read "Posted and visible to
    verified charities" - telling a donor their cancelled food was still up.

    Both are answered the same way, and the timestamp is reported honestly rather
    than invented: the entry appears with at: null, which StatusTimeline already
    prints as "Time not recorded".
  */
  const last = entries[entries.length - 1]
  if (!last || last.status !== listing.status) {
    const step = STEPS.find((candidate) => candidate.status === listing.status)
    if (step) {
      const at = step.at ? (listing[step.at] ?? null) : null
      entries.push({ ...step, at })
    }
  }

  return entries
}

/*
  The step a listing is sitting on right now, or null. A row is only "sitting" on
  a step if that step is the last one in the derived history, which is what makes
  this correct for a delivered row whose last timestamp is delivered_at.
*/
export function currentStep(entries) {
  return entries.length ? entries[entries.length - 1] : null
}

/*
  True while a listing is still moving and a donor is plausibly watching for the
  next transition. Terminal statuses never change again, so polling them is
  pure waste. Drives the refetch interval in useListing().
*/
export function isStillMoving(status) {
  return status === 'available' || status === 'claimed' || status === 'picked_up'
}

/* One-line human summary for the timeline header. */
export function timelineSummary(entries) {
  const step = currentStep(entries)
  if (!step) return null

  if (step.status === 'expired') return 'Expired — the pickup window lapsed'
  if (!step.at) return statusLabel(step.status)

  return `${statusLabel(step.status)} · ${formatDateTime(step.at)}`
}
