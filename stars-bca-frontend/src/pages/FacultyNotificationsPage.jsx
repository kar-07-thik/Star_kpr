import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, EmptyState, LoadingState, Toast } from '../components/UI.jsx'
import Shell from '../components/Shell.jsx'
import { getTeacherNotifications, markTeacherNotificationRead, markAllTeacherNotificationsRead, deleteTeacherNotification, deleteTeacherNotifications } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const TYPE_LABEL = {
  submission: 'Submission',
  appeal: 'Appeal',
  semester: 'Semester',
  deadline: 'Deadline',
  system: 'System',
}

export default function FacultyNotificationsPage({ onUnreadChange }) {
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('stars_user') || '{}') } catch { return {} }
  }, [])
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [removing, setRemoving] = useState(false)

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    try {
      const res = await getTeacherNotifications(1, 50)
      setNotifications(res.data?.notifications || [])
      setUnread(res.data?.unread || 0)
      setSelected(new Set())
      onUnreadChange?.(res.data?.unread || 0)
    } catch (error) {
      notify(error.message || 'Unable to load notifications', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkRead(id) {
    try {
      await markTeacherNotificationRead(id)
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)))
      const nextUnread = Math.max(0, unread - 1)
      setUnread(nextUnread)
      onUnreadChange?.(nextUnread)
    } catch (error) {
      notify(error.message || 'Unable to update notification', 'error')
    }
  }

  async function handleMarkAll() {
    try {
      await markAllTeacherNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnread(0)
      onUnreadChange?.(0)
    } catch (error) {
      notify(error.message || 'Unable to update notifications', 'error')
    }
  }

  async function handleDelete(id) {
    const notification = notifications.find((n) => n._id === id)
    try {
      await deleteTeacherNotification(id)
      const removedUnread = notification && !notification.read ? 1 : 0
      setNotifications((prev) => prev.filter((n) => n._id !== id))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      const nextUnread = Math.max(0, unread - removedUnread)
      setUnread(nextUnread)
      onUnreadChange?.(nextUnread)
      notify('Notification removed')
    } catch (error) {
      notify(error.message || 'Unable to remove notification', 'error')
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const allSelected = notifications.length > 0 && selected.size === notifications.length

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(notifications.map((n) => n._id)))
  }

  async function handleRemoveSelected() {
    if (selected.size === 0) return
    setRemoving(true)
    try {
      await deleteTeacherNotifications([...selected])
      const removedUnread = notifications.filter((n) => selected.has(n._id) && !n.read).length
      setNotifications((prev) => prev.filter((n) => !selected.has(n._id)))
      setSelected(new Set())
      const nextUnread = Math.max(0, unread - removedUnread)
      setUnread(nextUnread)
      onUnreadChange?.(nextUnread)
      notify(`${selected.size} notification${selected.size === 1 ? '' : 's'} removed`)
    } catch (error) {
      notify(error.message || 'Unable to remove notifications', 'error')
    } finally {
      setRemoving(false)
    }
  }

  if (loading) {
    return (
      <Shell role="faculty" userName={currentUser.name || 'Faculty'} department={currentUser.department || 'Department'} badges={{ '/faculty/notifications': unread }}>
        <LoadingState rows={4} />
      </Shell>
    )
  }

  return (
    <Shell role="faculty" userName={currentUser.name || 'Faculty'} department={currentUser.department || 'Department'} badges={{ '/faculty/notifications': unread }}>
      <div className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">Notifications</h1>
          <p className="mt-1.5 text-sm text-slate-500">Updates on submissions awaiting your review.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unread > 0 && (
            <Button variant="outline" onClick={handleMarkAll}>Mark all as read</Button>
          )}
          {selected.size > 0 && (
            <Button variant="danger" onClick={handleRemoveSelected} loading={removing}>
              Remove selected ({selected.size})
            </Button>
          )}
        </div>
      </div>

      {notifications.length > 0 ? (
        <>
          <div className="flex items-center gap-3 rounded-md border border-rule bg-card px-4 py-2.5">
            <label className="flex items-center gap-2.5 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-rule accent-brand-600"
              />
              Select all
            </label>
            <span className="font-mono text-[11px] text-slate-400">
              {selected.size > 0 ? `${selected.size} of ${notifications.length} selected` : `${notifications.length} notifications`}
            </span>
          </div>

          <Card className="divide-y divide-rule">
            {notifications.map((notification) => {
              const isSelected = selected.has(notification._id)
              return (
                <div
                  key={notification._id}
                  className={`group flex items-start gap-4 px-5 py-4 transition-colors ${isSelected ? 'bg-brand-50/60' : notification.read ? 'opacity-70' : 'hover:bg-paper/60'}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(notification._id)}
                    className="mt-1.5 h-4 w-4 shrink-0 rounded border-rule accent-brand-600"
                    aria-label="Select notification"
                  />
                  <button
                    type="button"
                    onClick={() => !notification.read && handleMarkRead(notification._id)}
                    className="flex min-w-0 flex-1 items-start gap-4 text-left"
                    aria-label={notification.read ? 'Notification details' : 'Mark as read'}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.read ? 'bg-slate-200' : 'bg-brand-500'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{notification.title}</span>
                        <span className="rounded-full border border-rule px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
                          {TYPE_LABEL[notification.type] || notification.type}
                        </span>
                      </span>
                      {notification.message && <span className="mt-1 block text-sm text-slate-500">{notification.message}</span>}
                      <span className="mt-1 block font-mono text-[11px] text-slate-400">{new Date(notification.createdAt).toLocaleString()}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(notification._id)}
                    className="shrink-0 rounded-full p-1.5 text-lg leading-none text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 focus-ring"
                    aria-label="Remove notification"
                    title="Remove notification"
                  >
                    &times;
                  </button>
                </div>
              )
            })}
          </Card>
        </>
      ) : (
        <EmptyState icon="○" title="No notifications yet" description="New submissions awaiting your review will appear here." />
      )}
      </div>
    </Shell>
  )
}