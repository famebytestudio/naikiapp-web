import { STATUSES } from './listingStatus'
import { isRemoved } from './moderation'

/*
  ============================================================================
  IMPACT AGGREGATION
  ============================================================================

  The arithmetic behind every "kg rescued" number, as a pure function over a
  donor's listings.

  It lives in utils/ rather than inside useImpact.js for two reasons. It is
  derivation rather than fetching, and AGENTS.md puts pure derivation helpers
  here. And the partner branch's platform-wide dashboard needs the same
  arithmetic over a different set of rows, so the rule is written once and
  imported on both sides instead of being reinvented and drifting apart.

  ---------------------------------------------------------------------------
  THE ANONYMITY RULE
  ---------------------------------------------------------------------------

  An aggregate is the hardest place to keep a donor's identity out, because
  aggregates are precisely the thing that gets shared: a dashboard, a
  screenshot, a pitch. AGENTS.md requires an anonymous donor to read as
  "Anonymous Donor" in impact views as well as in NGO views, and PROJECT.md
  section 4 requires the policies to hide donor identity from public impact
  views.

  The enforcement here is structural rather than a redaction step, and that is
  a deliberate choice. This function returns counters and kilograms and has no
  identity column at all, so there is no name present to leak - a caller cannot
  forget to redact a field that does not exist. A shared or public aggregate
  that DOES want to attribute a donation has to join profiles in explicitly and
  re-apply the rule at that seam; this module is where that decision gets made
  deliberately rather than by accident.

  A donor's own impact page is the benign case: it shows one donor their own
  totals and never names anybody else, so the rule has nothing to enforce
  there. The page still surfaces the preference, because a donor who has
  switched anonymity on deserves to see that it is in force.
  ============================================================================
*/

/*
  The weight a listing actually contributed.

  A delivered row carries the figure the charity recorded at handover
  (delivered_kg), which is the only real measurement in the system and the one
  that should be reported. Everything else is still an estimate, so
  estimated_kg stands in. This is the same precedence MyListings.jsx uses for
  its header total, kept identical on purpose - two rules for "how much did
  this donation weigh" is how a dashboard and a list page start disagreeing.

  Garbage in, zero out rather than NaN: a missing or unparseable estimate must
  not turn a total into NaN, which would render as "NaN kg" on a page whose
  whole job is to report a trustworthy number.
*/
function weightOf(listing) {
  const kg = Number(listing?.delivered_kg ?? listing?.estimated_kg ?? 0)
  return Number.isFinite(kg) && kg > 0 ? kg : 0
}

/*
  The estimated weight of a listing, for the offered side of the ledger.

  Deliberately never delivered_kg. A field has to keep one basis or it is
  quietly reporting a sum of two different things: the estimates and the
  handover weights are measured differently, and mixing them makes offeredKg
  smaller every time a listing is delivered, which reads as "the donor
  retroactively offered less" when it means nothing of the sort. So rescuedKg
  is the measured figure throughout, offeredKg is the estimated one
  throughout, and the two are never added together or divided into a rate.
*/
function estimatedKgOf(listing) {
  const kg = Number(listing?.estimated_kg ?? 0)
  return Number.isFinite(kg) && kg > 0 ? kg : 0
}

/*
  Summarises one donor's listings.

  A removed listing is excluded from every total and counted separately
  instead. Removal is not a status value (see utils/moderation.js) so it does
  not show up in the byStatus tally, and a listing an admin pulled for being
  spam or unsafe must not be counted as food this donor offered. Excluding it
  silently would be the dishonest option here: the page says "not food, or
  unsafe to eat" was never rescued food, and a total that quietly included it
  would contradict the moderation queue that removed it.

  offeredKg is every live listing's ESTIMATE, and rescueRate is the share of
  what a donor offered that a charity actually took. rescueRate is a count
  ratio (delivered listings over posted listings) rather than a weight ratio,
  and deliberately so: dividing rescuedKg by offeredKg would divide a recorded
  handover weight by a set of estimates and produce a precise-looking
  percentage built on two incompatible figures.
*/
export function summariseImpact(listings = []) {
  const byStatus = {}
  for (const status of STATUSES) byStatus[status] = 0

  let rescuedKg = 0
  let offeredKg = 0
  let postedCount = 0
  let deliveredCount = 0
  let removedCount = 0

  for (const listing of listings) {
    if (listing?.status in byStatus) byStatus[listing.status] += 1

    if (isRemoved(listing)) {
      removedCount += 1
      continue
    }

    postedCount += 1
    offeredKg += estimatedKgOf(listing)

    if (listing.status === 'delivered') {
      deliveredCount += 1
      rescuedKg += weightOf(listing)
    }
  }

  // Still moving: posted, claimed, or collected but not yet handed over. This
  // is the number that tells a donor their post is not just sitting there
  // unnoticed, which is the question this page is usually opened to answer.
  const inFlightCount = byStatus.available + byStatus.claimed + byStatus.picked_up

  return {
    rescuedKg,
    offeredKg,
    postedCount,
    deliveredCount,
    removedCount,
    inFlightCount,
    byStatus,
    // "Did any of this actually get rescued", as opposed to offered. Drives
    // the empty state, which is a different message from "nothing posted yet".
    hasRescued: deliveredCount > 0,
    hasPosted: postedCount > 0,
    rescueRate: postedCount > 0 ? Math.round((deliveredCount / postedCount) * 100) : 0,
  }
}
