import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Activity, Building2, ChartNoAxesCombined, Code2, FileText, Gauge, GraduationCap, KeyRound, LayoutDashboard, LockKeyhole, Mail, PlusCircle, School, ToggleRight, UserRound, UserRoundCog, UsersRound } from 'lucide-react'
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Shell from '../components/Shell.jsx'
import { StatCard, Button, PageHeader, Card, Toast, ConfirmDialog, Field, Input, Select, EmptyState, StatusBadge, LoadingState, Modal } from '../components/UI.jsx'
import {
  getAdminUsers,
  getLookups,
  getAnalytics,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createUser,
  updateUser,
  deleteUser,
  bulkDeleteUsers,
  resetUserPassword,
  exportAdminUsers,
  exportAnalytics,
  downloadAdminReport,
  getDeanStats,
  getDeanDepartmentsPerformance,
  getDeanDepartmentYearPerformance,
  getDeanDepartmentStudentPerformance,
  getDeanTopPerformers,
} from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const initialDepartmentForm = {
  name: '',
  code: '',
  schoolId: '',
  status: 'Active',
}

const initialHodForm = {
  name: '',
  email: '',
  password: '',
  schoolId: '',
  departmentId: '',
  status: 'Active',
}

const initialUserForm = {
  role: 'student',
  accountType: 'hod',
  name: '',
  email: '',
  password: '',
  registerNo: '',
  school: '',
  department: '',
  schoolId: '',
  departmentId: '',
  assignedTeacher: '',
  assignedYear: '',
  year: '',
  batch: '',
  section: '',
}

export default function PrincipalDashboard({ embedded = false }) {
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(initialUserForm)
  const [departmentForm, setDepartmentForm] = useState(initialDepartmentForm)
  const [hodForm, setHodForm] = useState(initialHodForm)
  const [editingId, setEditingId] = useState('')
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState([])
  const [lookups, setLookups] = useState({ schools: [], departments: [], faculty: [] })
  const [selectedFaculty, setSelectedFaculty] = useState('all')
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [confirm, setConfirm] = useState(null)
  const [exportingUsers, setExportingUsers] = useState(false)
  const [exportingAnalytics, setExportingAnalytics] = useState(false)
  const [downloadingReport, setDownloadingReport] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [deleteYear, setDeleteYear] = useState('')
  const [bulkDeleting, setBulkDeleting] = useState(false)

  async function handleDownloadReport() {
    setDownloadingReport(true)
    try {
      await downloadAdminReport()
    } catch (error) {
      notify(error.message || 'Unable to download report', 'error')
    } finally {
      setDownloadingReport(false)
    }
  }

  const [deanStats, setDeanStats] = useState({ departments: 0, hods: 0, faculty: 0 })
  const [deanDeptPerformance, setDeanDeptPerformance] = useState([])
  const [deanDepartmentsLoading, setDeanDepartmentsLoading] = useState(true)
  const [selectedDeptForAnalytics, setSelectedDeptForAnalytics] = useState(null)
  const [deptYearPerformance, setDeptYearPerformance] = useState([])
  const [deptTopPerformers, setDeptTopPerformers] = useState({ topHODs: [], topFaculty: [] })
  const [deptStudentPerformance, setDeptStudentPerformance] = useState({ department: '', totalStudents: 0, topStudents: [] })
  const [deptDetailsLoading, setDeptDetailsLoading] = useState(false)
  const [analyticsView, setAnalyticsView] = useState('departments')
  const [editingDepartment, setEditingDepartment] = useState(null)
  const [departmentEditForm, setDepartmentEditForm] = useState({ name: '', code: '', status: 'Active' })
  const [editingHod, setEditingHod] = useState(null)
  const [hodEditForm, setHodEditForm] = useState({ name: '', email: '', departmentId: '', status: 'Active' })
  const [departmentDeleteTarget, setDepartmentDeleteTarget] = useState(null)
  const [hodDeleteTarget, setHodDeleteTarget] = useState(null)

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('stars_user') || '{}')
    } catch {
      return {}
    }
  }, [])

  async function handleExportUsers() {
    setExportingUsers(true)
    try {
      await exportAdminUsers('')
    } catch (error) {
      notify(error.message || 'Export failed', 'error')
    } finally {
      setExportingUsers(false)
    }
  }

  async function handleExportAnalytics() {
    setExportingAnalytics(true)
    try {
      await exportAnalytics()
    } catch (error) {
      notify(error.message || 'Export failed', 'error')
    } finally {
      setExportingAnalytics(false)
    }
  }

  const isDean = currentUser?.accountType === 'dean'
  const isHod = currentUser?.accountType === 'hod'

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    loadUsers()
    loadLookups()
    loadAnalytics()
    if (isDean) {
      loadDeanStats()
      loadDeanDeptPerformance()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadUsers() {
    try {
      const data = await getAdminUsers()
      setUsers(data.data || [])
    } catch (error) {
      notify(error.message || 'Unable to load users right now.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadLookups() {
    try {
      const data = await getLookups()
      setLookups(data.data || { schools: [], departments: [], faculty: [] })
    } catch (error) {
      console.error(error)
    }
  }

  async function loadAnalytics() {
    try {
      const data = await getAnalytics()
      setAnalytics(data.data?.chartData || [])
    } catch (error) {
      console.error(error)
    }
  }

  async function loadDeanStats() {
    try {
      const data = await getDeanStats()
      setDeanStats(data.data || { departments: 0, hods: 0, faculty: 0 })
    } catch (error) {
      console.error(error)
    }
  }

  async function loadDeanDeptPerformance() {
    setDeanDepartmentsLoading(true)
    try {
      const data = await getDeanDepartmentsPerformance()
      setDeanDeptPerformance(data.data?.departments || [])
    } catch (error) {
      console.error(error)
    } finally {
      setDeanDepartmentsLoading(false)
    }
  }

  async function handleDeptClick(department) {
    setSelectedDeptForAnalytics(department)
    setAnalyticsView('year-performance')
    setDeptDetailsLoading(true)
    try {
      const [yearPerfData, topPerfData, studentPerfData] = await Promise.all([
        getDeanDepartmentYearPerformance(department._id),
        getDeanTopPerformers(department._id),
        getDeanDepartmentStudentPerformance(department._id),
      ])
      setDeptYearPerformance(yearPerfData.data?.yearPerformance || [])
      setDeptTopPerformers(topPerfData.data || { topHODs: [], topFaculty: [] })
      setDeptStudentPerformance(studentPerfData.data || { department: department.name, totalStudents: 0, topStudents: [] })
    } catch (error) {
      console.error(error)
      notify(error.message || 'Unable to load department details', 'error')
    } finally {
      setDeptDetailsLoading(false)
    }
  }

  function handleBackToDepartments() {
    setSelectedDeptForAnalytics(null)
    setAnalyticsView('departments')
    setDeptYearPerformance([])
    setDeptTopPerformers({ topHODs: [], topFaculty: [] })
    setDeptStudentPerformance({ department: '', totalStudents: 0, topStudents: [] })
    setDeptDetailsLoading(false)
  }

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const search = `${user.name || ''} ${user.email || ''} ${user.registerNo || user.registerNumber || user.regNo || ''}`.toLowerCase()
      return search.includes(query.toLowerCase())
    })
  }, [users, query])

  const studentCount = useMemo(() => users.filter((user) => user.role === 'student').length, [users])
  const facultyCount = useMemo(() => users.filter((user) => user.role === 'faculty').length, [users])
  const adminCount = useMemo(() => users.filter((user) => user.role === 'admin').length, [users])
  const availableYears = useMemo(() => [...new Set(users.map((user) => String(user.year || '').trim()).filter(Boolean))].sort(), [users])
  const usersForDeleteYear = useMemo(() => users.filter((user) => String(user.year || '').trim() === deleteYear), [deleteYear, users])

  const selectedDepartmentOptions = useMemo(() => {
    if (!form.schoolId) return lookups.departments
    return lookups.departments.filter((department) => {
      const departmentSchoolId = department.schoolId?._id || department.schoolId || ''
      return departmentSchoolId.toString() === form.schoolId.toString()
    })
  }, [form.schoolId, lookups.departments])

  const facultyForSelectedDepartment = useMemo(() => {
    if (!form.departmentId) return lookups.faculty
    return lookups.faculty.filter((member) => {
      const memberDepartmentId = member.departmentId?._id || member.departmentId || ''
      return memberDepartmentId.toString() === form.departmentId.toString()
    })
  }, [form.departmentId, lookups.faculty])

  const groupedUsers = useMemo(() => {
    const hodDean = filteredUsers.filter((user) => user.role === 'admin' || user.accountType === 'dean' || user.accountType === 'hod')
    const facultyUsers = filteredUsers.filter((user) => user.role === 'faculty')
    const students = filteredUsers.filter((user) => user.role === 'student')
    return { hodDean, facultyUsers, students }
  }, [filteredUsers])

  const deanSchoolDepartments = useMemo(() => {
    if (!isDean || !currentUser?.schoolId) return []
    return [...(lookups.departments || [])]
      .filter((department) => (department.schoolId?._id || department.schoolId || '').toString() === currentUser.schoolId.toString())
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  }, [currentUser?.schoolId, isDean, lookups.departments])

  const deanSchoolHods = useMemo(() => {
    if (!isDean || !currentUser?.schoolId) return []
    return [...users]
      .filter((user) => {
        const userSchoolId = user.schoolId?._id || user.schoolId
        return user.role === 'admin'
          && user.accountType === 'hod'
          && user.status === 'Active'
          && userSchoolId?.toString() === currentUser.schoolId.toString()
      })
      .map((user) => ({
        ...user,
        departmentName: user.departmentId?.name || user.department || 'Unassigned',
      }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  }, [currentUser?.schoolId, isDean, users])

  const facultyFilterOptions = useMemo(() => {
    const facultyFromLookups = Array.isArray(lookups.faculty) ? lookups.faculty : []
    const facultyFromUsers = Array.isArray(groupedUsers.facultyUsers) ? groupedUsers.facultyUsers : []
    const combined = [...facultyFromLookups, ...facultyFromUsers]
    const seen = new Set()

    return combined.filter((member) => {
      const key = member?._id || member?.name || ''
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    }).map((member) => ({
      value: member?._id || member?.name || '',
      label: member?.name || member?.email || 'Faculty',
    }))
  }, [groupedUsers.facultyUsers, lookups.faculty])

  const filteredStudentUsers = useMemo(() => {
    const studentUsers = Array.isArray(groupedUsers.students) ? groupedUsers.students : []
    if (selectedFaculty === 'all') return studentUsers

    const normalizedSelectedFaculty = `${selectedFaculty}`.trim().toLowerCase()

    return studentUsers.filter((student) => {
      const candidateValues = [
        student?.recommendedFaculty,
        student?.facultyName,
        student?.assignedFaculty,
        student?.assignedFacultyName,
        student?.assignedTeacher,
        student?.assignedTeacherName,
        student?.facultyId,
        student?.assignedFacultyId,
        student?.faculty?._id,
        student?.faculty?.name,
        student?.assignedTeacher?.name,
        student?.assignedTeacher?._id,
        student?.recommendedFacultyName,
      ]

      return candidateValues.some((value) => {
        if (!value) return false
        if (typeof value === 'object') {
          const nestedValue = `${value.name || value._id || ''}`.trim().toLowerCase()
          return nestedValue === normalizedSelectedFaculty
        }

        const normalizedValue = `${value}`.trim().toLowerCase()
        return normalizedValue === normalizedSelectedFaculty || normalizedValue.includes(normalizedSelectedFaculty)
      })
    })
  }, [groupedUsers.students, selectedFaculty])

  const chartTitle = isDean ? 'Department performance across your school' : isHod ? 'Year-level student performance' : 'Performance overview'

  const filteredAnalytics = useMemo(() => {
    if (selectedDepartment === 'all') return analytics
    return analytics.filter((item) => item.departmentId?.toString() === selectedDepartment.toString())
  }, [analytics, selectedDepartment])

  async function submitDepartment(e) {
    e.preventDefault()
    try {
      await createDepartment({ ...departmentForm, schoolId: departmentForm.schoolId || currentUser.schoolId || '' })
      setDepartmentForm(initialDepartmentForm)
      notify('Department created successfully.')
      await Promise.all([loadLookups(), loadAnalytics()])
    } catch (error) {
      notify(error.message || 'Unable to create department', 'error')
    }
  }

  async function submitHod(e) {
    e.preventDefault()
    try {
      await createUser({
        ...hodForm,
        role: 'admin',
        accountType: 'hod',
        schoolId: hodForm.schoolId || currentUser.schoolId || undefined,
        departmentId: hodForm.departmentId || undefined,
      })
      setHodForm(initialHodForm)
      notify('HOD created successfully.')
      await Promise.all([loadUsers(), loadLookups()])
    } catch (error) {
      notify(error.message || 'Unable to create HOD', 'error')
    }
  }

  async function submitUser(e) {
    e.preventDefault()
    try {
      const payload = {
        ...form,
        schoolId: form.schoolId || currentUser.schoolId || undefined,
        departmentId: form.departmentId || currentUser.departmentId || undefined,
        school: form.school || currentUser.school || 'STAR',
        department: form.department || currentUser.department || '',
      }

      if (isDean && (payload.role !== 'admin' || payload.accountType !== 'hod')) {
        throw new Error('Dean accounts can only add HOD users.')
      }
      if (isHod && payload.role === 'admin') {
        throw new Error('HOD accounts can only add students or faculty users.')
      }

      if (editingId) {
        await updateUser(editingId, { ...payload, password: undefined })
      } else {
        await createUser(payload)
      }

      setForm(initialUserForm)
      setEditingId('')
      notify(editingId ? 'User updated successfully.' : 'User added successfully.')
      await Promise.all([loadUsers(), loadLookups(), loadAnalytics()])
    } catch (error) {
      notify(error.message || 'Unable to save user', 'error')
    }
  }

  async function handleDeleteDepartment(departmentId) {
    try {
      await deleteDepartment(departmentId)
      notify('Department deleted successfully.')
      await Promise.all([loadLookups(), loadAnalytics(), loadUsers()])
    } catch (error) {
      notify(error.message || 'Unable to delete department', 'error')
    } finally {
      setDepartmentDeleteTarget(null)
    }
  }

  async function handleDeleteHod(hodId) {
    try {
      await deleteUser(hodId)
      notify('HOD deleted successfully.')
      await loadUsers()
    } catch (error) {
      notify(error.message || 'Unable to delete HOD', 'error')
    } finally {
      setHodDeleteTarget(null)
    }
  }

  async function handleResetHod(hodId) {
    try {
      await resetUserPassword(hodId)
      notify('HOD password reset to Welcome@123.')
    } catch (error) {
      notify(error.message || 'Unable to reset HOD password', 'error')
    }
  }

  async function confirmDelete(id) {
    try {
      await deleteUser(id)
      notify('User deleted successfully.')
      await loadUsers()
    } catch (error) {
      notify(error.message || 'Unable to delete user', 'error')
    } finally {
      setConfirm(null)
    }
  }

  async function performBulkDelete(payload) {
    if (bulkDeleting) return
    setBulkDeleting(true)
    try {
      const data = await bulkDeleteUsers(payload)
      notify(`${data.data?.deletedCount || 0} user${data.data?.deletedCount === 1 ? '' : 's'} deleted successfully.`)
      setSelectedUserIds([])
      setDeleteYear('')
      await loadUsers()
    } catch (error) {
      notify(error.message || 'Unable to delete users', 'error')
    } finally {
      setBulkDeleting(false)
      setConfirm(null)
    }
  }

  function requestBulkDeleteSelected() {
    if (!selectedUserIds.length || bulkDeleting) return
    setConfirm({
      title: 'Delete selected users',
      message: `Are you sure you want to delete ${selectedUserIds.length} selected user${selectedUserIds.length === 1 ? '' : 's'}? This action cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: () => performBulkDelete({ ids: selectedUserIds }),
    })
  }

  function requestBulkDeleteYear() {
    if (!deleteYear || bulkDeleting) return
    if (!usersForDeleteYear.length) {
      notify(`No users found for year ${deleteYear}.`, 'error')
      return
    }
    setConfirm({
      title: 'Delete users by year',
      message: `Are you sure you want to delete all ${usersForDeleteYear.length} users from year ${deleteYear}? This action cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: () => performBulkDelete({ year: deleteYear }),
    })
  }

  async function confirmReset(id) {
    try {
      await resetUserPassword(id)
      notify('Password reset to Welcome@123.')
    } catch (error) {
      notify(error.message || 'Unable to reset password', 'error')
    } finally {
      setConfirm(null)
    }
  }

  function startEditingUser(user) {
    setEditingId(user._id)
    setForm({
      role: user.role || 'student',
      accountType: user.accountType || 'hod',
      name: user.name || '',
      email: user.email || '',
      password: '',
      registerNo: user.registerNo || user.registerNumber || user.regNo || '',
      school: user.school || '',
      department: user.department || '',
      schoolId: user.schoolId || '',
      departmentId: user.departmentId || '',
      assignedTeacher: user.assignedTeacher || user.assignedFacultyId || '',
      assignedYear: user.assignedYear || user.yearAssigned || '',
      year: user.year || '',
      batch: user.batch || user.semesterBatch || '',
      section: user.section || '',
    })
  }

  function openDepartmentEditor(department) {
    setEditingDepartment(department)
    setDepartmentEditForm({
      name: department?.name || '',
      code: department?.code || '',
      status: department?.status || 'Active',
    })
  }

  async function saveDepartmentEdit(event) {
    event.preventDefault()
    if (!editingDepartment) return
    try {
      await updateDepartment(editingDepartment._id, {
        name: departmentEditForm.name.trim(),
        code: departmentEditForm.code.trim(),
        status: departmentEditForm.status,
      })
      setEditingDepartment(null)
      notify('Department updated successfully.')
      await Promise.all([loadLookups(), loadAnalytics()])
    } catch (error) {
      notify(error.message || 'Unable to update department', 'error')
    }
  }

  function openHodEditor(hod) {
    setEditingHod(hod)
    setHodEditForm({
      name: hod?.name || '',
      email: hod?.email || '',
      departmentId: hod?.departmentId?._id || hod?.departmentId || '',
      status: hod?.status || 'Active',
    })
  }

  async function saveHodEdit(event) {
    event.preventDefault()
    if (!editingHod) return
    try {
      await updateUser(editingHod._id, {
        name: hodEditForm.name.trim(),
        email: hodEditForm.email.trim(),
        departmentId: hodEditForm.departmentId,
        status: hodEditForm.status,
        role: 'admin',
        accountType: 'hod',
      })
      setEditingHod(null)
      notify('HOD updated successfully.')
      await loadUsers()
    } catch (error) {
      notify(error.message || 'Unable to update HOD', 'error')
    }
  }

  function actionButtons(user, isStudent = false) {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (isStudent) {
              window.location.href = `/${isHod ? 'hod' : 'principal'}/edit-student/${user._id}`
            } else {
              startEditingUser(user)
            }
          }}
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setConfirm({
              id: user._id,
              title: 'Delete user',
              message: `Are you sure you want to delete ${user.name || 'this user'}? This action cannot be undone.`,
              confirmLabel: 'Delete',
              onConfirm: () => confirmDelete(user._id),
            })
          }
        >
          Delete
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            setConfirm({
              id: user._id,
              title: 'Reset password',
              message: `Reset the password for ${user.name || 'this user'} to Welcome@123?`,
              confirmLabel: 'Reset',
              tone: 'primary',
              onConfirm: () => confirmReset(user._id),
            })
          }
        >
          Reset
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <PageFrame embedded={embedded} currentUser={currentUser}>
        <LoadingState rows={3} />
      </PageFrame>
    )
  }

  return (
    <PageFrame embedded={embedded} currentUser={currentUser}>
      <PageHeader
        title={isHod ? 'HOD DASHBOARD' : isDean ? 'DEAN DASHBOARD' : 'PRINCIPAL DASHBOARD'}
        icon={LayoutDashboard}
        subtitle={
          isDean
            ? 'Review school-wide department performance and view the top students for each department.'
            : 'Track department performance, manage student records, and assign faculty quickly.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleDownloadReport} loading={downloadingReport} className="flex items-center justify-center gap-2">
              <FileText size={18} /> PDF Report
            </Button>
            <Button variant="outline" onClick={handleExportAnalytics} loading={exportingAnalytics} className="flex items-center justify-center gap-2">
              <ChartNoAxesCombined size={18} /> Export Analytics
            </Button>
            <Button variant="outline" onClick={handleExportUsers} loading={exportingUsers} className="flex items-center justify-center gap-2">
              <UsersRound size={18} /> Export Users
            </Button>
          </div>
        }
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      <div className={`grid grid-cols-1 gap-5 mb-8 sm:grid-cols-2 ${isHod ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
        {isDean ? (
          <>
            <StatCard label="Departments" value={deanStats.departments} sub="Active departments" accent="brand" icon={Building2} />
            <StatCard label="HODs" value={deanStats.hods} sub="Active HOD accounts" accent="leaf" icon={UserRoundCog} />
            <StatCard label="Faculty" value={deanStats.faculty} sub="Active faculty accounts" accent="amber" icon={UsersRound} />
          </>
        ) : (
          <>
            <StatCard label="Students" value={studentCount} sub="Managed learners" accent="brand" />
            <StatCard label="Faculty" value={facultyCount} sub="Teaching staff" accent="leaf" />
            {!isHod && <StatCard label="Admins" value={adminCount} sub="HOD/Dean accounts" accent="amber" />}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="space-y-8 w-full">
          {!isHod && <Card className={isDean ? 'overflow-hidden rounded-3xl border border-sky-100/80 bg-gradient-to-br from-white via-sky-50/70 to-indigo-50/50 p-4 shadow-[0_18px_50px_-28px_rgba(30,64,175,0.45)] transition-shadow duration-200 sm:p-6' : 'p-6 border border-rule shadow-sm hover:shadow-md transition-shadow duration-200'}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
              <div>
                <h2 className="flex items-center gap-3 font-display text-xl font-semibold text-slate-900">
                  {isDean && <ChartNoAxesCombined className="h-6 w-6 shrink-0 text-blue-600" strokeWidth={2.2} />}
                  Performance Analytics
                </h2>
                <p className="text-sm text-slate-500 mt-2">
                  {isDean
                    ? analyticsView === 'departments'
                      ? 'Click a department to view year-wise performance and top performers.'
                      : `Year-wise performance and top performers for ${selectedDeptForAnalytics?.name || ''}`
                    : chartTitle}
                </p>
              </div>
              {isDean && analyticsView === 'year-performance' && (
                <Button variant="outline" size="sm" onClick={handleBackToDepartments} className="w-full md:w-auto">
                  ← Back to Departments
                </Button>
              )}
            </div>

            {isDean ? (
              analyticsView === 'departments' ? (
                <DepartmentGrid
                  departments={deanDeptPerformance}
                  onDeptClick={handleDeptClick}
                  loading={deanDepartmentsLoading}
                />
              ) : (
                <DeptDetailView
                  department={selectedDeptForAnalytics}
                  yearPerformance={deptYearPerformance}
                  topPerformers={deptTopPerformers}
                  studentPerformance={deptStudentPerformance}
                  loading={deptDetailsLoading}
                />
              )
            ) : (
              <div className="h-72">
                {filteredAnalytics.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredAnalytics} onClick={(entry) => isDean && entry?.activePayload?.[0]?.payload?.departmentId && setSelectedDepartment(entry.activePayload[0].payload.departmentId)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-slate-400)', fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--color-slate-400)', fontSize: 12 }} width={40} />
                      <Tooltip cursor={{ fill: 'var(--color-paper)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)' }} />
                      <Bar dataKey="performance" fill="var(--color-brand-500)" radius={[3, 3, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon="▤" title="No analytics data yet" description="Analytics will appear here once students start earning STAR points." />
                )}
              </div>
            )}
          </Card>}

          {isDean && (
            <div className="dean-forms-surface space-y-8 mt-8">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <Card className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-white via-blue-50/60 to-indigo-50/50 p-5 shadow-[0_16px_40px_-28px_rgba(37,99,235,0.5)] transition-shadow duration-200 hover:shadow-[0_20px_45px_-24px_rgba(37,99,235,0.42)] sm:p-6">
                  <div className="rounded-2xl border border-blue-100/80 bg-gradient-to-br from-blue-50/90 via-white/80 to-indigo-50/80 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 shadow-sm"><Building2 className="h-5 w-5" strokeWidth={2.1} /></span>
                      <div>
                        <h2 className="font-display text-lg font-semibold text-slate-900">Add Department</h2>
                        <p className="mt-1 text-xs text-slate-500">Create a new department for your school only.</p>
                      </div>
                    </div>
                  </div>
                  <form onSubmit={submitDepartment} className="mt-6 space-y-4">
                    <Field label={<span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-600" />Department name</span>}>
                      <Input required value={departmentForm.name} onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })} placeholder="Department name" className="!border-blue-100 !bg-white/75" />
                    </Field>
                    <Field label={<span className="flex items-center gap-2"><Code2 className="h-4 w-4 text-blue-600" />Code</span>}>
                      <Input required value={departmentForm.code} onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value })} placeholder="Code (for example BCA)" className="!border-blue-100 !bg-white/75" />
                    </Field>
                    <Field label={<span className="flex items-center gap-2"><School className="h-4 w-4 text-blue-600" />School</span>}>
                      <Select value={departmentForm.schoolId} onChange={(e) => setDepartmentForm({ ...departmentForm, schoolId: e.target.value })} className="!border-blue-100 !bg-white/75">
                        <option value="">Select school</option>
                        {lookups.schools.map((school) => <option key={school._id} value={school._id}>{school.name}</option>)}
                      </Select>
                    </Field>
                    <Field label={<span className="flex items-center gap-2"><ToggleRight className="h-4 w-4 text-blue-600" />Status</span>}>
                      <Select value={departmentForm.status} onChange={(e) => setDepartmentForm({ ...departmentForm, status: e.target.value })} className="!border-blue-100 !bg-white/75">
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </Select>
                    </Field>
                    <Button type="submit" className="w-full !bg-blue-600 hover:!bg-blue-700"><PlusCircle className="mr-2 h-4 w-4" />Create Department</Button>
                  </form>
                </Card>

                <Card className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/50 to-blue-50/60 p-5 shadow-[0_16px_40px_-28px_rgba(79,70,229,0.45)] transition-shadow duration-200 hover:shadow-[0_20px_45px_-24px_rgba(79,70,229,0.38)] sm:p-6">
                  <div className="rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/90 via-white/80 to-blue-50/80 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 shadow-sm"><UserRoundCog className="h-5 w-5" strokeWidth={2.1} /></span>
                      <div>
                        <h2 className="font-display text-lg font-semibold text-slate-900">Add HOD</h2>
                        <p className="mt-1 text-xs text-slate-500">Assign a head of department within your school.</p>
                      </div>
                    </div>
                  </div>
                  <form onSubmit={submitHod} className="mt-6 space-y-4">
                    <Field label={<span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-indigo-600" />HOD name</span>}>
                      <Input required value={hodForm.name} onChange={(e) => setHodForm({ ...hodForm, name: e.target.value })} placeholder="HOD name" className="!border-indigo-100 !bg-white/75" />
                    </Field>
                    <Field label={<span className="flex items-center gap-2"><Mail className="h-4 w-4 text-indigo-600" />Email</span>}>
                      <Input required type="email" value={hodForm.email} onChange={(e) => setHodForm({ ...hodForm, email: e.target.value })} placeholder="Email" className="!border-indigo-100 !bg-white/75" />
                    </Field>
                    <Field label={<span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-indigo-600" />Password</span>}>
                      <Input required type="password" minLength="6" value={hodForm.password} onChange={(e) => setHodForm({ ...hodForm, password: e.target.value })} placeholder="Password" className="!border-indigo-100 !bg-white/75" />
                    </Field>
                    <Field label={<span className="flex items-center gap-2"><School className="h-4 w-4 text-indigo-600" />School</span>}>
                      <Select value={hodForm.schoolId} onChange={(e) => {
                        const selectedSchoolId = e.target.value
                        setHodForm({ ...hodForm, schoolId: selectedSchoolId, departmentId: '' })
                      }} className="!border-indigo-100 !bg-white/75">
                        <option value="">Select school</option>
                        {lookups.schools.map((school) => <option key={school._id} value={school._id}>{school.name}</option>)}
                      </Select>
                    </Field>
                    <Field label={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-indigo-600" />Department</span>}>
                      <Select value={hodForm.departmentId} onChange={(e) => setHodForm({ ...hodForm, departmentId: e.target.value })} disabled={!hodForm.schoolId} className="!border-indigo-100 !bg-white/75">
                        <option value="">Select department</option>
                        {lookups.departments.filter((department) => (department.schoolId?._id || department.schoolId || '').toString() === hodForm.schoolId.toString()).map((department) => (
                          <option key={department._id} value={department._id}>{department.name}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={<span className="flex items-center gap-2"><ToggleRight className="h-4 w-4 text-indigo-600" />Status</span>}>
                      <Select value={hodForm.status} onChange={(e) => setHodForm({ ...hodForm, status: e.target.value })} className="!border-indigo-100 !bg-white/75">
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </Select>
                    </Field>
                    <Button type="submit" className="w-full !bg-indigo-600 hover:!bg-indigo-700"><PlusCircle className="mr-2 h-4 w-4" />Create HOD</Button>
                  </form>
                </Card>
              </div>

              <DeanUserManagementPanel
                departments={deanSchoolDepartments}
                hods={deanSchoolHods}
                onEditDepartment={openDepartmentEditor}
                onDeleteDepartment={(department) => setDepartmentDeleteTarget(department)}
                
                onEditHod={openHodEditor}
                onDeleteHod={(hod) => setHodDeleteTarget(hod)}
                onResetHod={handleResetHod}
              />
            </div>
          )}
        </div>

        {isDean ? null : (
          <Card className="p-6 self-start border border-rule shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">Create / Update User</h2>
                <p className="text-sm text-slate-500 mt-2">Manage students, faculty, HODs, and deans from one form.</p>
              </div>
            </div>

            <form onSubmit={submitUser} className={`space-y-3 ${isHod && editingId && form.role === 'faculty' ? 'hidden' : ''}`}>
              <Field label="Role">
                <Select
                  value={form.role}
                  onChange={(e) => {
                    const nextRole = e.target.value
                    if (isDean) {
                      setForm({ ...form, role: 'admin', accountType: 'hod' })
                      return
                    }
                    if (isHod && nextRole === 'admin') {
                      setForm({ ...form, role: 'student', accountType: null })
                      return
                    }
                    setForm({ ...form, role: nextRole, accountType: nextRole === 'admin' ? form.accountType || 'hod' : null })
                  }}
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  {!isDean && !isHod && <option value="admin">Admin</option>}
                  {isDean && <option value="admin">Admin (HOD)</option>}
                </Select>
              </Field>
              {(form.role === 'admin' || isDean) && (
                <Field label="Account type">
                  <Select value={form.accountType || 'hod'} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
                    <option value="hod">HOD</option>
                    {!isDean && <option value="dean">Dean</option>}
                  </Select>
                </Field>
              )}
              <Field label="Name">
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
              </Field>
              {form.role !== 'student' && (
                <Field label="Email">
                  <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
                </Field>
              )}
              <Field label="School">
                <Select
                  value={form.schoolId}
                  onChange={(event) => {
                    const selectedSchoolId = event.target.value
                    const selectedSchool = lookups.schools.find((school) => school._id === selectedSchoolId)
                    setForm({ ...form, schoolId: selectedSchoolId, school: selectedSchool?.name || '', departmentId: '', department: '' })
                  }}
                >
                  <option value="">Select school</option>
                  {lookups.schools.map((school) => <option key={school._id} value={school._id}>{school.name}</option>)}
                </Select>
              </Field>
              {(form.role === 'student' || form.role === 'faculty' || (form.role === 'admin' && form.accountType === 'hod')) && (
                <Field label="Department">
                  <Select
                    value={form.departmentId}
                    onChange={(event) => {
                      const selectedDepartmentId = event.target.value
                      const selectedDepartment = selectedDepartmentOptions.find((department) => department._id === selectedDepartmentId)
                      setForm({ ...form, departmentId: selectedDepartmentId, department: selectedDepartment?.name || '' })
                    }}
                  >
                    <option value="">Select department</option>
                    {selectedDepartmentOptions.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
                  </Select>
                </Field>
              )}
              {form.role === 'student' && (
                <Field label="Register number">
                  <Input required value={form.registerNo} onChange={(e) => setForm({ ...form, registerNo: e.target.value })} placeholder="Register number" />
                </Field>
              )}
              {form.role === 'faculty' && (
                <Field label="Assigned year">
                  <Input value={form.assignedYear} onChange={(e) => setForm({ ...form, assignedYear: e.target.value })} placeholder="Assigned year" />
                </Field>
              )}
              {form.role === 'student' && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Year">
                      <Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="Year" />
                    </Field>
                    <Field label="Batch">
                      <Input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} placeholder="Batch" />
                    </Field>
                    <Field label="Section">
                      <Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="Section" />
                    </Field>
                  </div>
                  <Field label="Assigned faculty">
                    <Select value={form.assignedTeacher} onChange={(e) => setForm({ ...form, assignedTeacher: e.target.value })}>
                      <option value="">Select assigned faculty</option>
                      {facultyForSelectedDepartment.map((member) => (
                        <option key={member._id} value={member._id}>{member.name}</option>
                      ))}
                    </Select>
                  </Field>
                </>
              )}
              {!editingId && (
                <Field label="Password">
                  <Input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" />
                </Field>
              )}
              <Button type="submit" className="w-full">{editingId ? 'Update User' : 'Create User'}</Button>
            </form>
          </Card>
        )}
      </div>

      {!isDean && (
        <Card className="p-6 mt-8 border border-rule shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">Users</h2>
              <p className="text-sm text-slate-500 mt-2">View and manage all users in your system</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users"
                className="!w-full md:!w-auto md:min-w-[180px] !bg-card !border-rule"
              />
              <Button size="sm" variant="danger" disabled={!selectedUserIds.length || bulkDeleting} loading={bulkDeleting} onClick={requestBulkDeleteSelected}>
                Bulk Delete ({selectedUserIds.length})
              </Button>
              <Select value={deleteYear} onChange={(event) => setDeleteYear(event.target.value)} className="!w-auto !bg-card !border-rule">
                <option value="">Delete by year</option>
                {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
              </Select>
              <Button size="sm" variant="danger" disabled={!deleteYear || !usersForDeleteYear.length || bulkDeleting} onClick={requestBulkDeleteYear}>
                Delete Year ({usersForDeleteYear.length})
              </Button>
            </div>
          </div>
          <div className="space-y-6">
            {[
              ...(!isHod ? [{ title: 'HOD & Dean', users: groupedUsers.hodDean || [] }] : []),
              { title: 'Faculty', users: groupedUsers.facultyUsers || [] },
              { title: 'Students', users: filteredStudentUsers || [] },
            ].map((group) => (
              <div key={group.title}>
                <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h3 className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">{group.title}</h3>
                  {group.title === 'Students' && (
                    <div className="flex w-full max-w-xs flex-col gap-2 md:w-auto">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Filter by Faculty</label>
                      <Select
                        value={selectedFaculty}
                        onChange={(event) => setSelectedFaculty(event.target.value)}
                        className="!bg-card !border-rule"
                      >
                        <option value="all">All Faculties</option>
                        {facultyFilterOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>

                {Array.isArray(group.users) && group.users.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                        <tr>
                          <th className="w-10 px-3 py-2.5" />
                          <th className="text-left font-medium px-3 py-2.5">Name</th>
                          {group.title === 'Students' ? (
                            <>
                              <th className="text-left font-medium px-3 py-2.5">Register</th>
                              <th className="text-left font-medium px-3 py-2.5">Faculty</th>
                              <th className="text-left font-medium px-3 py-2.5">Status</th>
                            </>
                          ) : (
                            <>
                              <th className="text-left font-medium px-3 py-2.5">Role</th>
                              <th className="text-left font-medium px-3 py-2.5">Identifier</th>
                            </>
                          )}
                          <th className="text-right font-medium px-3 py-2.5">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.users.map((user) => (
                          <tr key={user._id} className="border-b border-rule transition-colors hover:bg-paper/60">
                            <td className="px-3 py-2.5">
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(user._id)}
                                onChange={(event) => setSelectedUserIds((current) => event.target.checked ? [...new Set([...current, user._id])] : current.filter((id) => id !== user._id))}
                                aria-label={`Select ${user.name}`}
                              />
                            </td>
                            <td className="px-3 py-2.5 font-medium text-ink">
                              <div className="flex items-center gap-2.5">
                                <span className="h-8 w-8 rounded-full bg-ink text-paper flex items-center justify-center font-semibold text-xs shrink-0">
                                  {user.name?.[0] || '?'}
                                </span>
                                {user.name}
                              </div>
                            </td>
                            {group.title === 'Students' ? (
                              <>
                                <td className="px-3 py-2.5 text-slate-500">{user.registerNo || user.registerNumber || user.regNo || '—'}</td>
                                <td className="px-3 py-2.5 text-slate-500">{user.recommendedFaculty || user.assignedTeacher || user.assignedFacultyName || user.facultyName || user.assignedFacultyId || '—'}</td>
                                <td className="px-3 py-2.5"><StatusBadge status={user.status || 'Active'} /></td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-2.5 text-slate-500">{user.role}{user.accountType ? ` / ${user.accountType}` : ''}</td>
                                <td className="px-3 py-2.5 text-slate-500">{user.registerNo || user.registerNumber || user.regNo || user.email || '—'}</td>
                              </>
                            )}
                            <td className="px-3 py-2.5 text-right">{actionButtons(user, group.title === 'Students')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon="●" title={group.title === 'Students' ? 'No students found' : `No ${group.title.toLowerCase()} found`} description={group.title === 'Students' ? 'No students found for this faculty.' : `No ${group.title.toLowerCase()} accounts exist yet.`} />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

        <Modal
          open={isHod && !!editingId && form.role === 'faculty'}
          onClose={() => { setEditingId(''); setForm(initialUserForm) }}
          title="Edit Faculty"
          subtitle="Update the faculty profile and assignment."
          footer={
            <>
              <Button variant="ghost" onClick={() => { setEditingId(''); setForm(initialUserForm) }}>Cancel</Button>
              <Button type="submit" form="faculty-edit-form">Update User</Button>
            </>
          }
        >
          <form id="faculty-edit-form" onSubmit={submitUser} className="space-y-3">
            <Field label="Role">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="faculty">Faculty</option>
              </Select>
            </Field>
            <Field label="Name">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
            </Field>
            <Field label="Email">
              <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
            </Field>
            <Field label="School">
              <Select
                value={form.schoolId}
                onChange={(event) => {
                  const selectedSchoolId = event.target.value
                  const selectedSchool = lookups.schools.find((school) => school._id === selectedSchoolId)
                  setForm({ ...form, schoolId: selectedSchoolId, school: selectedSchool?.name || '', departmentId: '', department: '' })
                }}
              >
                <option value="">Select school</option>
                {lookups.schools.map((school) => <option key={school._id} value={school._id}>{school.name}</option>)}
              </Select>
            </Field>
            <Field label="Department">
              <Select
                value={form.departmentId}
                onChange={(event) => {
                  const selectedDepartmentId = event.target.value
                  const selectedDepartment = selectedDepartmentOptions.find((department) => department._id === selectedDepartmentId)
                  setForm({ ...form, departmentId: selectedDepartmentId, department: selectedDepartment?.name || '' })
                }}
              >
                <option value="">Select department</option>
                {selectedDepartmentOptions.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
              </Select>
            </Field>
            <Field label="Assigned year">
              <Input value={form.assignedYear} onChange={(e) => setForm({ ...form, assignedYear: e.target.value })} placeholder="Assigned year" />
            </Field>
          </form>
        </Modal>

      <Modal
        open={!!editingDepartment}
        onClose={() => setEditingDepartment(null)}
        title="Edit Department"
        subtitle="Update the department details for this school."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingDepartment(null)}>Cancel</Button>
            <Button onClick={saveDepartmentEdit}>Save Changes</Button>
          </>
        }
      >
        <form onSubmit={saveDepartmentEdit} className="space-y-4">
          <Field label="Department name">
            <Input value={departmentEditForm.name} onChange={(e) => setDepartmentEditForm({ ...departmentEditForm, name: e.target.value })} placeholder="Department name" />
          </Field>
          <Field label="Code">
            <Input value={departmentEditForm.code} onChange={(e) => setDepartmentEditForm({ ...departmentEditForm, code: e.target.value })} placeholder="Code" />
          </Field>
          <Field label="Status">
            <Select value={departmentEditForm.status} onChange={(e) => setDepartmentEditForm({ ...departmentEditForm, status: e.target.value })}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
          </Field>
        </form>
      </Modal>

      <Modal
        open={!!editingHod}
        onClose={() => setEditingHod(null)}
        title="Edit HOD"
        subtitle="Update the HOD profile and department assignment."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingHod(null)}>Cancel</Button>
            <Button onClick={saveHodEdit}>Save Changes</Button>
          </>
        }
      >
        <form onSubmit={saveHodEdit} className="space-y-4">
          <Field label="HOD name">
            <Input value={hodEditForm.name} onChange={(e) => setHodEditForm({ ...hodEditForm, name: e.target.value })} placeholder="HOD name" />
          </Field>
          <Field label="Email">
            <Input type="email" value={hodEditForm.email} onChange={(e) => setHodEditForm({ ...hodEditForm, email: e.target.value })} placeholder="Email" />
          </Field>
          <Field label="Department">
            <Select value={hodEditForm.departmentId} onChange={(e) => setHodEditForm({ ...hodEditForm, departmentId: e.target.value })}>
              <option value="">Select department</option>
              {deanSchoolDepartments.map((department) => (
                <option key={department._id} value={department._id}>{department.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={hodEditForm.status} onChange={(e) => setHodEditForm({ ...hodEditForm, status: e.target.value })}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!departmentDeleteTarget}
        onClose={() => setDepartmentDeleteTarget(null)}
        title="Delete department"
        message={departmentDeleteTarget ? `Are you sure you want to delete ${departmentDeleteTarget.name}? This cannot be undone.` : 'Are you sure you want to delete this department? This cannot be undone.'}
        confirmLabel="Delete"
        onConfirm={() => handleDeleteDepartment(departmentDeleteTarget?._id)}
      />

      <ConfirmDialog
        open={!!hodDeleteTarget}
        onClose={() => setHodDeleteTarget(null)}
        title="Delete HOD"
        message={hodDeleteTarget ? `Are you sure you want to delete ${hodDeleteTarget.name}? This action cannot be undone.` : 'Are you sure you want to delete this HOD? This action cannot be undone.'}
        confirmLabel="Delete"
        onConfirm={() => handleDeleteHod(hodDeleteTarget?._id)}
      />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        tone={confirm?.tone || 'danger'}
        onConfirm={confirm?.onConfirm}
      />
    </PageFrame>
  )
}

function PageFrame({ embedded, currentUser, children }) {
  if (embedded) return <>{children}</>
  const roleLabel = currentUser?.accountType === 'dean' ? 'Dean' : 'Principal'
  return (
    <Shell role="principal" roleLabel={roleLabel} userName={currentUser.name || 'Admin'} department={currentUser.department || 'User Management'}>
      <div className={currentUser?.accountType === 'dean' ? 'dean-dashboard-surface' : ''}>{children}</div>
    </Shell>
  )
}

function DeanUserManagementPanel({ departments, hods, onEditDepartment, onDeleteDepartment, onEditHod, onDeleteHod, onResetHod }) {
  return (
    <Card className="p-6 border border-rule shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="mb-8">
        <h2 className="font-display text-lg font-semibold text-ink">User Management</h2>
        <p className="mt-2 text-sm text-slate-500">Manage departments and HODs in your school.</p>
      </div>

      <div className="space-y-8">
        <div className="rounded-xl border border-rule bg-gradient-to-br from-slate-50 to-paper p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100">
              <svg className="h-4 w-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5.5m0 0H9m0 0H3.5m0 0H1m5.5 0a2.121 2.121 0 00-3-3M9 3h6m0 0h3" />
              </svg>
            </div>
            <h3 className="font-display text-base font-semibold text-ink">Departments</h3>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600 border border-brand-200">
              {departments.length}
            </span>
          </div>

          {departments.length ? (
            <div className="space-y-3">
              {departments.map((department) => (
                <div key={department._id} className="group flex flex-col gap-3 rounded-lg border border-rule bg-card p-4 transition-all duration-200 hover:border-brand-300 hover:shadow-md hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 border border-brand-200 font-display text-xs font-bold text-brand-600">
                        {department.code?.[0]?.toUpperCase() || '·'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink truncate">{department.name}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-500">{department.code}</span>
                          <StatusBadge status={department.status || 'Active'} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Button size="sm" variant="outline" onClick={() => onEditDepartment(department)}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => onDeleteDepartment(department)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="⊠"
              title="No departments created yet"
              description="Create your first department to organize students and HODs."
              action={<p className="text-xs text-slate-500 mt-2">Use the &quot;Add Department&quot; form above to get started.</p>}
            />
          )}
        </div>

        <div className="rounded-xl border border-rule bg-gradient-to-br from-slate-50 to-paper p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-leaf-100">
              <svg className="h-4 w-4 text-leaf-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="font-display text-base font-semibold text-ink">Heads of Department</h3>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-3 py-1 text-xs font-semibold text-leaf-600 border border-leaf-200">
              {hods.length}
            </span>
          </div>

          {hods.length ? (
            <div className="space-y-3">
              {hods.map((hod) => (
                <div key={hod._id} className="group flex flex-col gap-3 rounded-lg border border-rule bg-card p-4 transition-all duration-200 hover:border-leaf-300 hover:shadow-md hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-leaf-50 border border-leaf-200 font-display text-xs font-bold text-leaf-600">
                        {hod.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink truncate">{hod.name}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs text-slate-500 truncate max-w-xs">{hod.email || 'No email assigned'}</span>
                          {(hod.departmentId?.name || hod.departmentName || hod.department) && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{hod.departmentId?.name || hod.departmentName || hod.department}</span>
                          )}
                          {hod.status && <StatusBadge status={hod.status} />}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Button size="sm" variant="outline" onClick={() => onEditHod(hod)}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => onDeleteHod(hod)}>Delete</Button>
                    <Button size="sm" variant="ghost" onClick={() => onResetHod(hod._id)}>Reset</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="👤"
              title="No HODs assigned yet"
              description="Create HOD accounts to manage departments and review submissions."
              action={<p className="text-xs text-slate-500 mt-2">Use the &quot;Add HOD&quot; form above to assign a head of department.</p>}
            />
          )}
        </div>
      </div>
    </Card>
  )
}

function DepartmentGrid({ departments, onDeptClick, loading }) {
  if (loading) return <DepartmentGridSkeleton />
  if (!departments.length) {
    return <div className="analytics-panel-transition"><EmptyState icon="▤" title="No departments yet" description="Create departments to start tracking performance." /></div>
  }
  return (
    <div className="analytics-panel-transition grid w-full gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(245px, 1fr))' }}>
      {departments.map((dept) => (
        <button
          key={dept._id}
          onClick={() => onDeptClick(dept)}
          className="group relative rounded-2xl border border-sky-100 bg-white/90 p-5 text-left shadow-[0_10px_30px_-24px_rgba(15,23,42,0.55)] transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 hover:bg-white hover:shadow-[0_18px_35px_-22px_rgba(37,99,235,0.45)] focus:outline-none focus:ring-2 focus:ring-blue-400/50"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 shadow-inner">
                  <GraduationCap className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-slate-900 transition-colors duration-200 group-hover:text-blue-700">{dept.name}</h3>
                  <p className="mt-1 font-mono text-xs font-medium tracking-wide text-slate-400">{dept.code}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <span className="rounded-xl border border-blue-100 bg-blue-50/80 px-3 py-2.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-blue-600"><UsersRound className="h-3.5 w-3.5" /> Students</span>
                  <strong className="mt-1 block text-sm font-semibold text-slate-800">{dept.students}</strong>
                </span>
                <span className="rounded-xl border border-violet-100 bg-violet-50/80 px-3 py-2.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-violet-600"><Gauge className="h-3.5 w-3.5" /> Avg SP</span>
                  <strong className="mt-1 block text-sm font-semibold text-slate-800">{dept.averagePerformance} SP</strong>
                </span>
                <span className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-emerald-600"><Activity className="h-3.5 w-3.5" /> Total SP</span>
                  <strong className="mt-1 block text-sm font-semibold text-slate-800">{dept.totalPoints} SP</strong>
                </span>
              </div>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-100 bg-sky-50 text-slate-400 transition-all duration-200 group-hover:border-blue-300 group-hover:bg-blue-50 group-hover:text-blue-600">
              →
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

function SkeletonBlock({ className = '', style }) {
  return <span className={`analytics-skeleton-block ${className}`} style={style} aria-hidden="true" />
}

function DepartmentGridSkeleton() {
  return (
    <div className="analytics-panel-transition grid w-full gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }} aria-label="Loading departments">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-xl border border-rule bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <SkeletonBlock className="h-5 w-3/5" />
              <SkeletonBlock className="mt-3 h-4 w-1/4" />
              <div className="mt-5 flex flex-wrap gap-2">
                <SkeletonBlock className="h-6 w-24 rounded-full" />
                <SkeletonBlock className="h-6 w-20 rounded-full" />
                <SkeletonBlock className="h-6 w-24 rounded-full" />
              </div>
            </div>
            <SkeletonBlock className="h-8 w-8 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

function RankingSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-lg border border-rule bg-card p-4">
          <SkeletonBlock className="h-7 w-7 rounded-full" />
          <div className="flex-1">
            <SkeletonBlock className="h-4 w-2/5" />
            <SkeletonBlock className="mt-2 h-3 w-1/4" />
          </div>
          <div className="w-24">
            <SkeletonBlock className="ml-auto h-4 w-4/5" />
            <SkeletonBlock className="ml-auto mt-2 h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

function DeptDetailSkeleton() {
  return (
    <div className="analytics-panel-transition space-y-8" aria-label="Loading department analytics">
      <div className="h-72 rounded-lg border border-rule bg-card p-4 shadow-sm">
        <div className="flex h-full items-end gap-4 px-4 pb-4">
          {[46, 68, 54, 82, 62].map((height, index) => <SkeletonBlock key={index} className="max-h-[82%] flex-1 rounded-md" style={{ height: `${height}%` }} />)}
        </div>
      </div>
      <Card className="p-6 border border-rule shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="mt-3 h-4 w-56" />
          </div>
          <SkeletonBlock className="h-7 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <RankingSkeleton rows={4} />
          <div className="h-72 rounded-lg border border-rule bg-card p-4"><div className="flex h-full items-end gap-3"><SkeletonBlock className="h-1/2 flex-1 rounded-t-md" /><SkeletonBlock className="h-3/4 flex-1 rounded-t-md" /><SkeletonBlock className="h-2/3 flex-1 rounded-t-md" /><SkeletonBlock className="h-5/6 flex-1 rounded-t-md" /></div></div>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <Card key={item} className="p-6 border border-rule shadow-sm">
            <SkeletonBlock className="h-5 w-48" />
            <SkeletonBlock className="mt-3 h-4 w-64" />
            <div className="mt-5"><RankingSkeleton rows={3} /></div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function DeptDetailView({ department, yearPerformance, topPerformers, studentPerformance, loading }) {
  if (loading) return <DeptDetailSkeleton />

  const { topHODs = [], topFaculty = [] } = topPerformers || {}
  const { topStudents = [], totalStudents = 0 } = studentPerformance || {}
  const chartData = yearPerformance.filter((y) => y.students > 0)
  const studentChartData = [...topStudents].sort((a, b) => (b.totalSP || 0) - (a.totalSP || 0))

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-display text-xl font-semibold text-ink">{department?.name} ({department?.code})</h3>
          <p className="text-sm text-slate-500 mt-2">Year-wise performance breakdown</p>
        </div>
      </div>

      <div className="h-72 rounded-lg border border-rule bg-card p-4 shadow-sm">
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-slate-400)', fontSize: 12 }} width={40} />
              <YAxis dataKey="year" type="category" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-slate-400)', fontSize: 12 }} width={80} />
              <Tooltip cursor={{ fill: 'var(--color-paper)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)' }} />
              <Bar
                dataKey="averagePerformance"
                fill="var(--color-brand-500)"
                radius={[0, 3, 3, 0]}
                maxBarSize={40}
                animationDuration={1000}
                animationEasing="ease-out"
                isAnimationActive
              />
              <Bar
                dataKey="totalPoints"
                fill="var(--color-amber-500)"
                radius={[0, 3, 3, 0]}
                maxBarSize={40}
                animationDuration={1000}
                animationEasing="ease-out"
                isAnimationActive
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon="▤" title="No year performance data" description="No approved submissions found for any year in this department yet." />
        )}
      </div>

      <Card className="p-6 border border-rule shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="font-display font-semibold text-ink">Student Performance</h3>
            <p className="text-sm text-slate-500 mt-2">Top student rankings in this department</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{totalStudents} students</span>
        </div>

        {studentChartData.length ? (
          <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
            <div className="space-y-3">
              {studentChartData.map((student, index) => (
                <div key={student.studentId || index} className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-slate-50 to-paper p-4 border border-rule transition-all duration-200 hover:border-brand-300 hover:shadow-md">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 font-mono text-xs font-semibold text-brand-600">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink truncate">{student.name}</p>
                    <p className="text-xs text-slate-400 truncate">{student.registerNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-ink">{student.totalSP} SP</p>
                    <p className="text-xs text-slate-400">{student.submissionsCount} submissions</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="h-72 rounded-lg border border-rule bg-card p-4 shadow-sm">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studentChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-slate-400)', fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--color-slate-400)', fontSize: 12 }} width={40} />
                  <Tooltip
                    cursor={{ fill: 'var(--color-paper)' }}
                    labelFormatter={(label, payload) => {
                      const record = payload?.[0]?.payload
                      return `${label} (${record?.registerNumber || 'N/A'})`
                    }}
                    formatter={(value) => [`${value} SP`, 'Total SP']}
                    contentStyle={{ borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)' }}
                  />
                  <Bar dataKey="totalSP" fill="var(--color-brand-500)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <EmptyState
            icon="▤"
            title="No student performance data"
            description="No approved submissions found for any student in this department yet."
          />
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border border-rule shadow-sm">
          <h3 className="font-display font-semibold text-ink mb-4 flex items-center gap-3">
            <span className="h-7 w-7 rounded-full bg-rose-100 flex items-center justify-center">
              <svg className="h-4 w-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            </span>
            Top HOD Performance
          </h3>
          <p className="text-sm text-slate-500 mb-4">Ranked by total approved SP in their department</p>
          {topHODs.length ? (
            <div className="space-y-3">
              {topHODs.slice(0, 5).map((hod, index) => (
                <div key={hod._id} className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-slate-50 to-paper p-4 border border-rule transition-all duration-200 hover:border-rose-300 hover:shadow-md">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 font-mono text-xs font-semibold text-rose-600">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink truncate">{hod.name}</p>
                    <p className="text-xs text-slate-400 truncate">{hod.department}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-ink">{hod.totalApprovedSP} SP</p>
                    <p className="text-xs text-slate-400">{hod.submissionsReviewed} submissions · {hod.avgTurnaroundDays}d avg</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="●" title="No HOD data" description="No HOD performance metrics available for this department." />
          )}
        </Card>

        <Card className="p-6 border border-rule shadow-sm">
          <h3 className="font-display font-semibold text-ink mb-4 flex items-center gap-3">
            <span className="h-7 w-7 rounded-full bg-leaf-100 flex items-center justify-center">
              <svg className="h-4 w-4 text-leaf-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            </span>
            Top Faculty Performance
          </h3>
          <p className="text-sm text-slate-500 mb-4">Ranked by submissions reviewed/approved</p>
          {topFaculty.length ? (
            <div className="space-y-3">
              {topFaculty.slice(0, 5).map((fac, index) => (
                <div key={fac._id} className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-slate-50 to-paper p-4 border border-rule transition-all duration-200 hover:border-leaf-300 hover:shadow-md">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-leaf-100 font-mono text-xs font-semibold text-leaf-600">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink truncate">{fac.name}</p>
                    <p className="text-xs text-slate-400 truncate">{fac.department}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-ink">{fac.submissionsReviewed} reviewed</p>
                    <p className="text-xs text-slate-400">{fac.totalApprovedSP} SP · {fac.avgTurnaroundDays}d avg</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="●" title="No faculty data" description="No faculty performance metrics available for this department." />
          )}
        </Card>
      </div>
    </div>
  )
}
