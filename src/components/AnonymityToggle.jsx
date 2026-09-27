import { useState } from 'react'

import { useAuth } from '../context/useAuth'

/*
  The anonymity preference lives on the donor's profile, not on each listing, so
  this is a profile setting. It has to be respected in NGO views *and* in impact
  aggregates - see the is_anonymous column in migration 0001.
*/
export default function AnonymityToggle() {
  const { isAnonymous, updateProfile } = useAuth()
  const [pending, setPending] = useState(false)

  async function handleChange(event) {
    setPending(true)
    try {
      await updateProfile({ is_anonymous: event.target.checked })
    } finally {
      setPending(false)
    }
  }

  return (
    <label
      className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-colors ${
        isAnonymous ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
      }`}
    >
      <input
        type="checkbox"
        checked={isAnonymous}
        disabled={pending}
        onChange={handleChange}
        className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600"
      />
      <span className="text-sm">
        <span className="block font-bold text-slate-900">Donate anonymously</span>
        <span className="mt-1 block text-slate-600">
          {isAnonymous
            ? 'Charities see "Anonymous Donor" instead of your name. Your contact details are still shared so pickup can happen.'
            : 'Your name and organisation are shown to the charity that claims your food.'}
        </span>
      </span>
    </label>
  )
}
