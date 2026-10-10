import { Link } from 'react-router-dom'
import Logo from './Logo'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <div className="site-footer-brand">
          <Logo size="medium" />
          <p>
            Connecting surplus food with local charities, so good food can reach the
            communities that need it.
          </p>
        </div>

        <nav className="site-footer-nav" aria-label="Footer navigation">
          <div>
            <h2>Explore</h2>
            <Link to="/ngo/feed">Browse food</Link>
            <Link to="/#how">How it works</Link>
            <Link to="/#impact">Our impact</Link>
            <Link to="/registered-ngos">Registered NGOs</Link>
            <Link to="/top-donors">Top Donors</Link>
          </div>
          <div>
            <h2>Get involved</h2>
            <Link to="/auth/signup">Donate food</Link>
            <Link to="/auth/signup?role=ngo">Register a charity</Link>
            <Link to="/auth/login">Log in</Link>
          </div>
        </nav>
      </div>

      <div className="site-footer-bottom">
        <span>Built with purpose by FameByte Studio Team</span>
        <span>© 2026 DastarKhan</span>
      </div>
    </footer>
  )
}
