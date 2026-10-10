import { useState } from 'react'

import PickupLocationMap from './LazyPickupLocationMap'
import { FOOD_TYPES, PAKISTAN_CITIES, QUANTITY_UNITS } from '../utils/listingStatus'
import { EMPTY_LISTING, hasErrors, syncEstimatedKg, validateListing } from '../utils/listingValidation'

/*
  Shared by CreateListing and EditListing. One form means the validation rules,
  the field set and the pickup-window defaults cannot drift between the two
  screens, which is the usual way "create" and "edit" start behaving differently.
*/

const inputClass =
  'w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20'

function Field({ label, htmlFor, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm font-bold text-slate-800">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && (
        <p className="mt-1.5 text-xs font-semibold text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function Section({ id, step, title, description, children }) {
  return (
    <section id={id} className="listing-form-section">
      <div className="listing-form-section-heading">
        <span className="listing-form-step" aria-hidden="true">{step}</span>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      <div className="listing-form-section-content">{children}</div>
    </section>
  )
}

export default function ListingForm({ initialValues, onSubmit, submitting, submitLabel, isAnonymous, onCancel, allowPastDates = false }) {
  const [values, setValues] = useState({ ...EMPTY_LISTING, ...initialValues })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const isNewListing = submitLabel === 'Post listing'
  const pendingLabel = isNewListing ? 'Sharing…' : 'Saving…'

  function setField(name, value) {
    setValues((current) => {
      const next = { ...current, [name]: value }
      // Counting in kilograms makes the weight and the quantity the same
      // number, so do not ask for it twice.
      return name === 'quantity_unit' || name === 'quantity_value'
        ? syncEstimatedKg(next)
        : next
    })

    // Clear a field's error as soon as it is touched, but only after a first
    // submit attempt so the form does not shout before the donor is ready.
    if (submitted) {
      setErrors((current) => {
        const next = { ...current }
        delete next[name]
        return next
      })
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSubmitted(true)

    const found = validateListing(values, Date.now(), { allowPastDates })
    setErrors(found)
    if (hasErrors(found)) {
      // Move focus to the first problem rather than leaving the donor to hunt.
      const firstField = Object.keys(found)[0]
      document.getElementById(firstField)?.focus()
      return
    }

    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="listing-form">
      <Section id="what-youre-sharing" step="01" title="What are you sharing?" description="A few details help a charity decide quickly.">
        <Field label="Food name" htmlFor="title" error={errors.title}>
          <input
            id="title"
            type="text"
            value={values.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="Chicken biryani and qorma"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Food type" htmlFor="food_type" error={errors.food_type}>
            <select
              id="food_type"
              value={values.food_type}
              onChange={(e) => setField('food_type', e.target.value)}
              className={inputClass}
            >
              {FOOD_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notes for the charity" htmlFor="description" error={errors.description} hint="Optional. Allergies, packaging, anything useful.">
            <input
              id="description"
              type="text"
              value={values.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Kept covered and hot until 11pm"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="How much" htmlFor="quantity_value" error={errors.quantity_value}>
            <input
              id="quantity_value"
              type="number"
              min="1"
              inputMode="numeric"
              value={values.quantity_value}
              onChange={(e) => setField('quantity_value', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Unit" htmlFor="quantity_unit" error={errors.quantity_unit}>
            <select
              id="quantity_unit"
              value={values.quantity_unit}
              onChange={(e) => setField('quantity_unit', e.target.value)}
              className={inputClass}
            >
              {QUANTITY_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Estimated kg"
            htmlFor="estimated_kg"
            error={errors.estimated_kg}
            hint={values.quantity_unit === 'kg' ? 'Follows the quantity' : 'Used for impact totals'}
          >
            <input
              id="estimated_kg"
              type="number"
              min="0.5"
              step="0.5"
              inputMode="decimal"
              value={values.estimated_kg}
              readOnly={values.quantity_unit === 'kg'}
              onChange={(e) => setField('estimated_kg', e.target.value)}
              className={`${inputClass} ${values.quantity_unit === 'kg' ? 'bg-slate-100 text-slate-500' : ''}`}
            />
          </Field>
        </div>
      </Section>

      <Section id="when-to-collect" step="02" title="When can it be collected?" description="Make sure the pickup window ends before the food expires.">
        <Field label="Food expires" htmlFor="expiry_at" error={errors.expiry_at}>
          <input
            id="expiry_at"
            type="datetime-local"
            value={values.expiry_at}
            onChange={(e) => setField('expiry_at', e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pickup from" htmlFor="pickup_start_at" error={errors.pickup_start_at}>
            <input
              id="pickup_start_at"
              type="datetime-local"
              value={values.pickup_start_at}
              onChange={(e) => setField('pickup_start_at', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Pickup until" htmlFor="pickup_end_at" error={errors.pickup_end_at}>
            <input
              id="pickup_end_at"
              type="datetime-local"
              value={values.pickup_end_at}
              onChange={(e) => setField('pickup_end_at', e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <Section id="where-to-collect" step="03" title="Where should they collect it?" description="Set an accurate pin. Your exact address is only shared after a charity claims the food.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" htmlFor="city" error={errors.city}>
            <input
              id="city"
              type="text"
              list="cities"
              value={values.city}
              onChange={(e) => setField('city', e.target.value)}
              className={inputClass}
            />
            <datalist id="cities">
              {PAKISTAN_CITIES.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </Field>

          <Field label="Area" htmlFor="area" error={errors.area}>
            <input
              id="area"
              type="text"
              value={values.area}
              onChange={(e) => setField('area', e.target.value)}
              placeholder="Gulberg"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Pickup address" htmlFor="address" error={errors.address}>
          <input
            id="address"
            type="text"
            value={values.address}
            onChange={(e) => setField('address', e.target.value)}
            placeholder="House 42, Street 8, Gulberg III"
            className={inputClass}
          />
        </Field>

        <div id="pickup_location" tabIndex={-1}>
          <PickupLocationMap
            latitude={values.pickup_latitude}
            longitude={values.pickup_longitude}
            onChange={({ latitude, longitude }) => {
              setField('pickup_latitude', latitude)
              setField('pickup_longitude', longitude)
            }}
          />
          {errors.pickup_location && (
            <p className="mt-1.5 text-xs font-semibold text-rose-600" role="alert">
              {errors.pickup_location}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact name" htmlFor="contact_name" error={errors.contact_name}>
            <input
              id="contact_name"
              type="text"
              value={values.contact_name}
              onChange={(e) => setField('contact_name', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Contact phone" htmlFor="contact_phone" error={errors.contact_phone}>
            <input
              id="contact_phone"
              type="tel"
              value={values.contact_phone}
              onChange={(e) => setField('contact_phone', e.target.value)}
              placeholder="0300 1234567"
              className={inputClass}
            />
          </Field>
        </div>

        <p className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
          {isAnonymous
            ? 'You are set to donate anonymously, so the charity will see "Anonymous Donor". Contact details are always shared so pickup can happen.'
            : 'Your name and organisation will be shown to the charity that claims this listing. You can switch to anonymous at any time from your listings page.'}
        </p>
      </Section>

      <div className="listing-form-actions">
        <p>
          {isNewListing
            ? 'Review your details before sharing. You can manage this listing from My listings.'
            : 'Review your changes before saving.'}
        </p>
        <div>
          <button
            type="submit"
            disabled={submitting}
            className="listing-form-submit"
          >
            {submitting ? pendingLabel : submitLabel}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="listing-form-cancel"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
