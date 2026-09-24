import { Link } from 'react-router-dom'
import { useImpact } from '../../hooks/useImpact'

const formatKg = (value) => `${value.toFixed(1).replace(/\.0$/, '')} kg`

export default function ImpactDashboard() {
	const { stats, loading, error } = useImpact()

	const cards = [
		{ label: 'Meals rescued', value: stats.rescues, note: 'claims and deliveries recorded' },
		{ label: 'Active rescues', value: stats.activeRescues, note: 'currently claimed or in transit' },
		{ label: 'Delivered', value: stats.delivered, note: 'completed drop-offs' },
		{ label: 'Kg delivered', value: formatKg(stats.deliveredKg), note: 'actual kilograms logged' },
	]

	const statusBreakdown = [
		{ label: 'Claimed', value: stats.claimed, color: '#ee765b' },
		{ label: 'Picked up', value: stats.pickedUp, color: '#2b6e4f' },
		{ label: 'Delivered', value: stats.delivered, color: '#6bbf78' },
	]

	return (
		<main className="feed-shell dashboard-shell">
			<header className="app-header">
				<Link to="/ngo" className="brand"><span>n</span> naiki<span className="brand-mark">/</span></Link>
				<nav>
					<Link to="/ngo">Live feed</Link>
					<Link to="/ngo/claims">My claims</Link>
					<Link className="active" to="/dashboard">Impact</Link>
				</nav>
				<button className="profile-button" type="button" aria-label="Open profile">R</button>
			</header>

			<section className="feed-heading dashboard-heading">
				<div>
					<p className="eyebrow">NGO network / impact</p>
					<h1>Platform-wide rescue impact.</h1>
					<p className="subtitle">See how much surplus food is being rescued, picked up, and delivered across the network.</p>
				</div>
				<div className="impact-summary">
					<strong>{stats.deliveredKg.toFixed(1).replace(/\.0$/, '')}</strong>
					<span>kg delivered</span>
				</div>
			</section>

			{error && <p className="notice error">Could not load impact dashboard: {error}</p>}

			{loading ? (
				<div className="empty-state"><div className="spinner" />Loading impact data...</div>
			) : (
				<div className="dashboard-grid">
					<section className="dashboard-panel stats-panel">
						<div className="stats-grid">
							{cards.map((card) => (
								<div key={card.label} className="stat-card">
									<span>{card.label}</span>
									<strong>{card.value}</strong>
									<small>{card.note}</small>
								</div>
							))}
						</div>
					</section>

					<section className="dashboard-panel">
						<div className="panel-heading">
							<h2>Rescue status</h2>
						</div>
						<div className="status-breakdown">
							{statusBreakdown.map((item) => (
								<div key={item.label} className="status-row">
									<div className="status-meta"><span className="status-swatch" style={{ background: item.color }} />{item.label}</div>
									<strong>{item.value}</strong>
								</div>
							))}
						</div>
					</section>

					<section className="dashboard-panel">
						<div className="panel-heading">
							<h2>Top rescue cities</h2>
						</div>
						<div className="city-list">
							{stats.byCity.length ? stats.byCity.map((city) => (
								<div key={city.city} className="city-row">
									<span>{city.city}</span>
									<strong>{city.value}</strong>
								</div>
							)) : <p className="muted">No city data yet.</p>}
						</div>
					</section>
				</div>
			)}
		</main>
	)
}
