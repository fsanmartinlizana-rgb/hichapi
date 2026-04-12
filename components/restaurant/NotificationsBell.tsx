'use client'

/**
 * NotificationsBell — sits in the sidebar header.
 *   • Shows the unread count as a small badge
 *   • Toggles the slide-over notifications panel
 *
 * The actual list/panel UI lives in `NotificationsPanel`, mounted alongside
 * the bell so it can portal over the rest of the layout.
 */

import { Bell } from 'lucide-react'
import { useNotifications } from '@/lib/notifications-context'
import { NotificationsPanel } from './NotificationsPanel'

export function NotificationsBell() {
  const { unreadCount, togglePanel, panelOpen } = useNotifications()

  const display = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <>
      <button
        type="button"
        onClick={togglePanel}
        aria-label="Notificaciones"
        aria-expanded={panelOpen}
        className={[
          'relative w-8 h-8 rounded-lg flex items-center justify-center transition-all',
          panelOpen
            ? 'bg-[#FF6B35]/20 text-[#FF6B35]'
            : 'bg-white/5 text-white/55 hover:text-white hover:bg-white/10',
        ].join(' ')}
      >
        <Bell size={14} strokeWidth={2} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#FF6B35] text-white text-[9px] font-bold flex items-center justify-center border border-[#0F0F1C] shadow-sm shadow-[#FF6B35]/40"
          >
            {display}
          </span>
        )}
      </button>

      <NotificationsPanel />
    </>
  )
}
