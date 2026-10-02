import { useState } from 'react'

import { formatDateTime } from '../utils/formatDate'
import { NGO_VERIFICATION_META } from '../utils/roles'

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-700">{children}</dd>
    </div>
  )
}

/*
  One charity registration in the admin's queue, with the decision attached to
  it.

  What the reviewer needs to see is deliberately the charity's own submission:
  the organisation name, the registration number it typed, and the person who
  registered. Nothing here is editable. Migration 0006 grants an admin UPDATE on
  verification and review_note only, so the fields a decision is made *on* are
  the fields a moderator cannot quietly rewrite to justify the decision - and
  this card does not offer an input that would suggest otherwise.

  A rejection requires a reason, in the UI as well as the data layer. The
  charity is shown that exact text (NGO_VERIFICATION_META in utils/roles.js),
  and "not approved" on its own is not something it can act on or appeal.

  A decided registration can be re-decided from the same card, because the
  alternative is an admin in a SQL editor: a charity rejected in error is told
  to contact the platform team, and that team has to be able to fix it. It
  takes two clicks rather than one on purpose - reversing a decision by accident
  is worse than the extra click.
*/
export default function VerificationCard({ application, onDecide, isDeciding, decidedByName }) {
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reopening, setReopening] = useState(false)

  const meta = NGO_VERIFICATION_META[application.verification] ?? NGO_VERIFICATION_META.pending
  const pending = application.verification === 'pending'
  const noteMissing = rejecting && note.trim().length === 0

  async function handle(decision) {
    try {
      await onDecide({ id: application.id, decision, reviewNote: note.trim() || null })
      setNote('')
      setRejecting(false)
      setReopening(false)
    } catch {
      // The page owns the error surface, so the rejection is absorbed here
      // rather than becoming an unhandled promise rejection. The note is left
      // in the field so a failed decision does not cost the reviewer the text.
    }
  }

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-slate-900">{application.organisation}</h3>
          <p className="mt-1 text-sm text-slate-500">Registered {formatDateTime(application.created_at)}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${meta.tone}`}>
          {meta.label}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4">
        <Field label="Registration number">
          {application.registration_number || (
            <span className="text-rose-600">Not provided</span>
          )}
        </Field>
        <Field label="Contact">
          {application.contact_name}
          <span className="block text-xs font-medium text-slate-500">{application.contact_phone}</span>
        </Field>
      </dl>

      {/*
        A decided registration shows the decision and a way to reopen it. The
        decision buttons themselves stay hidden until "Change decision" is
        clicked, which is the whole point of the extra step.
      */}
      {!pending && (
        <div className="mt-4 rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {application.verification === 'verified' ? 'Approved' : 'Rejected'}
            {application.verified_at ? ` · ${formatDateTime(application.verified_at)}` : ''}
            {decidedByName ? ` by ${decidedByName}` : ''}
          </p>
          {application.review_note && (
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{application.review_note}</p>
          )}

          {!reopening && (
            <button
              type="button"
              onClick={() => setReopening(true)}
              disabled={isDeciding}
              className="mt-3 rounded-full border border-slate-300 px-5 py-2 text-sm font-bold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
            >
              Change decision
            </button>
          )}
        </div>
      )}

      {(pending || reopening) && (
        <div className="mt-5">
          {reopening && !pending && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-800">Reopen this decision</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Approving unlocks the feed immediately. Rejecting replaces the reason the charity was
                given, and it needs a new one.
              </p>
            </div>
          )}

          {rejecting && (
            <div className={pending ? 'mb-4' : 'mt-4'}>
              <label htmlFor={`note-${application.id}`} className="text-sm font-bold text-slate-800">
                Why is this being rejected?
              </label>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                The charity reads this, so say what it can fix.
              </p>
              <textarea
                id={`note-${application.id}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="e.g. The registration number does not match the one on the department list."
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-rose-400"
              />
              {noteMissing && (
                <p className="mt-2 text-xs font-semibold text-rose-600" role="alert">
                  A rejection needs a reason.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handle('verified')}
              disabled={isDeciding}
              className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
            >
              {pending ? 'Approve charity' : 'Approve instead'}
            </button>

            {rejecting ? (
              <>
                <button
                  type="button"
                  onClick={() => handle('rejected')}
                  disabled={isDeciding || noteMissing}
                  className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
                >
                  Confirm rejection
                </button>
                <button
                  type="button"
                  onClick={() => setRejecting(false)}
                  className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-white"
                >
                  Keep reviewing
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setRejecting(true)}
                disabled={isDeciding}
                className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:border-rose-300 hover:text-rose-600 active:scale-95 disabled:opacity-50"
              >
                {pending ? 'Reject' : 'Reject instead'}
              </button>
            )}

            {!pending && !rejecting && (
              <button
                type="button"
                onClick={() => setReopening(false)}
                className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-white"
              >
                Leave the decision
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
