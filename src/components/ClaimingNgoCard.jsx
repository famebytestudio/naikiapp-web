/*
  The charity that claimed a listing, as the donor sees it.

  This is the panel that answers "who is coming to collect my food and how do I
  reach them". It is donor-facing and reads from the two policies added in
  migration 0007 - see src/lib/ngoApi.js for why the claim is re-derived rather
  than taken from the caller.

  The three states it can be in:

    loading     the charity lookup is in flight
    open        no charity has claimed this yet, which is the normal state of an
                available listing - explained rather than left blank
    closed      the listing ended with no charity attached, so the panel says so
                instead of repeating the open-state copy
    claimed     the charity, with a verification badge and a contact person

  A null lookup with a claimed listing is deliberately NOT treated as unclaimed.
  That combination means the row points at a charity record the donor may not
  read, or one that no longer exists, and silently showing "no charity has claimed
  this" would be a lie about a listing the donor knows was claimed. It gets its
  own message.

  The donor's own anonymity is not in tension with anything here. It governs how
  the DONOR is shown to charities, not what the donor may learn about the charity
  collecting from them - and the charity's phone number is exactly what the donor
  needs in order to hand over food safely.
*/
import CountdownTag from './CountdownTag'
import { isOpen } from '../utils/listingStatus'
import { NGO_VERIFICATION_META } from '../utils/roles'
import { formatDateTime } from '../utils/formatDate'

function Row({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-700">{children}</dd>
    </div>
  )
}

function Unclaimed({ listing, now }) {
  const open = isOpen(listing.status)

  if (!open) {
    /*
      A cancelled or expired listing with no charity. Saying "no charity has
      claimed this yet" here would be wrong in a way that matters: nothing is
      going to claim it, and the copy invites the donor to wait for a pickup that
      is never coming. The past tense is the whole difference.
    */
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-bold text-slate-900">No charity collected this</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {listing.status === 'expired'
            ? 'The pickup window lapsed before a charity claimed it, so this food was not collected. Nothing further happens on this listing.'
            : 'You cancelled this listing before a charity claimed it, so there is no pickup to coordinate.'}
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-display text-lg font-bold text-slate-900">No charity has claimed this yet</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Only verified charities can see your listing, and it stays here until one of them claims it.
        You do not need to do anything - this page updates on its own once a charity picks it up.
      </p>
      {listing.expiry_at && (
        <p className="mt-4 text-sm text-slate-600">
          Expires <CountdownTag expiresAt={listing.expiry_at} now={now} />
        </p>
      )}
    </section>
  )
}

function Claimed({ ngo }) {
  const meta = NGO_VERIFICATION_META[ngo.verification] ?? NGO_VERIFICATION_META.pending

  return (
    <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-slate-900">{ngo.organisation}</h2>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">Claimed charity</p>
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${meta.tone}`}>
          {meta.label}
        </span>
      </div>

      {/*
        Why a donor is shown the badge at all, and why it is the only thing about
        the charity that is asserted rather than listed: ngo_details.verification
        is the single field the donations_select_verified_ngo policy gates the
        feed on, so a charity could only have claimed this food while it read
        'verified'.
      */}
      {ngo.verification === 'verified' && (
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Checked by NaikiApp before this charity could see any food on the platform.
        </p>
      )}

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <Row label="Contact person">{ngo.contact_name ?? 'Not provided'}</Row>
        <Row label="Phone">
          {ngo.contact_phone ? (
            <a
              href={`tel:${ngo.contact_phone.replace(/\s+/g, '')}`}
              className="text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-600"
            >
              {ngo.contact_phone}
            </a>
          ) : (
            'Not provided'
          )}
        </Row>
        <Row label="Registration number">{ngo.registration_number ?? 'Not provided'}</Row>
        <Row label="Claimed">{formatDateTime(ngo.claimed_at)}</Row>
      </dl>
    </section>
  )
}

export default function ClaimingNgoCard({ listing, ngo, isLoading, now }) {
  if (isLoading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" role="status" aria-live="polite">
        <p className="text-sm font-semibold text-slate-500">Looking up the charity that claimed this…</p>
      </section>
    )
  }

  // A claimed listing whose charity cannot be read is a different situation from
  // an unclaimed one, and must not be rendered as the second.
  if (listing?.claimed_by && !ngo) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h2 className="font-display text-lg font-bold text-amber-900">A charity claimed this</h2>
        <p className="mt-2 text-sm leading-relaxed text-amber-800">
          We cannot show you the charity&apos;s details for this listing. If a representative is
          expecting a pickup, contact the platform team before handing the food over.
        </p>
      </section>
    )
  }

  if (!ngo) return <Unclaimed listing={listing} now={now} />

  return <Claimed ngo={ngo} />
}
