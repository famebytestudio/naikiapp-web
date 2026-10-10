import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { homeForRole, ROLE_META } from '../utils/roles'
import SignOutButton from './SignOutButton'
import Logo from './Logo'
import PublicHeader from './PublicHeader'
import NotificationsMenu from './NotificationsMenu'

/*
  One navbar for three products' worth of screens, so the links are keyed off the
  role. A donor must not be offered "Moderate listings", and an admin has no
  listings of their own to post - showing everyone everything is how a role guard
  gets bypassed by a user who simply clicks the wrong thing.

  These are the same paths the guards in App.jsx protect. The two lists have to
  agree, so they are declared here once and read from the role.
*/
const NAV_BY_ROLE = {
  donor: [
    ['/donor/listings', 'My listings'],
    ['/donor/listings/new', 'Post food'],
    ['/dashboard', 'Impact'],
  ],
  ngo: [
    ['/ngo/feed', 'Available food'],
    ['/ngo/claims', 'My claims'],
    ['/dashboard', 'Impact'],
  ],
  admin: [
    ['/admin/listings', 'All listings'],
    ['/admin/ngos', 'Registered NGOs'],
  ],
}

export default function Navbar() {
  const { profile, role, isAuthenticated, isAnonymous } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  /*
    How the account introduces itself. An anonymous donor is "Anonymous Donor"
    even in their own navbar - the preference is a promise about how they are
    seen, and honouring it in the one place they are looking at themselves costs
    nothing and keeps the rule honest.
  */
  function identity() {
    if (isAnonymous) return { name: 'Anonymous Donor', detail: 'Name hidden' }
    if (role === 'admin') return { name: profile?.full_name ?? 'Platform admin', detail: 'Admin' }
    return { name: profile?.full_name, detail: profile?.organisation }
  }

  const { name, detail } = identity()
  if (!isAuthenticated) return <PublicHeader />

  return (
    <header className="app-navbar">
      <div className="app-navbar-inner">
        <Logo to={isAuthenticated ? homeForRole(role) : '/'} />

        {!isAuthenticated && (
          <nav className="auth-public-nav" aria-label="Main navigation">
            <Link to="/#how" className="app-nav-link">How it works</Link>
            <Link to="/#impact" className="app-nav-link">Our impact</Link>
            <Link to="/ngo/feed" className="app-nav-link">Browse food</Link>
          </nav>
        )}

        {isAuthenticated ? (
          <>
            <nav className="desktop-nav">
              {(NAV_BY_ROLE[role] ?? []).map(([to, label]) => (
                <NavLink key={to} to={to} className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`} end={to === '/donor/listings'}>
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="navbar-account flex items-center gap-3">
              <NotificationsMenu />
              <div className="text-right text-xs leading-tight">
                <p className="font-bold text-slate-800">{name}</p>
                <p className="text-slate-500">{detail ?? ROLE_META[role]?.label}</p>
              </div>

              <SignOutButton />
            </div>
            <button
              type="button"
              className="mobile-nav-toggle"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                {menuOpen ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/auth/login" className="rounded-full px-4 py-2 text-sm font-bold text-slate-600 transition hover:text-slate-900">
              Log in
            </Link>
            <Link
              to="/auth/signup"
              className="app-pill-button rounded-full px-5 py-2 text-sm font-bold text-white"
            >
              Sign up
            </Link>
          </div>
        )}
        {isAuthenticated && menuOpen && (
          <nav className="mobile-nav-panel" aria-label="Mobile navigation">
            <NotificationsMenu />
            {(NAV_BY_ROLE[role] ?? []).map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`} end={to === '/donor/listings'} onClick={() => setMenuOpen(false)}>
                {label}
              </NavLink>
            ))}
            <SignOutButton />
          </nav>
        )}
      </div>
    </header>
  )
}
