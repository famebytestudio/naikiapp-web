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
    <div className="post-food-page">
      <Navbar />

      <main className="post-food-main">
        <Link to="/donor/listings" className="post-food-back">
          <span aria-hidden="true">&larr;</span> My listings
        </Link>

        <section className="post-food-hero">
          <div className="post-food-hero-copy">
            <p className="post-food-eyebrow">A little food goes a long way</p>
            <h1>Give good food<br /><span>another table.</span></h1>
            <p className="post-food-intro">
              Share what you have. A nearby charity will take it from here, one meal at a time.
            </p>
            <div className="post-food-promises">
              <span><i aria-hidden="true">✓</i> Free to share</span>
              <span><i aria-hidden="true">✓</i> Local charity reach</span>
            </div>
          </div>
          <div className="post-food-illustration" aria-hidden="true">
            <span className="post-food-illustration-label">MADE TO BE SHARED</span>
            <div className="post-food-plate">
              <div className="post-food-bowl"><span /><span /><span /></div>
            </div>
            <span className="post-food-radius">10 km<small>community reach</small></span>
          </div>
          <nav className="post-food-steps" aria-label="Listing form sections">
            <a href="#what-youre-sharing"><span>01</span> Food details</a>
            <i aria-hidden="true" />
            <a href="#when-to-collect"><span>02</span> Pickup timing</a>
            <i aria-hidden="true" />
            <a href="#where-to-collect"><span>03</span> Pickup location</a>
          </nav>
        </section>

        <div className="post-food-layout">
          <div className="post-food-form-column">
            {/* Keep the form mounted after a failed post so entered details are preserved. */}
            {createListing.isError && (
              <p className="post-food-error" role="alert">
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

          <aside className="post-food-aside">
            <div className="post-food-aside-card">
              <p className="post-food-aside-eyebrow">A helpful little checklist</p>
              <h2>Make your listing easy to claim.</h2>
              <ul>
                <li><span>01</span><div><strong>Describe the food</strong><small>Include portions and anything a charity should know.</small></div></li>
                <li><span>02</span><div><strong>Pin the real pickup spot</strong><small>Charities nearby can find it within the 10 km range.</small></div></li>
                <li><span>03</span><div><strong>Leave time to collect</strong><small>Set a pickup window that ends before the food expires.</small></div></li>
              </ul>
              <div className="post-food-privacy">
                <span aria-hidden="true">i</span>
                <p><strong>Your address stays private.</strong> It is shared with the claiming charity when a pickup is arranged.</p>
              </div>
            </div>
            <p className="post-food-aside-note">Every listing helps good food reach someone who needs it.</p>
          </aside>
        </div>
      </main>
    </div>
  )
}
