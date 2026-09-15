const DEFAULT_API_BASE_URL = import.meta.env?.DEV ? '' : 'https://star-kpr.onrender.com'
export const API_BASE_URL = import.meta.env?.VITE_API_URL || DEFAULT_API_BASE_URL

function handleUnauthorized() {
  if (localStorage.getItem('stars_token')) {
    localStorage.removeItem('stars_token')
    localStorage.removeItem('stars_user')
    if (!window.location.pathname.startsWith('/')) {
      window.location.href = '/'
    } else {
      window.location.reload()
    }
  }
}

async function request(path, { method = 'GET', body, auth = true, isFormData = false, headers = {} } = {}) {
  const token = localStorage.getItem('stars_token')
  const options = { method, headers: { ...headers } }

  if (auth && token) {
    options.headers.Authorization = `Bearer ${token}`
  }

  if (body && !isFormData) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  } else if (body && isFormData) {
    options.body = body
  }

  const response = await fetch(`${API_BASE_URL}${path}`, options)
  const data = await response.json().catch(() => ({ success: false, message: 'Request failed' }))

  if (response.status === 401 && auth) {
    handleUnauthorized()
  }

  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || 'Request failed')
  }

  return data
}

export async function downloadFile(path, fallbackName = 'export') {
  const token = localStorage.getItem('stars_token')
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (response.status === 401) {
    handleUnauthorized()
  }
  if (!response.ok) {
    throw new Error('Export failed')
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/)
  const filename = match ? match[1] : fallbackName

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function loginUser(role, identifier, password) {
  const endpoint = role === 'student' ? '/api/auth/student/login' : role === 'faculty' ? '/api/auth/teacher/login' : '/api/auth/admin/login'
  const payload = role === 'student'
    ? { email: identifier, password }
    : { email: identifier, password }

  return request(endpoint, { method: 'POST', body: payload, auth: false })
}

export async function getStudentProfile() {
  return request('/api/student/profile')
}

export async function updateStudentProfile(profileData) {
  return request('/api/student/profile', { method: 'PUT', body: profileData })
}

export async function getStudentActivities(page = 1, limit = 10) {
  return request(`/api/student/activities?page=${page}&limit=${limit}`)
}

export async function getStudentSubmissions(limit = 20) {
  return request(`/api/student/submissions?limit=${limit}`)
}

export async function getStudentPoints() {
  return request('/api/student/points')
}

export async function appealSubmission(id, reason) {
  return request(`/api/student/submission/${id}/appeal`, { method: 'POST', body: { reason } })
}

export async function getStudentNotifications(page = 1, limit = 20) {
  return request(`/api/student/notifications?page=${page}&limit=${limit}`)
}

export async function markNotificationRead(id) {
  return request(`/api/student/notifications/${id}/read`, { method: 'PUT' })
}

export async function markAllNotificationsRead() {
  return request('/api/student/notifications/read-all', { method: 'PUT' })
}

export async function deleteStudentNotification(id) {
  return request(`/api/student/notifications/${id}`, { method: 'DELETE' })
}

export async function deleteStudentNotifications(ids) {
  return request('/api/student/notifications', { method: 'DELETE', body: { ids } })
}

export async function getTeacherNotifications(page = 1, limit = 20) {
  return request(`/api/teacher/notifications?page=${page}&limit=${limit}`)
}

export async function markTeacherNotificationRead(id) {
  return request(`/api/teacher/notifications/${id}/read`, { method: 'PUT' })
}

export async function markAllTeacherNotificationsRead() {
  return request('/api/teacher/notifications/read-all', { method: 'PUT' })
}

export async function deleteTeacherNotification(id) {
  return request(`/api/teacher/notifications/${id}`, { method: 'DELETE' })
}

export async function deleteTeacherNotifications(ids) {
  return request('/api/teacher/notifications', { method: 'DELETE', body: { ids } })
}

export async function getStudentLeaderboard(scope = 'batch') {
  return request(`/api/student/leaderboard?scope=${encodeURIComponent(scope)}`)
}

export async function getStudentPointsHistory() {
  return request('/api/student/points-history')
}

export async function getStudentDeadlineAlerts() {
  return request('/api/student/deadline-alerts')
}

export function downloadProgressCard() {
  return downloadFile('/api/student/progress-card', 'progress-card.pdf')
}

export async function submitStudentEvidence(formData) {
  return request('/api/student/submission', { method: 'POST', body: formData, auth: true, isFormData: true })
}

export async function resubmitStudentEvidence(submissionId, formData) {
  return request(`/api/student/submission/${submissionId}/resubmit`, { method: 'PUT', body: formData, auth: true, isFormData: true })
}

export async function getTeacherSubmissions(limit = 20, status = 'Pending') {
  return request(`/api/teacher/submissions/pending?limit=${limit}&status=${status}`)
}

export async function getSubmissionFileBlob(submissionId) {
  const token = localStorage.getItem('stars_token')
  const response = await fetch(`${API_BASE_URL}/api/submissions/${submissionId}/file`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Unable to load submission file')
  }

  return response.blob()
}

export async function getTeacherDashboard() {
  return request('/api/teacher/dashboard')
}

export async function getTeacherAnalytics(days = 90, period = 'week') {
  return request(`/api/teacher/analytics?days=${days}&period=${period}`)
}

export async function getStudentVerticalPerformance(studentId = '') {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''
  return request(`/api/teacher/vertical-performance${query}`)
}

export async function approveSubmission(id, pointsAwarded, teacherRemarks) {
  return request(`/api/teacher/submission/${id}/approve`, {
    method: 'PUT',
    body: { pointsAwarded, teacherRemarks },
  })
}

export async function rejectSubmission(id, teacherRemarks) {
  return request(`/api/teacher/submission/${id}/reject`, {
    method: 'PUT',
    body: { teacherRemarks },
  })
}

export async function bulkApproveSubmissions(ids, payload = {}) {
  return request('/api/teacher/submissions/bulk-approve', {
    method: 'POST',
    body: { ids, ...payload },
  })
}

export async function bulkRejectSubmissions(ids, payload = {}) {
  return request('/api/teacher/submissions/bulk-reject', {
    method: 'POST',
    body: { ids, ...payload },
  })
}

export function exportTeacherSubmissions(status = 'Pending') {
  return downloadFile(`/api/teacher/submissions/export?status=${status}`, 'submissions.xlsx')
}

export async function runAiReview(submissionId, pageImages = []) {
  return request(`/api/teacher/submission/${submissionId}/ai-review`, { method: 'POST', body: { pageImages } })
}

export async function applyAiReview(submissionId) {
  return request(`/api/teacher/submission/${submissionId}/ai-apply`, { method: 'POST' })
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function getAdminUsers() {
  return request('/api/admin/users')
}

export function exportAdminUsers(role = '') {
  return downloadFile(`/api/admin/users/export?role=${role}`, 'users.xlsx')
}

export async function getAdminUser(id) {
  return request(`/api/admin/users/${id}`)
}

export async function createUser(payload) {
  return request('/api/admin/users', { method: 'POST', body: payload })
}

export async function updateUser(id, payload) {
  return request(`/api/admin/users/${id}`, { method: 'PUT', body: payload })
}

export async function deleteUser(id) {
  return request(`/api/admin/users/${id}`, { method: 'DELETE' })
}

export async function bulkDeleteUsers(payload) {
  return request('/api/admin/users/bulk-delete', { method: 'POST', body: payload })
}

export async function resetUserPassword(id, newPassword = 'Welcome@123') {
  return request(`/api/admin/users/${id}/reset-password`, {
    method: 'PUT',
    body: { newPassword },
  })
}

export async function createDepartment(payload) {
  return request('/api/admin/departments', { method: 'POST', body: payload })
}

export async function updateDepartment(id, payload) {
  return request(`/api/admin/departments/${id}`, { method: 'PUT', body: payload })
}

export async function deleteDepartment(id) {
  return request(`/api/admin/departments/${id}`, { method: 'DELETE' })
}

export async function getLookups() {
  return request('/api/admin/lookups')
}

export async function getAnalytics() {
  return request('/api/admin/analytics')
}

export async function bulkUploadUsers(formData) {
  return request('/api/admin/users/bulk-upload', {
    method: 'POST',
    body: formData,
    isFormData: true,
  })
}

export async function bulkUpdateUsers(formData) {
  return request('/api/admin/users/bulk-update', {
    method: 'PUT',
    body: formData,
    isFormData: true,
  })
}

export function downloadBulkTemplate() {
  return downloadFile('/api/admin/bulk-upload/template', 'students-bulk-upload-template.xlsx')
}

export async function getAdminActivities() {
  return request('/api/admin/activities')
}

export async function createAdminActivity(payload) {
  return request('/api/admin/activities', { method: 'POST', body: payload })
}

export async function updateAdminActivity(id, payload) {
  return request(`/api/admin/activities/${id}`, { method: 'PUT', body: payload })
}

export async function deleteAdminActivity(id) {
  return request(`/api/admin/activities/${id}`, { method: 'DELETE' })
}

export function exportAnalytics() {
  return downloadFile('/api/admin/analytics/export', 'analytics.xlsx')
}

export async function getAuditLogs(page = 1, limit = 20, action = '') {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (action) query.set('action', action)
  return request(`/api/admin/audit-logs?${query.toString()}`)
}

export async function deleteAuditLog(id) {
  return request(`/api/admin/audit-logs/${id}`, { method: 'DELETE' })
}

export async function clearAuditLogs() {
  return request('/api/admin/audit-logs', { method: 'DELETE' })
}

export function downloadAdminReport() {
  return downloadFile('/api/admin/report', 'institution-report.pdf')
}

export async function getDepartmentStats() {
  return request('/api/admin/department-stats')
}

export async function getDepartmentAiSummary() {
  return request('/api/admin/ai/department-summary')
}

export async function bulkAssignFaculty(formData) {
  return request('/api/admin/users/bulk-assign-faculty', { method: 'POST', body: formData, isFormData: true })
}

export async function getAcademicSettings() {
  return request('/api/admin/academic-year')
}

export async function updateAcademicSettings(payload) {
  return request('/api/admin/academic-year', { method: 'PUT', body: payload })
}

export async function rolloverAcademicYear(payload) {
  return request('/api/admin/academic-year/rollover', { method: 'POST', body: payload })
}

// ---------------------------------------------------------------------------
// Dean-specific endpoints
// ---------------------------------------------------------------------------

export async function getDeanStats() {
  return request('/api/admin/dean/stats')
}

export async function getDeanDepartmentsPerformance() {
  return request('/api/admin/dean/departments-performance')
}

export async function getDeanDepartmentYearPerformance(departmentId) {
  return request(`/api/admin/dean/departments/${departmentId}/year-performance`)
}

export async function getDeanDepartmentStudentPerformance(departmentId) {
  return request(`/api/admin/dean/departments/${departmentId}/student-performance`)
}

export async function getDeanTopPerformers(departmentId) {
  return request(`/api/admin/dean/departments/${departmentId}/top-performers`)
}

export async function runHodAiReview(submissionId) {
  return request(`/api/hod/submission/${submissionId}/ai-review`, { method: 'POST' })
}

export async function getHodSubmissions(limit = 50, flagged = false, search = '') {
  const query = new URLSearchParams({ limit: String(limit) })
  if (flagged) query.set('flagged', 'true')
  if (search) query.set('search', search)
  return request(`/api/hod/submissions/pending?${query.toString()}`)
}

export async function getHodDashboard() {
  return request('/api/hod/dashboard')
}

export function exportHodSubmissions(status = 'FacultyApproved') {
  return downloadFile(`/api/hod/submissions/export?status=${status}`, 'hod-submissions.xlsx')
}

export async function verifyHodSubmission(id, status, payload = {}) {
  const endpoint = status === 'Approved' ? 'approve' : 'reject'
  return request(`/api/hod/submission/${id}/${endpoint}`, { method: 'PUT', body: payload })
}

export async function bulkVerifyHodSubmissions(ids, status, payload = {}) {
  const endpoint = status === 'Approved' ? 'bulk-approve' : 'bulk-reject'
  return request(`/api/hod/submissions/${endpoint}`, {
    method: 'POST',
    body: { ids, ...payload },
  })
}

export async function lockSemester(batch) {
  return request('/api/hod/semester/lock', { method: 'PUT', body: { batch: batch || undefined } })
}

export async function unlockSemester(batch) {
  return request('/api/hod/semester/unlock', { method: 'PUT', body: { batch: batch || undefined } })
}

export async function getHodSemesterStatus() {
  return request('/api/hod/semester/status')
}

export async function getHodLeaderboard(limit = 25) {
  return request(`/api/hod/leaderboard?limit=${limit}`)
}

export async function getHodAtRisk() {
  return request('/api/hod/at-risk')
}

export async function getHodFacultyOverview() {
  return request('/api/hod/faculty')
}

export async function getHodStudentOverview(studentId) {
  return request(`/api/hod/students/${studentId}/overview`)
}

export function exportHodLeaderboard() {
  return downloadFile('/api/hod/leaderboard/export', 'leaderboard.xlsx')
}

export function exportHodFacultyOverview() {
  return downloadFile('/api/hod/faculty/export', 'faculty-overview.xlsx')
}

export async function getAcademicMetricsRegNos() {
  return request('/api/teacher/academic-metrics/reg-nos')
}

export function downloadAcademicMetricsTemplate() {
  return downloadFile('/api/teacher/academic-metrics/template', 'academic-metrics-template.xlsx')
}

export function downloadAcademicMetricsCsvTemplate() {
  return downloadFile('/api/teacher/academic-metrics/template-csv', 'academic-metrics-template.csv')
}

export async function bulkUploadAcademicMetrics(rows) {
  return request('/api/teacher/academic-metrics/bulk-upload', {
    method: 'POST',
    body: { rows }
  })
}

export async function getScoreboard() {
  return request('/api/teacher/scoreboard')
}

export function downloadPdfReport(type = 'submissions', status = 'FacultyApproved') {
  return downloadFile(`/api/teacher/reports/pdf?type=${type}&status=${status}`, `${type}-report.pdf`)
}

export async function autoApproveByAi(ids = []) {
  return request('/api/teacher/submissions/auto-approve-ai', {
    method: 'POST',
    body: { ids }
  })
}

export async function getStudentAcademicRecords(search = '', batch = '') {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (batch) params.set('batch', batch)
  const query = params.toString()
  return request(`/api/teacher/academic-records${query ? '?' + query : ''}`)
}

export async function updateAcademicRecord(id, payload) {
  return request(`/api/teacher/academic-records/${id}`, {
    method: 'PUT',
    body: payload
  })
}

export async function deleteAcademicRecord(id) {
  return request(`/api/teacher/academic-records/${id}`, {
    method: 'DELETE'
  })
}
