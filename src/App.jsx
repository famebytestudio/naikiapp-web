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
import ImpactDashboard from './pages/Dashboard/ImpactDashboard'
import Landing from './pages/Landing'
import Feed from './pages/Ngo/Feed'
import ListingDetail from './pages/Ngo/ListingDetail'
import MyClaims from './pages/Ngo/MyClaims'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/signup" element={<Signup />} />

            <Route path="/dashboard" element={<ImpactDashboard />} />

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
            <Route path="/ngo/listings/:id" element={<ListingDetail />} />
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

