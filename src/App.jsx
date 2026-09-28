<<<<<<< HEAD
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import RequireRole from './components/RequireRole'
import { AuthProvider } from './context/AuthContext'
import ListingsOverview from './pages/Admin/ListingsOverview'
import NgoVerification from './pages/Admin/NgoVerification'
import Login from './pages/Auth/Login'
import Signup from './pages/Auth/Signup'
import CreateListing from './pages/Donor/CreateListing'
import EditListing from './pages/Donor/EditListing'
import MyListings from './pages/Donor/MyListings'
import Landing from './pages/Landing'
import Feed from './pages/Ngo/Feed'
import MyClaims from './pages/Ngo/MyClaims'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Listings change when the donor or a charity acts, and a stale feed means
      // someone drives to a pickup that was cancelled an hour ago.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <h1 className="font-display text-4xl font-black text-slate-900">Page not found</h1>
      <a href="/" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">
        Back to the homepage
      </a>
    </div>
  )
}

/*
  Role-guarded routes. The guards are the only place access is decided in the
  browser, and they are a convenience layer over RLS rather than a substitute for
  it: every rule enforced here is enforced again by a policy on the table.

  `roles` is a list so a surface can admit more than one role later without
  changing the guard. The NGO feed additionally requires a verified charity,
  because holding the ngo role is not the same as being allowed to see other
  people's listings.

  The bare /donor, /ngo and /admin paths exist so a role's section has an address
  of its own; each one redirects to that role's home from utils/roles.js rather
  than repeating the path here.
*/
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/signup" element={<Signup />} />

            <Route path="/donor" element={<Navigate to="/donor/listings" replace />} />
            <Route
              path="/donor/listings"
              element={
                <RequireRole roles={['donor']}>
                  <MyListings />
                </RequireRole>
              }
            />
            <Route
              path="/donor/listings/new"
              element={
                <RequireRole roles={['donor']}>
                  <CreateListing />
                </RequireRole>
              }
            />
            <Route
              path="/donor/listings/:id/edit"
              element={
                <RequireRole roles={['donor']}>
                  <EditListing />
                </RequireRole>
              }
            />

            <Route path="/ngo" element={<Navigate to="/ngo/feed" replace />} />
            <Route
              path="/ngo/feed"
              element={
                <RequireRole roles={['ngo']} requireVerifiedNgo>
                  <Feed />
                </RequireRole>
              }
            />
            <Route
              path="/ngo/claims"
              element={
                <RequireRole roles={['ngo']}>
                  <MyClaims />
                </RequireRole>
              }
            />

            <Route path="/admin" element={<Navigate to="/admin/listings" replace />} />
            <Route
              path="/admin/listings"
              element={
                <RequireRole roles={['admin']}>
                  <ListingsOverview />
                </RequireRole>
              }
            />
            <Route
              path="/admin/verifications"
              element={
                <RequireRole roles={['admin']}>
                  <NgoVerification />
                </RequireRole>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
=======
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing/index.jsx'
import Feed from './pages/Ngo/Feed.jsx'
import ListingDetail from './pages/Ngo/ListingDetail.jsx'
import MyClaims from './pages/Ngo/MyClaims.jsx'
import ImpactDashboard from './pages/Dashboard/ImpactDashboard.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/ngo" element={<Feed />} />
        <Route path="/ngo/claims" element={<MyClaims />} />
        <Route path="/ngo/listings/:id" element={<ListingDetail />} />
        <Route path="/dashboard" element={<ImpactDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
>>>>>>> b1e189bb00756791550fc48f767911a07d2198c0
