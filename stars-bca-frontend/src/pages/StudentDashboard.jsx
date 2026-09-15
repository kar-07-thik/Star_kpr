import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import Shell from '../components/Shell.jsx'
import { Modal, Button, Toast, LoadingState, EmptyState, Field, Input, Select } from '../components/UI.jsx'
import { TASKS, categoryById } from '../data/mockData.js'
import { getStudentActivities, getStudentProfile, getStudentPoints, getStudentSubmissions, submitStudentEvidence, resubmitStudentEvidence, getSubmissionFileBlob, getStudentNotifications, getStudentDeadlineAlerts } from '../utils/api.js'
import StudentDashboardHome from './StudentDashboardHome.jsx'
import StudentTasksPage from './StudentTasksPage.jsx'
import StudentSubmissionsPage from './StudentSubmissionsPage.jsx'
import StudentProfileModal from './StudentProfileModal.jsx'
import StudentLeaderboardPage from './StudentLeaderboardPage.jsx'
import StudentNotificationsPage from './StudentNotificationsPage.jsx'

GlobalWorkerOptions.workerSrc = pdfWorker

function isPdfEvidence(fileName = '', contentType = '') {
  return contentType === 'application/pdf' || /\.pdf$/i.test(fileName)
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

const SPLIT_TIER_ACTIVITIES = new Set([
  'Internship / Case Study / Mini Project',
  'Industrial / Institutional / International Visit',
  'Value Added Course (VAC)',
  'Technical Event (quiz / GD / Debugging / others)',
  'Paper Presentation',
  'Patent / Copyright / Trademark',
])

const GROUPED_TIER_ACTIVITIES = new Set([
  'Online Certification',
  'Value Added Course (VAC)',
  'Technical Event (quiz / GD / Debugging / others)',
  'Paper Presentation',
  'Patent / Copyright / Trademark',
])

const ACTIVITY_DISPLAY_ALIASES = {
  'case study/mini project': 'case study / mini project',
  'industry internship(2 weeks)-4pts': 'industry internship (2 weeks)',
  'industry internship(4 weeks)-6pts': 'industry internship (4 weeks)',
  'industrial vist completed - 5pts': 'industrial visit completed',
  'institutional vist completed - 5pts': 'institutional visit completed',
  'international vist/conference - 10pts': 'international visit / conference',
}

const VERTICAL_1_VISIT_ACTIVITIES = new Set([
  'industrial visit completed',
  'institutional visit completed',
  'international visit / conference',
])

function groupedLevelTasks(activity, parentName, levels, namePrefix = '') {
  const base = {
    description: activity.description || 'Upload supporting evidence',
    evidenceType: activity.evidenceType || 'either',
    deadline: activity.deadline || '',
    important: activity.important || false,
    category: parentName.includes('Paper') || parentName.includes('Patent') ? 'research' : 'cert',
    vertical: activity.vertical || '',
    activityId: activity._id,
    parentName,
    onlineCertificationGroup: 'grouped-level',
  }
  return levels.map((level, index) => ({
    ...base,
    id: `${activity._id}:grouped:${index}`,
    name: `${namePrefix}${level.label}`,
    maxPoints: level.points,
    levels: [{ label: level.label, points: level.points }],
    maxStarPct: Math.min(100, Math.round(level.points / 5)),
  }))
}

function activityDisplayKey(activityName = '') {
  const normalized = String(activityName).trim().toLowerCase().replace(/\s+/g, ' ')
  return ACTIVITY_DISPLAY_ALIASES[normalized] || normalized
}

function isLegacyActivity(activityName = '') {
  const normalized = String(activityName).trim().toLowerCase().replace(/\s+/g, ' ')
  return Boolean(ACTIVITY_DISPLAY_ALIASES[normalized])
}

export default function StudentDashboard() {
  const [student, setStudent] = useState(null)
  const [points, setPoints] = useState(0)
  const [surplusPoints, setSurplusPoints] = useState(0)
  const [submissions, setSubmissions] = useState([])
  const [activities, setActivities] = useState([])
  const [activityPage, setActivityPage] = useState(1)
  const [activityMeta, setActivityMeta] = useState({ page: 1, limit: 6, total: 0 })
  const [selectedVertical, setSelectedVertical] = useState('Vertical 1 - Academic Performance')
  const [activeTask, setActiveTask] = useState(null)
  const [evidencePreview, setEvidencePreview] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [activityOption, setActivityOption] = useState('Internship')
  const [visitOption, setVisitOption] = useState('Industrial Visit')
  const [durationWeeks, setDurationWeeks] = useState('2 weeks')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [alerts, setAlerts] = useState([])
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('stars_dismissed_alerts') || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    getStudentDeadlineAlerts()
      .then((res) => setAlerts(res.data?.alerts || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('stars_dismissed_alerts', JSON.stringify(dismissedAlerts))
    } catch {
      /* ignore */
    }
  }, [dismissedAlerts])

  function dismissAlert(activityId) {
    setDismissedAlerts((prev) => (prev.includes(activityId) ? prev : [...prev, activityId]))
  }

  const visibleAlerts = useMemo(
    () => alerts.filter((alert) => !dismissedAlerts.includes(String(alert.activityId))),
    [alerts, dismissedAlerts]
  )

  useEffect(() => {
    async function loadData() {
      try {
        setError('')
        const [profileRes, pointsRes, submissionsRes, activitiesRes] = await Promise.all([
          getStudentProfile(),
          getStudentPoints(),
          getStudentSubmissions(20),
          getStudentActivities(1, 50)
        ])

        if (!profileRes?.data) {
          throw new Error('Student profile not found')
        }

        const firstActivityPage = Array.isArray(activitiesRes?.data?.activities)
          ? activitiesRes.data.activities
          : Array.isArray(activitiesRes?.data)
            ? activitiesRes.data
            : []
        const totalActivities = Number(activitiesRes?.data?.total || firstActivityPage.length)
        const pageLimit = Number(activitiesRes?.data?.limit || 50)
        const remainingPages = Math.max(0, Math.ceil(totalActivities / pageLimit) - 1)
        const remainingActivityResponses = await Promise.all(
          Array.from({ length: remainingPages }, (_, index) => getStudentActivities(index + 2, pageLimit))
        )
        const loadedActivities = [
          ...firstActivityPage,
          ...remainingActivityResponses.flatMap((response) => Array.isArray(response?.data?.activities) ? response.data.activities : []),
        ]
        const activityByKey = new Map()
        loadedActivities.forEach((activity) => {
          const key = activityDisplayKey(activity.activityName)
          const current = activityByKey.get(key)
          if (!current || (isLegacyActivity(current.activityName) && !isLegacyActivity(activity.activityName))) {
            activityByKey.set(key, activity)
          }
        })
        const activityList = [...activityByKey.values()]

        setStudent(profileRes.data)
        setPoints(pointsRes?.data?.totalPoints || 0)
        setSurplusPoints(pointsRes?.data?.surplusPoints || 0)
        setSubmissions(submissionsRes?.data?.submissions || [])
        setActivities(activityList)
        setActivityMeta({
          page: activitiesRes?.data?.page || 1,
          limit: pageLimit,
          total: totalActivities,
        })
      } catch (error) {
        setError(error.message || 'Unable to load student data')
      } finally {
        setLoading(false)
      }
    }

    loadData()

    getStudentNotifications(1, 1)
      .then((res) => setUnreadCount(res.data?.unread || 0))
      .catch(() => {})
  }, [activityPage])

  const verticalOptions = useMemo(() => {
    const options = new Set(
      activities
        .map((activity) => activity.vertical || 'Vertical 1 - Academic Performance')
        .filter(Boolean)
    )

    return [...options].sort((a, b) => {
      // Extract numbers from format like "v1", "v2" or "Vertical 1", "Vertical 2"
      const matchA = a.match(/(?:v|Vertical)\s*(\d+)/i)
      const matchB = b.match(/(?:v|Vertical)\s*(\d+)/i)
      const numA = matchA ? parseInt(matchA[1], 10) : 99
      const numB = matchB ? parseInt(matchB[1], 10) : 99
      return numA - numB
    })
  }, [activities])

  const availableTasks = useMemo(() => {
    if (activities.length > 0) {
      return activities.flatMap((activity) => {
        const isVertical2 = String(activity.vertical || '').match(/(?:v|vertical)\s*2\b/i)
        const vertical2Allowed = new Set(['NPTEL Certification', 'Online Certification 1', 'Online Certification 2', 'Industry Certification', 'Short MOOC / Online Course', 'Value Added Course (VAC)', 'VAC with Assessment / Internal Certification', 'VAC with assessment / internal certification - 5pts', 'External Agency / Industry Expert with Certification', 'External agency / industry expert with certification - 10pts'])
        if (isVertical2 && !vertical2Allowed.has(activity.activityName)) {
          return []
        }

        const activityName = String(activity.activityName || '')
        if (activityName === 'Value Added Course (VAC)') {
          return groupedLevelTasks(activity, 'Value Added Course (VAC)', [
            { label: 'VAC with assessment / internal certification', points: 5 },
            { label: 'External agency / industry expert with certification', points: 10 },
          ])
        }
        if (/^(VAC with assessment|External agency \/ industry expert)/i.test(activityName)) {
          const isExternal = /^External agency/i.test(activityName)
          return groupedLevelTasks(activity, 'Value Added Course (VAC)', [{
            label: isExternal ? 'External agency / industry expert with certification' : 'VAC with assessment / internal certification',
            points: isExternal ? 10 : 5,
          }])
        }
        if (/^Technical Event \(quiz \/ GD \/ Debugging \/ others\)$/i.test(activityName)) {
          return groupedLevelTasks(activity, 'Technical Event (quiz / GD / Debugging / others)', [
            { label: 'Intra-college participation', points: 3 },
            { label: 'Intra-college winner / Inter-college participation', points: 6 },
            { label: 'Inter-college winner', points: 10 },
            { label: 'State/national winner', points: 15 },
          ])
        }
        if (activityName === 'Paper Presentation' && Array.isArray(activity.levels) && activity.levels.length > 1) {
          return groupedLevelTasks(activity, 'Paper Presentation', [
            { label: 'Internal / Department', points: 5 },
            { label: 'External / Intercollegiate', points: 10 },
            { label: 'State / National level', points: 15 },
            { label: 'International', points: 20 },
          ])
        }
        if (activityName === 'Patent / Copyright / Trademark' && Array.isArray(activity.levels) && activity.levels.length > 1) {
          return groupedLevelTasks(activity, 'Patent / Copyright / Trademark', [
            { label: 'Draft filed', points: 10 },
            { label: 'Published', points: 15 },
            { label: 'Granted', points: 20 },
          ])
        }

        if (activity.activityName === 'Value Added Course (VAC)' || activity.activityName === 'VAC with Assessment / Internal Certification') {
          if (activity.activityName === 'VAC with Assessment / Internal Certification' && activities.some((item) => item.activityName === 'Value Added Course (VAC)')) {
            return []
          }
          const internal = activities.find((item) => item.activityName === 'Value Added Course (VAC)' || item.activityName === 'VAC with Assessment / Internal Certification')
          const external = activities.find((item) => item.activityName === 'External Agency / Industry Expert with Certification')
          return [{
            id: activity._id,
            name: 'Value Added Course',
            description: activity.description || 'Upload supporting evidence',
            maxPoints: Math.max(internal?.maximumPoints || 0, external?.maximumPoints || 0),
            levels: [],
            evidenceType: activity.evidenceType || 'either',
            maxStarPct: Math.min(100, Math.round((activity.maximumPoints || 0) / 5)),
            deadline: activity.deadline || '',
            important: activity.important || false,
            category: 'cert',
            vertical: activity.vertical || 'Vertical 2 — Skill Development & Certifications',
            valueAddedOptions: [
              { label: 'Internal', activityId: internal?._id, level: internal?.levels?.[0]?.label || 'VAC with Assessment / Internal Certification', points: internal?.levels?.[0]?.points || 5 },
              { label: 'External', activityId: external?._id, level: external?.levels?.[0]?.label || 'External Agency / Industry Expert with Certification', points: external?.levels?.[0]?.points || 10 },
            ],
          }]
        }

        if (activity.activityName === 'External Agency / Industry Expert with Certification' || activity.activityName === 'External agency / industry expert with certification - 10pts' || activity.activityName === 'VAC with assessment / internal certification - 5pts') {
          return []
        }

        const displayName = activity.activityName === 'Online Certification 1'
          ? 'Online Certification - Course'
          : activity.activityName === 'Online Certification 2'
            ? 'Online Certification - Professional'
            : activity.activityName
        const onlineCertificationLevels = activity.activityName === 'Online Certification 2'
          ? [{ label: 'Professional certificate', points: 12 }, { label: '2 professional certs', points: 15 }]
          : activity.activityName === 'Online Certification 1'
            ? [{ label: 'Completed 1 course', points: 5 }, { label: 'Specialisation, multi-course', points: 8 }]
            : null
        const normalizedActivityName = activityName.toLowerCase()
        const isTechnicalEventLevel = ['intra-college participation', 'intra-college winner / inter-college participation', 'inter-college winner', 'state/national winner']
          .some((label) => normalizedActivityName.startsWith(label))

        if (activity.activityName === 'Online Certification' && Array.isArray(activity.levels) && activity.levels.length >= 4) {
          const base = {
            description: 'Coursera / Udemy / edX or equivalent certification',
            maxPoints: activity.maximumPoints || 0,
            evidenceType: activity.evidenceType || 'either',
            deadline: activity.deadline || '',
            important: activity.important || false,
            category: 'cert',
            vertical: activity.vertical || 'Vertical 1 - Academic Performance',
            activityId: activity._id,
          }
          return [
            { ...base, id: `${activity._id}:course-completion`, name: 'Online Certification — Course Completion', parentName: activity.activityName, levels: activity.levels.slice(0, 2), onlineCertificationGroup: 'course' },
            { ...base, id: `${activity._id}:professional-certificate`, name: 'Online Certification — Professional Certificate', parentName: activity.activityName, levels: activity.levels.slice(2, 4), onlineCertificationGroup: 'professional' },
          ]
        }

        if (activity.activityName === 'Industry Internship (4 weeks)') return []
        const internshipOptions = activity.activityName === 'Industry Internship (2 weeks)'
          ? activities
            .filter((item) => item.activityName === 'Industry Internship (2 weeks)' || item.activityName === 'Industry Internship (4 weeks)')
            .sort((a, b) => String(a.activityName).localeCompare(String(b.activityName)))
            .map((item) => ({ activityId: item._id, label: item.activityName.includes('4 weeks') ? '4 Weeks' : '2 Weeks', level: item.levels?.[0]?.label || item.activityName, points: item.maximumPoints || 0 }))
          : null
        return [{
        id: activity._id,
        name: internshipOptions ? 'Industrial Internship' : displayName,
        parentName: onlineCertificationLevels
          ? 'Online Certification'
          : /^Paper Presentation - /i.test(activityName)
            ? 'Paper Presentation'
            : /^Patent \/ Copyright \/ Trademark - /i.test(activityName)
              ? 'Patent / Copyright / Trademark'
              : isTechnicalEventLevel
                ? 'Technical Event (quiz / GD / Debugging / others)'
              : undefined,
        description: activity.description || 'Upload supporting evidence',
        maxPoints: activity.maximumPoints || 0,
        levels: onlineCertificationLevels || (Array.isArray(activity.levels) ? activity.levels.filter((level) => level && level.label) : []),
        evidenceType: activity.evidenceType || 'either',
        maxStarPct: Math.min(100, Math.round((activity.maximumPoints || 0) / 5)),
        deadline: activity.deadline || '',
        important: activity.important || false,
        category: 'cert',
        vertical: activity.vertical || 'Vertical 1 - Academic Performance',
        splitTiers: SPLIT_TIER_ACTIVITIES.has(activity.activityName),
        internshipOptions,
        }]
      }).flat()
    }

    return TASKS.map((task) => ({
      ...task,
      vertical: 'Vertical 1 - Academic Performance',
    }))
  }, [activities])

  useEffect(() => {
    if (verticalOptions.length > 0 && !verticalOptions.includes(selectedVertical)) {
      setSelectedVertical(verticalOptions[0])
    }
  }, [selectedVertical, verticalOptions])

  const pendingTasks = availableTasks.flatMap((task) => {
    if (task.valueAddedOptions?.length) {
      const submitted = task.valueAddedOptions.some((option) => submissions.some((submission) => {
        const activityId = typeof submission.activityId === 'object' ? submission.activityId?._id : submission.activityId
        return String(activityId) === String(option.activityId) && ['Pending', 'FacultyApproved', 'HODApproved', 'Approved'].includes(submission.status)
      }))
      const rejectedSubmission = task.valueAddedOptions.map((option) => submissions.find((submission) => {
        const activityId = typeof submission.activityId === 'object' ? submission.activityId?._id : submission.activityId
        return String(activityId) === String(option.activityId) && ['Rejected', 'HODRejected'].includes(submission.status)
      })).find(Boolean)
      return submitted ? [] : [{ ...task, reuploadSubmissionId: rejectedSubmission?._id, reuploadRequired: Boolean(rejectedSubmission) }]
    }

    if (task.internshipOptions?.length) {
      const submitted = task.internshipOptions.some((option) => submissions.some((submission) => {
        const activityId = typeof submission.activityId === 'object' ? submission.activityId?._id : submission.activityId
        return String(activityId) === String(option.activityId) && ['Pending', 'FacultyApproved', 'HODApproved', 'Approved'].includes(submission.status)
      }))
      const rejectedSubmission = task.internshipOptions.map((option) => submissions.find((submission) => {
        const activityId = typeof submission.activityId === 'object' ? submission.activityId?._id : submission.activityId
        return String(activityId) === String(option.activityId) && ['Rejected', 'HODRejected'].includes(submission.status)
      })).find(Boolean)
      return submitted ? [] : [{ ...task, reuploadSubmissionId: rejectedSubmission?._id, reuploadRequired: Boolean(rejectedSubmission) }]
    }
    if (task.onlineCertificationGroup) {
      const rejectedSubmission = submissions.find((submission) => {
        const activityId = typeof submission.activityId === 'object' ? submission.activityId?._id : submission.activityId
        return String(activityId) === String(task.activityId) && task.levels.some((level) => level.label === submission.selectedLevel) && ['Rejected', 'HODRejected'].includes(submission.status)
      })
      const submittedLevels = new Set(submissions
        .filter((submission) => {
          const activityId = typeof submission.activityId === 'object' ? submission.activityId?._id : submission.activityId
          return String(activityId) === String(task.activityId) && ['Pending', 'FacultyApproved', 'HODApproved', 'Approved'].includes(submission.status)
        })
        .map((submission) => submission.selectedLevel))
      return task.levels.some((level) => !submittedLevels.has(level.label)) ? [{ ...task, reuploadSubmissionId: rejectedSubmission?._id, reuploadRequired: Boolean(rejectedSubmission) }] : []
    }

    if (!task.splitTiers || !task.levels?.length) {
      const submitted = submissions.some((submission) => {
        const activityId = typeof submission.activityId === 'object' ? submission.activityId?._id : submission.activityId
        return String(activityId) === String(task.id) && ['Pending', 'FacultyApproved', 'HODApproved', 'Approved'].includes(submission.status)
      })
      const rejectedSubmission = submissions.find((submission) => {
        const activityId = typeof submission.activityId === 'object' ? submission.activityId?._id : submission.activityId
        return String(activityId) === String(task.id) && ['Rejected', 'HODRejected'].includes(submission.status)
      })
      return submitted ? [] : [{ ...task, reuploadSubmissionId: rejectedSubmission?._id, reuploadRequired: Boolean(rejectedSubmission) }]
    }

    return task.levels.map((level, tierIndex) => {
      const submitted = submissions.some((submission) => {
        const activityId = typeof submission.activityId === 'object' ? submission.activityId?._id : submission.activityId
        const selectedTier = Number.isInteger(submission.tierIndex)
          ? submission.tierIndex
          : task.levels.findIndex((item) => item.label === submission.selectedLevel)
        return String(activityId) === String(task.id) && selectedTier === tierIndex && ['Pending', 'FacultyApproved', 'HODApproved', 'Approved'].includes(submission.status)
      })
      const rejectedSubmission = submissions.find((submission) => {
        const activityId = typeof submission.activityId === 'object' ? submission.activityId?._id : submission.activityId
        const selectedTier = Number.isInteger(submission.tierIndex) ? submission.tierIndex : task.levels.findIndex((item) => item.label === submission.selectedLevel)
        return String(activityId) === String(task.id) && selectedTier === tierIndex && ['Rejected', 'HODRejected'].includes(submission.status)
      })
      return submitted ? null : {
        ...task,
        id: `${task.id}:tier:${tierIndex}`,
        activityId: task.id,
        name: `${task.name} — ${level.label}`,
        parentName: task.name,
        maxPoints: level.points,
        tierIndex,
        tierLabel: level.label,
        splitTierCard: true,
        reuploadSubmissionId: rejectedSubmission?._id,
        reuploadRequired: Boolean(rejectedSubmission),
      }
    }).filter(Boolean)
  })
  const completed = submissions.filter((s) => ['Approved', 'FacultyApproved', 'HODApproved'].includes(s.status)).length
  const pendingReview = submissions.filter((s) => s.status === 'Pending').length
  const totalActivityPages = Math.max(1, Math.ceil((activityMeta.total || 0) / (activityMeta.limit || 1)))

  const groupedTasks = useMemo(() => {
    const filtered = pendingTasks.filter((task) => task.vertical === selectedVertical)
    const v1Order = ['Internship / Case Study / Mini Project', 'Industrial / Institutional / International Visit', 'Scholarship']
    const ordered = filtered.sort((a, b) => {
      const aIndex = v1Order.indexOf(a.name)
      const bIndex = v1Order.indexOf(b.name)
      if (aIndex < 0 && bIndex < 0) return 0
      if (aIndex < 0) return 1
      if (bIndex < 0) return -1
      return aIndex - bIndex
    })
    if (ordered.length === 0) return [{ key: 'all', heading: selectedVertical, items: [] }]

    const name = normalizeTaskName(selectedVertical)
    // V1 gets sub-grouped by activity type
    if (name.includes('vertical 1') || name.includes('academic')) {
      const groups = [
        { key: 'activity-1', heading: 'Activity: Internship / Case Study / Mini Project', activityName: 'Internship / Case Study / Mini Project', items: [] },
        { key: 'activity-2', heading: 'Activity: Industrial / Institutional / International Visit', activityName: 'Industrial / Institutional / International Visit', items: [] },
        { key: 'activity-3', heading: 'Activity: Academic & Other', activityName: 'Academic & Other', items: [] },
      ]
      ordered.forEach((task) => {
        const n = activityDisplayKey(task.name)
        if (n.includes('internship') || n.includes('case study') || n.includes('mini project')) groups[0].items.push(task)
        else if (VERTICAL_1_VISIT_ACTIVITIES.has(n)) groups[1].items.push(task)
        else groups[2].items.push(task)
      })
      return groups
    }

    const grouped = new Map()
    const ungrouped = []
    ordered.forEach((task) => {
      const activityName = task.parentName || task.name
      if (!GROUPED_TIER_ACTIVITIES.has(activityName)) {
        ungrouped.push(task)
        return
      }
      if (!grouped.has(activityName)) grouped.set(activityName, [])
      grouped.get(activityName).push(task)
    })

    const targetGroups = [...grouped.entries()].map(([activityName, items]) => ({
      key: `activity-${activityName}`,
      heading: `Activity: ${activityName}`,
      activityName,
      items,
    }))

    if (ungrouped.length > 0) {
      targetGroups.push({ key: 'all', heading: '', items: ungrouped })
    }

    return targetGroups.length > 0 ? targetGroups : [{ key: 'all', heading: selectedVertical, items: [] }]
  }, [pendingTasks, selectedVertical])

  const recent = useMemo(
    () => [...submissions].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 4),
    [submissions]
  )

  function normalizeTaskName(value = '') {
    return String(value || '').toLowerCase()
  }

  function getTaskProfile(task = {}) {
    const name = normalizeTaskName(task?.name)

    if (task?.valueAddedOptions?.length) {
      return { group: 'value-added-options', defaultOption: 'Internal', options: task.valueAddedOptions.map((option) => option.label) }
    }

    if (task?.internshipOptions?.length) {
      return { group: 'internship-options', defaultOption: task.internshipOptions[0].label, options: task.internshipOptions.map((option) => option.label) }
    }

    if (['industrial visit completed', 'institutional visit completed', 'international visit / conference'].includes(name)) {
      return { group: 'document', defaultOption: '', options: [] }
    }

    if (task?.splitTierCard) {
      return {
        group: 'split-tier',
        defaultOption: task.tierLabel,
        options: [],
      }
    }

    if (name === 'case study / mini project' || name === 'case study/mini project') {
      return {
        group: 'activity-1',
        defaultOption: 'Case Study',
        options: ['Case Study', 'Mini Project'],
      }
    }

    if (Array.isArray(task?.levels) && task.levels.length > 0) {
      return {
        group: 'level-select',
        defaultOption: '',
        options: task.levels.map((level) => level.label),
      }
    }

    if (name.includes('internship') || name.includes('case study') || name.includes('mini project')) {
      return {
        group: 'activity-1',
        defaultOption: name.includes('internship') ? 'Internship' : name.includes('case study') ? 'Case Study' : 'Mini Project',
        options: ['Internship', 'Case Study', 'Mini Project'],
      }
    }

    if (name.includes('visit')) {
      return {
        group: 'activity-2',
        defaultOption: name.includes('industrial') ? 'Industrial Visit' : name.includes('institutional') ? 'Institutional Visit' : 'International Visit',
        options: ['Industrial Visit', 'Institutional Visit', 'International Visit'],
      }
    }

    // Activities that need a URL proof
    if (name.includes('live project') || name.includes('github portfolio') || name.includes('portfolio website') ||
        name.includes('linkedin') || name.includes('kaggle') || name.includes('genai') ||
        name.includes('ai / ml') || name.includes('open-source')) {
      return { group: 'url', defaultOption: '', options: [] }
    }

    // Level-select activities (V2–V10)
    const levelMap = {
      'semester exam': ['< 60%', '60–69%', '70–79%', '80% and above'],
      'attendance': ['75–79%', '80–89%', '90–94%', '95% and above'],
      'internship': ['Case study/Mini project', 'Industry internship (2 weeks)', 'Industry internship (4 weeks)'],
      'case study': ['Case study/Mini project', 'Industry internship (2 weeks)', 'Industry internship (4 weeks)'],
      'mini project': ['Case study/Mini project', 'Industry internship (2 weeks)', 'Industry internship (4 weeks)'],
      'visit': ['Industrial Visit completed', 'Institutional Visit completed', 'International Visit / Conference'],
      'library': ['5 Hrs', '10 Hrs', '15 Hrs'],
      'scholarship': ['Applied for scholarship', 'Scholarship received', 'Merit Scholarship'],
      'nptel': ['Registered & Completed Assignments', 'Successfully completed', 'Elite', 'Elite with Gold/Silver badge'],
      'online certification': ['Completed 1 course', 'Specialisation / multi-course', 'Professional certificate', '2 professional certs'],
      'industry certification': ['Foundation level', 'Associate level', 'Professional level', 'Expert / Speciality level'],
      'short mooc': ['Enrolled & completed', '2 MOOCs completed', '3+ MOOCs with assessment'],
      'value added course': ['VAC with assessment / internal certification', 'External agency / industry expert with certification'],
      'leetcode': ['Profile + 5–20 Easy', '50 Easy / 10 Medium', '50 Medium problems', '100+ Medium / Hard / Top 10%'],
      'hackerrank': ['Profile + 5–20 Easy', '50 Easy / 10 Medium', '50 Medium problems', '100+ Medium / Hard / Top 10%'],
      'hackerearth': ['Profile + 5–20 Easy', '50 Easy / 10 Medium', '50 Medium problems', '100+ Medium / Hard / Top 10%'],
      'programming, data structures': ['Basic assessment cleared', 'Intermediate cleared', 'Advanced cleared', 'Expert / Certification'],
      'codechef': ['1–2 Star / 25 problems', '3 Star / 50 problems', '4 Star / 100 problems', '5 Star / 200 problems'],
      'geeksforgeeks': ['1–2 Star / 25 problems', '3 Star / 50 problems', '4 Star / 100 problems', '5 Star / 200 problems'],
      'coding contest': ['Participated', 'Top 50%', 'Finalist', 'Winner'],
      'open-source': ['GitHub profile + starred/forked repo + raised an issue', 'Pull Request submitted'],
      'hackathon': ['Participated', 'Qualified round / finalist', 'Regional/Local winner', 'IIT/NIT /National winner'],
      'datathon': ['Participated', 'Qualified round / finalist', 'Regional/Local winner', 'IIT/NIT /National winner'],
      'ideathon': ['Participated', 'Shortlisted / top 50%', 'Finalist', 'Winner'],
      'business plan': ['Participated', 'Shortlisted / top 50%', 'Finalist', 'Winner'],
      'startup': ['Participated / idea submitted', 'Prototype / MVP built', 'Incubated', 'Startup registered / funded'],
      'technical event': ['Intra-college participation', 'Intra-college winner / Inter-college participation', 'Inter-college winner', 'State/national winner'],
      'paper presentation': ['Internal / Department', 'External/Intercollegiate', 'State / National level', 'International'],
      'conference / journal': ['Abstract submitted', 'Conference paper published', 'Indexed conference', 'Indexed journal (Scopus)'],
      'patent': ['Draft filed', 'Published', 'Granted', 'Copyright'],
      'book chapter': ['Internal project report', 'Book chapter submitted', 'Book chapter published', 'International publisher'],
      'workshop': ['1 event attended', '2 events attended', '3+ events / paper presented', 'Best paper / award'],
      'symposium': ['1 event attended', '2 events attended', '3+ events / paper presented', 'Best paper / award'],
      'kaggle': ['Profile created + participated', 'Top 50%', 'Bronze / top 25%', 'Silver/Gold / top 10%'],
      'analytics vidhya': ['Profile created + participated', 'Top 50%', 'Bronze / top 25%', 'Silver/Gold / top 10%'],
      'ai / ml': ['Prototype / idea stage', 'Functional project', 'Deployed (app / dashboard)', 'Real user adoption / published'],
      'web dev': ['Prototype / idea stage', 'Functional project', 'Deployed (app / dashboard)', 'Real user adoption / published'],
      'networking project': ['Prototype / idea stage', 'Functional project', 'Deployed (app / dashboard)', 'Real user adoption / published'],
      'live project': ['Basic deployment', 'Multi-service deployment', 'Production-ready', 'Certified + deployed'],
      'genai': ['Used AI tools + documented', 'Built GenAI-integrated project', 'Deployed GenAI app', 'Industry / research recognised'],
      'prompt engineering': ['Used AI tools + documented', 'Built GenAI-integrated project', 'Deployed GenAI app', 'Industry / research recognised'],
      'linkedin': ['Profile created (Professional)', '50 connections + active posts + tagging college, Principal, Dean & HOD', '100 connections + weekly posts + engagement (likes/comments)', 'Recommendations + thought leader + college/department featured/shared your post'],
      'github portfolio': ['Account + 2–5 repos', '5–10 repos with README', 'Practical work submission', 'Mini-projects / projects submission'],
      'portfolio website': ['Basic portfolio page', 'Professional with projects', 'Project showcase + deployed'],
      'technical blog': ['3 blogs / 3 videos', '5 blogs', '10 blogs / YouTube channel', 'Industry / media recognition'],
      'podcast': ['3 blogs / 3 videos', '5 blogs', '10 blogs / YouTube channel', 'Industry / media recognition'],
      'peer mentoring': ['Helped 1–2 students', 'Study group / 5 students', 'Workshop / session conducted (class / juniors)', 'Structured mentoring programme'],
      'knowledge sharing': ['Helped 1–2 students', 'Study group / 5 students', 'Workshop / session conducted (class / juniors)', 'Structured mentoring programme'],
      'student council': ['Member', 'Active contributor', 'Coordinator / Jt. Secretary', 'President / Secretary'],
      'club': ['Member', 'Active contributor', 'Coordinator / Jt. Secretary', 'President / Secretary'],
      'professional conduct': ['Awarded by Mentor'],
      'event organising': ['Volunteer in a department-level event', 'Core committee member in college-level event', 'Coordinator / Joint Secretary of major college event', 'Chief Organiser / Convenor of inter-college / national event'],
      'nss': ['Enrolled', 'Active volunteer', 'Event organiser / camp', 'Camp leader / award'],
      'ncc': ['Enrolled', 'Certificate A/B', 'Certificate C', 'Leadership / National'],
      'cultural': ['College-level participation', 'Intercollegiate participation', 'Intercollegiate winner', 'State / national level'],
      'sports': ['College-level participation', 'Intercollegiate participation', 'Intercollegiate winner', 'State / national level'],
      'community outreach': ['Participated in 1 activity', 'Active volunteer (3+ events)', 'Coordinator / project lead', 'Measurable social impact'],
      'social initiative': ['Participated in 1 activity', 'Active volunteer (3+ events)', 'Coordinator / project lead', 'Measurable social impact'],
      'air-rifle': ['Enrolled', 'District level', 'State level', 'National level'],
      'resume': ['Basic draft created', 'Senior reviewed', 'ATS-optimised', 'Industry-reviewed / LinkedIn synced'],
      'mock interview': ['Attended mock / aptitude', 'Cleared aptitude test (>=60%)', 'High rating mock interview', 'Outstanding / top performer'],
      'aptitude': ['Attended mock / aptitude', 'Cleared aptitude test (>=60%)', 'High rating mock interview', 'Outstanding / top performer'],
      'placement': ['Internship offer received', 'Placement offer (<5 LPA)', 'Placement offer (5-10 LPA)', 'Dream offer (>10 LPA)'],
      'internship offer': ['Internship offer received', 'Placement offer (<5 LPA)', 'Placement offer (5-10 LPA)', 'Dream offer (>10 LPA)'],
      'higher studies': ['Appeared in exam', 'Qualified / cleared', 'Good percentile (>=70%ile)', 'Top rank / scholarship / admission'],
      'competitive exam': ['Appeared in exam', 'Qualified / cleared', 'Good percentile (>=70%ile)', 'Top rank / scholarship / admission'],
    }

    for (const [key, options] of Object.entries(levelMap)) {
      if (name.includes(key)) return { group: 'level-select', defaultOption: '', options }
    }

    return { group: 'generic', defaultOption: '', options: [] }
  }

  function openUpload(task) {
    const profile = getTaskProfile(task)
    setActiveTask(task)
    setSelectedFile(null)
    setFileName('')
    setDurationWeeks('2 weeks')
    setActivityOption(profile.defaultOption || 'Internship')
    setVisitOption(profile.defaultOption || 'Industrial Visit')
    setSelectedLevel(task.splitTierCard ? task.tierLabel : profile.group === 'level-select' ? profile.options[0] || '' : '')
    setUrlInput('')
  }

  function getSubmissionRules() {
    const profile = getTaskProfile(activeTask)
    const selectedActivity = profile.group === 'activity-1' ? activityOption : profile.group === 'activity-2' ? visitOption : ''
    const valueAddedOption = activeTask?.valueAddedOptions?.find((option) => option.label === activityOption) || activeTask?.valueAddedOptions?.[0]
    const selectedLevelText = String(selectedLevel || '').toLowerCase()
    const internshipOption = activeTask?.internshipOptions?.find((option) => option.label === activityOption) || activeTask?.internshipOptions?.[0]
    const isInternship = Boolean(internshipOption) || selectedActivity === 'Internship' || selectedLevelText.includes('internship')
    const isCaseStudy = selectedActivity === 'Case Study' || selectedLevelText.includes('case study')
    const isMiniProject = selectedActivity === 'Mini Project' || selectedLevelText.includes('mini project')

    const requiresFile = activeTask?.evidenceType === 'both' || activeTask?.evidenceType === 'file' || profile.group === 'split-tier' || profile.group === 'generic' || profile.group === 'document' || profile.group === 'activity-2' ||
      profile.group === 'level-select' || profile.group === 'value-added-options' || isInternship || isCaseStudy
    const requiresUrl = activeTask?.evidenceType === 'both' || activeTask?.evidenceType === 'url' || isMiniProject || profile.group === 'url'
    const requiresLevel = profile.group === 'level-select'

    const canSubmit =
      (requiresFile ? Boolean(selectedFile) : true) &&
      (requiresUrl ? Boolean(urlInput.trim()) : true) &&
      (requiresLevel ? Boolean(selectedLevel) : true)

    return { profile, selectedActivity, valueAddedOption, internshipOption, isInternship, isCaseStudy, isMiniProject, requiresFile, requiresUrl, requiresLevel, canSubmit, reuploadSubmissionId: activeTask?.reuploadSubmissionId || '' }
  }

  const ALLOWED_FILE_TYPES = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml']
  const MAX_FILE_SIZE = 5 * 1024 * 1024

  async function submitEvidence() {
    if (!activeTask) return

    const rules = getSubmissionRules()
    if (rules.requiresLevel && !selectedLevel) {
      setToast('Please select a level before submitting.')
      return
    }
    if (rules.requiresUrl && !urlInput.trim()) {
      setToast('Please enter your profile/submission URL')
      return
    }
    if (rules.requiresFile && !selectedFile) {
      setToast('Please upload a supporting document (screenshot/certificate)')
      return
    }
    if (rules.requiresFile && selectedFile) {
      const typeOk = ALLOWED_FILE_TYPES.some((prefix) => selectedFile.type.startsWith(prefix))
      if (!typeOk) {
        setToast('Please upload an image, PDF, or Word document.')
        return
      }
      if (selectedFile.size > MAX_FILE_SIZE) {
        setToast('File is too large — the maximum size is 5 MB.')
        return
      }
    }
    if (rules.requiresUrl && urlInput.trim()) {
      try {
        const parsed = new URL(urlInput.trim())
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
      } catch {
        setToast('Please enter a valid URL starting with http:// or https://.')
        return
      }
    }
    if (rules.isInternship && !durationWeeks) {
      setToast('Please select the internship duration before submitting.')
      return
    }

    const formData = new FormData()
    const internshipOption = rules.internshipOption
    const valueAddedOption = rules.valueAddedOption
    const activityId = valueAddedOption?.activityId || internshipOption?.activityId || activeTask.activityId || activeTask.id || activeTask._id || ''

    formData.append('activityId', activityId)
    formData.append('description', `Submission for ${activeTask.name}${rules.selectedActivity ? ` • ${rules.selectedActivity}` : ''}`)
    formData.append('activityType', rules.selectedActivity || '')
    formData.append('visitType', rules.selectedActivity || '')
    const isCaseStudyMiniProject = ['case study / mini project', 'case study/mini project'].includes(normalizeTaskName(activeTask.name))
    const submissionLevel = activeTask.splitTierCard
      ? activeTask.tierLabel
      : valueAddedOption?.level
        || internshipOption?.level
        || (isCaseStudyMiniProject ? activeTask.levels?.[0]?.label || '' : selectedLevel || '')
    formData.append('selectedLevel', submissionLevel)
    formData.append('durationWeeks', rules.internshipOption?.label.toLowerCase() || (rules.isInternship ? (selectedLevel.toLowerCase().includes('4 weeks') ? '4 weeks' : durationWeeks) : ''))
    formData.append('projectUrl', rules.requiresUrl ? urlInput : '')
    formData.append('proofUrl', rules.requiresUrl ? urlInput : '')

    if (selectedFile) formData.append('certificateFile', selectedFile)

    setSubmitting(true)
    try {
      const response = rules.reuploadSubmissionId
        ? await resubmitStudentEvidence(rules.reuploadSubmissionId, formData)
        : await submitStudentEvidence(formData)
      setSubmissions((prev) => rules.reuploadSubmissionId
        ? prev.map((submission) => submission._id === rules.reuploadSubmissionId ? response.data : submission)
        : [response.data, ...prev])
      setActiveTask(null)
      setSelectedFile(null)
      setSelectedLevel('')
      setUrlInput('')
      setToast('Evidence submitted — your faculty will review it shortly.')
      setTimeout(() => setToast(''), 3500)
    } catch (error) {
      setToast(error.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function openEvidence(submissionId, fileName = '', contentType = '') {
    try {
      const blob = await getSubmissionFileBlob(submissionId)
      const url = URL.createObjectURL(blob)
      if (isPdfEvidence(fileName, contentType || blob.type)) {
        const pages = await renderPdfPages(blob)
        setEvidencePreview({ pages, url, contentType: 'application/pdf' })
      } else {
        setEvidencePreview({ url, contentType: blob.type })
      }
    } catch (error) {
      setToast(error.message || 'Unable to open evidence file')
    }
  }

  function closeEvidencePreview() {
    if (evidencePreview?.url?.startsWith('blob:')) URL.revokeObjectURL(evidencePreview.url)
    setEvidencePreview(null)
  }

  if (loading) {
    return (
      <Shell role="student" userName="Student" department="Loading">
        <div className="student-dashboard-surface"><LoadingState rows={3} /></div>
      </Shell>
    )
  }

  if (error || !student) {
    return (
      <Shell role="student" userName="Student" department="Student">
        <div className="student-dashboard-surface">
          <EmptyState
            icon="⚠"
            title="Unable to load the dashboard"
            description={error || 'The student profile could not be loaded.'}
            action={<Button onClick={() => window.location.reload()}>Try again</Button>}
          />
        </div>
      </Shell>
    )
  }

  return (
    <Shell role="student" userName={student.name} department={student.department} profileTrigger={() => setProfileOpen(true)} badges={{ '/student/notifications': unreadCount }}>
      <div className="student-dashboard-surface">
        {toast && <Toast message={toast} tone={toast.toLowerCase().includes('fail') || toast.toLowerCase().includes('unable') || toast.toLowerCase().includes('please') ? 'error' : 'success'} onDismiss={() => setToast('')} />}

        {visibleAlerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {visibleAlerts.map((alert) => {
            const overdue = alert.tone === 'overdue'
            const urgent = alert.tone === 'urgent'
            return (
              <div
                key={String(alert.activityId)}
                className={`flex items-start justify-between gap-3 rounded-md border px-4 py-3 ${
                  overdue ? 'border-rose-300 bg-rose-50' : urgent ? 'border-amber-400 bg-amber-50' : 'border-amber-200 bg-amber-50/70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${
                    overdue ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {overdue ? '!' : '⏱'}
                  </span>
                  <div>
                    <p className={`text-sm font-medium ${overdue ? 'text-rose-700' : 'text-amber-800'}`}>
                      {overdue ? 'Overdue' : urgent ? 'Important — due soon' : 'Deadline approaching'}: {alert.activityName}
                      {alert.important && (
                        <span className="ml-2 inline-flex rounded-full bg-amber-500 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white">Important</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700/90">
                      {overdue
                        ? `Deadline was ${new Date(alert.deadline).toLocaleDateString()} — submit evidence to earn up to ${alert.maximumPoints} pts.`
                        : `Due ${new Date(alert.deadline).toLocaleDateString()} (${alert.daysLeft} day${alert.daysLeft === 1 ? '' : 's'}) — earn up to ${alert.maximumPoints} pts.`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismissAlert(alert.activityId)}
                  className="shrink-0 text-lg leading-none text-amber-700/60 transition-colors hover:text-amber-900 focus-ring"
                  aria-label="Dismiss alert"
                >
                  &times;
                </button>
              </div>
            )
          })}
        </div>
      )}

        <Routes>
          <Route path="" element={<StudentDashboardHome student={student} points={points} surplusPoints={surplusPoints} completed={completed} pendingTasks={pendingTasks} pendingReview={pendingReview} submissions={submissions} recent={recent} activities={activities} />} />
          <Route path="tasks" element={<StudentTasksPage selectedVertical={selectedVertical} setSelectedVertical={setSelectedVertical} verticalOptions={verticalOptions} groupedTasks={groupedTasks} pendingTasks={pendingTasks} activityMeta={activityMeta} activityPage={activityPage} totalActivityPages={totalActivityPages} setActivityPage={setActivityPage} openUpload={openUpload} categoryById={categoryById} />} />
          <Route path="submissions" element={<StudentSubmissionsPage submissions={submissions} openUpload={openUpload} openEvidence={openEvidence} />} />
          <Route path="leaderboard" element={<StudentLeaderboardPage />} />
          <Route path="notifications" element={<StudentNotificationsPage onUnreadChange={setUnreadCount} />} />
          <Route path="*" element={<Navigate to="/student" replace />} />
        </Routes>

        <Modal open={profileOpen} onClose={() => setProfileOpen(false)} title="">
        <StudentProfileModal
          student={student}
          points={points}
          submissions={submissions}
          activities={activities}
          recent={recent}
          onProfileUpdate={(updated) => setStudent(updated)}
        />
        </Modal>

        <Modal
          open={!!evidencePreview}
          onClose={closeEvidencePreview}
          title="Evidence preview"
          footer={evidencePreview && (
            <>
              <a
                href={evidencePreview.url}
                download="evidence"
                className="inline-flex items-center justify-center rounded-md border border-rule bg-transparent px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-slate-300 hover:bg-card focus-ring"
              >
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

        <Modal
        open={!!activeTask}
        onClose={() => setActiveTask(null)}
        title={`Upload evidence — ${activeTask?.name || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setActiveTask(null)}>Cancel</Button>
            <Button onClick={submitEvidence} loading={submitting} disabled={!getSubmissionRules().canSubmit || submitting}>Submit</Button>
          </>
        }
      >
        <p className="text-sm text-slate-500 mb-4">{activeTask?.description}</p>

        {getTaskProfile(activeTask).group === 'activity-1' && (
          <Field label="Select activity" className="mb-4">
            <Select value={activityOption} onChange={(e) => setActivityOption(e.target.value)}>
              {getTaskProfile(activeTask).options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </Field>
        )}

        {getTaskProfile(activeTask).group === 'internship-options' && (
          <Field label="Select duration" className="mb-4">
            <Select value={activityOption} onChange={(e) => setActivityOption(e.target.value)}>
              {getTaskProfile(activeTask).options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </Field>
        )}

        {getTaskProfile(activeTask).group === 'value-added-options' && (
          <Field label="Select course type" className="mb-4">
            <Select value={activityOption} onChange={(e) => setActivityOption(e.target.value)}>
              {getTaskProfile(activeTask).options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </Field>
        )}

        {getTaskProfile(activeTask).group === 'activity-2' && (
          <Field label="Select visit type" className="mb-4">
            <Select value={visitOption} onChange={(e) => setVisitOption(e.target.value)}>
              {getTaskProfile(activeTask).options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </Field>
        )}

        {getTaskProfile(activeTask).group === 'level-select' && (
          <Field label="Select level / achievement" className="mb-4">
            <Select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}>
              <option value="">-- Select --</option>
              {(activeTask?.levels?.length ? activeTask.levels : getTaskProfile(activeTask).options.map((label) => ({ label }))).map((level) => (
                <option key={level.label} value={level.label}>{level.label}{level.points !== undefined ? ` — ${level.points} pts` : ''}</option>
              ))}
            </Select>
          </Field>
        )}

        {getSubmissionRules().requiresUrl && (
          <Field label="Profile / Project URL" className="mb-4">
            <Input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://" />
          </Field>
        )}

        {getSubmissionRules().requiresFile && (
          <div className="mb-4">
            <label className="block cursor-pointer rounded-md border border-dashed border-rule bg-paper p-6 text-center transition-colors hover:border-brand-300">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  setSelectedFile(file)
                  setFileName(file?.name || '')
                }}
              />
              <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-md border border-rule bg-card font-mono text-sm text-slate-400">&#x2191;</span>
              <p className="mt-2 text-sm text-slate-500">{fileName ? <span className="font-medium text-ink">{fileName}</span> : 'Click to choose a file (PDF, JPG, PNG, DOC) — max 5 MB'}</p>
            </label>
          </div>
        )}

        {getTaskProfile(activeTask).group === 'activity-1' && activityOption === 'Internship' && (
          <Field label="Duration" className="mb-4">
            <Select value={durationWeeks} onChange={(e) => setDurationWeeks(e.target.value)}>
              <option value="2 weeks">2 weeks</option>
              <option value="4 weeks">4 weeks</option>
            </Select>
          </Field>
        )}

        </Modal>
      </div>
    </Shell>
  )
}
