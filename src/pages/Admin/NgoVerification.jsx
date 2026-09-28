import { useMemo } from 'react'

import Navbar from '../../components/Navbar'
import { EmptyState, ErrorState, LoadingState } from '../../components/PageState'
import VerificationCard from '../../components/VerificationCard'
import { useAdminAccounts, useVerificationDecision } from '../../hooks/useAdmin'
import { isDecided } from '../../utils/moderation'

/*
  The charity verification queue.

  Two lists rather than one filter: what is waiting on a decision, and what has
  already been decided. An admin opening this page has one job - clear the
  queue - and burying six approved charities above two pending ones makes that
  job slower every week the platform runs.

  The decided list is not decoration. A rejection is something an admin will be
  asked to defend weeks later ("why was this charity turned down?"), so the
  decision, who made it and the reason given are all on the card.

  Approving here unblocks that charity's feed access, which is the whole point of
  the step: donations_select_verified_ngo in migration 0003 grants the feed on
  verification = 'verified' and nothing else.
*/
export default function NgoVerification() {
  const { data: accounts, isLoading, isError, error, refetch } = useAdminAccounts()
  const decision = useVerificationDecision()

  const { pending, decided, decidedById } = useMemo(() => {
    const rows = (accounts ?? [])
      .filter((account) => account.ngo)
      .map((account) => ({ ...account.ngo, contact_name: account.profile?.full_name, contact_phone: account.profile?.phone }))

    return {
      pending: rows.filter((row) => row.verification === 'pending'),
      decided: rows.filter((row) => isDecided(row.verification)).sort((a, b) => new Date(b.verified_at ?? 0) - new Date(a.verified_at ?? 0)),
      decidedById: new Map((accounts ?? []).map((account) => [account.id, account.profile?.full_name])),
    }
  }, [accounts])

  function handleDecide(payload) {
    return decision.mutateAsync(payload)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-black tracking-tight text-slate-900">NGO verifications</h1>
            <p className="mt-1 text-sm text-slate-600">
              {isLoading
                ? 'Loading registrations…'
                : `${pending.length} waiting on a decision · ${decided.length} decided`}
            </p>
          </div>
        </div>

        {isLoading ? (
          <LoadingState label="Loading registrations" />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} title="Could not load the verification queue" />
        ) : (
          <>
            <section className="mt-8">
              <h2 className="font-display text-lg font-bold text-slate-900">Waiting on a decision</h2>
              <p className="mt-1 text-sm text-slate-600">
                A charity cannot browse or claim food until it is approved. Check the registration
                number against the issuing department before you approve.
              </p>

              <div className="mt-4">
                {pending.length === 0 ? (
                  <EmptyState
                    title="Nothing waiting"
                    description="Every charity that has registered has been approved or rejected. New registrations land here on their own."
                  />
                ) : (
                  <div className="grid gap-5">
                    {pending.map((application) => (
                      <VerificationCard
                        key={application.id}
                        application={application}
                        onDecide={handleDecide}
                        isDeciding={decision.isPending && decision.variables?.id === application.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            {decided.length > 0 && (
              <section className="mt-12">
                <h2 className="font-display text-lg font-bold text-slate-900">Decided</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Kept for the record. A decision can be changed here if one turns out to be wrong.
                </p>

                <div className="mt-4 grid gap-5">
                  {decided.map((application) => (
                    <VerificationCard
                      key={application.id}
                      application={application}
                      onDecide={handleDecide}
                      decidedByName={decidedById.get(application.verified_by) ?? null}
                      isDeciding={decision.isPending && decision.variables?.id === application.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {decision.isError && (
              <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700" role="alert">
                {decision.error.message}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
