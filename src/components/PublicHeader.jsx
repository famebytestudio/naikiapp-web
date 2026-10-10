import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { homeForRole } from '../utils/roles'
import Logo from './Logo'
import SignOutButton from './SignOutButton'
import './public.css'

const links = [
  ['/#how', 'How it works'],
  ['/registered-ngos', 'Registered NGOs'],
  ['/top-donors', 'Top Donors'],
  ['/#impact', 'Our impact'],
]

export default function PublicHeader() {
  const { isAuthenticated, role } = useAuth()
  const [open, setOpen] = useState(false)
  return (
    <header className="landing-header">
      <div className="landing-header-inner">
        <Logo to="/" />
        <nav className="landing-nav" aria-label="Main navigation">
          {links.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => isActive && !to.includes('#') ? 'active' : undefined}>{label}</NavLink>)}
        </nav>
        <div className="landing-header-actions">
          {isAuthenticated ? <><Link to={homeForRole(role)}>My workspace</Link><SignOutButton /></> : <><Link to="/auth/login">Log in</Link><Link to="/auth/signup" className="landing-signup">Get started <span aria-hidden="true">↗</span></Link></>}
        </div>
        <button type="button" className="landing-mobile-toggle" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={open} aria-controls="public-mobile-nav" onClick={() => setOpen(!open)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d={open ? 'm6 6 12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} />
          </svg>
        </button>
        {open && <nav id="public-mobile-nav" className="landing-mobile-nav" aria-label="Mobile navigation">
          {links.map(([to, label]) => <Link key={to} to={to} onClick={() => setOpen(false)}>{label}</Link>)}
          <Link to="/ngo/feed" onClick={() => setOpen(false)}>Browse food</Link>
          {!isAuthenticated && <Link to="/auth/login" onClick={() => setOpen(false)}>Log in</Link>}
          <Link to={isAuthenticated ? homeForRole(role) : '/auth/signup'} onClick={() => setOpen(false)}>{isAuthenticated ? 'My workspace' : 'Get started'}</Link>
        </nav>}
      </div>
    </header>
  )
}
