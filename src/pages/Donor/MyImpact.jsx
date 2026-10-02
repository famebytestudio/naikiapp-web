import { Link } from 'react-router-dom'

import Navbar from '../../components/Navbar'
import { EmptyState, ErrorState, LoadingState } from '../../components/PageState'
import { useAuth } from '../../context/useAuth'
import { useImpact } from '../../hooks/useImpact'
import { formatKg } from '../../utils/formatKg'
import { STATUSES, STATUS_META } from '../../utils/listingStatus'

/*
  The donor half of the impact story: how much food you donated, and how many of
  those donations a charity actually took. Owned by this repo (PROJECT.md
  section 1).

  THE TWO HEADLINE NUMBERS, and why they are not the same number.

  "Total kilograms donated" is every live listing's estimated weight - what you
  put on the platform. "Donations delivered" is how many of those listings a
  charity collected and handed over. They are deliberately presented side by
  side rather than merged, because a donor who posts 100kg and delivers 10kg
  has not rescued 100kg, and a page that led with the offered figure alone
  would let that gap read as a success.

  So the page shows what was offered, what was delivered, and - as the measured
  counterpart to the estimate - the weight a charity actually recorded at
  handover. summariseImpact() in utils/impact.js keeps the offered side and the
  measured side on separate bases for the same reason, and the reason a total
  can never quietly include both.

  ANONYMITY: this page is one donor looking at their own totals and never names
  anybody else, and the aggregate it renders has no identity column to redact.
  The toggle is surfaced at the bottom anyway, because a donor who switched it
  on is checking that it is in force. The surface where anonymity actually has
  teeth is a shared or public aggregate - the partner branch's dashboard - and
  the rule it must honour is documented in utils/impact.js.
*/

function Stat({ label, value, hint, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-2 font-display text-3xl font-black tracking-tight ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>}
    </div>
  )
}

export default function MyImpact() {
  const { isAnonymous } = useAuth()
  const { impact, isLoading, isError, error, refetch } = useImpact()

  const breakdown = STATUSES.filter((status) => impact.byStatus[status] > 0)

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-3xl font-black tracking-tight text-slate-900">My impact</h1>
        <p className="mt-1 text-sm text-slate-600">
          The food you donated, and how much of it a charity took delivery.
        </p>

        {isLoading ? (
          <LoadingState label="Adding up your impact" />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} title="Could not load your impact" />
        ) : !impact.hasPosted ? (
          <div className="mt-6">
            <EmptyState
              title="No impact to show yet"
              description="Once you post surplus food, this page tracks how much you donated and how many donations a charity collects."
              action={
                <Link
                  to="/donor/listings/new"
                  className="inline-block rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 active:scale-95"
                >
                  Post your first listing
                </Link>
              }
            />
          </div>
        ) : (
          <>
            {/*
              The two requested metrics, given equal weight as headline tiles.
              Kept as two tiles rather than one combined figure because a single
              number would have to pick one basis, and either pick is misleading:
              summing estimates and handover weights together, or calling the
              estimate "rescued".
            */}
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <section className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white shadow-lg shadow-emerald-600/20">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-50/80">
                  Total kilograms donated
                </p>
                <p className="mt-2 font-display text-5xl font-black tracking-tight">
                  {formatKg(impact.offeredKg)}
                </p>
                <p className="mt-3 text-sm text-emerald-50">
                  Across {impact.postedCount} {impact.postedCount === 1 ? 'listing' : 'listings'}, using the
                  weight you estimated when you posted. Removed listings are not counted.
                </p>
              </section>

              <section className="rounded-3xl border border-teal-200 bg-white p-8 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Donations delivered
                </p>
                <p className="mt-2 font-display text-5xl font-black tracking-tight text-teal-700">
                  {impact.deliveredCount}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  {impact.deliveredCount === 0
                    ? 'None yet - a donation only counts here once a charity has collected it.'
                    : `Collected and handed over${
                        impact.postedCount > 0 ? `, ${impact.rescueRate}% of what you posted` : ''
                      }.`}
                </p>
              </section>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              {/*
                The measured counterpart to the estimate above. Same donations,
                counted by the weight the charity recorded at handover rather
                than the donor's guess - which is why it can legitimately be
                lower than the figure next to it.
              */}
              <Stat
                label="Measured at handover"
                value={formatKg(impact.rescuedKg, { precise: impact.rescuedKg < 10 })}
                hint="Weight charities recorded on collection"
                tone="text-teal-700"
              />
              <Stat
                label="Still moving"
                value={impact.inFlightCount}
                hint={
                  impact.inFlightCount > 0
                    ? 'Posted, claimed or collected but not yet delivered'
                    : 'Nothing in progress'
                }
                tone="text-amber-700"
              />
              <Stat
                label="Listings posted"
                value={impact.postedCount}
                hint={impact.removedCount > 0 ? `${impact.removedCount} removed by an admin` : 'Live listings'}
              />
            </div>

            {breakdown.length > 0 && (
              <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-display text-lg font-bold text-slate-900">Where your listings stand</h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {breakdown.map((status) => (
                    <li
                      key={status}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                        STATUS_META[status].tone
                      }`}
                    >
                      {STATUS_META[status].label}
                      <span className="opacity-60">{impact.byStatus[status]}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {isAnonymous ? (
              <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                You are donating anonymously, so charities see{' '}
                <span className="font-bold">Anonymous Donor</span> instead of your name. Your totals are
                yours alone - this page never names another donor. Change it any time from{' '}
                <Link to="/donor/listings" className="font-bold underline">
                  My listings
                </Link>
                .
              </p>
            ) : (
              <p className="mt-5 text-sm text-slate-500">
                Your name is shown to the charity that claims your food.{' '}
                <Link to="/donor/listings" className="font-bold text-emerald-700 hover:underline">
                  Donate anonymously
                </Link>{' '}
                if you would rather appear as Anonymous Donor.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
