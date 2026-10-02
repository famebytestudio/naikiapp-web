import { NavLink, Link } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { homeForRole, ROLE_META } from '../utils/roles'
import { ANONYMOUS_DONOR_LABEL } from '../utils/anonymity'
import SignOutButton from './SignOutButton'

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
    ['/donor/impact', 'My impact'],
    ['/donor/listings/new', 'Post food'],
  ],
  ngo: [
    ['/ngo/feed', 'Available food'],
    ['/ngo/claims', 'My claims'],
  ],
  admin: [
    ['/admin/listings', 'All listings'],
    ['/admin/ngo-verification', 'Verify NGOs'],
  ],
}

export default function Navbar() {
  const { profile, role, isAuthenticated, isAnonymous } = useAuth()

  const linkClass = ({ isActive }) =>
    `rounded-full px-4 py-2 text-sm font-bold transition-colors ${
      isActive ? 'bg-emerald-100 text-emerald-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`

  /*
    How the account introduces itself. An anonymous donor is "Anonymous Donor"
    even in their own navbar - the preference is a promise about how they are
    seen, and honouring it in the one place they are looking at themselves costs
    nothing and keeps the rule honest.

    donorDisplayName() owns that decision; this only adds the two role-specific
    details. See utils/anonymity.js for why the rule is not inlined here.
  */
  function identity() {
    if (isAnonymous) return { name: ANONYMOUS_DONOR_LABEL, detail: 'Name hidden' }
    if (role === 'admin') return { name: profile?.full_name ?? 'Platform admin', detail: 'Admin' }
    return { name: profile?.full_name, detail: profile?.organisation }
  }

  const { name, detail } = identity()

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link to={isAuthenticated ? homeForRole(role) : '/'} className="flex items-center gap-2 font-display text-xl font-black text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-emerald-400 to-teal-500 text-sm text-white">
            N
          </span>
          NaikiApp
        </Link>

        {isAuthenticated ? (
          <>
            <nav className="flex items-center gap-1">
              {(NAV_BY_ROLE[role] ?? []).map(([to, label]) => (
                <NavLink key={to} to={to} className={linkClass} end={to === '/donor/listings'}>
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <div className="text-right text-xs leading-tight">
                <p className="font-bold text-slate-800">{name}</p>
                <p className="text-slate-500">{detail ?? ROLE_META[role]?.label}</p>
              </div>

              <SignOutButton />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/auth/login" className="rounded-full px-4 py-2 text-sm font-bold text-slate-600 transition hover:text-slate-900">
              Log in
            </Link>
            <Link
              to="/auth/signup"
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white transition hover:bg-emerald-600"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
