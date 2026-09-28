/*
  The "NaikiApp took this down" notice, shown to a donor on their own listing.

  Extracted because two surfaces now say it - the donor's list and the listing
  detail page - and a donor who reads a different explanation on the list than
  on the detail page has been told two different things about the same removal.

  Why a removed listing is still visible at all: donations_select_own in 0003 is
  left untouched by 0006 precisely so that taking something down is not the same
  as making it vanish. A donor who posted food that was fine, and was then taken
  down over a contact number that did not answer, deserves to know it was not
  their fault and to be able to say so.
*/
export default function RemovedNotice({ listing }) {
  if (!listing?.removed_at) return null

  return (
    <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
      <p className="text-sm font-bold text-rose-900">Removed by NaikiApp</p>
      <p className="mt-1 text-sm leading-relaxed text-rose-700">{listing.removal_reason}</p>
      <p className="mt-2 text-xs text-rose-600">
        It is no longer shown to charities and cannot be edited. Contact the platform team if you
        think this is a mistake.
      </p>
    </div>
  )
}
