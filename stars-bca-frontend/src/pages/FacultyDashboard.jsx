import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from 'recharts'
import { BarChart3, BrainCircuit, CalendarDays, CalendarRange, CheckCheck, CheckCircle, ClipboardCheck, Clock, Download, Eye, FileSpreadsheet, Star, Users, XCircle } from 'lucide-react'
import Shell from '../components/Shell.jsx'
import { StatCard, StatusBadge, Modal, Button, PageHeader, Card, Toast, EmptyState, Field, Input, Textarea, Select, ConfirmDialog } from '../components/UI.jsx'
import { getTeacherDashboard, getTeacherSubmissions, approveSubmission, rejectSubmission, getSubmissionFileBlob, runAiReview, applyAiReview, bulkApproveSubmissions, bulkRejectSubmissions, exportTeacherSubmissions, downloadPdfReport, autoApproveByAi, getScoreboard, getTeacherNotifications, getTeacherAnalytics } from '../utils/api.js'
import ScoreboardPage from './ScoreboardPage.jsx'
import BulkAcademicMetricsUpload from './BulkAcademicMetricsUpload.jsx'
import FacultyNotificationsPage from './FacultyNotificationsPage.jsx'
import './FacultyDashboard.css'

GlobalWorkerOptions.workerSrc = pdfWorker

function isPdfEvidence(file) {
  return file?.contentType === 'application/pdf' || /\.pdf$/i.test(file?.fileName || '')
}

async function renderPdfPages(blob) {
  const pdf = await getDocument({ data: await blob.arrayBuffer() }).promise
  const pages = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    pages.push(canvas.toDataURL('image/png'))
  }
  return pages
}

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

function normalizeExternalUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  return /^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`
}

function EvidenceRow({ label, value, link = false }) {
  if (!value) return null
  const normalizedUrl = link ? normalizeExternalUrl(value) : ''
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-rule bg-paper px-3 py-2.5 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      {link ? (
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 break-all text-right font-medium text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-700"
        >
          {value}
        </a>
      ) : (
        <span className="min-w-0 break-words text-right font-medium text-ink">{value}</span>
      )}
    </div>
  )
}

function isAwarded(sub) {
  const status = sub?.status
  return status === 'FacultyApproved' || status === 'HODApproved' || status === 'Approved'
}

function pointsFor(sub) {
  const awarded = sub?.pointsAwarded
  const suggested = sub?.suggestedPoints
  return isAwarded(sub) ? (awarded ?? suggested ?? 0) : (suggested ?? 0)
}

function pointsStateLabel(sub) {
  const status = sub?.status
  if (status === 'Rejected' || status === 'HODRejected') return 'Rejected'
  if (isAwarded(sub)) return 'Awarded marks'
  return 'Suggested marks'
}

function PointsTag({ sub }) {
  const status = sub?.status
  if (isAwarded(sub)) {
    return <span className="rounded-full bg-leaf-100 text-leaf-700 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em]">Awarded</span>
  }
  if (status === 'Rejected' || status === 'HODRejected') {
    return <span className="rounded-full bg-rose-50 text-rose-600 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em]">Rejected</span>
  }
  return <span className="rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em]">Suggested</span>
}

function AiReviewBadge({ sub }) {
  const recommendation = sub?.aiReview?.recommendation || 'Review'
  const label = recommendation === 'Review' ? 'Needs Review' : recommendation
  const tone = recommendation === 'Approve'
    ? 'bg-leaf-100 text-leaf-700'
    : recommendation === 'Reject'
      ? 'bg-rose-50 text-rose-600'
      : 'bg-amber-50 text-amber-700'

  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] ${tone}`}>
      {label}
    </span>
  )
}

const STATUS_TABS = [
  { key: 'Pending', label: 'To Review' },
  { key: 'FacultyApproved', label: 'Faculty Approved' },
  { key: 'Rejected', label: 'Rejected' },
]

const FACULTY_VERTICALS = [
  'Vertical 1 - Academic Performance',
  'Vertical 2 - Innovation & Research',
  'Vertical 3 - Leadership & Governance',
  'Vertical 4 - Community Engagement',
  'Vertical 5 - Cultural & Sports',
  'Vertical 6 - Professional Development',
  'Vertical 7 - Entrepreneurship',
  'Vertical 8 - Global Exposure',
  'Vertical 9 - Social Responsibility',
  'Vertical 10 - Digital Skills',
]

function formatVerticalName(name) {
  if (!name) return name
  const match = String(name).match(/^V(\d+)\s*[-–—]\s*(.+)$/)
  return match ? `Vertical ${match[1]} - ${match[2]}` : String(name)
}

function ChartFrame({ title, subtitle, icon: Icon, actions, children }) {
  return (
    <Card className="faculty-points-chart-card p-5">
      <div className="faculty-points-chart-card__header">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="faculty-points-chart-card__icon" aria-hidden="true">
              <Icon className="h-4 w-4" strokeWidth={1.9} />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold uppercase tracking-[0.04em] text-ink">{title}</h3>
            {subtitle && <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

const FACULTY_STAT_ICONS = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  students: Users,
  points: Star,
}

function FacultyStatCard({ icon, className = '', ...props }) {
  const Icon = FACULTY_STAT_ICONS[icon]
  return (
    <div className="faculty-stat-card">
      <StatCard {...props} className={`faculty-stat-card__surface ${className}`} />
      <span className="faculty-stat-card__icon" aria-hidden="true">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
    </div>
  )
}

const CHART_TICK = { fill: 'var(--color-slate-400)', fontSize: 11 }
const CHART_TOOLTIP_STYLE = { borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)', color: 'var(--color-ink)' }

function VerticalTick({ x, y, payload }) {
  const label = payload?.value || ''
  const display = label.length > 44 ? `${label.slice(0, 44).trimEnd()}…` : label
  return (
    <text x={x} y={y} dy={3} textAnchor="end" fill="var(--color-slate-600)" fontSize={10}>
      {display}
    </text>
  )
}

function VerticalChart({ data }) {
  const [selectedVertical, setSelectedVertical] = useState('all')

  const verticalOptions = useMemo(() => {
    const seen = new Set()
    const options = []
    const present = data.map((entry) => entry.name)
    for (const name of [...present, ...FACULTY_VERTICALS]) {
      if (!seen.has(name)) {
        seen.add(name)
        options.push({ value: name, label: formatVerticalName(name) })
      }
    }
    return options
  }, [data])

  const chartData = useMemo(() => {
    const base = selectedVertical === 'all'
      ? data.slice(0, 8)
      : data.filter((entry) => entry.name === selectedVertical)
    return base.map((entry) => ({ ...entry, displayName: formatVerticalName(entry.name) }))
  }, [data, selectedVertical])

  const axisWidth = useMemo(() => {
    const longest = chartData.reduce((max, entry) => Math.max(max, (entry.displayName || '').length), 0)
    return Math.min(250, Math.max(150, longest * 6.2 + 18))
  }, [chartData])

  return (
    <ChartFrame
      title="Points by vertical"
      subtitle={selectedVertical === 'all' ? 'Approved STAR points per activity vertical.' : `Approved STAR points for ${formatVerticalName(selectedVertical)}.`}
      icon={BarChart3}
      actions={(
        <select
          value={selectedVertical}
          onChange={(e) => setSelectedVertical(e.target.value)}
          className="faculty-points-chart-card__select rounded-md border border-rule bg-card px-3 py-1.5 text-xs font-medium text-ink focus-ring focus:border-brand-400"
          aria-label="Filter vertical"
        >
          <option value="all">All Verticals</option>
          {verticalOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
    >
      <div className="faculty-points-chart-card__body">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 34 }} barCategoryGap="32%" maxBarSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={CHART_TICK} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="displayName"
                width={axisWidth}
                interval={0}
                tick={<VerticalTick />}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip cursor={{ fill: 'var(--color-paper)' }} contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="points" name="STAR Points" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={index === 0 ? 'var(--color-amber-500)' : 'var(--color-brand-500)'} />
                ))}
                <LabelList dataKey="points" position="right" style={{ fill: 'var(--color-slate-500)', fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="faculty-points-chart-card__empty">
            <BarChart3 className="h-7 w-7" strokeWidth={1.7} aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-ink">No vertical data available yet</p>
            <p className="mt-1 max-w-xs text-center text-xs leading-5 text-slate-400">Approved STAR points will appear here when records are available.</p>
          </div>
        )}
      </div>
    </ChartFrame>
  )
}

function AiInsights({ ai }) {
  const recData = (ai?.byRecommendation || []).map((item) => ({
    name: item.name || 'Review',
    count: item.count || 0,
    fill: item.name === 'Approve' ? 'var(--color-leaf-500)' : item.name === 'Reject' ? 'var(--color-rose-500)' : 'var(--color-amber-500)',
  }))
  return (
    <Card className="p-5">
      <h3 className="font-display text-base font-semibold text-ink">AI Review Insights</h3>
      <p className="mt-0.5 text-xs text-slate-400">How the AI evidence reviewer is performing.</p>
      <div className="faculty-ai-metrics mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="faculty-ai-metric rounded-md border border-rule bg-paper p-3">
          <span className="faculty-ai-metric__icon" aria-hidden="true"><Eye className="h-4 w-4" strokeWidth={1.9} /></span>
          <div>
            <p className="tabular font-display text-2xl font-semibold text-ink">{ai?.reviewed || 0}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-slate-400">Reviewed</p>
          </div>
        </div>
        <div className="faculty-ai-metric rounded-md border border-rule bg-paper p-3">
          <span className="faculty-ai-metric__icon" aria-hidden="true"><BrainCircuit className="h-4 w-4" strokeWidth={1.9} /></span>
          <div>
            <p className="tabular font-display text-2xl font-semibold text-ink">{ai?.avgConfidence || 0}%</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-slate-400">Avg confidence</p>
          </div>
        </div>
        <div className="faculty-ai-metric rounded-md border border-rule bg-paper p-3">
          <span className="faculty-ai-metric__icon" aria-hidden="true"><CheckCheck className="h-4 w-4" strokeWidth={1.9} /></span>
          <div>
            <p className="tabular font-display text-2xl font-semibold text-ink">{ai?.acceptanceRate || 0}%</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-slate-400">Faculty matches AI</p>
          </div>
        </div>
      </div>
      {recData.length > 0 ? (
        <div className="mt-4 h-44 w-full rounded-md border border-rule bg-paper p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={recData} barCategoryGap={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" vertical={false} />
              <XAxis dataKey="name" tick={CHART_TICK} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={CHART_TICK} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'var(--color-paper)' }} contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" name="Submissions" radius={[4, 4, 0, 0]}>
                {recData.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="faculty-ai-empty-state" role="status">
          <span className="faculty-ai-empty-state__icon" aria-hidden="true">
            <BrainCircuit className="h-7 w-7" strokeWidth={1.7} />
          </span>
          <p className="mt-3 text-sm font-semibold text-ink">AI Insights Coming Soon</p>
          <p className="mt-1 max-w-xs text-center text-xs leading-5 text-slate-400">AI-powered review insights and analysis will appear here as more submissions are reviewed.</p>
        </div>
      )}
      {ai?.flags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ai.flags.map((flag) => (
            <span key={flag.name} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
              {flag.name} · {flag.count}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

function BatchPreview({ selectedSubmissions, onApprove, onReject, onClose }) {
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)

  if (!selectedSubmissions || selectedSubmissions.length === 0) return null

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Batch Preview (${selectedSubmissions.length} submissions)`}
      footer={
        <>
          <Button
            variant="danger"
            onClick={() => onReject(selectedSubmissions, remarks)}
            loading={loading}
          >
            Reject All
          </Button>
          <Button
            variant="success"
            onClick={() => onApprove(selectedSubmissions, remarks)}
            loading={loading}
          >
            Approve All
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border border-rule bg-paper p-4">
          <p className="text-sm text-slate-600 mb-2">Preview submissions for batch processing:</p>
          <div className="space-y-2 max-h-64 overflow-auto">
            {selectedSubmissions.slice(0, 5).map((sub) => (
              <div key={sub._id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-ink truncate">{sub.activityId?.activityName}</p>
                  <p className="text-xs text-slate-500">{sub.studentId?.name} - {sub.pointsAwarded || sub.suggestedPoints} SP</p>
                </div>
                <StatusBadge status={sub.status} />
              </div>
            ))}
            {selectedSubmissions.length > 5 && (
              <p className="text-xs text-slate-400 text-center">...and {selectedSubmissions.length - 5} more</p>
            )}
          </div>
        </div>

        <Field label="Remarks (for all)">
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            placeholder="Add feedback for all selected submissions..."
          />
        </Field>
      </div>
    </Modal>
  )
}

function QuickStudentView({ student, onClose }) {
  if (!student) return null

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Student Profile: ${student.name}`}
      footer={
        <Button variant="outline" onClick={onClose}>Close</Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border border-rule bg-paper p-3">
              <span className="text-sm text-slate-500">Register No.</span>
              <span className="font-medium text-ink">{student.registerNumber}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-rule bg-paper p-3">
              <span className="text-sm text-slate-500">Department</span>
              <span className="font-medium text-ink">{student.department}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-rule bg-paper p-3">
              <span className="text-sm text-slate-500">Total Points</span>
              <span className="font-medium text-ink">{student.totalPoints} SP</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border border-rule bg-paper p-3">
              <span className="text-sm text-slate-500">Submitted Activities</span>
              <span className="font-medium text-ink">{student.activitiesCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-rule bg-paper p-3">
              <span className="text-sm text-slate-500">Last Activity</span>
              <span className="font-medium text-ink">{student.lastActivity || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-rule bg-paper p-3">
              <span className="text-sm text-slate-500">Avg Score</span>
              <span className="font-medium text-ink">{student.avgScore}%</span>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-rule bg-paper p-4">
          <h4 className="text-sm font-medium text-ink mb-2">Recent Activities</h4>
          <div className="space-y-2 max-h-48 overflow-auto">
            {student.recentActivities?.slice(0, 5).map((activity) => (
              <div key={activity._id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-ink truncate">{activity.activityId?.activityName}</p>
                  <p className="text-xs text-slate-500">{activity.submittedOn}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={activity.status} />
                  <p className="text-xs text-slate-500 mt-0.5">{activity.pointsAwarded || activity.suggestedPoints} SP</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function TemplateRemarks({ onApply }) {
  const templates = [
    { id: 'template1', text: 'Excellent work! Your evidence clearly demonstrates mastery of the required competencies.', category: 'Positive' },
    { id: 'template2', text: 'Good effort. Please provide additional evidence or clarification to strengthen this submission.', category: 'Neutral' },
    { id: 'template3', text: 'Your work shows potential but needs improvement. Consider revisiting the activity guidelines.', category: 'Improvement' },
    { id: 'template4', text: 'Well-structured submission with clear evidence of learning outcomes.', category: 'Positive' },
    { id: 'template5', text: 'The submission meets basic requirements. Further enhancement opportunities available.', category: 'Neutral' },
  ]

  return (
    <Card className="p-4">
      <h3 className="font-display text-sm font-semibold text-ink mb-3">Quick Remark Templates</h3>
      <div className="space-y-2">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onApply(template.text)}
            className="w-full text-left p-3 rounded-md border border-rule hover:bg-brand-50/50 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                template.category === 'Positive' ? 'bg-leaf-100 text-leaf-700' :
                template.category === 'Improvement' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-600'
              }`}>{template.category}</span>
            </div>
            <p className="text-xs text-slate-600 line-clamp-2">{template.text}</p>
          </button>
        ))}
      </div>
    </Card>
  )
}

function ComplianceChecker({ submissions, onCheck }) {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  const checkCompliance = async () => {
    setLoading(true)
    try {
      const compliantCount = submissions.filter(sub => sub.isCompliant).length
      const result = {
        total: submissions.length,
        compliant: compliantCount,
        nonCompliant: submissions.length - compliantCount,
        issues: submissions.filter(sub => !sub.isCompliant).slice(0, 5)
      }
      setResults(result)
      if (onCheck) onCheck(result)
    } catch (error) {
      console.error('Compliance check failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-4">
      <h3 className="font-display text-sm font-semibold text-ink mb-3">Compliance Checker</h3>
      <p className="text-xs text-slate-500 mb-3">Check if selected submissions meet all requirements.</p>
      <Button
        size="sm"
        variant="outline"
        onClick={checkCompliance}
        loading={loading}
        disabled={submissions.length === 0}
      >
        Check Compliance ({submissions.length} selected)
      </Button>

      {results && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="text-center p-2 rounded-md bg-slate-50">
              <p className="text-lg font-semibold text-slate-600">{results.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
            <div className="text-center p-2 rounded-md bg-leaf-50">
              <p className="text-lg font-semibold text-leaf-600">{results.compliant}</p>
              <p className="text-xs text-slate-500">Compliant</p>
            </div>
            <div className="text-center p-2 rounded-md bg-rose-50">
              <p className="text-lg font-semibold text-rose-600">{results.nonCompliant}</p>
              <p className="text-xs text-slate-500">Issues</p>
            </div>
          </div>
          {results.issues.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600">Issues found:</p>
              {results.issues.map((issue, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs rounded-md border border-rose-200 bg-rose-50 p-2">
                  <span className="text-rose-700 truncate">{issue.studentId?.name} - {issue.activityId?.activityName}</span>
                  <span className="text-rose-600 ml-2">-{issue.missingPoints} SP</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function QualityMetrics({ data }) {
  const metrics = useMemo(() => {
    if (!data || data.length === 0) return null

    const approved = data.filter(sub => sub.status === 'FacultyApproved').length
    const rejected = data.filter(sub => sub.status === 'Rejected').length
    const avgScore = data.reduce((sum, sub) => sum + (sub.pointsAwarded || sub.suggestedPoints || 0), 0) / data.length
    const consistency = ((approved / data.length) * 100).toFixed(1)

    return {
      approvalRate: consistency,
      avgScore: avgScore.toFixed(1),
      totalSubmissions: data.length,
      avgReviewTime: '2.3d', // Would come from backend
      accuracyScore: '94%', // Would come from backend
    }
  }, [data])

  if (!metrics) return null

  return (
    <Card className="p-4">
      <h3 className="font-display text-sm font-semibold text-ink mb-3">Quality Metrics</h3>
      <p className="text-xs text-slate-500 mb-3">Performance indicators for faculty review quality.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-rule bg-paper p-3">
          <p className="text-xs text-slate-500 mb-1">Approval Rate</p>
          <p className="text-lg font-semibold text-ink">{metrics.approvalRate}%</p>
        </div>
        <div className="rounded-md border border-rule bg-paper p-3">
          <p className="text-xs text-slate-500 mb-1">Avg Score</p>
          <p className="text-lg font-semibold text-ink">{metrics.avgScore} SP</p>
        </div>
        <div className="rounded-md border border-rule bg-paper p-3">
          <p className="text-xs text-slate-500 mb-1">Total Submissions</p>
          <p className="text-lg font-semibold text-ink">{metrics.totalSubmissions}</p>
        </div>
        <div className="rounded-md border border-rule bg-paper p-3">
          <p className="text-xs text-slate-500 mb-1">Avg Review Time</p>
          <p className="text-lg font-semibold text-ink">{metrics.avgReviewTime}</p>
        </div>
      </div>
    </Card>
  )
}

function AnalyticsSection({ analytics, loading, period, days, onPeriodChange, onDaysChange }) {
  if (loading && !analytics) {
    return (
      <Card className="p-6 mb-8">
        <p className="text-sm text-slate-400 animate-pulse">Loading analytics…</p>
      </Card>
    )
  }
  return (
    <div className="mb-8 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Analytics</h2>
          <p className="mt-1 text-sm text-slate-400">Review workload, student engagement, and department numbers at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="faculty-analytics-filter">
            <CalendarDays className="faculty-analytics-filter__icon" aria-hidden="true" />
            <select
              value={period}
              onChange={(e) => onPeriodChange(e.target.value)}
              className="faculty-analytics-filter__select"
              aria-label="Trend period"
            >
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </label>
          <label className="faculty-analytics-filter">
            <CalendarRange className="faculty-analytics-filter__icon" aria-hidden="true" />
            <select
              value={days}
              onChange={(e) => onDaysChange(Number(e.target.value))}
              className="faculty-analytics-filter__select"
              aria-label="Trend range"
            >
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={180}>6 months</option>
              <option value={365}>12 months</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VerticalChart data={analytics?.verticals || []} />
        <AiInsights ai={analytics?.aiReview} />
        <QualityMetrics data={analytics?.submissions} />
      </div>
    </div>
  )
}

function studentInitials(name) {
  return (name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
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

function TopStudentsPanel({ students }) {
  const podium = students.slice(0, 3)
  const rest = students.slice(3)
  const maxPoints = Math.max(1, ...students.map((s) => s.totalPoints || 0))

  if (students.length === 0) {
    return (
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Top Students</h2>
          <span className="text-xs text-slate-400">Ranked by approved STAR points</span>
        </div>
        <EmptyState
          icon="🏆"
          title="No data yet"
          description="Top students will appear here once submissions are approved."
        />
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">Top Students</h2>
        <span className="text-xs text-slate-400">Ranked by approved STAR points</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {podium.map((student, index) => {
          const medal = MEDAL_STYLES[index] || MEDAL_STYLES[0]
          const rank = student.rank || index + 1
          const pct = Math.max(4, ((student.totalPoints || 0) / maxPoints) * 100)
          return (
            <div
              key={student._id}
              className={`relative overflow-hidden rounded-2xl border border-rule bg-gradient-to-b ${medal.grad} p-4 text-center ring-4 ${medal.ring}`}
            >
              <div className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full ${medal.badge} font-display text-sm font-bold ${medal.text}`}>
                {rank}
              </div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink font-display text-base font-bold text-paper shadow-soft">
                {studentInitials(student.name)}
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-ink">{student.name}</p>
              <p className="truncate text-[11px] text-slate-500">{student.registerNumber || student.regNo || ''}</p>
              <div className="mt-2">
                <span className="font-mono text-lg font-bold text-ink">{student.totalPoints || 0}</span>
                <span className="text-[11px] text-slate-500"> SP</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {rest.length > 0 && (
        <div className="mt-4 space-y-2">
          {rest.map((student) => (
            <div key={student._id} className="flex items-center gap-3 rounded-lg border border-rule/60 bg-paper px-3 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 font-mono text-xs font-semibold text-brand-600">
                {student.rank || 4}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{student.name}</p>
                <p className="truncate text-xs text-slate-400">{student.registerNumber || student.regNo || ''}</p>
              </div>
              <span className="font-mono text-sm font-semibold text-ink">{student.totalPoints || 0} SP</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function FacultyHomePage({ reviewsOnly = false, notificationsUnread = 0, onNotificationsUnreadChange = () => {} }) {
  const [submissions, setSubmissions] = useState([])
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, totalStudents: 0, totalPointsAwarded: 0 })
  const [reviewing, setReviewing] = useState(null)
  const [evidencePreview, setEvidencePreview] = useState(null)
  const [score, setScore] = useState('')
  const [remarks, setRemarks] = useState('')
  const [reviewHistory, setReviewHistory] = useState([])
  const [toast, setToast] = useState(null)
  const [, setLoading] = useState(true)
  const [expandedStudents, setExpandedStudents] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkConfirm, setBulkConfirm] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkRemarks, setBulkRemarks] = useState('')
  const [exporting, setExporting] = useState(false)
  const [statusFilter, setStatusFilter] = useState('Pending')
  const [autoApproving, setAutoApproving] = useState(false)
  const [autoApproveConfirm, setAutoApproveConfirm] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [topStudents, setTopStudents] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsPeriod, setAnalyticsPeriod] = useState('week')
  const [analyticsDays, setAnalyticsDays] = useState(90)
  const [batchPreview, setBatchPreview] = useState([])
  const [showStudentProfile, setShowStudentProfile] = useState(null)
  const [templateRemarks, setTemplateRemarks] = useState('')
  const [complianceResults, setComplianceResults] = useState(null)
  const [predictiveData, setPredictiveData] = useState(null)

  const currentUser = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('stars_user') || '{}') } catch { return {} }
  }, [])

  const loadCurrent = useCallback(async () => {
    const [submissionsRes, dashboardRes, scoreboardRes] = await Promise.all([
      getTeacherSubmissions(50, statusFilter),
      getTeacherDashboard(),
      getScoreboard().catch(() => ({ data: { topStudents: [] } }))
    ])
    setSubmissions(submissionsRes.data.submissions || [])
    setStats(dashboardRes.data)
    setTopStudents(scoreboardRes.data?.topStudents || [])
    getTeacherNotifications(1, 1)
      .then((res) => onNotificationsUnreadChange(res.data?.unread || 0))
      .catch(() => {})
  }, [statusFilter, onNotificationsUnreadChange])

  useEffect(() => {
    let active = true
    loadCurrent()
      .catch((error) => { if (active) setToast({ message: error.message || 'Unable to load submissions', tone: 'error' }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [statusFilter, loadCurrent])

  const loadAnalytics = useCallback(async (period, days) => {
    setAnalyticsLoading(true)
    try {
      const res = await getTeacherAnalytics(days, period)
      setAnalytics(res.data)
    } catch (error) {
      setToast({ message: error.message || 'Unable to load analytics', tone: 'error' })
    } finally {
      setAnalyticsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAnalytics(analyticsPeriod, analyticsDays)
  }, [loadAnalytics, analyticsPeriod, analyticsDays])

  const groupedSubmissions = useMemo(() => {
    const groups = []
    const groupsByKey = new Map()

    submissions.forEach((submission) => {
      const studentKey = submission?.studentId?._id || submission?.studentId
      const normalizedKey = studentKey?.toString?.() || `${submission?.studentId?.name || 'Student'}-${submission?.studentId?.registerNumber || ''}`

      if (!groupsByKey.has(normalizedKey)) {
        const newGroup = {
          key: normalizedKey,
          name: submission?.studentId?.name || 'Student',
          registerNumber: submission?.studentId?.registerNumber || '',
          submissions: []
        }

        groupsByKey.set(normalizedKey, newGroup)
        groups.push(newGroup)
      }

      groupsByKey.get(normalizedKey).submissions.push(submission)
    })

    return groups
  }, [submissions])

  function toggleStudent(studentKey) {
    setExpandedStudents((prev) => (
      prev.includes(studentKey)
        ? prev.filter((entry) => entry !== studentKey)
        : [...prev, studentKey]
    ))
  }

  const allSubmissionIds = useMemo(() => groupedSubmissions.flatMap((group) => group.submissions.map((s) => s._id)), [groupedSubmissions])
  const allSelected = allSubmissionIds.length > 0 && allSubmissionIds.every((id) => selectedIds.includes(id))

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : allSubmissionIds)
  }

  async function runBulkAction() {
    if (!bulkConfirm) return
    setBulkLoading(true)
    try {
      const ids = [...selectedIds]
      if (bulkConfirm.action === 'Rejected' && !bulkRemarks.trim()) {
        throw new Error('Rejection reason is required')
      }
      if (bulkConfirm.action === 'Approved') {
        await bulkApproveSubmissions(ids)
      } else {
        await bulkRejectSubmissions(ids, { teacherRemarks: bulkRemarks })
      }
      const removed = new Set(ids)
      setSubmissions((prev) => prev.filter((s) => !removed.has(s._id)))
      setSelectedIds([])
      setBulkRemarks('')
      setToast({ message: `${ids.length} submission${ids.length === 1 ? '' : 's'} ${bulkConfirm.action === 'Approved' ? 'approved' : 'rejected'}.`, tone: 'success' })
      loadCurrent().catch(() => {})
    } catch (error) {
      setToast({ message: error.message || 'Bulk action failed', tone: 'error' })
    } finally {
      setBulkLoading(false)
      setBulkConfirm(null)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportTeacherSubmissions('Pending')
    } catch (error) {
      setToast({ message: error.message || 'Export failed', tone: 'error' })
    } finally {
      setExporting(false)
    }
  }

  async function handlePdfExport(type = 'submissions') {
    setGeneratingPdf(true)
    try {
      await downloadPdfReport(type, statusFilter)
      setToast({ message: `PDF report downloaded successfully`, tone: 'success' })
    } catch (error) {
      setToast({ message: error.message || 'PDF export failed', tone: 'error' })
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleAutoApprove() {
    setAutoApproving(true)
    setAutoApproveConfirm(false)
    try {
      const result = await autoApproveByAi(selectedIds.length > 0 ? selectedIds : [])
      const { approved = 0, skipped = 0, failed = 0 } = result.data || {}
      setToast({ message: `AI Auto-Approve: ${approved} approved, ${skipped} skipped, ${failed} failed`, tone: approved > 0 ? 'success' : 'warning' })
      setSelectedIds([])
      loadCurrent().catch(() => {})
    } catch (error) {
      setToast({ message: error.message || 'Auto-approve failed', tone: 'error' })
    } finally {
      setAutoApproving(false)
    }
  }

  function openReview(sub) {
    const studentId = sub?.studentId?._id || sub?.studentId
    const siblingReviews = submissions.filter((entry) => {
      const entryStudentId = entry?.studentId?._id || entry?.studentId
      return entryStudentId && studentId && entryStudentId.toString() === studentId.toString()
    })
    setReviewHistory(siblingReviews)
    setReviewing(sub)
    setScore(String(pointsFor(sub)))
    setRemarks('')
  }

  function selectReview(event) {
    const selectedReviewId = event.target.value
    const selectedReview = submissions.find((entry) => entry._id === selectedReviewId)
    if (selectedReview) {
      setReviewing(selectedReview)
      setScore(String(pointsFor(selectedReview)))
      setRemarks('')
    }
  }

  async function decide(status) {
    if (!reviewing) return
    const id = reviewing._id

    if (reviewing.status !== 'Pending') {
      setToast({ message: 'This submission is already reviewed — it is awaiting HOD verification.', tone: 'warning' })
      return
    }

    try {
      if (status === 'Approved') {
        await approveSubmission(id, Number(score) || 0, remarks)
      } else {
        await rejectSubmission(id, remarks)
      }

      setSubmissions((prev) => prev.filter((s) => s._id !== id))
      setToast({ message: `Submission ${status.toLowerCase()} for ${reviewing.studentId?.name || 'student'}.`, tone: 'success' })
      setReviewing(null)
      loadCurrent().catch(() => {})
    } catch (error) {
      setToast({ message: error.message || 'Review action failed', tone: 'error' })
    }
  }

  async function openEvidence(submissionId) {
    try {
      const blob = await getSubmissionFileBlob(submissionId)
      const downloadUrl = URL.createObjectURL(blob)
      if (isPdfEvidence(reviewing?.certificateFile)) {
        const pages = await renderPdfPages(blob)
        setEvidencePreview({ pages, downloadUrl, contentType: 'application/pdf', fileName: reviewing?.certificateFile?.fileName || '' })
      } else {
        setEvidencePreview({ url: downloadUrl, contentType: blob.type })
      }
    } catch (error) {
      setToast({ message: error.message || 'Unable to open evidence file', tone: 'error' })
    }
  }

  function closeEvidencePreview() {
    if (evidencePreview?.downloadUrl) URL.revokeObjectURL(evidencePreview.downloadUrl)
    else if (evidencePreview?.url?.startsWith('blob:')) URL.revokeObjectURL(evidencePreview.url)
    setEvidencePreview(null)
  }

  const AI_RECOMMENDATION_TONES = {
    Approve: 'bg-leaf-100 text-leaf-600',
    Reject: 'bg-rose-50 text-rose-600',
    Review: 'bg-amber-50 text-amber-600',
  }

  async function runAi() {
    if (!reviewing || aiLoading) return
    setAiLoading(true)
    try {
      let pageImages = evidencePreview?.pages || []
      if (!pageImages.length && isPdfEvidence(reviewing.certificateFile)) {
        const blob = await getSubmissionFileBlob(reviewing._id)
        pageImages = await renderPdfPages(blob)
        const downloadUrl = URL.createObjectURL(blob)
        setEvidencePreview({ pages: pageImages, downloadUrl, contentType: 'application/pdf', fileName: reviewing.certificateFile.fileName || '' })
      }
      const res = await runAiReview(reviewing._id, pageImages)
      const review = res.data
      setReviewing((prev) => ({ ...prev, aiReview: review }))
      setSubmissions((prev) => prev.map((s) => (s._id === review.submissionId ? { ...s, aiReview: review } : s)))
      setToast({ message: `AI review ready (${review.provider || 'rule engine'}).`, tone: 'info' })
    } catch (error) {
      setToast({ message: error.message || 'AI review failed', tone: 'error' })
    } finally {
      setAiLoading(false)
    }
  }

  async function applyAi() {
    if (!reviewing) return
    try {
      const res = await applyAiReview(reviewing._id)
      const updated = res.data
      setReviewing((prev) => ({ ...prev, ...updated }))
      setSubmissions((prev) => prev.map((s) => (s._id === updated._id ? { ...s, ...updated } : s)))
      setScore(String(updated.suggestedPoints ?? 0))
      setRemarks(updated.teacherRemarks || '')
      setToast({ message: 'AI suggestion applied — review and confirm before approving.', tone: 'success' })
    } catch (error) {
      setToast({ message: error.message || 'Could not apply AI suggestion', tone: 'error' })
    }
  }

  return (
    <Shell role="faculty" userName={currentUser.name || 'Faculty'} department={currentUser.department || 'Department'} badges={{ '/faculty/reviews': stats.pending, '/faculty/notifications': notificationsUnread }} className="faculty-dashboard-shell">
      <div className="faculty-dashboard">
      <PageHeader
        title={reviewsOnly ? 'Review Submissions' : (
          <span className="faculty-page-title">
            <span className="faculty-page-title__icon" aria-hidden="true">
              <ClipboardCheck className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <span>FACULTY REVIEW DASHBOARD</span>
          </span>
        )}
        subtitle="Verify evidence, score submissions, and keep student STAR records up to date."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handlePdfExport('submissions')} loading={generatingPdf}>
              <Download className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
              PDF Report
            </Button>
            <Button variant="outline" onClick={handleExport} loading={exporting}>
              <FileSpreadsheet className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
              Export Excel
            </Button>
            {statusFilter === 'Pending' && (
              <Button variant="primary" onClick={() => setAutoApproveConfirm(true)} loading={autoApproving}>
                ✨ Auto-Approve AI
              </Button>
            )}
          </div>
        }
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <FacultyStatCard icon="pending" className="h-full min-h-[132px] shadow-[0_10px_24px_rgba(23,38,63,0.05)]" label="Pending Reviews" value={stats.pending} sub="Awaiting your action" accent="amber" />
        <FacultyStatCard icon="approved" className="h-full min-h-[132px] shadow-[0_10px_24px_rgba(23,38,63,0.05)]" label="Approved Tasks" value={stats.approved} sub="This term" accent="leaf" />
        <FacultyStatCard icon="rejected" className="h-full min-h-[132px] shadow-[0_10px_24px_rgba(23,38,63,0.05)]" label="Rejected Tasks" value={stats.rejected} sub="Needs resubmission" accent="rose" />
        <FacultyStatCard icon="students" className="h-full min-h-[132px] shadow-[0_10px_24px_rgba(23,38,63,0.05)]" label="Total Students" value={stats.totalStudents} sub="Registered learners" accent="brand" />
        <FacultyStatCard icon="points" className="h-full min-h-[132px] shadow-[0_10px_24px_rgba(23,38,63,0.05)]" label="Points Awarded" value={stats.totalPointsAwarded} sub="Total SP this term" accent="amber" />
      </div>

      {!reviewsOnly && <AnalyticsSection
        analytics={analytics}
        loading={analyticsLoading}
        period={analyticsPeriod}
        days={analyticsDays}
        onPeriodChange={setAnalyticsPeriod}
        onDaysChange={setAnalyticsDays}
      />
      }

      {reviewsOnly && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-6 border-b border-rule">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.key)
                  setSelectedIds([])
                  setExpandedStudents([])
                }}
                className={`relative pb-2 text-sm font-medium transition-colors ${
                  statusFilter === tab.key ? 'text-ink' : 'text-slate-500 hover:text-ink'
                }`}
              >
                {tab.label}
                {statusFilter === tab.key && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-500" />}
              </button>
            ))}
          </div>
          <h2 className="font-display text-lg font-semibold text-ink mb-3">Submissions</h2>
          {statusFilter === 'Pending' && selectedIds.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand-200 bg-brand-50/70 px-4 py-3">
              <p className="text-sm font-medium text-ink">{selectedIds.length} selected</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedIds([])}>Clear</Button>
                <Button size="sm" variant="danger" onClick={() => setBulkConfirm({ action: 'Rejected' })}>Reject selected</Button>
                <Button size="sm" variant="success" onClick={() => setBulkConfirm({ action: 'Approved' })}>Approve selected</Button>
              </div>
            </div>
          )}
          {groupedSubmissions.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                  <tr>
                    <th className="w-12 px-5 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-brand-500"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all submissions"
                      />
                    </th>
                    <th className="text-left font-medium px-5 py-3">Student</th>
                    <th className="text-left font-medium px-5 py-3">Task</th>
                    <th className="text-left font-medium px-5 py-3">Status</th>
                    <th className="text-left font-medium px-5 py-3">AI Review</th>
                    <th className="text-left font-medium px-5 py-3">Points</th>
                    <th className="text-right font-medium px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {groupedSubmissions.map((group) => {
                    const isMultiSubmission = group.submissions.length > 1
                    const isExpanded = expandedStudents.includes(group.key)

                    return (
                      <React.Fragment key={group.key}>
                        <tr className="border-b border-rule transition-colors hover:bg-paper/60">
                          <td className="px-5 py-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 cursor-pointer accent-brand-500"
                              checked={group.submissions.every((s) => selectedIds.includes(s._id))}
                              onChange={() => {
                                const ids = group.submissions.map((s) => s._id)
                                setSelectedIds((prev) => {
                                  const anySelected = ids.some((id) => prev.includes(id))
                                  return anySelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]
                                })
                              }}
                              aria-label={`Select submissions for ${group.name}`}
                            />
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              {isMultiSubmission ? (
                                <button
                                  type="button"
                                  onClick={() => toggleStudent(group.key)}
                                  aria-expanded={isExpanded}
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.1 1.04l-4.25 4.5a.75.75 0 01-1.1 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              ) : (
                                <span className="h-6 w-6" />
                              )}
                              <div>
                                <p className="font-medium text-ink">{group.name}</p>
                                <p className="text-xs text-slate-400">{group.registerNumber}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-600 max-w-[220px]">
                            {isMultiSubmission ? (
                              <span className="text-sm font-medium text-slate-600">{group.submissions.length} Submissions</span>
                            ) : (
                              <span className="truncate block">{group.submissions[0]?.activityId?.activityName || 'Activity'}</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {isMultiSubmission ? (
                              <span className="text-xs text-slate-400">Grouped</span>
                            ) : (
                              <StatusBadge status={group.submissions[0]?.status} />
                            )}
                          </td>
                          <td className="px-5 py-3"><AiReviewBadge sub={group.submissions[0]} /></td>
                          <td className="px-5 py-3">
                            {isMultiSubmission ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <span className="tabular font-medium text-slate-600">{pointsFor(group.submissions[0])} pts</span>
                                <PointsTag sub={group.submissions[0]} />
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {!isMultiSubmission && (
                              <Button size="sm" variant="outline" onClick={() => openReview(group.submissions[0])}>Review</Button>
                            )}
                          </td>
                        </tr>

                        {isMultiSubmission && isExpanded && group.submissions.map((submission) => (
                          <tr key={submission._id} className="border-b border-rule bg-paper/70">
                            <td className="px-8 py-3">
                              <input
                                type="checkbox"
                                className="h-4 w-4 cursor-pointer accent-brand-500"
                                checked={selectedIds.includes(submission._id)}
                                onChange={() => toggleSelect(submission._id)}
                                aria-label={`Select submission ${submission.activityId?.activityName || ''}`}
                              />
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-brand-300" />
                                <div>
                                  <p className="text-sm font-medium text-ink">{submission.activityId?.activityName || 'Activity'}</p>
                                  <p className="text-xs text-slate-400">{submission.studentId?.registerNumber || ''}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-slate-600 max-w-[220px] truncate">{submission.activityId?.activityName || 'Activity'}</td>
                            <td className="px-5 py-3"><StatusBadge status={submission.status} /></td>
                            <td className="px-5 py-3">
                              <span className="flex items-center gap-2">
                                <span className="tabular font-medium text-slate-600">{pointsFor(submission)} pts</span>
                                <PointsTag sub={submission} />
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <Button size="sm" variant="outline" onClick={() => openReview(submission)}>Review</Button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </Card>
          ) : (
            <EmptyState
              icon="✓"
              title={statusFilter === 'Pending' ? 'All caught up' : statusFilter === 'FacultyApproved' ? 'No approved submissions yet' : 'No rejected submissions'}
              description={statusFilter === 'Pending' ? 'There are no submissions waiting for your review right now.' : 'Submissions will appear here as they move through the review workflow.'}
            />
          )}
        </div>

        <div>
          <TopStudentsPanel students={topStudents} />
        </div>
        </div>
      )}

      <Modal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title={`Review submission — ${reviewing?.studentId?.name || 'student'}`}
        footer={
          <>
            {reviewing?.status === 'Pending' ? (
              <>
                <Button variant="danger" onClick={() => decide('Rejected')}>Reject</Button>
                <Button variant="success" onClick={() => decide('Approved')}>Approve</Button>
              </>
            ) : (
              <span className="text-sm text-slate-500">
                {reviewing?.status === 'FacultyApproved'
                  ? 'Already approved — pending HOD verification.'
                  : 'Already reviewed — no further action available.'}
              </span>
            )}
          </>
        }
      >
        {reviewing && (
          <div className="space-y-4">
            {reviewHistory.length > 1 && (
              <div className="rounded-md border border-rule bg-paper p-4">
                <label className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Review history</label>
                <Select value={reviewing?._id || ''} onChange={selectReview} className="mt-2 !bg-card !border-rule">
                  {reviewHistory.map((entry) => (
                    <option key={entry._id} value={entry._id}>{entry.activityId?.activityName || 'Activity'} • {new Date(entry.submittedAt).toLocaleDateString()}</option>
                  ))}
                </Select>
              </div>
            )}

            <div className="rounded-md border border-rule p-4 space-y-2">
              <p className="text-sm font-semibold text-ink">{reviewing.activityId?.activityName || 'Activity'}</p>
              <EvidenceRow label="Student" value={reviewing.studentId?.name} />
              <EvidenceRow label="Register No." value={reviewing.studentId?.registerNumber || reviewing.studentId?.regNo} />
              <EvidenceRow label="Vertical" value={reviewing.activityId?.vertical || reviewing.vertical} />
              <EvidenceRow label="Activity type" value={reviewing.activityType || reviewing.visitType} />
              <EvidenceRow label="Level" value={reviewing.selectedLevel} />
              <EvidenceRow label="Duration" value={reviewing.durationWeeks} />
              <EvidenceRow label="Project URL" value={reviewing.projectUrl || reviewing.proofUrl} link />
              {reviewing.description && (
                <p className="text-xs text-slate-400 mt-1">{reviewing.description}</p>
              )}
            </div>

            {reviewing?.certificateFile?.fileName && (
              <div className="rounded-md border border-rule bg-paper p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">Stored evidence</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{reviewing.certificateFile.fileName}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openEvidence(reviewing._id)}>View evidence</Button>
              </div>
            )}

            <div className="rounded-md border border-rule bg-paper p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-brand-200 bg-brand-50 font-mono text-[10px] font-medium text-brand-600">AI</span>
                  <p className="text-sm font-semibold text-ink">Evidence Review</p>
                  {reviewing?.aiReview?.provider && (
                    <span className="rounded-full bg-brand-100 text-brand-600 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em]">
                      {reviewing.aiReview.provider}
                    </span>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={runAi} loading={aiLoading}>
                  {reviewing?.aiReview ? 'Re-run' : 'Run AI review'}
                </Button>
              </div>

              {aiLoading ? (
                <p className="text-xs text-slate-400 animate-pulse">Analyzing evidence and submission details…</p>
              ) : reviewing?.aiReview ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${AI_RECOMMENDATION_TONES[reviewing.aiReview.recommendation] || 'bg-slate-100 text-slate-600'}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {reviewing.aiReview.recommendation === 'Review' ? 'Needs Review' : reviewing.aiReview.recommendation}
                    </span>
                    <span className="text-xs text-slate-500">
                      {reviewing.aiReview.suggestedPoints} SP suggested · {reviewing.aiReview.confidence}% confidence
                    </span>
                  </div>
                  {reviewing.aiReview.reasoning && (
                    <p className="text-sm text-slate-600 leading-relaxed">{reviewing.aiReview.reasoning}</p>
                  )}
                  {Array.isArray(reviewing.aiReview.flags) && reviewing.aiReview.flags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {reviewing.aiReview.flags.map((flag, index) => (
                        <span key={index} className="rounded-md bg-card border border-amber-200 text-amber-700 text-xs px-2 py-1">
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={applyAi}>Use suggested score & reasoning</Button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400">
                  No AI review yet. Run the AI evidence reviewer to get an approve/reject/review recommendation.
                </p>
              )}
            </div>

            <div className="rounded-md border border-rule bg-paper p-4 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-400">{pointsStateLabel(reviewing)}</p>
              <p className="text-lg font-semibold text-ink">{pointsFor(reviewing)} SP</p>
            </div>

            <Field label="Final marks">
              <Input
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="Remarks" hint="This feedback will be visible to the student.">
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Add feedback for the student..."
              />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!evidencePreview}
        onClose={closeEvidencePreview}
        title="Evidence preview"
        footer={evidencePreview && (
          <>
            <a
              href={evidencePreview.downloadUrl || evidencePreview.url}
              download={reviewing?.certificateFile?.fileName || 'evidence'}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-rule bg-transparent px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-slate-300 hover:bg-card focus-ring"
            >
              <Download className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
              Download
            </a>
            <Button variant="outline" onClick={closeEvidencePreview}>Close</Button>
          </>
        )}
      >
        {evidencePreview?.pages?.length ? (
          <div className="flex max-h-[70vh] min-h-[420px] flex-col gap-4 overflow-y-auto rounded-md border border-rule bg-paper p-3">
            {evidencePreview.pages.map((page, index) => (
              <img key={page} src={page} alt={`Evidence page ${index + 1}`} className="w-full object-contain" />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[420px] items-center justify-center rounded-md border border-rule bg-paper p-4">
            <img src={evidencePreview?.url} alt="Evidence preview" className="max-h-[70vh] max-w-full object-contain" />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!bulkConfirm}
        onClose={() => { setBulkConfirm(null); setBulkRemarks('') }}
        title={bulkConfirm?.action === 'Approved' ? 'Bulk approve submissions' : 'Bulk reject submissions'}
        message={
          bulkConfirm?.action === 'Approved'
            ? `Approve ${selectedIds.length} selected submission(s)? Each will use its suggested marks and become pending HOD verification.`
            : `Reject ${selectedIds.length} selected submission(s)? Students will be asked to resubmit with clearer evidence.`
        }
        confirmLabel={bulkConfirm?.action === 'Approved' ? 'Approve' : 'Reject'}
        tone={bulkConfirm?.action === 'Approved' ? 'success' : 'danger'}
        onConfirm={runBulkAction}
        loading={bulkLoading}
        inputLabel={bulkConfirm?.action === 'Rejected' ? 'Rejection reason' : undefined}
        inputValue={bulkRemarks}
        onInputChange={setBulkRemarks}
        inputPlaceholder={bulkConfirm?.action === 'Rejected' ? 'Explain why submissions are being rejected…' : undefined}
      />

      <ConfirmDialog
        open={autoApproveConfirm}
        onClose={() => setAutoApproveConfirm(false)}
        title="Auto-Approve Submissions with AI"
        message={
          selectedIds.length > 0
            ? `Run AI review on ${selectedIds.length} selected submission(s) and auto-approve those with "Approve" recommendation (confidence >= 50%)? Skipped submissions will remain pending.`
            : 'Run AI review on ALL pending submissions and auto-approve those with "Approve" recommendation (confidence >= 50%)? Skipped submissions will remain pending.'
        }
        confirmLabel="Run Auto-Approve"
        tone="primary"
        onConfirm={handleAutoApprove}
        loading={autoApproving}
      />
      </div>
    </Shell>
  )
}

export default function FacultyDashboard() {
  const [notificationsUnread, setNotificationsUnread] = useState(0)
  const onUnreadChange = useCallback((count) => setNotificationsUnread(count), [])
  return (
    <Routes>
      <Route
        path=""
        element={<FacultyHomePage notificationsUnread={notificationsUnread} onNotificationsUnreadChange={onUnreadChange} />}
      />
      <Route
        path="reviews"
        element={<FacultyHomePage reviewsOnly notificationsUnread={notificationsUnread} onNotificationsUnreadChange={onUnreadChange} />}
      />
      <Route path="scoreboard" element={<ScoreboardPage />} />
      <Route path="bulk-academic-metrics" element={<BulkAcademicMetricsUpload />} />
      <Route path="notifications" element={<FacultyNotificationsPage onUnreadChange={onUnreadChange} />} />
      <Route path="*" element={<Navigate to="/faculty" replace />} />
    </Routes>
  )
}
