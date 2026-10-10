import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import Navbar from '../../components/Navbar'
import {
  listRegisteredNgosForAdmin,
  setNgoDisabledByAdmin,
  setNgoVerificationByAdmin,
} from '../../lib/authApi'
import { supabase } from '../../lib/supabaseClient'

function normalizeNgo(profile) {
  const details = Array.isArray(profile.ngo_details) ? profile.ngo_details[0] : profile.ngo_details
  return {
    id: profile.id,
    fullName: profile.full_name ?? '',
    organisation: details?.organisation ?? profile.organisation ?? 'Charity organisation',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
    registrationNumber: details?.registration_number ?? null,
    idCardNumber: details?.id_card_number ?? null,
    idCardDocumentPath: details?.id_card_document_path ?? null,
    officialLink: details?.official_link ?? null,
    verificationStatus: details?.verification_status ?? 'pending',
    needsInfo: Boolean(details?.needs_info),
    reviewNote: details?.review_note ?? null,
    registeredAt: details?.created_at ?? profile.created_at,
    disabledAt: profile.disabled_at ?? null,
    disabledReason: profile.disabled_reason ?? null,
  }
}

function formatDate(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
}

function hasVerificationEvidence(ngo) {
  return Boolean(
    ngo.registrationNumber
    && ngo.idCardNumber
    && (ngo.idCardDocument || ngo.idCardDocumentPath)
    && ngo.officialLink,
  )
}

export default function RegisteredNgos() {
  const [search, setSearch] = useState('')
  const [selectedNgo, setSelectedNgo] = useState(null)
  const [reason, setReason] = useState('')
  const [reviewingNgo, setReviewingNgo] = useState(null)
  const [reviewNote, setReviewNote] = useState('')
  const [evidenceError, setEvidenceError] = useState('')
  const queryClient = useQueryClient()

  const { data: ngos = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['admin', 'registered-ngos'],
    queryFn: async () => {
      if (!supabase) return listRegisteredNgosForAdmin()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, organisation, phone, created_at, disabled_at, disabled_reason, ngo_details(organisation, registration_number, id_card_number, id_card_document_path, official_link, verification_status, needs_info, review_note, created_at)')
        .eq('role', 'ngo')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map(normalizeNgo)
    },
  })
  const error = queryError?.message ?? ''
  const accountMutation = useMutation({
    mutationFn: async ({ ngo, disabled, reason: actionReason }) => {
      if (supabase) {
        const { error: rpcError } = await supabase.rpc('set_ngo_disabled_as_admin', {
          p_ngo_id: ngo.id,
          p_disabled: disabled,
          p_reason: actionReason || null,
        })
        if (rpcError) throw rpcError
        return
      }
      return setNgoDisabledByAdmin(ngo.id, disabled, actionReason)
    },
    onSuccess: async () => {
      setSelectedNgo(null)
      setReason('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'registered-ngos'] })
    },
  })
  const verificationMutation = useMutation({
    mutationFn: async ({ ngo, decision, note }) => {
      if (supabase) {
        const { error: rpcError } = await supabase.rpc('review_ngo_registration', {
          p_ngo_id: ngo.id,
          p_decision: decision,
          p_note: note || null,
        })
        if (rpcError) throw rpcError
        return
      }
      return setNgoVerificationByAdmin(ngo.id, decision, note)
    },
    onSuccess: async () => {
      setReviewingNgo(null)
      setReviewNote('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'registered-ngos'] })
    },
  })

  const visibleNgos = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return ngos
    return ngos.filter((ngo) => (
      `${ngo.organisation} ${ngo.fullName} ${ngo.email} ${ngo.phone} ${ngo.registrationNumber ?? ''} ${ngo.idCardNumber ?? ''} ${ngo.officialLink ?? ''} ${ngo.verificationStatus}`
        .toLowerCase()
        .includes(query)
    ))
  }, [ngos, search])

  const withRegistrationNumber = ngos.filter((ngo) => ngo.registrationNumber).length
  const activeCount = ngos.filter((ngo) => !ngo.disabledAt).length
  const pendingCount = ngos.filter((ngo) => ngo.verificationStatus === 'pending').length
  const verifiedCount = ngos.filter((ngo) => ngo.verificationStatus === 'verified').length

  async function viewIdCard(ngo) {
    setEvidenceError('')
    if (ngo.idCardDocument) {
      window.open(ngo.idCardDocument, '_blank', 'noopener,noreferrer')
      return
    }
    if (!supabase || !ngo.idCardDocumentPath) {
      setEvidenceError('No ID card document was submitted for this registration.')
      return
    }

    const tab = window.open('about:blank', '_blank')
    if (!tab) {
      setEvidenceError('Allow pop-ups to view this private ID card document.')
      return
    }
    tab.opener = null

    const { data, error: storageError } = await supabase.storage
      .from('ngo-id-cards')
      .createSignedUrl(ngo.idCardDocumentPath, 60)
    if (storageError) {
      tab.close()
      setEvidenceError(`Could not open the ID card document: ${storageError.message}`)
      return
    }
    tab.location.href = data.signedUrl
  }

  function reviewNgo(ngo, decision) {
    verificationMutation.mutate({ ngo: reviewingNgo, decision, note: reviewNote.trim() })
  }

  async function setAccountStatus(disabled) {
    if (!selectedNgo) return
    accountMutation.mutate({
      ngo: selectedNgo,
      disabled,
      reason: disabled ? reason.trim() : '',
    })
  }

  return (
    <>
      <Navbar />
      <main className="admin-page">
        <section className="admin-heading">
          <div>
            <p className="admin-eyebrow">DastarKhan / charity network</p>
            <h1>Registered NGOs</h1>
            <p className="admin-heading-copy">Find organisation and contact details for charities registered on DastarKhan.</p>
          </div>
          <div className="admin-total"><strong>{ngos.length}</strong><span>registered NGOs</span></div>
        </section>

        <section className="admin-overview ngo-overview" aria-label="Charity directory overview">
          <article className="admin-metric">
            <span>Registered organisations</span>
            <strong>{ngos.length}</strong>
            <small>Charity accounts in the directory</small>
          </article>
          <article className="admin-metric">
            <span>Active accounts</span>
            <strong>{activeCount}</strong>
            <small>{ngos.length - activeCount} disabled and excluded from food workflows</small>
          </article>
          <article className="admin-metric">
            <span>Registration references</span>
            <strong>{withRegistrationNumber}</strong>
            <small>References supplied at sign-up</small>
          </article>
          <article className="admin-metric">
            <span>Pending review</span>
            <strong>{pendingCount}</strong>
            <small>{verifiedCount} organisations approved</small>
          </article>
        </section>

        <section className="admin-listings-panel">
          <div className="admin-listings-toolbar">
            <div>
              <h2>Organisation directory</h2>
              <p>{visibleNgos.length} of {ngos.length} registered organisation{ngos.length === 1 ? '' : 's'}</p>
            </div>
            <label className="admin-search">
              <span className="sr-only">Search registered NGOs</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, contact, or reference"
              />
            </label>
          </div>

          {error && <p className="notice error" role="alert">Could not load registered NGOs: {error}</p>}
          {accountMutation.isError && <p className="notice error" role="alert">Could not update charity access: {accountMutation.error.message}</p>}
          {verificationMutation.isError && <p className="notice error" role="alert">Could not update charity verification: {verificationMutation.error.message}</p>}
          {evidenceError && <p className="notice error" role="alert">{evidenceError}</p>}
          {verificationMutation.isSuccess && <p className="admin-success" role="status">Organisation verification status updated.</p>}
          {accountMutation.isSuccess && <p className="admin-success" role="status">Charity account access updated. Organisation and donation history were retained.</p>}
          {loading ? (
            <div className="empty-state"><div className="spinner" />Loading registered organisations…</div>
          ) : visibleNgos.length === 0 ? (
            <div className="empty-state">
              <strong>{ngos.length ? 'No matching organisations' : 'No NGOs registered yet'}</strong>
              <span>{ngos.length ? 'Try a different name, contact, or registration reference.' : 'Registered charities will appear here.'}</span>
            </div>
          ) : (
            <div className="admin-table-scroll" role="region" aria-label="Registered NGOs, scroll horizontally to view all columns" tabIndex={0}>
              <table className="admin-table ngo-directory-table">
                <thead>
                  <tr>
                    <th>Organisation</th>
                    <th>Representative</th>
                    <th>Contact</th>
                    <th>Registration reference</th>
                    <th>ID evidence</th>
                    <th>Official link</th>
                    <th>Verification</th>
                    <th>Registered</th>
                    <th>Access</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleNgos.map((ngo) => (
                    <tr key={ngo.id}>
                      <td><strong>{ngo.organisation}</strong><span>NGO account</span></td>
                      <td>{ngo.fullName || 'Not provided'}</td>
                      <td>
                        {ngo.email ? <a className="ngo-contact-link" href={`mailto:${ngo.email}`}>{ngo.email}</a> : <span>—</span>}
                        {ngo.phone ? <a className="ngo-contact-link" href={`tel:${ngo.phone}`}>{ngo.phone}</a> : <small className="admin-city">Phone not provided</small>}
                      </td>
                      <td>{ngo.registrationNumber || 'Not provided'}</td>
                      <td>
                        <span>{ngo.idCardNumber || 'ID number not provided'}</span>
                        {ngo.idCardDocument ? (
                          <a className="ngo-contact-link" href={ngo.idCardDocument} target="_blank" rel="noreferrer">
                            View document
                          </a>
                        ) : ngo.idCardDocumentPath ? (
                          <button type="button" className="ngo-contact-link" onClick={() => viewIdCard(ngo)}>
                            View private document
                          </button>
                        ) : (
                          <small className="admin-city">Document not provided</small>
                        )}
                      </td>
                      <td>
                        {ngo.officialLink ? (
                          <a className="ngo-contact-link" href={ngo.officialLink} target="_blank" rel="noreferrer">
                            Open official link
                          </a>
                        ) : 'Not provided'}
                      </td>
                      <td>
                        <span className={`ngo-access-badge ${ngo.verificationStatus === 'verified' ? 'active' : ngo.verificationStatus === 'rejected' ? 'disabled' : ''}`}>
                          {ngo.verificationStatus === 'verified' ? 'Approved' : ngo.verificationStatus === 'rejected' ? 'Rejected' : ngo.needsInfo ? 'Information requested' : 'Pending'}
                        </span>
                        {ngo.reviewNote && <small className="admin-city">{ngo.reviewNote}</small>}
                        {ngo.verificationStatus !== 'verified' && (
                          <button
                            type="button"
                            className="admin-edit-button"
                            disabled={verificationMutation.isPending}
                            onClick={() => { setReviewingNgo(ngo); setReviewNote('') }}
                          >
                            Review
                          </button>
                        )}
                      </td>
                      <td>{formatDate(ngo.registeredAt)}</td>
                      <td>
                        <span className={`ngo-access-badge ${ngo.disabledAt ? 'disabled' : 'active'}`}>
                          {ngo.disabledAt ? 'Disabled' : 'Active'}
                        </span>
                        {ngo.disabledReason && <small className="admin-city">{ngo.disabledReason}</small>}
                      </td>
                      <td>
                        {ngo.disabledAt ? (
                          <button
                            type="button"
                            className="admin-edit-button"
                            onClick={() => { setSelectedNgo(ngo); setReason('') }}
                          >
                            Re-enable
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-remove-button"
                            onClick={() => { setSelectedNgo(ngo); setReason('') }}
                          >
                            Disable & remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      {reviewingNgo && (
        <div className="admin-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !verificationMutation.isPending) setReviewingNgo(null)
        }}>
          <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="ngo-review-title">
            <h2 id="ngo-review-title">Review {reviewingNgo.organisation}</h2>
            <p>Check the registration number, representative ID, uploaded document, and official link before deciding.</p>
            {!hasVerificationEvidence(reviewingNgo) && (
              <p className="notice error" role="status">Required evidence is incomplete. Approval will remain unavailable until the NGO submits it.</p>
            )}
            <label className="admin-reason-field">
              Review note
              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Required to reject or request more information"
              />
            </label>
            <div className="admin-dialog-actions">
              <button type="button" className="admin-edit-button" onClick={() => setReviewingNgo(null)} disabled={verificationMutation.isPending}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-edit-button"
                disabled={verificationMutation.isPending || !hasVerificationEvidence(reviewingNgo)}
                onClick={() => reviewNgo(reviewingNgo, 'approve')}
              >
                Approve
              </button>
              <button
                type="button"
                className="admin-remove-button"
                disabled={verificationMutation.isPending || !reviewNote.trim()}
                onClick={() => reviewNgo(reviewingNgo, 'request_info')}
              >
                Request information
              </button>
              <button
                type="button"
                className="admin-remove-button"
                disabled={verificationMutation.isPending || !reviewNote.trim()}
                onClick={() => reviewNgo(reviewingNgo, 'reject')}
              >
                Reject
              </button>
            </div>
          </section>
        </div>
      )}
      {selectedNgo && (
        <div className="admin-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !accountMutation.isPending) setSelectedNgo(null)
        }}>
          <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="ngo-action-title">
            <h2 id="ngo-action-title">{selectedNgo.disabledAt ? 'Re-enable charity account?' : 'Disable and remove charity?'}</h2>
            <p>
              {selectedNgo.disabledAt
                ? `${selectedNgo.organisation} will regain access to browsing, claiming, and account sign-in.`
                : `${selectedNgo.organisation} will be blocked from sign-in and all food workflows, and removed from the active charity network. Existing claims and donation history will be retained.`}
            </p>
            {!selectedNgo.disabledAt && (
              <label className="admin-reason-field">
                Reason for disabling
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  rows={3}
                  required
                  placeholder="Record why access is being disabled"
                />
              </label>
            )}
            <div className="admin-dialog-actions">
              <button type="button" className="admin-edit-button" onClick={() => setSelectedNgo(null)} disabled={accountMutation.isPending}>
                Keep account
              </button>
              <button
                type="button"
                className={selectedNgo.disabledAt ? 'admin-create-button' : 'admin-remove-button'}
                disabled={accountMutation.isPending || (!selectedNgo.disabledAt && reason.trim().length < 8)}
                onClick={() => setAccountStatus(!selectedNgo.disabledAt)}
              >
                {accountMutation.isPending ? 'Saving…' : selectedNgo.disabledAt ? 'Re-enable account' : 'Disable account'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
