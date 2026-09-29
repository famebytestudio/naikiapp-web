/*
  The donation status workflow. These values are a cross-branch contract with
  the NGO-side pages and must not be renamed:

    available -> claimed -> picked_up -> delivered

  with two terminal-off states: expired (pickup window lapsed) and cancelled
  (the donor pulled the listing).

  This module is the single source of truth for that contract. The UI reads it
  to decide which buttons to show, and src/lib/listingsApi.js reads the same
  predicates so the mock backend enforces the same rules the RLS policies in
  supabase/migrations/0003_create_donations.sql enforce on a real database.
*/

export const STATUSES = [
  'available',
  'claimed',
  'picked_up',
  'delivered',
  'expired',
  'cancelled',
]

export const STATUS_META = {
  available: { label: 'Available', tone: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  claimed: { label: 'Claimed', tone: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  picked_up: { label: 'Picked up', tone: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  delivered: { label: 'Delivered', tone: 'bg-teal-500/10 text-teal-700 border-teal-500/20' },
  expired: { label: 'Expired', tone: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  cancelled: { label: 'Cancelled', tone: 'bg-rose-500/10 text-rose-700 border-rose-500/20' },
}

export const FOOD_TYPES = [
  { value: 'cooked', label: 'Cooked food' },
  { value: 'packaged', label: 'Packaged / dry goods' },
  { value: 'fresh_produce', label: 'Fresh produce' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'other', label: 'Other' },
]

export const QUANTITY_UNITS = [
  { value: 'plates', label: 'plates' },
  { value: 'trays', label: 'trays' },
  { value: 'packs', label: 'packs' },
  { value: 'boxes', label: 'boxes' },
  { value: 'kg', label: 'kg' },
]

export const PAKISTAN_CITIES = [
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Sialkot',
  'Gujranwala',
  'Hyderabad',
  'Sukkur',
]

/*
  Edit is allowed only while nobody has claimed the listing: an NGO that has
  claimed is planning a pickup around these details, so they are frozen.

  Cancel is allowed from available or claimed, because a donor still has to be
  able to call a listing off after an NGO is on its way. It is blocked from
  picked_up onward, where the food is already in the NGO's hands.
*/
const EDITABLE = ['available']
const CANCELLABLE = ['available', 'claimed']

export function canEdit(status) {
  return EDITABLE.includes(status)
}

export function canCancel(status) {
  return CANCELLABLE.includes(status)
}

export function isOpen(status) {
  return status === 'available' || status === 'claimed'
}

export function statusLabel(status) {
  return STATUS_META[status]?.label ?? status
}

export function foodTypeLabel(value) {
  return FOOD_TYPES.find((t) => t.value === value)?.label ?? value
}
