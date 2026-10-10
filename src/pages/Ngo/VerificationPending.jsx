import { useState } from 'react'
import { Link } from 'react-router-dom'

import Navbar from '../../components/Navbar'
import { useAuth } from '../../context/useAuth'

export default function VerificationPending() {
  const { ngo, submitNgoIdCard, isDemoBackend } = useAuth()
  const [file, setFile] = useState(null)
  const [registrationNumber, setRegistrationNumber] = useState(ngo?.registration_number ?? '')
  const [idCardNumber, setIdCardNumber] = useState(ngo?.id_card_number ?? '')
  const [officialLink, setOfficialLink] = useState(ngo?.official_link ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submitEvidence(event) {
    event.preventDefault()
    const form = event.currentTarget
    setPending(true)
    setError('')
    setSuccess('')
    try {
      await submitNgoIdCard(file, {
        registration_number: registrationNumber,
        id_card_number: idCardNumber,
        official_link: officialLink,
      })
      setSuccess('Your evidence was submitted. An administrator will review the updated registration.')
      setFile(null)
      form.reset()
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-5 py-12">
        <section className="w-full rounded-3xl border border-emerald-100 bg-white p-8 shadow-sm sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Organisation review</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {ngo?.needs_info || ngo?.verification_status === 'rejected' ? 'More information is needed' : 'Your registration is under review'}
          </h1>
          <p className="mt-4 leading-relaxed text-slate-600">
            {ngo?.needs_info || ngo?.verification_status === 'rejected'
              ? 'An administrator needs an update before they can complete this review.'
              : 'An administrator will check your charity registration, official link, and representative ID before enabling food access.'}
          </p>
          {ngo?.review_note && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <strong>Administrator’s note</strong>
              <p className="mt-1">{ngo.review_note}</p>
            </div>
          )}
          {ngo?.official_link && (
            <a
              className="mt-5 inline-flex break-all font-semibold text-emerald-700 underline underline-offset-4"
              href={ngo.official_link}
              target="_blank"
              rel="noreferrer"
            >
              View the official link you submitted
            </a>
          )}
          {ngo?.verification_status !== 'verified' && (
            <form className="mt-7 space-y-4 border-t border-slate-100 pt-6" onSubmit={submitEvidence}>
              <h2 className="text-lg font-bold text-slate-900">Submit or update verification evidence</h2>
              {isDemoBackend && <p className="text-xs text-amber-800">Demo mode stores uploaded ID documents in this browser only. Do not use real identity documents.</p>}
              {error && <p className="notice error" role="alert">{error}</p>}
              {success && <p className="admin-success" role="status">{success}</p>}
              <label className="block text-sm font-semibold text-slate-800">
                Charity registration number
                <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" required maxLength={100} value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                Representative ID card number
                <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" required minLength={5} maxLength={50} value={idCardNumber} onChange={(event) => setIdCardNumber(event.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                Official verification link
                <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" required type="url" value={officialLink} onChange={(event) => setOfficialLink(event.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                Representative’s ID card (JPG, PNG, or PDF; max 2 MB)
                <input className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" required type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </label>
              <button type="submit" disabled={pending || !file} className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {pending ? 'Uploading securely…' : 'Submit evidence for review'}
              </button>
            </form>
          )}
          <div className="mt-8 border-t border-slate-100 pt-6">
            <p className="text-sm text-slate-500">
              {ngo?.verification_status === 'rejected' && !ngo?.needs_info
                ? 'You cannot browse or claim donations until the issue is resolved.'
                : 'You can sign in again later; this page will update after the administrator decides.'}
            </p>
            <Link to="/" className="mt-5 inline-flex font-bold text-emerald-700 hover:text-emerald-800">
              Return to home
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}
