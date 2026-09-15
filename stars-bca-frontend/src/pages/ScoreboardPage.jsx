import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend } from 'recharts'
import Shell from '../components/Shell.jsx'
import { PageHeader, Card, LoadingState, EmptyState, Toast, Input, Field, StatCard } from '../components/UI.jsx'
import { getScoreboard, getStudentVerticalPerformance } from '../utils/api.js'

function studentInitials(name) {
  return (name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatVerticalName(name) {
  if (!name) return name
  const match = String(name).match(/^V(\d+)\s*[-–—]\s*(.+)$/)
  return match ? `Vertical ${match[1]} - ${match[2]}` : String(name)
}

const MEDAL_STYLES = [
  {
    ring: 'ring-amber-400/50',
    badge: 'bg-amber-100 text-amber-700',
    grad: 'from-amber-50 via-yellow-50 to-orange-50',
    text: 'text-amber-600',
  },
  {
    ring: 'ring-slate-300/50',
    badge: 'bg-slate-200 text-slate-600',
    grad: 'from-slate-50 to-slate-100',
    text: 'text-slate-500',
  },
  {
    ring: 'ring-orange-300/50',
    badge: 'bg-orange-100 text-orange-700',
    grad: 'from-orange-50 to-amber-50',
    text: 'text-orange-600',
  },
]

function Podium({ topStudents }) {
  if (!topStudents || topStudents.length === 0) return null

  const ordered = [...topStudents].sort((a, b) => (a.rank || 0) - (b.rank || 0))
  const [first, second, third] = [ordered[0], ordered[1], ordered[2]]
  const maxPoints = Math.max(1, ...ordered.map((s) => s.totalPoints || 0))

  const renderCard = (student, index) => {
    if (!student) return null
    const medal = MEDAL_STYLES[index] || MEDAL_STYLES[0]
    const pct = Math.max(4, ((student.totalPoints || 0) / maxPoints) * 100)
    const rank = student.rank || index + 1
    return (
      <div
        key={student._id}
        className={`relative overflow-hidden rounded-2xl border border-rule bg-gradient-to-b ${medal.grad} p-5 text-center ring-4 ${medal.ring} ${index === 0 ? 'lg:-translate-y-2 lg:scale-105' : ''}`}
      >
        {index === 0 && (
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M12 1.5a1 1 0 01.93.63l1.85 3.74 4.13.6a1 1 0 01.56 1.7l-3 2.92.71 4.13a1 1 0 01-1.45 1.05L12 14.34l-3.73 1.96a1 1 0 01-1.45-1.05l.71-4.13-3-2.92a1 1 0 01.56-1.7l4.13-.6 1.85-3.74A1 1 0 0112 1.5z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        <div className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full ${medal.badge} font-display text-sm font-bold ${medal.text}`}>
          {rank}
        </div>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink font-display text-lg font-bold text-paper shadow-soft">
          {studentInitials(student.name)}
        </div>
        <p className="mt-2 truncate text-sm font-semibold text-ink">{student.name}</p>
        <p className="truncate text-[11px] text-slate-500">{student.registerNumber}</p>
        <div className="mt-2 flex items-end justify-center gap-1">
          <span className="font-mono text-2xl font-bold text-ink">{student.totalPoints || 0}</span>
          <span className="pb-1 text-[11px] text-slate-500">SP</span>
        </div>
        <div className="mx-auto mt-3 h-1.5 max-w-[160px] overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {renderCard(second, 1)}
      {renderCard(first, 0)}
      {renderCard(third, 2)}
    </div>
  )
}

function VerticalPerfTick({ x, y, payload }) {
  const label = payload?.value || ''
  const display = label.length > 46 ? `${label.slice(0, 46).trimEnd()}…` : label
  return (
    <text x={x} y={y} dy={3} textAnchor="end" fill="var(--color-slate-600)" fontSize={10}>
      {display}
    </text>
  )
}

function StudentVerticalPerformance() {
  const [students, setStudents] = useState([])
  const [studentId, setStudentId] = useState('')
  const [verticals, setVerticals] = useState([])
  const [verticalName, setVerticalName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (sid) => {
    setLoading(true)
    setError('')
    try {
      const res = await getStudentVerticalPerformance(sid)
      const { students = [], verticals = [], student } = res.data || {}
      setStudents(students)
      setVerticals(verticals)
      if (student) setStudentId(student._id)
      setVerticalName((prev) => {
        if (prev && verticals.some((v) => v.name === prev)) return prev
        const preferred = verticals.find((v) => /community/i.test(v.name))
        return preferred?.name || verticals[0]?.name || ''
      })
    } catch (e) {
      setError(e.message || 'Unable to load vertical performance')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load('') }, [load])

  const handleStudentChange = (e) => {
    const sid = e.target.value
    setStudentId(sid)
    if (sid) load(sid)
  }

  const selectedVertical = verticals.find((v) => v.name === verticalName) || null
  const chartData = useMemo(
    () => (selectedVertical?.activities || []).map((a) => ({ name: a.name, pointsEarned: a.pointsEarned, completed: a.completed ? 1 : 0 })),
    [selectedVertical]
  )
  const axisWidth = useMemo(() => {
    const longest = chartData.reduce((max, entry) => Math.max(max, (entry.name || '').length), 0)
    return Math.min(280, Math.max(160, longest * 6.4 + 18))
  }, [chartData])
  const participation = selectedVertical?.totalActivities
    ? Math.round((selectedVertical.completedActivities / selectedVertical.totalActivities) * 100)
    : 0

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-ink">STAR Vertical Performance</h2>
          <p className="mt-0.5 text-xs text-slate-400">Live activity data for {formatVerticalName(verticalName) || 'a vertical'}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={studentId}
            onChange={handleStudentChange}
            className="rounded-md border border-rule bg-card px-3 py-1.5 text-xs font-medium text-ink focus-ring focus:border-brand-400"
            aria-label="Select student"
          >
            <option value="">Select Student</option>
            {students.map((s) => (
              <option key={s._id} value={s._id}>{s.name} — {s.registerNumber || s.regNo || ''}</option>
            ))}
          </select>
          <select
            value={verticalName}
            onChange={(e) => setVerticalName(e.target.value)}
            className="rounded-md border border-rule bg-card px-3 py-1.5 text-xs font-medium text-ink focus-ring focus:border-brand-400"
            aria-label="Select vertical"
          >
            {verticals.map((v) => (
              <option key={v.name} value={v.name}>{formatVerticalName(v.name)}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-400 animate-pulse">Loading vertical performance…</p>
      ) : error ? (
        <p className="mt-6 text-sm text-rose-600">{error}</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-72 rounded-md border border-rule bg-paper p-3 lg:col-span-2">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 24 }} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--color-slate-400)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={axisWidth} interval={0} tick={<VerticalPerfTick />} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'var(--color-paper)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)', color: 'var(--color-ink)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="pointsEarned" name="Points Earned" radius={[0, 4, 4, 0]} fill="var(--color-brand-500)" maxBarSize={12} />
                  <Bar dataKey="completed" name="Completed" radius={[0, 4, 4, 0]} fill="var(--color-leaf-500)" maxBarSize={12} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No activities found in this vertical.</div>
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-md border border-rule bg-paper p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Selected Vertical</p>
              <p className="mt-1 text-sm font-medium leading-snug text-ink">{formatVerticalName(selectedVertical?.name) || '—'}</p>
              <p className="mt-2 text-sm text-slate-500">{selectedVertical?.completedActivities || 0} completed · {selectedVertical?.pointsEarned || 0} pts</p>
            </div>
            <div className="rounded-md border border-rule bg-paper p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Activities Completed</p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink">{selectedVertical?.completedActivities || 0} of {selectedVertical?.totalActivities || 0}</p>
              <p className="mt-1 text-xs text-slate-400">{selectedVertical?.totalActivities || 0} total in vertical</p>
            </div>
            <div className="rounded-md border border-rule bg-paper p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Participation</p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink">{participation}%</p>
              <p className="mt-1 text-xs text-slate-400">in this vertical</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function ScoreboardPage() {
  const [scoreboard, setScoreboard] = useState({ students: [], topStudents: [] })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [toast, setToast] = useState(null)

  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('stars_user') || '{}') } catch { return {} }
  }, [])

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const loadScoreboard = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getScoreboard()
      setScoreboard(data.data || { students: [], topStudents: [] })
    } catch (error) {
      notify(error.message || 'Failed to load scoreboard', 'error')
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    loadScoreboard()
  }, [loadScoreboard])

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return scoreboard.students
    const term = search.toLowerCase().trim()
    return scoreboard.students.filter((student) =>
      student.name.toLowerCase().includes(term) ||
      student.registerNumber.toLowerCase().includes(term)
    )
  }, [scoreboard.students, search])

  const progressData = useMemo(() =>
    filteredStudents.map((student) => ({
      name: student.registerNumber || student.name,
      points: student.totalPoints || 0,
      submissions: student.submissions?.length || 0,
    }))
  , [filteredStudents])

  const summary = useMemo(() => {
    const totalStudents = scoreboard.students.length
    const totalPoints = scoreboard.students.reduce((sum, s) => sum + (s.totalPoints || 0), 0)
    const avgPoints = totalStudents ? Math.round(totalPoints / totalStudents) : 0
    const top = scoreboard.students[0]
    return { totalStudents, totalPoints, avgPoints, top }
  }, [scoreboard.students])

  function toggleRow(studentId) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  if (loading) {
    return (
      <Shell role="faculty" userName={currentUser.name || 'Faculty'} department={currentUser.department || 'Department'}>
        <LoadingState rows={3} />
      </Shell>
    )
  }

  return (
    <Shell role="faculty" userName={currentUser.name || 'Faculty'} department={currentUser.department || 'Department'}>
      <div className="max-w-7xl space-y-6">
        <PageHeader
          title="Scoreboard"
          subtitle="Ranked view of student STAR points with vertical activity breakdown."
        />

        {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Students" value={summary.totalStudents} sub="Assigned to your department" accent="brand" />
          <StatCard label="STAR Points Awarded" value={summary.totalPoints} sub="Across all students" accent="amber" />
          <StatCard label="Average Points" value={summary.avgPoints} sub="Per student" accent="leaf" />
          <StatCard label="Top Scorer" value={summary.top?.name || '—'} sub={summary.top ? `${summary.top.totalPoints || 0} SP` : 'No data yet'} accent="rose" />
        </div>

        {scoreboard.topStudents.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Leaderboard Podium</h2>
                <p className="mt-1 text-sm text-slate-400">Celebrating the highest STAR point earners.</p>
              </div>
            </div>
            <Podium topStudents={scoreboard.topStudents} />
          </div>
        )}

        <StudentVerticalPerformance />

        {progressData.length > 0 && (
          <Card className="p-6">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Student Progress Report</h2>
              <p className="mt-1 text-sm text-slate-400">Total STAR points earned per student.</p>
            </div>
            <div className="mt-5 overflow-x-auto">
              <div className="h-72 min-w-[640px] rounded-md border border-rule bg-paper p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progressData} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--color-slate-400)', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fill: 'var(--color-slate-400)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'var(--color-paper)' }}
                      contentStyle={{ borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)', color: 'var(--color-ink)' }}
                      formatter={(value, name) => [value, name === 'points' ? 'STAR Points' : 'Submissions']}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="points" name="STAR Points" radius={[4, 4, 0, 0]}>
                      {progressData.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={index === 0 ? 'var(--color-amber-500)' : 'var(--color-brand-500)'} />
                      ))}
                    </Bar>
                    <Bar dataKey="submissions" name="Submissions" radius={[4, 4, 0, 0]} fill="var(--color-slate-300)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6">
          <Field label="Search students" hint="Type name or register number to filter the list.">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or reg no..."
              className="max-w-md"
            />
          </Field>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                <tr>
                  <th className="w-14 px-5 py-3 text-center">Rank</th>
                  <th className="w-10 px-5 py-3">
                    <button
                      type="button"
                      aria-label="Expand all"
                      onClick={() => setExpandedRows(new Set(filteredStudents.map(s => s._id)))}
                      className="flex h-6 w-6 items-center justify-center mx-auto text-slate-400 hover:text-ink transition-colors"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.1 1.04l-4.25 4.5a.75.75 0 01-1.1 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </th>
                  <th className="text-left font-medium px-5 py-3">Student</th>
                  <th className="text-right font-medium px-5 py-3">Total STAR Points</th>
                  <th className="text-right font-medium px-5 py-3">Submissions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => {
                    const isExpanded = expandedRows.has(student._id)
                    return (
                      <React.Fragment key={student._id}>
                        <tr className="border-b border-rule transition-colors hover:bg-paper/60">
                          <td className="px-5 py-3 text-center tabular font-mono text-ink">{student.rank}</td>
                          <td className="px-5 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleRow(student._id)}
                              aria-expanded={isExpanded}
                              className="flex h-6 w-6 items-center justify-center mx-auto rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.1 1.04l-4.25 4.5a.75.75 0 01-1.1 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-xs font-bold text-brand-600">
                                {studentInitials(student.name)}
                              </span>
                              <div>
                                <p className="font-medium text-ink">{student.name}</p>
                                <p className="text-xs text-slate-400">{student.registerNumber}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right tabular font-display text-xl font-semibold text-ink">{student.totalPoints}</td>
                          <td className="px-5 py-3 text-right font-mono text-slate-600">{student.submissions?.length || 0}</td>
                        </tr>

                        {isExpanded && student.submissions?.length > 0 && (
                          <tr className="bg-paper/50">
                            <td colSpan={5} className="px-5 py-3">
                              <div className="ml-14 border-l-2 border-rule pl-4 space-y-2">
                                {student.submissions.map((submission) => (
                                  <div key={submission._id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-rule/50 last:border-0">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-ink truncate">{submission.activityName}</p>
                                      <p className="text-xs text-slate-400 flex flex-wrap gap-3">
                                        <span className="flex items-center gap-1">
                                          <span className="h-1.5 w-1.5 rounded-full bg-brand-300" />
                                          {formatVerticalName(submission.vertical) || 'Uncategorised'}
                                        </span>
                                        <span className="font-mono text-slate-500">
                                          {new Date(submission.submittedAt).toLocaleDateString()}
                                        </span>
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-4 sm:ml-4">
                                      <StatusBadge status={submission.status} />
                                      <span className="tabular font-mono font-medium text-brand-600">
                                        +{submission.pointsAwarded} SP
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
                      <EmptyState
                        icon="🔍"
                        title="No students found"
                        description={search ? 'Try adjusting your search terms.' : 'No students assigned to you yet.'}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Shell>
  )
}

function StatusBadge({ status }) {
  const STATUS_TONES = {
    Approved: 'bg-leaf-100 text-leaf-600 border-leaf-300/50',
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    FacultyApproved: 'bg-brand-50 text-brand-700 border-brand-200',
    HODApproved: 'bg-leaf-100 text-leaf-600 border-leaf-300/50',
    Rejected: 'bg-rose-50 text-rose-600 border-rose-200',
    HODRejected: 'bg-rose-50 text-rose-600 border-rose-200',
  }
  const tone = STATUS_TONES[status] || 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}