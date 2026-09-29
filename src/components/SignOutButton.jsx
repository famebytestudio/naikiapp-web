import { useAuth } from '../context/useAuth'

export default function SignOutButton({ className = '' }) {
  const { signOut } = useAuth()

  return (
    <button type="button" onClick={signOut} className={`sign-out-button ${className}`.trim()}>
      Sign out
    </button>
  )
}