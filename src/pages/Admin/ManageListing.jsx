import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import ListingForm from '../../components/ListingForm'
import Navbar from '../../components/Navbar'
import { ErrorState, LoadingState } from '../../components/PageState'
import { useAuth } from '../../context/useAuth'
import { createByAdmin, getById, updateByAdmin } from '../../lib/listingsApi'
import { supabase } from '../../lib/supabaseClient'
import { defaultPickupWindow, fromLocalInputValue, toLocalInputValue } from '../../utils/formatDate'

function defaultValues(profile) {
  const window = defaultPickupWindow()
  return {
    title: '',
    description: '',
    food_type: 'cooked',
    quantity_value: '',
    quantity_unit: 'plates',
    estimated_kg: '',
    expiry_at: window.end,
    pickup_start_at: window.start,
    pickup_end_at: window.end,
    city: 'Lahore',
    area: '',
    address: '',
    contact_name: profile?.full_name ?? '',
    contact_phone: profile?.phone ?? '',
  }
}

function toFormValues(listing) {
  return {
    title: listing.title ?? '',
    description: listing.description ?? '',
    food_type: listing.food_type,
    quantity_value: String(listing.quantity_value),
    quantity_unit: listing.quantity_unit,
    estimated_kg: String(listing.estimated_kg),
    expiry_at: toLocalInputValue(listing.expiry_at),
    pickup_start_at: toLocalInputValue(listing.pickup_start_at),
    pickup_end_at: toLocalInputValue(listing.pickup_end_at),
    city: listing.city,
    area: listing.area,
    address: listing.address,
    pickup_latitude: listing.pickup_latitude,
    pickup_longitude: listing.pickup_longitude,
    contact_name: listing.contact_name,
    contact_phone: listing.contact_phone,
  }
}

function toPayload(values) {
  return {
    ...values,
    quantity_value: Number(values.quantity_value),
    estimated_kg: Number(values.estimated_kg),
    expiry_at: fromLocalInputValue(values.expiry_at),
    pickup_start_at: fromLocalInputValue(values.pickup_start_at),
    pickup_end_at: fromLocalInputValue(values.pickup_end_at),
  }
}

export default function ManageListing() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(Boolean(id))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        let result
        if (supabase) {
          const { data, error: queryError } = await supabase.from('donations').select('*').eq('id', id).maybeSingle()
          if (queryError) throw queryError
          result = data
        } else {
          result = await getById(id)
        }
        if (!result) throw new Error('That donation could not be found.')
        if (!cancelled) {
          setListing(result)
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id])

  async function handleSubmit(values) {
    setSaving(true)
    setError('')
    const payload = toPayload(values)
    try {
      if (id) {
        if (supabase) {
          const { error: mutationError } = await supabase.rpc('update_donation_as_admin', {
            p_donation_id: id,
            p_listing: payload,
          })
          if (mutationError) throw mutationError
        } else {
          await updateByAdmin(id, payload)
        }
      } else if (supabase) {
        const { error: mutationError } = await supabase.rpc('create_donation_as_admin', { p_listing: payload })
        if (mutationError) throw mutationError
      } else {
        await createByAdmin(payload)
      }
      navigate('/admin/listings', { replace: true })
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/admin/listings" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">
          &larr; Back to all listings
        </Link>
        <h1 className="mt-4 font-display text-3xl font-black tracking-tight text-slate-900">
          {id ? 'Edit donation listing' : 'Create donation listing'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {id
            ? 'Update listing details while retaining its owner, claim state, and history.'
            : 'Create a listing on behalf of the platform. New listings start as available.'}
        </p>

        <div className="mt-8">
          {loading ? (
            <LoadingState label="Loading donation details" />
          ) : error && (!id || !listing) ? (
            <ErrorState title="Could not load this listing" error={error} />
          ) : (
            <>
              {error && <p className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700" role="alert">{error}</p>}
              {listing && (
                <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Current status: <strong>{listing.status?.replace('_', ' ')}</strong>. Editing details will not change the workflow status or remove its history.
                </p>
              )}
              <ListingForm
                key={id ?? 'new-admin-listing'}
                initialValues={listing ? toFormValues(listing) : defaultValues(profile)}
                onSubmit={handleSubmit}
                submitting={saving}
                submitLabel={id ? 'Save listing changes' : 'Create listing'}
                isAnonymous={false}
                allowPastDates={Boolean(id)}
                onCancel={() => navigate('/admin/listings')}
              />
            </>
          )}
        </div>
      </main>
    </>
  )
}
