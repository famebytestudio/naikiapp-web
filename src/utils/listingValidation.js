import { FOOD_TYPES, QUANTITY_UNITS } from './listingStatus'

const PHONE_PATTERN = /^[0-9+\-\s()]{7,20}$/

export const EMPTY_LISTING = {
  title: '',
  description: '',
  food_type: 'cooked',
  quantity_value: '',
  quantity_unit: 'plates',
  estimated_kg: '',
  expiry_at: '',
  pickup_start_at: '',
  pickup_end_at: '',
  city: 'Lahore',
  area: '',
  address: '',
  contact_name: '',
  contact_phone: '',
}

const REQUIRED = [
  ['title', 'Give the food a short name'],
  ['city', 'City is required'],
  ['area', 'Area is required'],
  ['address', 'Pickup address is required'],
  ['contact_name', 'Who is handing this over?'],
]

/*
  Shape validation only - no server state, no I/O. Returns a field -> message
  map, empty when the listing is good to post. Mirrors the CHECK constraints in
  supabase/migrations/0003_create_donations.sql so the same input is rejected
  on both sides; the database remains the authority.
*/
export function validateListing(values, now = Date.now()) {
  const errors = {}

  for (const [field, message] of REQUIRED) {
    if (!String(values[field] ?? '').trim()) errors[field] = message
  }

  if (values.title && values.title.trim().length > 120) {
    errors.title = 'Keep the name under 120 characters'
  }
  if (values.description && values.description.length > 1000) {
    errors.description = 'Keep the description under 1000 characters'
  }

  if (!FOOD_TYPES.some((type) => type.value === values.food_type)) {
    errors.food_type = 'Pick a food type'
  }

  if (!QUANTITY_UNITS.some((unit) => unit.value === values.quantity_unit)) {
    errors.quantity_unit = 'Pick a unit'
  }

  const quantity = Number(values.quantity_value)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    errors.quantity_value = 'Enter how much there is'
  }

  const kg = Number(values.estimated_kg)
  if (!Number.isFinite(kg) || kg <= 0) {
    errors.estimated_kg = 'Estimated kg is needed for impact tracking'
  }

  const expiry = Date.parse(values.expiry_at)
  const start = Date.parse(values.pickup_start_at)
  const end = Date.parse(values.pickup_end_at)

  if (Number.isNaN(expiry)) {
    errors.expiry_at = 'When does this food expire?'
  } else if (expiry <= now) {
    errors.expiry_at = 'Expiry has to be in the future'
  }

  if (Number.isNaN(start) || Number.isNaN(end)) {
    errors.pickup_end_at = 'Set the full pickup window'
  } else {
    if (end <= start) errors.pickup_end_at = 'Pickup must end after it starts'
    if (start <= now) errors.pickup_start_at = 'Pickup cannot start in the past'
    // Food that expires before the NGO can collect it is not really available.
    if (!Number.isNaN(expiry) && end > expiry) {
      errors.pickup_end_at = 'Pickup must close before the food expires'
    }
  }

  if (values.contact_phone && !PHONE_PATTERN.test(values.contact_phone.trim())) {
    errors.contact_phone = 'Enter a reachable phone number'
  }

  return errors
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0
}

/*
  When the donor is counting in kilograms the weight and the quantity are the
  same number, so keep them in step instead of asking twice.
*/
export function syncEstimatedKg(values) {
  if (values.quantity_unit !== 'kg') return values
  return { ...values, estimated_kg: values.quantity_value }
}
