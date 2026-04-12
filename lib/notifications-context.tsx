'use client'

/**
 * NotificationsProvider — central client store for notifications.
 *
 * Responsibilities:
 *   • Fetch the last 10 days of notifications for the active restaurant
 *   • Subscribe to realtime INSERT/UPDATE/DELETE events on the notifications
 *     table so the bell badge updates live across tabs/devices
 *   • Expose imperative helpers: markRead, markAllRead, resolve, dismiss
 *   • Persist a "panel open/closed" UI state
 *
 * The bell + slide-over panel consume this via `useNotifications()`.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react'
import { useRestaurant } from './restaurant-context'
import { createClient } from './supabase/client'
import type { NotificationRow } from './notifications/types'

interface NotificationsContextValue {
  notifications: NotificationRow[]
  unreadCount:   number
  loading:       boolean
  panelOpen:     boolean
  openPanel:     () => void
  closePanel:    () => void
  togglePanel:   () => void
  refresh:       () => Promise<void>
  markRead:      (id: string) => Promise<void>
  markAllRead:   () => Promise<void>
  resolve:       (id: string) => Promise<void>
  dismiss:       (id: string) => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue>({
  notifications: [],
  unreadCount:   0,
  loading:       false,
  panelOpen:     false,
  openPanel:     () => {},
  closePanel:    () => {},
  togglePanel:   () => {},
  refresh:       async () => {},
  markRead:      async () => {},
  markAllRead:   async () => {},
  resolve:       async () => {},
  dismiss:       async () => {},
})

export function useNotifications() {
  return useContext(NotificationsContext)
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { restaurant } = useRestaurant()
  const supabase = useMemo(() => createClient(), [])

  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [loading, setLoading]             = useState(false)
  const [panelOpen, setPanelOpen]         = useState(false)

  // Used to drop stale fetches when the restaurant changes mid-request
  const fetchTokenRef = useRef(0)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!restaurant?.id) return
    const token = ++fetchTokenRef.current
    setLoading(true)
    try {
      const res = await fetch(
        `/api/notifications?restaurant_id=${restaurant.id}&limit=80`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      if (token !== fetchTokenRef.current) return
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unread_count ?? 0)
    } catch (err) {
      console.error('[notifications] fetch error', err)
    } finally {
      if (token === fetchTokenRef.current) setLoading(false)
    }
  }, [restaurant?.id])

  // Initial fetch + on restaurant change
  useEffect(() => {
    setNotifications([])
    setUnreadCount(0)
    if (restaurant?.id) refresh()
  }, [restaurant?.id, refresh])

  // Realtime subscription
  useEffect(() => {
    if (!restaurant?.id) return
    const channel = supabase
      .channel(`notif:${restaurant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          // Cheap re-fetch keeps both the list and the unread count in sync.
          refresh()
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurant?.id, supabase, refresh])

  // ── Mutators ───────────────────────────────────────────────────────────────
  const markRead = useCallback(async (id: string) => {
    // Optimistic — only decrement if the notification was actually unread
    let wasUnread = false
    setNotifications(prev => prev.map(n => {
      if (n.id === id && !n.is_read) { wasUnread = true; return { ...n, is_read: true, read_at: new Date().toISOString() } }
      return n
    }))
    if (wasUnread) setUnreadCount(c => Math.max(0, c - 1))
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      })
    } catch (err) {
      console.error('[notifications] markRead failed', err)
      refresh()
    }
  }, [refresh])

  const markAllRead = useCallback(async () => {
    if (!restaurant?.id) return
    setNotifications(prev => prev.map(n => n.is_read ? n : { ...n, is_read: true, read_at: new Date().toISOString() }))
    setUnreadCount(0)
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurant.id }),
      })
    } catch (err) {
      console.error('[notifications] markAllRead failed', err)
      refresh()
    }
  }, [restaurant?.id, refresh])

  const resolve = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id
      ? { ...n, is_read: true, read_at: new Date().toISOString(), resolved_at: new Date().toISOString() }
      : n))
    setUnreadCount(c => {
      const target = notifications.find(n => n.id === id)
      return target && !target.is_read ? Math.max(0, c - 1) : c
    })
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true, is_read: true }),
      })
    } catch (err) {
      console.error('[notifications] resolve failed', err)
      refresh()
    }
  }, [notifications, refresh])

  const dismiss = useCallback(async (id: string) => {
    const target = notifications.find(n => n.id === id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (target && !target.is_read) setUnreadCount(c => Math.max(0, c - 1))
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    } catch (err) {
      console.error('[notifications] dismiss failed', err)
      refresh()
    }
  }, [notifications, refresh])

  // ── Panel UI helpers ───────────────────────────────────────────────────────
  const openPanel  = useCallback(() => setPanelOpen(true), [])
  const closePanel = useCallback(() => setPanelOpen(false), [])
  const togglePanel = useCallback(() => setPanelOpen(o => !o), [])

  // Close on Escape
  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanelOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen])

  const value: NotificationsContextValue = {
    notifications,
    unreadCount,
    loading,
    panelOpen,
    openPanel,
    closePanel,
    togglePanel,
    refresh,
    markRead,
    markAllRead,
    resolve,
    dismiss,
  }

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}
