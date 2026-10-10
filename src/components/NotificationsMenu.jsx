import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '../context/useAuth'
import { supabase } from '../lib/supabaseClient'

function notificationTarget(notification, role) {
  if (!notification.donation_id) return null
  return role === 'ngo'
    ? `/ngo/listings/${notification.donation_id}`
    : role === 'donor'
      ? '/donor/listings'
      : null
}

export default function NotificationsMenu() {
  const { user, role } = useAuth()
  const [open, setOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const queryClient = useQueryClient()

  const { data: notifications = [], error } = useQuery({
    queryKey: ['notifications', user?.id],
    enabled: Boolean(supabase && user?.id),
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from('user_notifications')
        .select('id, event_type, title, message, donation_id, read_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (queryError) throw queryError
      return data ?? []
    },
  })

  useEffect(() => {
    if (!supabase || !user?.id) return undefined
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => queryClient.invalidateQueries({ queryKey: ['notifications', user.id] }))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [queryClient, user?.id])

  async function markRead(notification) {
    if (notification.read_at) return
    setActionError('')
    const { error: updateError } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notification.id)
      .eq('user_id', user.id)
    if (updateError) {
      setActionError(`Could not mark notification as read: ${updateError.message}`)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['notifications', user.id] })
  }

  if (!supabase || !user?.id) return null
  const unreadCount = notifications.filter((notification) => !notification.read_at).length

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-full border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{unreadCount}</span>}
      </button>
      {open && (
        <section className="absolute right-0 top-full z-[60] mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" aria-label="Notifications">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="font-bold text-slate-900">Notifications</h2>
          </div>
          {error ? (
            <p className="p-4 text-sm text-rose-700">Could not load notifications: {error.message}</p>
          ) : notifications.length ? (
            <>
            {actionError && <p className="px-4 pt-3 text-xs text-rose-700" role="alert">{actionError}</p>}
            <ul className="max-h-[min(70vh,32rem)] overflow-auto">
              {notifications.map((notification) => {
                const target = notificationTarget(notification, role)
                const content = (
                  <>
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.read_at ? 'bg-slate-200' : 'bg-emerald-600'}`} />
                    <span>
                      <strong className="block text-sm text-slate-900">{notification.title}</strong>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-600">{notification.message}</span>
                      <time className="mt-1 block text-[11px] text-slate-400">{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.created_at))}</time>
                    </span>
                  </>
                )
                return (
                  <li key={notification.id} className="border-b border-slate-50 last:border-0">
                    {target ? (
                      <Link to={target} onClick={() => { markRead(notification); setOpen(false) }} className="flex gap-3 px-4 py-3 hover:bg-slate-50">
                        {content}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => markRead(notification)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50">
                        {content}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
            </>
          ) : (
            <div>
              {actionError && <p className="px-4 pt-3 text-xs text-rose-700" role="alert">{actionError}</p>}
              <p className="p-4 text-sm text-slate-500">You’re all caught up.</p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
