import { Link, useNavigate } from 'react-router-dom'

import ListingForm from '../../components/ListingForm'
import Navbar from '../../components/Navbar'
import { useAuth } from '../../context/useAuth'
import { useCreateListing } from '../../hooks/useListings'
import { defaultPickupWindow, fromLocalInputValue } from '../../utils/formatDate'

/*
  A new listing always starts life as 'available'. The mock API drops any status
  the client sends and the donations_insert_own RLS policy pins it server-side,
  so a listing can never be born already claimed or delivered.
*/
function buildDefaults(profile) {
  const window = defaultPickupWindow()
  return {
    title: '',
    description: '',
    food_type: 'cooked',
    quantity_value: '',
    quantity_unit: 'plates',
    estimated_kg: '',
    expiry_at: '',
    pickup_start_at: window.start,
    pickup_end_at: window.end,
    city: 'Lahore',
    area: '',
    address: '',
    // Pre-filled from the profile so the donor is not retyping their own
    // details on every post.
    contact_name: profile?.full_name ?? '',
    contact_phone: profile?.phone ?? '',
  }
}

export default function CreateListing() {
  const navigate = useNavigate()
  const { profile, isAnonymous } = useAuth()
  const createListing = useCreateListing()

  async function handleSubmit(values) {
    try {
      const created = await createListing.mutateAsync({
        ...values,
        expiry_at: fromLocalInputValue(values.expiry_at),
        pickup_start_at: fromLocalInputValue(values.pickup_start_at),
        pickup_end_at: fromLocalInputValue(values.pickup_end_at),
      })
      navigate('/donor/listings', { replace: true, state: { created: created.id } })
    } catch {
      // Rendered inline below; nothing else to do here.
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/donor/listings" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">
          &larr; Back to my listings
        </Link>

        <h1 className="mt-4 font-display text-3xl font-black tracking-tight text-slate-900">Post surplus food</h1>
        <p className="mt-1 text-sm text-slate-600">
          Local charities browse live listings. The sooner you post, the more likely someone claims it before it expires.
        </p>

        <div className="mt-8">
          {/* The error is a banner rather than a replacement, so a failed post
              never costs the donor everything they typed. */}
          {createListing.isError && (
            <p className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700" role="alert">
              {createListing.error.message}
            </p>
          )}

          <ListingForm
            initialValues={buildDefaults(profile)}
            onSubmit={handleSubmit}
            submitting={createListing.isPending}
            submitLabel="Post listing"
            isAnonymous={isAnonymous}
            onCancel={() => navigate('/donor/listings')}
          />
        </div>
      </main>
    </div>
  )
}
