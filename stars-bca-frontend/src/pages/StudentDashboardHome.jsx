import React, { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { motion } from 'framer-motion'
import { Activity, Award, BriefcaseBusiness, Building2, Check, Clock, FolderKanban, GraduationCap, Lightbulb, Map, MapPinned, Star, Trophy } from 'lucide-react'
import { StatCard, PageHeader, Card, EmptyState, Button, Toast } from '../components/UI.jsx'
import { downloadProgressCard, getStudentLeaderboard } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const DEFAULT_VERTICALS = [
  { key: 'academic', label: 'Vertical 1 - Academic Performance' },
  { key: 'innovation', label: 'Vertical 2 - Innovation & Research' },
  { key: 'leadership', label: 'Vertical 3 - Leadership & Governance' },
  { key: 'community', label: 'Vertical 4 - Community Engagement' },
  { key: 'culture', label: 'Vertical 5 - Cultural & Sports' },
  { key: 'professional', label: 'Vertical 6 - Professional Development' },
  { key: 'entrepreneurship', label: 'Vertical 7 - Entrepreneurship' },
  { key: 'global', label: 'Vertical 8 - Global Exposure' },
  { key: 'social', label: 'Vertical 9 - Social Responsibility' },
  { key: 'digital', label: 'Vertical 10 - Digital Skills' },
]

function normalizeVerticalKey(value = '') {
  const text = String(value || '').toLowerCase()
  const verticalNumber = text.match(/\b(?:v|vertical)\s*(10|[1-9])\b/)
  if (verticalNumber) return DEFAULT_VERTICALS[Number(verticalNumber[1]) - 1]?.key || null
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

function getRecentActivityIcon(item) {
  const activityName = String(item.activityId?.activityName || item.activityName || '').toLowerCase()
  if (activityName.includes('industry certification')) return Award
  if (activityName.includes('industrial visit')) return Building2
  if (activityName.includes('institutional visit')) return MapPinned
  if (activityName.includes('international visit')) return Map
  if (activityName.includes('internship')) return BriefcaseBusiness
  if (activityName.includes('case study')) return GraduationCap
  if (activityName.includes('mini project')) return FolderKanban
  if (activityName === 'activity' || activityName.includes('activity')) return Lightbulb
  return Activity
}

function activityStatus(activity) {
  if (activity.status === 'Completed') return { label: 'Completed', badge: 'bg-leaf-100 text-leaf-700' }
  if (activity.status === 'Pending') return { label: 'Pending', badge: 'bg-amber-50 text-amber-700' }
  if (activity.status === 'Rejected' || activity.status === 'HODRejected') return { label: 'Rejected', badge: 'bg-rose-50 text-rose-600' }
  return { label: 'Not submitted', badge: 'bg-slate-100 text-slate-500' }
}

function VerticalAxisTick({ x, y, payload }) {
  const [number, ...nameParts] = String(payload?.value || '').split('|')
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="var(--color-slate-500)" fontSize={10} fontWeight={700}>{number}</text>
      <text x={0} y={0} dy={28} textAnchor="middle" fill="var(--color-slate-400)" fontSize={9}>{nameParts.join('|')}</text>
    </g>
  )
}

function VerticalChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const vertical = payload[0].payload
  return (
    <div className="min-w-[190px] rounded-lg border border-slate-200 bg-card px-3.5 py-3 shadow-[0_10px_24px_rgba(23,38,63,0.14)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600">{vertical.number}</p>
      <p className="mt-1 text-sm font-semibold leading-snug text-ink">{vertical.fullName}</p>
      <dl className="mt-2 space-y-1.5 border-t border-rule pt-2 text-xs">
        <div className="flex items-center justify-between gap-4"><dt className="text-slate-500">Completed Activities</dt><dd className="font-mono font-semibold text-ink">{vertical.completed}</dd></div>
        <div className="flex items-center justify-between gap-4"><dt className="text-slate-500">Points Earned</dt><dd className="font-mono font-semibold text-ink">{vertical.points}</dd></div>
      </dl>
    </div>
  )
}

function ActivityCard({ activity }) {
  const { label, badge } = activityStatus(activity)
  return (
    <li className="rounded-md border border-rule bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{activity.name}</p>
          {activity.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{activity.description}</p>}
          {activity.deadline && (
            <p className="mt-1 font-mono text-[11px] text-slate-400">Due {new Date(activity.deadline).toLocaleDateString()}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] ${badge}`}>
          {label}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-slate-500">Max {activity.maxPoints} pts</span>
        {activity.status === 'Completed' && (
          <span className="tabular font-mono font-semibold text-leaf-700">{activity.points} pts earned</span>
        )}
      </div>
    </li>
  )
}

function DecorativeMetricIcon({ type, tone }) {
  const Icon = { star: Star, trophy: Trophy, check: Check, clock: Clock }[type]
  const iconSize = type === 'star' ? 'h-9 w-9' : 'h-10 w-10'

  return (
    <motion.span variants={{ hidden: { scale: 0.98 }, visible: { scale: 1 }, hover: { scale: 1.04 } }} className="decorative-metric-icon pointer-events-none absolute right-5 top-1/2 flex h-12 w-12 shrink-0 -translate-y-1/2 items-center justify-center" aria-hidden="true">
      <Icon className={`${iconSize} shrink-0 ${tone}`} strokeWidth={2} aria-hidden="true" />
    </motion.span>
  )
}

function AnimatedProgressBar({ percent }) {
  return (
    <motion.div
      className="h-full rounded-full"
      initial={{ width: 0 }}
      animate={{ width: `${percent}%` }}
      transition={{ duration: 0.65, delay: 0.24, ease: 'easeOut' }}
      style={{ backgroundColor: 'var(--color-brand-500)' }}
    />
  )
}

const statCardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  hover: { y: -3, scale: 1.01, transition: { duration: 0.2, ease: 'easeOut' } },
}

export default function StudentDashboardHome({ student, points, surplusPoints = 0, completed, pendingTasks, pendingReview, submissions, recent, activities = [] }) {
  const percent = Math.min(100, Math.round((points / 200) * 100))
  const [streak, setStreak] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [toast, setToast] = useState('')
  const [selectedVerticalKey, setSelectedVerticalKey] = useState('all')
  const [selectedChartKey, setSelectedChartKey] = useState(null)
  useEffect(() => {
    getStudentLeaderboard()
      .then((res) => setStreak(res.data?.streak || 0))
      .catch(() => {})
  }, [])

  async function handleDownloadCard() {
    setDownloading(true)
    try {
      await downloadProgressCard()
    } catch (error) {
      setToast(error.message || 'Unable to download progress card')
    } finally {
      setDownloading(false)
    }
  }

  const verticalAnalytics = useMemo(() => {
    const activityLookup = activities.reduce((acc, activity) => {
      const key = activity._id || activity.activityId || activity.activityName
      if (key) acc[key] = activity
      return acc
    }, {})

    const metrics = DEFAULT_VERTICALS.map((vertical) => {
      const matchingActivities = activities.filter((activity) => normalizeVerticalKey(activity.vertical) === vertical.key)
      const totalActivities = matchingActivities.length
      const approvedActivityIds = new Set()
      const EARNED_STATUSES = ['FacultyApproved', 'HODApproved', 'Approved']
      const approvedPoints = submissions.reduce((sum, submission) => {
        if (!EARNED_STATUSES.includes(submission.status)) return sum
        const activityId = submission.activityId?._id || submission.activityId || submission.activity?.id || submission.activityId?.activityName
        const activity = activityId ? activityLookup[activityId] : null
        const verticalName = activity?.vertical || submission.activityId?.vertical || submission.vertical || ''
        const activityVerticalKey = normalizeVerticalKey(verticalName)
        if (activityVerticalKey !== vertical.key) return sum
        approvedActivityIds.add(activityId || verticalName)
        const awarded = Number(submission.pointsAwarded ?? submission.suggestedPoints ?? 0)
        return sum + (Number.isFinite(awarded) ? awarded : 0)
      }, 0)

      const completedCount = approvedActivityIds.size
      const participation = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0

      return {
        key: vertical.key,
        name: vertical.label,
        completed: completedCount,
        points: approvedPoints,
        participation,
        totalActivities,
      }
    })

    return metrics
  }, [activities, submissions])

  const summaryStats = useMemo(() => {
    const participated = verticalAnalytics.filter((item) => item.completed > 0).length
    const mostActive = [...verticalAnalytics].sort((a, b) => (b.completed === a.completed ? b.points - a.points : b.completed - a.completed))[0]
    const leastActive = [...verticalAnalytics].sort((a, b) => (a.completed === b.completed ? a.points - b.points : a.completed - b.completed))[0]
    const overallParticipation = verticalAnalytics.length > 0
      ? Math.round(verticalAnalytics.reduce((sum, item) => sum + item.participation, 0) / verticalAnalytics.length)
      : 0

    return {
      mostActive,
      leastActive,
      participated,
      remaining: Math.max(0, DEFAULT_VERTICALS.length - participated),
      overallParticipation,
    }
  }, [verticalAnalytics])

  const chartData = verticalAnalytics.map((item) => ({
    key: item.key,
    number: item.name.match(/^Vertical \d+/)?.[0] || item.name,
    name: `${item.name.match(/^Vertical \d+/)?.[0] || item.name}|${item.name.replace(/^Vertical \d+ - /, '').split(' ')[0]}`,
    fullName: item.name,
    completed: item.completed,
    points: item.points,
    participation: item.participation,
  }))

  const filteredChartData = selectedVerticalKey === 'all'
    ? chartData
    : chartData.filter((item) => item.key === selectedVerticalKey)

  const activityAxisMax = Math.max(5, ...filteredChartData.map((item) => item.completed || 0)) + 1
  const pointsAxisMax = Math.max(25, ...filteredChartData.map((item) => item.points || 0)) + 5
  const hasPerformanceData = filteredChartData.some((item) => item.completed > 0 || item.points > 0)

  const selectedVerticalData = selectedVerticalKey === 'all'
    ? null
    : verticalAnalytics.find((item) => item.key === selectedVerticalKey)

  const panelRows = selectedVerticalData
    ? [
        ['Selected Vertical', selectedVerticalData.name, `${selectedVerticalData.completed} completed · ${selectedVerticalData.points} pts`],
        ['Activities Completed', `${selectedVerticalData.completed} of ${selectedVerticalData.totalActivities}`, `${selectedVerticalData.totalActivities} total in vertical`],
        ['Participation', `${selectedVerticalData.participation}%`, 'in this vertical'],
      ]
    : [
        ['Most Active Vertical', summaryStats.mostActive?.name || '—', `${summaryStats.mostActive?.completed || 0} activities · ${summaryStats.mostActive?.points || 0} pts`],
        ['Least Active Vertical', summaryStats.leastActive?.name || '—', `${summaryStats.leastActive?.completed || 0} activities · ${summaryStats.leastActive?.points || 0} pts`],
        ['Participation', `${summaryStats.participated} of ${DEFAULT_VERTICALS.length}`, `${summaryStats.remaining} remaining · ${summaryStats.overallParticipation}% overall`],
      ]

  const enrichedActivities = useMemo(() => {
    const EARNED_STATUSES = ['FacultyApproved', 'HODApproved', 'Approved']
    return activities.map((activity, index) => {
      const activityId = activity._id || activity.activityId || activity.activityName
      const submission = submissions.find((sub) => {
        const subActivityId = sub.activityId?._id || sub.activityId
        return subActivityId && activityId && subActivityId.toString() === activityId.toString()
      })
      const earned = submission && EARNED_STATUSES.includes(submission.status)
      return {
        id: activity._id || activity.activityId || `${activity.activityName}-${index}`,
        key: normalizeVerticalKey(activity.vertical),
        name: activity.activityName || 'Unnamed activity',
        description: activity.description || '',
        deadline: activity.deadline || '',
        maxPoints: activity.maximumPoints || 0,
        status: earned ? 'Completed' : submission ? submission.status : 'Not submitted',
        points: earned ? Number(submission.pointsAwarded ?? submission.suggestedPoints ?? 0) : 0,
      }
    })
  }, [activities, submissions])

  const selectedVerticalActivities = selectedVerticalKey === 'all'
    ? []
    : enrichedActivities.filter((activity) => activity.key === selectedVerticalKey)

  return (
    <div className="space-y-8">
      {toast && <Toast message={toast} tone="error" onDismiss={() => setToast('')} />}
      <PageHeader
        title="Your STAR Dashboard"
        subtitle={`Register No. ${student.registerNumber || student.regNo || student.register || '—'}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleDownloadCard} loading={downloading}>⬇ Progress Card (PDF)</Button>
            <span className="inline-flex rounded-full border border-rule bg-card px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500">
              {summaryStats.participated} of {DEFAULT_VERTICALS.length} verticals active
            </span>
          </div>
        }
      />

      {/* Meter-led stat row */}
      <motion.div
        className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      >
        <motion.div className="lg:col-span-4" variants={statCardVariants} whileHover="hover">
          <Card className="relative h-[151px] min-h-[151px] overflow-hidden p-5">
          <DecorativeMetricIcon type="star" tone="text-brand-600/65" />
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-500">STAR %</p>
          <div className="mt-4 max-w-[220px]">
            <p className="tabular font-display text-4xl font-semibold leading-none text-ink">{percent}%</p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200">
              <AnimatedProgressBar percent={percent} />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">Overall achievement on a 200-point scale</p>
          {streak > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-mono text-[11px] font-medium text-amber-700">
              🔥 {streak} week{streak === 1 ? '' : 's'} streak
            </p>
          )}
          </Card>
        </motion.div>
        <div className="grid h-full grid-cols-1 items-stretch gap-4 sm:grid-cols-3 lg:col-span-8">
          <motion.div className="relative h-full overflow-hidden" variants={statCardVariants} whileHover="hover">
            <StatCard className="flex h-[151px] min-h-[151px] flex-col justify-between" label="Total Points" value={points} sub={`Earned so far · ${surplusPoints} surplus`} accent="brand" />
            <DecorativeMetricIcon type="trophy" tone="text-ink/60" />
          </motion.div>
          <motion.div className="relative h-full overflow-hidden" variants={statCardVariants} whileHover="hover">
            <StatCard className="flex h-[151px] min-h-[151px] flex-col justify-between" label="Completed Tasks" value={completed} sub={`${submissions.length} total submitted`} accent="leaf" />
            <DecorativeMetricIcon type="check" tone="text-leaf-600/65" />
          </motion.div>
          <motion.div className="relative h-full overflow-hidden" variants={statCardVariants} whileHover="hover">
            <StatCard className="flex h-[151px] min-h-[151px] flex-col justify-between" label="Pending Tasks" value={pendingTasks.length} sub={`${pendingReview} awaiting review`} accent="amber" />
            <DecorativeMetricIcon type="clock" tone="text-amber-600/65" />
          </motion.div>
        </div>
      </motion.div>

      {/* Vertical performance */}
      <Card className="overflow-hidden border-slate-200/80 bg-card/90 p-5 shadow-[0_12px_36px_rgba(23,38,63,0.08)] backdrop-blur-sm sm:p-6">
        <div className="flex flex-col gap-4 border-b border-rule/80 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-ink">STAR Vertical Performance</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              {selectedVerticalData
                ? `Live activity data for ${selectedVerticalData.name}.`
                : 'Participation across all 10 STAR Framework Verticals, from live activity data.'}
            </p>
          </div>
          <select
            value={selectedVerticalKey}
            onChange={(e) => {
              setSelectedVerticalKey(e.target.value)
              setSelectedChartKey(null)
            }}
            className="w-full rounded-lg border border-slate-200 bg-paper/70 px-3.5 py-2 text-xs font-semibold text-ink shadow-sm outline-none transition-colors hover:border-brand-300 focus-ring focus:border-brand-400 focus:bg-card sm:w-auto"
            aria-label="Filter vertical"
          >
            <option value="all">All Verticals</option>
            {DEFAULT_VERTICALS.map((vertical) => (
              <option key={vertical.key} value={vertical.key}>{vertical.label}</option>
            ))}
          </select>
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.65fr_0.9fr] xl:gap-8">
          <div className="relative flex h-[22rem] min-h-[22rem] w-full flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-paper/75 p-3 shadow-inner sm:h-96 sm:min-h-0 sm:p-4">
            <div className="pointer-events-none absolute inset-3 rounded-lg border border-dashed border-brand-200/60 sm:inset-4" aria-hidden="true" />
            <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 px-1 text-[11px] font-medium text-slate-500">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#2a78d6]" aria-hidden="true" />Completed Activities</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#008300]" aria-hidden="true" />Points Earned</span>
            </div>
            {!hasPerformanceData && (
              <p className="mb-1 shrink-0 px-1 text-[11px] text-slate-400">No performance data available yet. Complete activities to see your progress.</p>
            )}
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredChartData}
                barGap={2}
                barCategoryGap="24%"
                margin={{ top: 4, right: 16, left: 8, bottom: 42 }}
                onClick={(state) => {
                  const key = state?.activePayload?.[0]?.payload?.key
                  if (key) setSelectedChartKey(key)
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" vertical={false} />
                <XAxis dataKey="name" interval={0} height={58} tickMargin={8} tick={<VerticalAxisTick />} axisLine={false} tickLine={false} />
                <YAxis yAxisId="yLeft" width={42} domain={[0, activityAxisMax]} allowDecimals={false} label={{ value: 'Activities', angle: -90, position: 'insideLeft', fill: '#2a78d6', fontSize: 11 }} tick={{ fill: '#2a78d6', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="yRight" orientation="right" width={42} domain={[0, pointsAxisMax]} allowDecimals={false} label={{ value: 'Points', angle: 90, position: 'insideRight', fill: '#008300', fontSize: 11 }} tick={{ fill: '#008300', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={<VerticalChartTooltip />}
                  cursor={{ fill: 'var(--color-brand-50)', opacity: 0.6 }}
                />
                {hasPerformanceData && <Bar dataKey="completed" name="Completed Activities" yAxisId="yLeft" radius={[4, 4, 0, 0]} maxBarSize={14} animationDuration={450}>
                  {filteredChartData.map((entry) => <Cell key={`completed-${entry.key}`} fill={entry.key === selectedChartKey ? '#155bb0' : '#2a78d6'} />)}
                </Bar>}
                {hasPerformanceData && <Bar dataKey="points" name="Points Earned" yAxisId="yRight" radius={[4, 4, 0, 0]} maxBarSize={14} animationDuration={450}>
                  {filteredChartData.map((entry) => <Cell key={`points-${entry.key}`} fill={entry.key === selectedChartKey ? '#006400' : '#008300'} />)}
                </Bar>}
              </BarChart>
              </ResponsiveContainer>
            </div>
            {selectedChartKey && (() => {
              const selected = chartData.find((item) => item.key === selectedChartKey)
              if (!selected) return null
              const completionSummary = selected.completed > 0
                ? `${selected.completed} completed activity${selected.completed === 1 ? '' : 'ies'} contributing to ${selected.points} earned points.`
                : 'No completed activities in this vertical yet.'
              return (
                <div className="mt-3 shrink-0 rounded-lg border border-brand-200/80 bg-brand-50/45 px-3.5 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600">Selected Vertical</p>
                      <p className="mt-1 text-sm font-semibold text-ink">{selected.fullName}</p>
                    </div>
                    <div className="flex gap-4 text-right text-xs">
                      <span className="text-slate-500">Completed<strong className="ml-1 font-mono text-ink">{selected.completed}</strong></span>
                      <span className="text-slate-500">Points<strong className="ml-1 font-mono text-ink">{selected.points}</strong></span>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">{completionSummary}</p>
                </div>
              )
            })()}
          </div>

          <div className="xl:border-l xl:border-rule xl:pl-8">
            <dl className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {panelRows.map(([label, value, sub]) => (
                <div key={label} className="group rounded-xl border border-rule/80 bg-paper/55 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30">
                  <dt className="flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-sm text-brand-500" aria-hidden="true">
                      {label === 'Most Active Vertical' ? '↗' : label === 'Least Active Vertical' ? '↘' : '◉'}
                    </span>
                    {label}
                  </dt>
                  <dd className="mt-3 font-display text-lg font-semibold leading-tight text-ink">{value}</dd>
                  <dd className="mt-1 text-sm leading-5 text-slate-500">{sub}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {selectedVerticalData && (
          <div className="mt-6 border-t border-rule pt-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-500">Activities in this vertical</h3>
              <span className="font-mono text-xs text-slate-400">{selectedVerticalActivities.length} activities</span>
            </div>
            {selectedVerticalActivities.length > 0 ? (
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {selectedVerticalActivities.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </ul>
            ) : (
              <div className="mt-3">
                <EmptyState icon="·" title="No activities in this vertical" description="No STAR activities are available for this vertical yet." />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Performance summary + recent activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Performance Summary</h2>
          <dl className="mt-2">
            <div className="flex items-baseline justify-between border-t border-rule py-4">
              <dt className="text-sm text-slate-500">Approved submissions</dt>
              <dd className="tabular font-display text-2xl font-semibold text-ink">{completed}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-rule py-4">
              <dt className="text-sm text-slate-500">Pending review</dt>
              <dd className="tabular font-display text-2xl font-semibold text-ink">{pendingReview}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Recent Activity</h2>
          {recent.length > 0 ? (
            <ul className="mt-2">
              {recent.map((item) => (
                <motion.li
                  key={item._id}
                  className="border-t border-rule py-3 transition-colors hover:bg-brand-50/30"
                  whileHover={{ x: 1 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <div className="flex items-start gap-3">
                    {(() => {
                      const ActivityIcon = getRecentActivityIcon(item)
                      return (
                        <motion.span
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600"
                          whileHover={{ scale: 1.08 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          aria-hidden="true"
                        >
                          <ActivityIcon className="h-3.5 w-3.5" strokeWidth={2} />
                        </motion.span>
                      )
                    })()}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{item.activityId?.activityName || 'Activity'}</p>
                      <p className="font-mono text-xs text-slate-400">{item.status} · {new Date(item.submittedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </motion.li>
              ))}
            </ul>
          ) : (
            <div className="mt-2">
              <EmptyState icon="·" title="No recent activity" description="Your latest submission updates will show up here." />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}