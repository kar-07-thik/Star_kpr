import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Button, Field, Input, ThemeToggle } from '../components/UI.jsx'
import { updateStudentProfile, getStudentProfile } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const EARNED_STATUSES = ['FacultyApproved', 'HODApproved', 'Approved']
const POINTS_TARGET = 200
const MILESTONES = [0, 50, 100, 150, 200]

const VERTICAL_LABELS = {
  academic: 'Academic Performance',
  innovation: 'Innovation & Research',
  leadership: 'Leadership & Governance',
  community: 'Community Engagement',
  culture: 'Cultural & Sports',
  professional: 'Professional Development',
  entrepreneurship: 'Entrepreneurship',
  global: 'Global Exposure',
  social: 'Social Responsibility',
  digital: 'Digital Skills',
}

function normalizeVerticalKey(value = '') {
  const text = String(value || '').toLowerCase()
  if (text.includes('academic')) return 'academic'
  if (text.includes('innovation') || text.includes('research')) return 'innovation'
  if (text.includes('leadership') || text.includes('governance')) return 'leadership'
  if (text.includes('community') || text.includes('engagement')) return 'community'
  if (text.includes('culture') || text.includes('sports')) return 'culture'
  if (text.includes('professional') || text.includes('development')) return 'professional'
  if (text.includes('entrepreneur')) return 'entrepreneurship'
  if (text.includes('global') || text.includes('international')) return 'global'
  if (text.includes('social') || text.includes('responsibility')) return 'social'
  if (text.includes('digital') || text.includes('technology')) return 'digital'
  return null
}

function StarTrack({ points, initial }) {
  const target = Math.min(100, Math.max(0, ((Number(points) || 0) / POINTS_TARGET) * 100))
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setPct(target), 120)
    return () => clearTimeout(timer)
  }, [target])

  return (
    <div className="px-5 pb-2 pt-5">
      <div className="relative">
        <div className="h-1.5 w-full rounded-full bg-slate-200/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-leaf-500 transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        {MILESTONES.map((m) => (
          <span
            key={m}
            className="absolute -top-[2px] h-2.5 w-px bg-slate-300"
            style={{ left: `${(m / POINTS_TARGET) * 100}%` }}
          />
        ))}
        <div
          className="absolute -top-6 -translate-x-1/2 transition-all duration-700 ease-out"
          style={{ left: `${pct}%` }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-leaf-200 bg-ink font-display text-xs font-semibold text-paper shadow-md">
            {initial}
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-between">
        {MILESTONES.map((m) => (
          <span key={m} className="font-mono text-[10px] text-slate-400">{m}</span>
        ))}
      </div>
      <div className="mt-3 flex items-baseline justify-center gap-2">
        <span className="tabular font-mono text-xl font-semibold text-ink">{Number(points) || 0}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">of {POINTS_TARGET} STAR points</span>
      </div>
    </div>
  )
}

function VerticalBars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  if (data.length === 0) {
    return <p className="text-sm text-slate-400">No approved points yet — track your verticals as they grow.</p>
  }
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.key}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-slate-500">{VERTICAL_LABELS[item.key] || item.key}</span>
            <span className="tabular shrink-0 font-mono font-medium text-ink">{item.value} pts · {item.count}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-500 transition-all duration-700" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function DefinitionList({ items }) {
  return (
    <dl>
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[150px_1fr] gap-4 border-t border-rule py-2.5 text-sm">
          <dt className="text-slate-400">{item.label}</dt>
          <dd className="font-medium text-ink">{item.value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function StudentProfileModal({ student, points, submissions = [], onProfileUpdate }) {
  const [profileData, setProfileData] = useState(student)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', department: '', school: '', section: '', semesterBatch: '', phoneNumber: '', dob: '' })
  const [validationErrors, setValidationErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    setProfileData(student)
    setEditForm({
      name: student?.name || '',
      department: student?.department || '',
      school: student?.school || '',
      section: student?.section || '',
      semesterBatch: student?.semesterBatch || student?.semester || '',
      phoneNumber: student?.phoneNumber || student?.mobileNumber || '',
      dob: student?.dob || '',
    })
    setValidationErrors({})
  }, [student])

  const verticalAnalytics = useMemo(() => {
    const sums = new Map()
    const counts = new Map()
    for (const sub of submissions || []) {
      if (!EARNED_STATUSES.includes(sub.status)) continue
      const verticalName = sub.activityId?.vertical || sub.vertical || 'General'
      const key = normalizeVerticalKey(verticalName) || verticalName
      const pts = Number(sub.pointsAwarded) || 0
      sums.set(key, (sums.get(key) || 0) + pts)
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return [...sums.entries()]
      .map(([key, value]) => ({ key, value, count: counts.get(key) || 0 }))
      .sort((a, b) => b.value - a.value)
  }, [submissions])

  const statusLabel = profileData?.status === 'Inactive' || profileData?.isActive === false ? 'Inactive' : 'Active'
  const statusTone = statusLabel === 'Active' ? 'bg-leaf-100 text-leaf-600 border-leaf-300/50' : 'bg-amber-100 text-amber-700 border-amber-200'

  function openEdit() {
    setEditForm({
      name: profileData?.name || '',
      department: profileData?.department || '',
      school: profileData?.school || '',
      section: profileData?.section || '',
      semesterBatch: profileData?.semesterBatch || profileData?.semester || '',
      phoneNumber: profileData?.phoneNumber || profileData?.mobileNumber || '',
      dob: profileData?.dob || '',
    })
    setValidationErrors({})
    setIsEditOpen(true)
  }

  async function handleSave() {
    const nextErrors = {}

    if (!editForm.name.trim()) nextErrors.name = 'Full name is required.'
    if (!editForm.department.trim()) nextErrors.department = 'Department is required.'
    if (!editForm.school.trim()) nextErrors.school = 'School is required.'
    if (!editForm.section.trim()) nextErrors.section = 'Section is required.'
    if (!editForm.semesterBatch.trim()) nextErrors.semesterBatch = 'Semester or batch is required.'
    if (!editForm.phoneNumber.trim()) nextErrors.phoneNumber = 'Mobile number is required.'
    if (!editForm.dob) nextErrors.dob = 'Date of birth is required.'

    if (Object.keys(nextErrors).length) {
      setValidationErrors(nextErrors)
      setToast('Please complete all required fields before saving.')
      setTimeout(() => setToast(''), 2400)
      return
    }

    try {
      setSaving(true)
      const response = await updateStudentProfile({
        name: editForm.name.trim(),
        department: editForm.department.trim(),
        school: editForm.school.trim(),
        section: editForm.section.trim(),
        semesterBatch: editForm.semesterBatch.trim(),
        phoneNumber: editForm.phoneNumber.trim(),
        dob: editForm.dob,
      })

      let updatedStudent = response?.data || { ...profileData, ...editForm, phoneNumber: editForm.phoneNumber.trim(), dob: editForm.dob }

      try {
        const refreshed = await getStudentProfile()
        if (refreshed?.data) {
          updatedStudent = refreshed.data
        }
      } catch (refreshError) {
        console.warn('Unable to refresh profile after update', refreshError)
      }

      setProfileData(updatedStudent)
      onProfileUpdate?.(updatedStudent)
      setValidationErrors({})
      setIsEditOpen(false)
      setToast('Profile updated successfully.')
      setTimeout(() => setToast(''), 2400)
    } catch (error) {
      setToast(error.message || 'Unable to update profile')
      setTimeout(() => setToast(''), 2400)
    } finally {
      setSaving(false)
    }
  }

  if (!profileData) {
    return (
      <div className="w-full animate-pulse space-y-4">
        <div className="h-24 rounded-md bg-slate-200" />
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="h-72 rounded-md bg-slate-100" />
          <div className="space-y-4">
            <div className="h-40 rounded-md bg-slate-100" />
            <div className="h-40 rounded-md bg-slate-100" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {toast && (
        <div className="border-b border-brand-200 bg-brand-100/70 px-6 py-3 text-sm font-medium text-brand-800">{toast}</div>
      )}

      <div className="flex flex-col gap-4 border-b border-rule px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Student profile</p>
          <h3 className="mt-1 truncate font-display text-2xl font-semibold tracking-tight text-ink">{profileData.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{profileData.department || 'Department'} · {profileData.school || 'School'}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-400">Register No.</p>
          <p className="tabular border-l border-rule pl-3 font-mono text-sm font-medium text-ink">{profileData.registerNumber || profileData.regNo || '—'}</p>
        </div>
      </div>

      <div className="grid gap-8 p-6 lg:grid-cols-[240px_1fr]">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ink font-display text-3xl font-semibold text-paper">
            {profileData.name?.[0] || 'S'}
          </div>
          <h4 className="mt-4 font-display text-lg font-semibold tracking-tight text-ink">{profileData.name}</h4>
          <p className="tabular mt-1 font-mono text-xs text-slate-400">{profileData.registerNumber || profileData.regNo || '—'}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <span className={`rounded-full border px-3 py-0.5 font-mono text-[11px] font-medium ${statusTone}`}>{statusLabel}</span>
            <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-0.5 font-mono text-[11px] font-medium text-brand-700">{points} pts</span>
          </div>
          <div className="mt-6 w-full">
            <Button className="w-full justify-center" onClick={openEdit}>Edit Profile</Button>
          </div>
        </div>

        <div className="space-y-8">
          <section>
            <h4 className="font-display text-base font-semibold tracking-tight text-ink">Personal Information</h4>
            <div className="mt-2">
              <DefinitionList
                items={[
                  { label: 'Full Name', value: profileData.name },
                  { label: 'Email', value: profileData.email },
                  { label: 'Mobile Number', value: profileData.phoneNumber || profileData.mobileNumber },
                  { label: 'Date of Birth', value: profileData.dob },
                ]}
              />
            </div>
          </section>

          <section>
            <h4 className="font-display text-base font-semibold tracking-tight text-ink">Academic Information</h4>
            <div className="mt-2">
              <DefinitionList
                items={[
                  { label: 'Register Number', value: profileData.registerNumber || profileData.regNo },
                  { label: 'Department', value: profileData.department },
                  { label: 'School', value: profileData.school },
                  { label: 'Batch', value: profileData.batch },
                  { label: 'Semester', value: profileData.semester },
                  { label: 'Section', value: profileData.section },
                  { label: 'Faculty Mentor', value: profileData.facultyMentor },
                  { label: 'HOD', value: profileData.hod },
                ]}
              />
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h4 className="font-display text-base font-semibold tracking-tight text-ink">STAR Analytics</h4>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">Tracked</p>
                  <p className="tabular font-mono text-lg font-semibold text-leaf-600">{points}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">Verticals</p>
                  <p className="tabular font-mono text-lg font-semibold text-ink">{verticalAnalytics.length}</p>
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-md border border-rule bg-paper">
              <StarTrack points={points} initial={profileData.name?.[0] || 'S'} />
            </div>
            <div className="mt-3 rounded-md border border-rule bg-paper p-4">
              <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">Points by vertical</p>
              <VerticalBars data={verticalAnalytics} />
            </div>
          </section>
        </div>
      </div>

      <Modal open={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Profile">
        <div className="space-y-4">
          <Field label="Full Name" error={validationErrors.name}>
            <Input invalid={!!validationErrors.name} value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department" error={validationErrors.department}>
              <Input invalid={!!validationErrors.department} value={editForm.department} onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))} />
            </Field>
            <Field label="School" error={validationErrors.school}>
              <Input invalid={!!validationErrors.school} value={editForm.school} onChange={(e) => setEditForm((prev) => ({ ...prev, school: e.target.value }))} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Section" error={validationErrors.section}>
              <Input invalid={!!validationErrors.section} value={editForm.section} onChange={(e) => setEditForm((prev) => ({ ...prev, section: e.target.value }))} />
            </Field>
            <Field label="Semester / Batch" error={validationErrors.semesterBatch}>
              <Input invalid={!!validationErrors.semesterBatch} value={editForm.semesterBatch} onChange={(e) => setEditForm((prev) => ({ ...prev, semesterBatch: e.target.value }))} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mobile Number" error={validationErrors.phoneNumber}>
              <Input invalid={!!validationErrors.phoneNumber} value={editForm.phoneNumber} onChange={(e) => setEditForm((prev) => ({ ...prev, phoneNumber: e.target.value }))} />
            </Field>
            <Field label="Date of Birth" error={validationErrors.dob}>
              <Input invalid={!!validationErrors.dob} type="date" value={editForm.dob} onChange={(e) => setEditForm((prev) => ({ ...prev, dob: e.target.value }))} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Register Number">
              <Input value={profileData?.registerNumber || profileData?.regNo || ''} readOnly disabled className="!bg-paper !text-slate-500" />
            </Field>
            <Field label="Email">
              <Input value={profileData?.email || ''} readOnly disabled className="!bg-paper !text-slate-500" />
            </Field>
          </div>
          <ThemeToggle />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
        </div>
      </Modal>
    </div>
  )
}