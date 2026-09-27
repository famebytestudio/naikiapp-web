import { Link, useNavigate, useParams } from 'react-router-dom'

import ListingForm from '../../components/ListingForm'
import Navbar from '../../components/Navbar'
import { ErrorState, LoadingState } from '../../components/PageState'
import { useAuth } from '../../context/useAuth'
import { useListing, useUpdateListing } from '../../hooks/useListings'
import { canEdit } from '../../utils/listingStatus'
import { fromLocalInputValue, toLocalInputValue } from '../../utils/formatDate'

/*
  Form values are the persisted ISO timestamps converted back to the wall-clock
  local strings <input type="datetime-local"> expects, so a donor in Karachi
  opens the form and sees 9:00 pm, not a UTC-shifted time.
*/
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
    contact_name: listing.contact_name,
    contact_phone: listing.contact_phone,
  }
}

export default function EditListing() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAnonymous } = useAuth()
  const { data: listing, isLoading, isError, error, refetch } = useListing(id)
  const updateListing = useUpdateListing()

  async function handleSubmit(values) {
    try {
      await updateListing.mutateAsync({
        id,
        values: {
          ...values,
          expiry_at: fromLocalInputValue(values.expiry_at),
          pickup_start_at: fromLocalInputValue(values.pickup_start_at),
          pickup_end_at: fromLocalInputValue(values.pickup_end_at),
        },
      })
      navigate('/donor/listings')
    } catch {
      // Rendered inline; the listing list behind this page already refetched.
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/donor/listings" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">
          &larr; Back to my listings
        </Link>

        <h1 className="mt-4 font-display text-3xl font-black tracking-tight text-slate-900">Edit listing</h1>

        <div className="mt-8">
          {isLoading ? (
            <LoadingState label="Loading this listing" />
          ) : isError || !listing ? (
            <ErrorState error={error ?? new Error('That listing could not be found.')} onRetry={refetch} title="Could not load this listing" />
          ) : !canEdit(listing.status) ? (
            <ErrorState
              title="This listing can no longer be edited"
              error={
                listing.status === 'claimed'
                  ? 'A charity has claimed it and is planning a pickup, so the details are locked. Cancel it and post a new listing if the food has changed.'
                  : `It is already ${listing.status.replace('_', ' ')}, so there is nothing left to change.`
              }
            />
          ) : updateListing.isError ? (
            <ErrorState error={updateListing.error} title="Could not save your changes" />
          ) : (
            <ListingForm
              initialValues={toFormValues(listing)}
              onSubmit={handleSubmit}
              submitting={updateListing.isPending}
              submitLabel="Save changes"
              isAnonymous={isAnonymous}
              onCancel={() => navigate('/donor/listings')}
            />
          )}
        </div>
      </main>
    </div>
  )
}
