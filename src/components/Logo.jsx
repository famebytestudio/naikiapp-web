import { Link } from 'react-router-dom'

export default function Logo({ to = '/', size = 'small', inverse = false, className = '' }) {
  return (
    <Link
      to={to}
      aria-label="DastarKhan home"
      className={`brand-logo brand-logo--${size}${inverse ? ' brand-logo--inverse' : ''} ${className}`.trim()}
    >
      <img
        className="brand-logo__mark"
        src="/Hands%20Sharing%20Roti%20with%20Urdu%20Calligraphy.png"
        alt=""
        aria-hidden="true"
      />
      <span className="brand-logo__name">DastarKhan</span>
    </Link>
  )
}
