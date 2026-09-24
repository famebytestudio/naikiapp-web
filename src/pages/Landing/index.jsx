import { Link } from 'react-router-dom'
import { useImpact } from '../../hooks/useImpact'

const formatKg = (value) => `${value.toFixed(1).replace(/\.0$/, '')} kg`

export default function Landing() {
	const { stats, loading } = useImpact()

	return (
		<main className="landing-shell">
			<header className="landing-header">
				<Link to="/" className="brand"><span>n</span> naiki<span className="brand-mark">/</span></Link>
				<nav>
					<Link to="/ngo">Browse food</Link>
					<Link to="/dashboard">Impact</Link>
				</nav>
				<Link to="/ngo" className="landing-cta">View listings</Link>
			</header>

			<section className="landing-hero">
				<div className="landing-copy">
					<p className="eyebrow">Community rescue network</p>
					<h1>Turn surplus food into shared impact.</h1>
					<p className="subtitle">Helping donors and NGOs rescue food before it goes to waste while keeping nearby communities fed.</p>
					<div className="hero-actions">
						<Link to="/ngo" className="primary-button">Find food nearby</Link>
						<Link to="/dashboard" className="map-link">See live impact</Link>
					</div>
				</div>

				<div className="impact-panel" aria-live="polite">
					<span className="impact-kicker">Rescued across the platform</span>
					<strong>{loading ? 'Loading...' : formatKg(stats.deliveredKg)}</strong>
					<div className="impact-detail">
						<span className="status-pulse" />
						<span>{stats.delivered} deliveries logged</span>
					</div>
				</div>
			</section>
		</main>
	)
}
