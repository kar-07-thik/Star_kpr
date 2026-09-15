import React, { Suspense, lazy, useEffect, useMemo, useState, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Shell from '../components/Shell.jsx'
import { StatCard, Modal, Button, PageHeader, Card, Toast, ConfirmDialog, EmptyState, LoadingState, Field, Input, Textarea, StatusBadge } from '../components/UI.jsx'
import { getHodSubmissions, getHodDashboard, verifyHodSubmission, bulkVerifyHodSubmissions, lockSemester, unlockSemester, getHodSemesterStatus, getHodLeaderboard, getHodAtRisk, getHodFacultyOverview, getHodStudentOverview, exportHodLeaderboard, exportHodFacultyOverview, getSubmissionFileBlob, exportHodSubmissions, runHodAiReview } from '../utils/api.js'
import { CircleCheck, CircleX, ClipboardCheck, GraduationCap, ShieldAlert } from 'lucide-react'

const PrincipalDashboard = lazy(() => import('./PrincipalDashboard.jsx'))

/* Hallmark Â· genre: editorial Â· macrostructure: Workbench Â· design-system: design.md Â· designed-as-app */

function HODHome({ stats, facultyOverview }) {
  const [atRisk, setAtRisk] = useState([])
  const [viewingId, setViewingId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    getHodAtRisk()
      .then((res) => { if (active) setAtRisk(res.data?.atRisk || []) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  return (
    <div className="hod-dashboard-surface space-y-6">
      <PageHeader icon={GraduationCap} title="HOD Dashboard" subtitle="Monitor faculty review workload and manage your department." />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard className="hod-animated-card hod-summary-card" icon={ClipboardCheck} label="Pending Faculty Reviews" value={facultyOverview.reduce((total, faculty) => total + (faculty.pendingReviews || 0), 0)} sub="Awaiting faculty review" accent="amber" />
        <StatCard className="hod-animated-card hod-summary-card" icon={CircleCheck} label="Approved" value={stats.approved} sub="This term" accent="leaf" />
        <StatCard className="hod-animated-card hod-summary-card" icon={CircleX} label="Rejected" value={stats.rejected} sub="Needs resubmission" accent="rose" />
        <StatCard className="hod-animated-card hod-summary-card" icon={ShieldAlert} label="At-Risk Students" value={atRisk.length} sub="No approved points yet" accent="brand" />
      </div>
      <Card className="hod-animated-card p-5">
        <h2 className="font-display text-lg font-semibold text-ink mb-3">Pending Faculty Reviews</h2>
        {facultyOverview.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                <tr>
                  <th className="text-left font-medium px-3 py-2.5">Faculty Name</th>
                  <th className="text-right font-medium px-3 py-2.5">Pending Reviews</th>
                </tr>
              </thead>
              <tbody>
                {facultyOverview.map((faculty) => (
                  <tr key={faculty._id} className="border-b border-rule">
                    <td className="px-3 py-2.5 font-medium text-ink">{faculty.name}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">{faculty.pendingReviews || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="âœ“" title="No faculty found" description="There are no faculty members in your department." />
        )}
      </Card>

      {atRisk.length > 0 && (
        <Card className="hod-animated-card p-5">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Students Needing Attention</h2>
              <p className="text-sm text-slate-400 mt-1">These students have no approved STAR points yet â€” consider following up.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/hod/leaderboard')}>View Leaderboard</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                <tr>
                  <th className="text-left font-medium px-3 py-2.5">Student</th>
                  <th className="text-left font-medium px-3 py-2.5">Register No</th>
                  <th className="text-left font-medium px-3 py-2.5">Batch</th>
                  <th className="text-right font-medium px-3 py-2.5">Approved SP</th>
                  <th className="text-right font-medium px-3 py-2.5">Profile</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.slice(0, 8).map((student) => (
                  <tr key={student._id} className="border-b border-rule transition-colors hover:bg-paper/60">
                    <td className="px-3 py-2.5 font-medium text-ink">{student.name}</td>
                    <td className="px-3 py-2.5 text-slate-500">{student.registerNumber || 'â€”'}</td>
                    <td className="px-3 py-2.5 text-slate-500">{student.batch || 'â€”'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">{student.totalPoints || 0}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="sm" variant="outline" onClick={() => setViewingId(student._id)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {atRisk.length > 8 && (
            <p className="mt-3 text-xs text-slate-400">+ {atRisk.length - 8} more at-risk students in your department.</p>
          )}
        </Card>
      )}

      <StudentOverviewModal studentId={viewingId} onClose={() => setViewingId(null)} />
    </div>
  )
}

function SemesterLockPage() {
  const [batch, setBatch] = useState('')
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(true)

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    let active = true
    getHodSemesterStatus()
      .then((res) => { if (active) setStatus(res.data) })
      .catch(() => { if (active) setStatus(null) })
      .finally(() => { if (active) setStatusLoading(false) })
    return () => { active = false }
  }, [])

  async function refreshStatus() {
    try {
      const res = await getHodSemesterStatus()
      setStatus(res.data)
    } catch {
      setStatus(null)
    }
  }

  async function runLockAction(action) {
    try {
      if (action === 'lock') {
        await lockSemester(batch)
        notify(batch ? `Semester locked for batch ${batch}.` : 'Semester locked for all batches.')
      } else {
        await unlockSemester(batch)
        notify(batch ? `Semester unlocked for batch ${batch}.` : 'Semester unlocked for all batches.')
      }
      await refreshStatus()
    } catch (err) {
      notify(err.message || `Unable to ${action} the semester`, 'error')
    } finally {
      setConfirm(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Semester Lock" subtitle="Lock or unlock semester submissions for students in your department." />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      {!statusLoading && status && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">Locked students</p>
            <p className="mt-2 font-display text-2xl font-semibold text-ink">{status.locked}</p>
            <p className="mt-1 text-xs text-slate-400">of {status.total || 0} students cannot submit.</p>
          </Card>
          <Card className="p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">Locked batches</p>
            <p className="mt-2 font-display text-2xl font-semibold text-ink">{status.batches?.filter((b) => b.locked > 0).length || 0}</p>
            <p className="mt-1 text-xs text-slate-400">Batches with locked students.</p>
          </Card>
          <Card className="p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">Open students</p>
            <p className="mt-2 font-display text-2xl font-semibold text-leaf-600">{status.unlocked}</p>
            <p className="mt-1 text-xs text-slate-400">Students can still submit evidence.</p>
          </Card>
        </div>
      )}

      <Card className="p-6 max-w-lg">
        <Field label="Batch (optional)" hint="Leave empty to apply to all batches.">
          <Input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="e.g. 2023-2026" />
        </Field>
        {!statusLoading && status?.batches?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {status.batches.map((item) => (
              <span
                key={item.name}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] ${
                  item.locked ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-leaf-200 bg-leaf-50 text-leaf-700'
                }`}
              >
                {item.name}: {item.locked}/{item.total} locked
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-3 mt-4">
          <Button
            variant="danger"
            onClick={() => setConfirm({ action: 'lock', title: 'Lock semester', message: `Lock semester submissions${batch ? ` for batch ${batch}` : ' for all batches'}? Students will not be able to submit or resubmit activities.` })}
          >
            Lock Semester
          </Button>
          <Button
            variant="success"
            onClick={() => setConfirm({ action: 'unlock', title: 'Unlock semester', message: `Unlock semester submissions${batch ? ` for batch ${batch}` : ' for all batches'}?` })}
          >
            Unlock Semester
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-4">When locked, students cannot submit or resubmit activities.</p>
      </Card>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.action === 'lock' ? 'Lock' : 'Unlock'}
        tone={confirm?.action === 'lock' ? 'danger' : 'success'}
        onConfirm={() => runLockAction(confirm.action)}
      />
    </div>
  )
}

// eslint-disable-next-line no-unused-vars
function VerifyPage() {
  const [submissions, setSubmissions] = useState([])
  const [, setStats] = useState({ pendingHOD: 0, approved: 0, rejected: 0, totalStudents: 0 })
  const [reviewing, setReviewing] = useState(null)
  const [score, setScore] = useState('')
  const [remarks, setRemarks] = useState('')
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkConfirm, setBulkConfirm] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkRemarks, setBulkRemarks] = useState('')
  const [flagged, setFlagged] = useState(false)
  const [search, setSearch] = useState('')
  const [aiReviewing, setAiReviewing] = useState(false)
  const [aiResult, setAiResult] = useState(null)

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const allSelected = submissions.length > 0 && submissions.every((s) => selectedIds.includes(s._id))

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : submissions.map((s) => s._id))
  }

  async function runBulkAction() {
    if (!bulkConfirm) return
    setBulkLoading(true)
    try {
      const ids = [...selectedIds]
      if (bulkConfirm.action === 'Rejected' && !bulkRemarks.trim()) {
        throw new Error('Rejection reason is required')
      }
      await bulkVerifyHodSubmissions(ids, bulkConfirm.action, bulkConfirm.action === 'Rejected' ? { hodRemarks: bulkRemarks } : {})
      const removed = new Set(ids)
      setSubmissions((prev) => prev.filter((s) => !removed.has(s._id)))
      setSelectedIds([])
      setBulkRemarks('')
      notify(`${ids.length} submission${ids.length === 1 ? '' : 's'} ${bulkConfirm.action === 'Approved' ? 'approved' : 'rejected'}`)
    } catch (err) {
      notify(err.message || 'Bulk verification failed', 'error')
    } finally {
      setBulkLoading(false)
      setBulkConfirm(null)
    }
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [subData, statsData] = await Promise.all([getHodSubmissions(50, flagged, search), getHodDashboard()])
        setSubmissions(subData.data.submissions || [])
        setStats(statsData.data)
      } catch (err) {
        notify(err.message || 'Unable to load submissions', 'error')
      } finally {
        setLoading(false)
      }
    }
    const timeout = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagged, search])

  async function handleVerify(status) {
    if (!reviewing) return
    try {
      await verifyHodSubmission(
        reviewing._id,
        status,
        status === 'Approved'
          ? { pointsAwarded: Number(score) || reviewing.suggestedPoints, hodRemarks: remarks }
          : { hodRemarks: remarks }
      )
      setSubmissions((prev) => prev.filter((s) => s._id !== reviewing._id))
      notify(`Submission ${status.toLowerCase()} successfully`)
      setReviewing(null)
    } catch (err) {
      notify(err.message || 'Verification failed', 'error')
    }
  }

  async function openEvidence(submissionId) {
    try {
      const blob = await getSubmissionFileBlob(submissionId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      notify(error.message || 'Unable to open evidence file', 'error')
    }
  }

  function openReview(sub) {
    setReviewing(sub)
    setScore(String(sub.suggestedPoints || sub.pointsAwarded || 0))
    setRemarks('')
    setAiResult(null)
  }

  async function handleAiReview() {
    if (!reviewing) return
    setAiReviewing(true)
    setAiResult(null)
    try {
      const res = await runHodAiReview(reviewing._id)
      setAiResult(res.data)
      notify('AI review complete')
    } catch (err) {
      notify(err.message || 'AI review failed', 'error')
    } finally {
      setAiReviewing(false)
    }
  }

  if (loading) return <LoadingState rows={4} />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verify Submissions"
        subtitle="Faculty-approved submissions awaiting your final verification."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant={flagged ? 'brand' : 'outline'} onClick={() => setFlagged((prev) => !prev)}>
              {flagged ? 'âœ“ Showing flagged' : 'âš‘ Flagged only'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportHodSubmissions('FacultyApproved')}>â¬‡ Export Excel</Button>
          </div>
        }
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student or activityâ€¦"
          className="!bg-card !border-rule md:!w-72"
        />
        <p className="text-xs text-slate-400">{submissions.length} submission{submissions.length === 1 ? '' : 's'} in queue</p>
      </div>

      {submissions.length > 0 ? (
        <Card className="overflow-hidden">
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-200 bg-brand-50/70 px-4 py-3">
              <p className="text-sm font-medium text-ink">{selectedIds.length} selected</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedIds([])}>Clear</Button>
                <Button size="sm" variant="danger" onClick={() => setBulkConfirm({ action: 'Rejected' })}>Reject selected</Button>
                <Button size="sm" variant="success" onClick={() => setBulkConfirm({ action: 'Approved' })}>Approve selected</Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-brand-500"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all submissions"
                  />
                </th>
                <th className="text-left font-medium px-4 py-3">Student</th>
                <th className="text-left font-medium px-4 py-3">Activity</th>
                <th className="text-left font-medium px-4 py-3">Verified by</th>
                <th className="text-left font-medium px-4 py-3">Suggested</th>
                <th className="text-right font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => (
<tr key={sub._id} className="border-b border-rule transition-colors hover:bg-paper/60">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-brand-500"
                      checked={selectedIds.includes(sub._id)}
                      onChange={() => toggleSelect(sub._id)}
                      aria-label={`Select submission for ${sub.studentId?.name || 'student'}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{sub.studentId?.name || 'Student'}</p>
                    <p className="text-xs text-slate-400">{sub.studentId?.regNo || sub.studentId?.registerNumber || ''}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{sub.activityId?.activityName || 'Activity'}</td>
                  <td className="px-4 py-3 text-slate-600">{sub.verifiedBy?.name || 'Faculty'}</td>
                  <td className="px-4 py-3 text-slate-500">{sub.suggestedPoints || 0} SP</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => openReview(sub)}>Review</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      ) : (
        <EmptyState icon="âœ“" title="Nothing to verify" description="No submissions are pending HOD approval right now." />
      )}

      <Modal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title={`Verify â€” ${reviewing?.studentId?.name || ''}`}
        footer={
          <>
            <Button variant="danger" onClick={() => handleVerify('Rejected')}>Reject</Button>
            <Button variant="success" onClick={() => handleVerify('Approved')}>Approve</Button>
          </>
        }
      >
        {reviewing && (
          <div className="space-y-4">
            <div className="rounded-md border border-rule p-4 space-y-2">
              <p className="text-sm font-semibold text-ink">{reviewing.activityId?.activityName}</p>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-md border border-rule bg-paper px-3 py-2.5">
                  <p className="text-xs text-slate-400">Student</p>
                  <p className="font-medium text-ink">{reviewing.studentId?.name || 'Student'}</p>
                </div>
                <div className="rounded-md border border-rule bg-paper px-3 py-2.5">
                  <p className="text-xs text-slate-400">Verified by</p>
                  <p className="font-medium text-ink">{reviewing.verifiedBy?.name || 'Faculty'}</p>
                </div>
                {reviewing.selectedLevel && (
                  <div className="rounded-md border border-rule bg-paper px-3 py-2.5">
                    <p className="text-xs text-slate-400">Level</p>
                    <p className="font-medium text-ink">{reviewing.selectedLevel}</p>
                  </div>
                )}
                {reviewing.durationWeeks && (
                  <div className="rounded-md border border-rule bg-paper px-3 py-2.5">
                    <p className="text-xs text-slate-400">Duration</p>
                    <p className="font-medium text-ink">{reviewing.durationWeeks}</p>
                  </div>
                )}
                {reviewing.activityType && (
                  <div className="rounded-md border border-rule bg-paper px-3 py-2.5">
                    <p className="text-xs text-slate-400">Activity type</p>
                    <p className="font-medium text-ink">{reviewing.activityType}</p>
                  </div>
                )}
                {reviewing.projectUrl && (
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5 sm:col-span-2">
                    <p className="text-xs text-slate-400">Project URL</p>
                    <a href={reviewing.projectUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-500 hover:underline break-all">{reviewing.projectUrl}</a>
                  </div>
                )}
              </div>
              {reviewing.description && <p className="text-xs text-slate-400">{reviewing.description}</p>}
            </div>

            {reviewing?.certificateFile?.fileName && (
              <div className="rounded-md border border-rule bg-paper p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">Evidence file</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{reviewing.certificateFile.fileName}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openEvidence(reviewing._id)}>Open file</Button>
              </div>
            )}

            <div className="rounded-md border border-rule bg-paper p-4 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-400">Faculty suggested marks</p>
              <p className="text-lg font-semibold text-ink">{reviewing.suggestedPoints || 0} SP</p>
            </div>

            <div className="rounded-md border border-rule bg-paper p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">AI-assisted review</p>
                  <p className="text-xs text-slate-400 mt-0.5">Runs the STAR rule engine / Gemini on the submission evidence.</p>
                </div>
                <Button size="sm" variant="outline" onClick={handleAiReview} loading={aiReviewing}>Run AI review</Button>
              </div>
              {aiResult && (
                <div className="mt-3 space-y-2 rounded-md border border-rule bg-paper p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium ${
                      aiResult.recommendation === 'Approve' ? 'bg-leaf-50 text-leaf-600' : aiResult.recommendation === 'Reject' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {aiResult.recommendation || 'Review'}
                    </span>
                    {aiResult.confidence !== undefined && aiResult.confidence !== null && (
                      <span className="font-mono text-xs text-slate-500">confidence {aiResult.confidence}%</span>
                    )}
                  </div>
                  {aiResult.suggestedPoints !== undefined && aiResult.suggestedPoints !== null && (
                    <p className="text-sm text-slate-600">Suggested points: <span className="font-medium text-ink">{aiResult.suggestedPoints}</span></p>
                  )}
                  {aiResult.reasoning && <p className="text-sm text-slate-500">{aiResult.reasoning}</p>}
                </div>
              )}
            </div>

            {reviewing.teacherRemarks && (
              <div className="rounded-md border border-rule bg-paper p-4 space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-400">Faculty feedback</p>
                <p className="text-sm text-slate-600">{reviewing.teacherRemarks}</p>
              </div>
            )}

            <Field label="Final marks">
              <Input type="number" value={score} onChange={(e) => setScore(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Remarks" hint="This feedback will be visible to the student.">
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Add remarks..." />
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!bulkConfirm}
        onClose={() => { setBulkConfirm(null); setBulkRemarks('') }}
        title={bulkConfirm?.action === 'Approved' ? 'Bulk approve submissions' : 'Bulk reject submissions'}
        message={
          bulkConfirm?.action === 'Approved'
            ? `Approve ${selectedIds.length} selected submission(s)? Each will use the faculty-suggested marks.`
            : `Reject ${selectedIds.length} selected submission(s)? Students will be asked to resubmit with clearer evidence.`
        }
        confirmLabel={bulkConfirm?.action === 'Approved' ? 'Approve' : 'Reject'}
        tone={bulkConfirm?.action === 'Approved' ? 'success' : 'danger'}
        onConfirm={runBulkAction}
        loading={bulkLoading}
        inputLabel={bulkConfirm?.action === 'Rejected' ? 'Rejection reason' : undefined}
        inputValue={bulkRemarks}
        onInputChange={setBulkRemarks}
        inputPlaceholder={bulkConfirm?.action === 'Rejected' ? 'Explain why submissions are being rejectedâ€¦' : undefined}
      />
    </div>
  )
}

function LeaderboardPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewingId, setViewingId] = useState(null)
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      await exportHodLeaderboard()
    } catch {
      // export failures surface via browser download errors; nothing else to do
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    let active = true
    getHodLeaderboard(25)
      .then((res) => { if (active) setEntries(res.data?.leaderboard || []) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const medalStyles = [
    { ring: 'border-amber-300', chip: 'bg-amber-100 text-amber-700', label: '1st' },
    { ring: 'border-slate-300', chip: 'bg-slate-200 text-slate-600', label: '2nd' },
    { ring: 'border-orange-300', chip: 'bg-orange-100 text-orange-700', label: '3rd' },
  ]

  if (loading) return <LoadingState rows={5} />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Department Leaderboard"
        subtitle="Top students in your department ranked by approved STAR points."
        actions={<Button variant="outline" onClick={handleExport} loading={exporting}>⬇ Export Excel</Button>}
      />

      {entries.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon="â˜…" title="No leaderboard yet" description="Students appear here once they earn approved STAR points." />
        </Card>
      ) : (
        <>
          {entries.length >= 3 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {entries.slice(0, 3).map((entry, index) => (
                <Card key={entry._id} className={`p-5 border-2 ${medalStyles[index].ring}`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${medalStyles[index].chip}`}>
                      {medalStyles[index].label}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink truncate">{entry.name}</p>
                      <p className="font-mono text-xs text-slate-400">{entry.registerNumber || 'â€”'}</p>
                    </div>
                    <span className="ml-auto font-mono text-xl font-semibold text-brand-500">{entry.totalPoints}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{entry.approvedSubmissions} approved submission{entry.approvedSubmissions === 1 ? '' : 's'}</p>
                </Card>
              ))}
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Rank</th>
                    <th className="text-left font-medium px-4 py-3">Student</th>
                    <th className="text-left font-medium px-4 py-3">Register No</th>
                    <th className="text-right font-medium px-4 py-3">Approved</th>
                    <th className="text-right font-medium px-4 py-3">STAR Points</th>
                    <th className="text-right font-medium px-4 py-3">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry._id} className="border-b border-rule transition-colors hover:bg-paper/60">
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-semibold ${
                          entry.rank <= 3 ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {entry.rank}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-ink">{entry.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{entry.registerNumber || 'â€”'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">{entry.approvedSubmissions}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-ink">{entry.totalPoints}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button size="sm" variant="outline" onClick={() => setViewingId(entry._id)}>View</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <StudentOverviewModal studentId={viewingId} onClose={() => setViewingId(null)} />
    </div>
  )
}

function FacultyOverviewPage() {
  const [faculty, setFaculty] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [expandedFacultyId, setExpandedFacultyId] = useState(null)

  useEffect(() => {
    let active = true
    getHodFacultyOverview()
      .then((res) => { if (active) setFaculty(res.data?.overview || []) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function handleExport() {
    setExporting(true)
    try {
      await exportHodFacultyOverview()
    } catch {
      // download errors surface in the browser; nothing else to do
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <LoadingState rows={5} />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty Overview"
        subtitle="Monitor faculty review workload and performance in your department."
        actions={<Button variant="outline" onClick={handleExport} loading={exporting}>⬇ Export Excel</Button>}
      />

      {faculty.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon="â˜°" title="No faculty found" description="Add faculty members from User Management to see their overview here." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Faculty" value={faculty.length} sub="In your department" accent="brand" />
            <StatCard label="Total Pending Reviews" value={faculty.reduce((total, item) => total + (item.pendingReviews || 0), 0)} sub="Awaiting faculty review" accent="amber" />
            <StatCard label="Total Reviewed" value={faculty.reduce((total, item) => total + (item.reviewed || 0), 0)} sub="Faculty review activity" accent="leaf" />
            <StatCard label="Total Approved" value={faculty.reduce((total, item) => total + (item.approved || 0), 0)} sub="Approved by faculty" accent="leaf" />
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-rule px-4 py-4 sm:px-6">
              <h2 className="font-display text-lg font-semibold text-ink">Faculty Review &amp; Performance</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[980px]">
                <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Faculty Name</th>
                    <th className="text-right font-medium px-4 py-3">Assigned Students</th>
                    <th className="text-right font-medium px-4 py-3">Pending Reviews</th>
                    <th className="text-right font-medium px-4 py-3">Reviewed</th>
                    <th className="text-right font-medium px-4 py-3">Approved</th>
                    <th className="text-right font-medium px-4 py-3">Rejected</th>
                    <th className="text-right font-medium px-4 py-3">Approval rate</th>
                    <th className="text-right font-medium px-4 py-3">STAR Points Awarded</th>
                    <th className="text-right font-medium px-4 py-3">Average Turnaround</th>
                    <th className="text-center font-medium px-4 py-3">Faculty Status</th>
                  </tr>
                </thead>
                <tbody>
                  {faculty.map((f) => (
                    <React.Fragment key={f._id}>
                    <tr className="border-b border-rule transition-colors hover:bg-paper/60">
                      <td className="px-4 py-3">
                        <button type="button" className="text-left font-medium text-ink hover:text-brand-600" onClick={() => setExpandedFacultyId((current) => current === f._id ? null : f._id)}>
                          {f.name} {expandedFacultyId === f._id ? '▲' : '▼'}
                        </button>
                        <p className="text-xs text-slate-400">{f.email || 'No email'}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">{f.assignedStudents}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">{f.pendingReviews || 0}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">{f.reviewed}</td>
                      <td className="px-4 py-3 text-right font-mono text-leaf-600">{f.approved}</td>
                      <td className="px-4 py-3 text-right font-mono text-rose-500">{f.rejected}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${
                          f.approvalRate >= 70 ? 'bg-leaf-50 text-leaf-600' : f.approvalRate >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {f.approvalRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">{f.totalPointsAwarded}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500">{f.avgTurnaroundDays}d</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={f.status} /></td>
                    </tr>
                    {expandedFacultyId === f._id && (
                      <tr className="border-b border-rule bg-paper/50">
                        <td colSpan="10" className="px-4 py-4">
                          <p className="mb-3 font-display text-sm font-semibold text-ink">Pending Reviews — {f.name}</p>
                          {f.pendingReviewItems?.length ? (
                            <table className="w-full text-sm">
                              <thead className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                                <tr><th className="text-left px-3 py-2">Student Name</th><th className="text-left px-3 py-2">Register Number</th><th className="text-left px-3 py-2">Activity</th><th className="text-left px-3 py-2">Submission Date</th><th className="text-left px-3 py-2">Current Status</th></tr>
                              </thead>
                              <tbody>{f.pendingReviewItems.map((item) => <tr key={item._id} className="border-t border-rule"><td className="px-3 py-2 text-ink">{item.studentName}</td><td className="px-3 py-2 text-slate-600">{item.registerNumber || '—'}</td><td className="px-3 py-2 text-slate-600">{item.activity}</td><td className="px-3 py-2 text-slate-600">{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : '—'}</td><td className="px-3 py-2 text-slate-600">{item.status}</td></tr>)}</tbody>
                            </table>
                          ) : <p className="text-sm text-slate-400">No pending reviews.</p>}
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

// eslint-disable-next-line no-unused-vars
function FacultyReviewMonitoringPage() {
  const [faculty, setFaculty] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getHodFacultyOverview()
      .then((res) => { if (active) setFaculty(res.data?.overview || []) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) return <LoadingState rows={5} />

  const totalPending = faculty.reduce((total, item) => total + (item.pendingReviews || 0), 0)
  const totalReviewed = faculty.reduce((total, item) => total + (item.reviewed || 0), 0)
  const totalApproved = faculty.reduce((total, item) => total + (item.approved || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Faculty Review Monitoring" subtitle="Monitor current faculty review workload and activity in your department." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Faculty" value={faculty.length} sub="In your department" accent="brand" />
        <StatCard label="Total Pending Reviews" value={totalPending} sub="Awaiting faculty review" accent="amber" />
        <StatCard label="Total Reviewed" value={totalReviewed} sub="Faculty review activity" accent="leaf" />
        <StatCard label="Total Approved" value={totalApproved} sub="Approved by faculty" accent="leaf" />
      </div>
      <Card className="overflow-hidden">
        <div className="border-b border-rule px-4 py-4 sm:px-6">
          <h2 className="font-display text-lg font-semibold text-ink">Faculty Review Status</h2>
        </div>
        {faculty.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Faculty Name</th>
                  <th className="text-right font-medium px-4 py-3">Assigned Students</th>
                  <th className="text-right font-medium px-4 py-3">Pending Reviews</th>
                  <th className="text-right font-medium px-4 py-3">Reviewed</th>
                  <th className="text-right font-medium px-4 py-3">Approved</th>
                  <th className="text-right font-medium px-4 py-3">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {faculty.map((item) => (
                  <tr key={item._id} className="border-b border-rule transition-colors hover:bg-paper/60">
                    <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">{item.assignedStudents}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">{item.pendingReviews || 0}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">{item.reviewed}</td>
                    <td className="px-4 py-3 text-right font-mono text-leaf-600">{item.approved}</td>
                    <td className="px-4 py-3 text-right font-mono text-rose-500">{item.rejected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6"><EmptyState icon="â˜°" title="No faculty found" description="There are no faculty members in your department." /></div>
        )}
      </Card>
    </div>
  )
}

function StudentOverviewModal({ studentId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!studentId) return
    let active = true
    setLoading(true)
    setData(null)
    getHodStudentOverview(studentId)
      .then((res) => { if (active) setData(res.data) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [studentId])

  return (
    <Modal open={!!studentId} onClose={onClose} title={data?.student?.name || 'Student Overview'} subtitle={data ? `${data.student.registerNumber || ''} Â· ${data.student.batch || ''}` : 'Loadingâ€¦'}>
      {loading || !data ? (
        <LoadingState rows={3} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-md border border-rule bg-paper p-3 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">Total SP</p>
              <p className="mt-1 font-display text-xl font-semibold text-brand-500">{data.student.totalPoints}</p>
            </div>
            <div className="rounded-md border border-rule bg-paper p-3 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">Approved</p>
              <p className="mt-1 font-display text-xl font-semibold text-ink">{data.totals.approvedCount}</p>
            </div>
            <div className="rounded-md border border-rule bg-paper p-3 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">Rejected</p>
              <p className="mt-1 font-display text-xl font-semibold text-rose-500">{data.totals.rejectedCount}</p>
            </div>
          </div>

          {data.verticalBreakdown.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-ink mb-2">Vertical strengths</h4>
              <div className="flex flex-wrap gap-1.5">
                {data.verticalBreakdown.map((v) => (
                  <span key={v.vertical} className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper px-2.5 py-1 text-xs">
                    <span className="font-medium text-ink">{v.vertical}</span>
                    <span className="font-mono text-[11px] text-brand-500">{v.points} SP</span>
                    <span className="font-mono text-[10px] text-slate-400">({v.submissions})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-ink mb-2">Recent submissions</h4>
            {data.recentSubmissions.length > 0 ? (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {data.recentSubmissions.map((s) => (
                  <div key={s._id} className="flex items-center justify-between gap-2 rounded-md border border-rule bg-paper px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{s.activity}</p>
                      <p className="text-[11px] text-slate-400">{s.vertical} Â· {new Date(s.submittedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={s.status} />
                      <span className="font-mono text-xs text-slate-500">{s.points} SP</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="â—‹" title="No submissions yet" description="This student has not submitted any activities." />
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function HODDashboard() {
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('stars_user') || '{}') } catch { return {} }
  }, [])
  return (
    <Shell role="hod" userName={currentUser.name || 'HOD'} department={currentUser.department || 'Department'}>
      <Routes>
        <Route path="" element={<HODHomeWrapper />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="faculty" element={<FacultyOverviewPage />} />
        <Route path="semester" element={<SemesterLockPage />} />
        <Route path="users" element={<Suspense fallback={<LoadingState rows={3} />}><PrincipalDashboard embedded /></Suspense>} />
        <Route path="*" element={<Navigate to="/hod" replace />} />
      </Routes>
    </Shell>
  )
}

function HODHomeWrapper() {
  const [stats, setStats] = useState({ pendingHOD: 0, approved: 0, rejected: 0, totalStudents: 0 })
  const [facultyOverview, setFacultyOverview] = useState([])
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [statsData, facultyData] = await Promise.all([getHodDashboard(), getHodFacultyOverview()])
        setStats(statsData.data)
        setFacultyOverview(facultyData.data?.overview || [])
      } catch (err) {
        setToast({ message: err.message || 'Unable to load dashboard', tone: 'error' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <LoadingState rows={3} />
  if (toast) return <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
  return <HODHome stats={stats} facultyOverview={facultyOverview} />
}
