import { useMemo } from 'react'

import { useMyListings } from './useListings'
import { summariseImpact } from '../utils/impact'

/*
  All data fetching lives in hooks and pages render, per the architecture in
  AGENTS.md. This is the donor half of that rule: useImpact() exposes the
  aggregates behind /donor/impact.

  It deliberately does NOT issue a second query. An impact total is a function
  of the donor's own listings, and those rows are already in the cache under
  the listings.mine key that useMyListings() uses, so the aggregate is derived
  from that same entry rather than re-fetched. Two consequences worth keeping:

  1. Visiting /donor/impact after /donor/listings costs no extra request, and
     the two pages can never show numbers from different moments.

  2. Any mutation that already invalidates listingKeys.all - create, update,
     cancel, or an admin action landing through a refetch - refreshes the impact
     totals for free, because they are derived from the same query. There is no
     second cache key to remember to invalidate.

  When this becomes a real aggregate query against Postgres - a rollup rather
  than a sum over rows - this hook is the only thing that changes. The page
  reads .impact and does not know whether the numbers arrived from a sum in
  JavaScript or from a view.

  THE PARTNER BRANCH: the platform-wide dashboard is Rida's slice
  (PROJECT.md section 1). summariseImpact() in utils/impact.js is written to be
  reused over her own row set, and the anonymity contract that makes it safe to
  share is documented there. A public aggregate that wants to attribute a
  donation must join profiles in deliberately and apply the rule at that seam.
*/

export function useImpact() {
  const query = useMyListings()

  // Memoised on the query data so the totals are recomputed when the rows
  // change and not on every unrelated re-render of the page.
  const impact = useMemo(() => summariseImpact(query.data ?? []), [query.data])

  return { ...query, impact }
}
