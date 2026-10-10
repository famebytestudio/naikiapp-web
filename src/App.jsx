import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import Logo from './components/Logo'
import RequireRole from './components/RequireRole'
import SiteFooter from './components/SiteFooter'
import { AuthProvider } from './context/AuthContext'
import ListingsOverview from './pages/Admin/ListingsOverview'
import ManageListing from './pages/Admin/ManageListing'
import RegisteredDonors from './pages/Admin/RegisteredDonors'
import RegisteredNgos from './pages/Admin/RegisteredNgos'
import Login from './pages/Auth/Login'
import Signup from './pages/Auth/Signup'
import ImpactDashboard from './pages/Dashboard/ImpactDashboard'
import CreateListing from './pages/Donor/CreateListing'
import EditListing from './pages/Donor/EditListing'
import MyListings from './pages/Donor/MyListings'
import Landing from './pages/Landing'
import CommunityDirectory from './pages/Community/CommunityDirectory'
import { useEffect, useState } from 'react'
import Feed from './pages/Ngo/Feed'
import ListingDetail from './pages/Ngo/ListingDetail'
import MyClaims from './pages/Ngo/MyClaims'
import VerificationPending from './pages/Ngo/VerificationPending'

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
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <Logo size="medium" className="mb-3" />
      <h1 className="font-display text-4xl font-black text-slate-900">Page not found</h1>
      <Link to="/" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">
        Back to the homepage
      </Link>
    </div>
  )
}

function ScrollToSection() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'instant' })
    else window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash])
  return null
}

function AppFooter() {
  const { pathname } = useLocation()
  if (pathname === '/') return null

  return <SiteFooter />
}

function SplashScreen() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 5000)
    return () => window.clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div className="app-splash" role="status" aria-label="Loading DastarKhan">
      <div className="app-splash__content">
        <div className="app-splash__loader" aria-hidden="true">
          <img
            className="app-splash__logo"
            src="/Hands%20Sharing%20Roti%20with%20Urdu%20Calligraphy.png"
            alt=""
          />
        </div>
        <span className="app-splash__name">DastarKhan</span>
        <span className="app-splash__message">Sharing kindness, one meal at a time</span>
      </div>
    </div>
  )
}

/*
  Role-guarded routes. The guards are the only place access is decided in the
  browser, and they are a convenience layer over RLS rather than a substitute for
  it: every rule enforced here is enforced again by a policy on the table.

  `roles` is a list so a surface can admit more than one role later without
  changing the guard. NGO access is held until an administrator verifies the
  registration.

  The bare /donor, /ngo and /admin paths exist so a role's section has an address
  of its own; each one redirects to that role's home from utils/roles.js rather
  than repeating the path here.
*/
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SplashScreen />
        <BrowserRouter>
          <ScrollToSection />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/registered-ngos" element={<CommunityDirectory kind="ngos" />} />
            <Route path="/top-donors" element={<CommunityDirectory kind="donors" />} />
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
              path="/ngo/verification"
              element={
                <RequireRole roles={['ngo']} allowPendingNgo>
                  <VerificationPending />
                </RequireRole>
              }
            />
            <Route
              path="/ngo/feed"
              element={
                <RequireRole roles={['ngo']}>
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
            <Route
              path="/ngo/listings/:id"
              element={
                <RequireRole roles={['ngo']}>
                  <ListingDetail />
                </RequireRole>
              }
            />

            <Route
              path="/dashboard"
              element={
                <RequireRole roles={['donor', 'ngo']}>
                  <ImpactDashboard />
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
              path="/admin/listings/new"
              element={
                <RequireRole roles={['admin']}>
                  <ManageListing />
                </RequireRole>
              }
            />
            <Route
              path="/admin/listings/:id/edit"
              element={
                <RequireRole roles={['admin']}>
                  <ManageListing />
                </RequireRole>
              }
            />
            <Route
              path="/admin/ngos"
              element={
                <RequireRole roles={['admin']}>
                  <RegisteredNgos />
                </RequireRole>
              }
            />
            <Route
              path="/admin/donors"
              element={
                <RequireRole roles={['admin']}>
                  <RegisteredDonors />
                </RequireRole>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AppFooter />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
