import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Shell from '../components/Shell.jsx'
import { Button, Card, Field, Input, Modal, Textarea, Toast, EmptyState, LoadingState, ConfirmDialog } from '../components/UI.jsx'
import { getAdminActivities, createAdminActivity, updateAdminActivity, deleteAdminActivity } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const emptyForm = { activityName: '', vertical: '', maximumPoints: '', description: '', levels: [], deadline: '', important: false }

export default function ActivityManagement() {
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('stars_user') || '{}') } catch { return {} }
  }, [])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState(null)

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
      const res = await getAdminActivities()
      setActivities(res.data || [])
    } catch (error) {
      notify(error.message || 'Unable to load activities', 'error')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(activity) {
    setEditing(activity)
    setForm({
      activityName: activity.activityName || '',
      vertical: activity.vertical || '',
      maximumPoints: String(activity.maximumPoints ?? ''),
      description: activity.description || '',
      levels: Array.isArray(activity.levels) ? activity.levels.map((level) => ({ label: level.label || '', points: String(level.points ?? '') })) : [],
      deadline: activity.deadline ? String(activity.deadline).slice(0, 10) : '',
      important: Boolean(activity.important),
    })
    setFormOpen(true)
  }

  function setLevel(index, key, value) {
    const next = [...form.levels]
    next[index] = { ...next[index], [key]: value }
    setForm({ ...form, levels: next })
  }

  async function submit(e) {
    e.preventDefault()
    try {
      const payload = {
        activityName: form.activityName.trim(),
        vertical: form.vertical.trim(),
        maximumPoints: Number(form.maximumPoints),
        description: form.description.trim(),
        levels: form.levels,
        deadline: form.deadline || null,
        important: form.important,
      }
      if (editing) {
        await updateAdminActivity(editing._id, payload)
        notify('Activity updated successfully.')
      } else {
        await createAdminActivity(payload)
        notify('Activity created successfully.')
      }
      setFormOpen(false)
      await load()
    } catch (error) {
      notify(error.message || 'Unable to save activity', 'error')
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      await deleteAdminActivity(confirmDelete)
      notify('Activity and its submissions deleted.')
      await load()
    } catch (error) {
      notify(error.message || 'Unable to delete activity', 'error')
    } finally {
      setConfirmDelete(null)
    }
  }

  const grouped = useMemo(() => {
    const map = {}
    activities.forEach((activity) => {
      const key = activity.vertical || 'General'
      if (!map[key]) map[key] = []
      map[key].push(activity)
    })
    return map
  }, [activities])

  if (loading) {
    return (
      <Shell role="principal" userName={currentUser.name || 'Admin'} department={currentUser.department || 'Activities'}>
        <LoadingState rows={4} />
      </Shell>
    )
  }

  return (
    <Shell role="principal" userName={currentUser.name || 'Admin'} department={currentUser.department || 'Activities'}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">Activity Management</h1>
          <p className="mt-1.5 text-sm text-slate-500">Create and maintain the STAR activity catalogue used by students when submitting evidence.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 font-mono text-[11px] font-medium text-brand-600">
            {activities.length} activities
          </span>
          <Button onClick={openCreate}>+ New Activity</Button>
        </div>
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      <div className="mt-6 space-y-8">
        {Object.keys(grouped).length > 0 ? (
          Object.entries(grouped).map(([vertical, items]) => (
            <div key={vertical}>
              <h2 className="mb-3 flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">
                {vertical}
                <span className="rounded-full border border-rule bg-paper px-2 py-0.5 font-mono text-[10px] tracking-normal text-slate-500">{items.length}</span>
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((activity) => (
                  <Card key={activity._id} className="p-5 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-ink">{activity.activityName}</h3>
                      <span className="shrink-0 rounded-full border border-rule px-2.5 py-0.5 font-mono text-[11px] text-slate-500">{activity.maximumPoints} pts</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {activity.important && (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-700">Important</span>
                      )}
                      {activity.deadline && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rule px-2 py-0.5 font-mono text-[11px] text-slate-500">
                          ⏱ {new Date(activity.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {activity.description && <p className="mt-2 text-sm text-slate-500 line-clamp-2">{activity.description}</p>}
                    {Array.isArray(activity.levels) && activity.levels.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {activity.levels.slice(0, 3).map((level, index) => (
                          <li key={index} className="flex items-center justify-between text-xs text-slate-500">
                            <span>{level.label}</span>
                            <span className="font-mono">{level.points} pts</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-4 flex gap-2 pt-3 border-t border-rule">
                      <Button size="sm" variant="outline" onClick={() => openEdit(activity)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => setConfirmDelete(activity._id)}>Delete</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon="☆" title="No activities yet" description="Create your first STAR activity to let students start submitting evidence." />
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit activity' : 'New activity'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!form.activityName.trim() || !form.vertical.trim() || form.maximumPoints === ''}>{editing ? 'Save changes' : 'Create activity'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Activity name">
            <Input value={form.activityName} onChange={(e) => setForm({ ...form, activityName: e.target.value })} placeholder="e.g. Internship" />
          </Field>
          <Field label="Vertical">
            <Input value={form.vertical} onChange={(e) => setForm({ ...form, vertical: e.target.value })} placeholder="e.g. Vertical 1 - Academic Performance" />
          </Field>
          <Field label="Maximum points">
            <Input type="number" value={form.maximumPoints} onChange={(e) => setForm({ ...form, maximumPoints: e.target.value })} placeholder="e.g. 10" />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="What evidence does this activity require?" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Deadline" hint="Students get alerts as this date approaches.">
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </Field>
            <Field label="Mark as important">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-rule bg-paper px-3 py-2.5">
                <input type="checkbox" checked={form.important} onChange={(e) => setForm({ ...form, important: e.target.checked })} className="h-4 w-4 accent-amber-500" />
                <span className="text-sm text-slate-600">Trigger urgent alerts when the deadline is near</span>
              </label>
            </Field>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Levels (optional)</label>
              <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, levels: [...form.levels, { label: '', points: '' }] })}>+ Add level</Button>
            </div>
            {form.levels.map((level, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <Input value={level.label} onChange={(e) => setLevel(index, 'label', e.target.value)} placeholder="Level label" className="!flex-1" />
                <Input type="number" value={level.points} onChange={(e) => setLevel(index, 'points', e.target.value)} placeholder="pts" className="!w-24" />
                <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, levels: form.levels.filter((_, i) => i !== index) })}>✕</Button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete activity"
        message="This will permanently delete the activity and all of its submissions. This action cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={handleDelete}
      />
    </Shell>
  )
}