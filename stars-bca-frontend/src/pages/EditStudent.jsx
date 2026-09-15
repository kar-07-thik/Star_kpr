import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Shell from '../components/Shell.jsx'
import { Button, PageHeader, Card, Toast, LoadingState, Field, Input, Select } from '../components/UI.jsx'
import { getAdminUser, getLookups, updateUser } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const emptyForm = {
  name: '',
  email: '',
  registerNo: '',
  registerNumber: '',
  regNo: '',
  school: '',
  department: '',
  schoolId: '',
  departmentId: '',
  assignedTeacher: '',
  assignedFacultyId: '',
  recommendedSchool: '',
  recommendedDepartment: '',
  recommendedFaculty: '',
  section: '',
  year: '',
  batch: '',
  semesterBatch: '',
  assignedYear: '',
  yearAssigned: '',
  status: 'Active',
}

export default function EditStudent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [lookups, setLookups] = useState({ schools: [], departments: [], faculty: [] })
  const [student, setStudent] = useState(null)

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('stars_user') || '{}')
    } catch {
      return {}
    }
  }, [])

  const canEdit = currentUser?.role === 'admin' || currentUser?.accountType === 'hod' || currentUser?.accountType === 'dean'
  const shellRole = currentUser?.accountType === 'hod' ? 'hod' : 'principal'
  const dashboardPath = currentUser?.accountType === 'hod' ? '/hod/users' : '/principal'

  useEffect(() => {
    if (!canEdit) {
      setToast({ message: 'Only Admin or HOD accounts can edit student details.', tone: 'error' })
      setLoading(false)
      return
    }
    loadLookups()
    loadStudent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, canEdit])

  async function loadLookups() {
    try {
      const data = await getLookups()
      setLookups(data.data || { schools: [], departments: [], faculty: [] })
    } catch (error) {
      console.error(error)
    }
  }

  async function loadStudent() {
    try {
      const data = await getAdminUser(id)
      const user = data.data || {}
      setStudent(user)
      setForm({
        name: user.name || '',
        email: user.email || '',
        registerNo: user.registerNo || user.registerNumber || user.regNo || '',
        registerNumber: user.registerNumber || user.registerNo || user.regNo || '',
        regNo: user.regNo || user.registerNo || user.registerNumber || '',
        school: user.school || '',
        department: user.department || '',
        schoolId: user.schoolId || '',
        departmentId: user.departmentId || '',
        assignedTeacher: user.assignedTeacher || user.assignedFacultyId || '',
        assignedFacultyId: user.assignedTeacher || user.assignedFacultyId || '',
        recommendedSchool: user.recommendedSchool || user.school || '',
        recommendedDepartment: user.recommendedDepartment || user.department || '',
        recommendedFaculty: user.recommendedFaculty || '',
        section: user.section || '',
        year: user.year || '',
        batch: user.batch || user.semesterBatch || '',
        semesterBatch: user.semesterBatch || user.batch || '',
        assignedYear: user.assignedYear || user.yearAssigned || '',
        yearAssigned: user.yearAssigned || user.assignedYear || '',
        status: user.status || 'Active',
      })
    } catch (error) {
      setToast({ message: error.message || 'Unable to load student details', tone: 'error' })
    } finally {
      setLoading(false)
    }
  }

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

  async function handleSubmit(event) {
    event.preventDefault()
    if (!form.name || !form.email || !form.registerNo) {
      setToast({ message: 'Name, email, and register number are required.', tone: 'error' })
      return
    }

    try {
      setSaving(true)
      await updateUser(id, {
        ...form,
        role: student?.role || 'student',
        accountType: student?.accountType || null,
        school: form.school || lookups.schools.find((school) => school._id === form.schoolId)?.name || '',
        department: form.department || selectedDepartmentOptions.find((department) => department._id === form.departmentId)?.name || '',
        assignedTeacher: form.assignedTeacher || form.assignedFacultyId || null,
        assignedFacultyId: form.assignedTeacher || form.assignedFacultyId || null,
      })
      navigate(dashboardPath)
    } catch (error) {
      setToast({ message: error.message || 'Unable to update student', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Shell role={shellRole} userName={currentUser.name || 'Admin'} department={currentUser.department || 'Edit Student'}>
        <LoadingState rows={2} />
      </Shell>
    )
  }

  return (
    <Shell role={shellRole} userName={currentUser.name || 'Admin'} department={currentUser.department || 'Edit Student'}>
      <div className="max-w-4xl space-y-6">
        <PageHeader
          title="Edit Student"
          subtitle="Update student information and keep the existing record intact."
          actions={<Button variant="outline" onClick={() => navigate(dashboardPath)}>Back to dashboard</Button>}
        />

        {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name" hint="Full legal name of the student.">
                <Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Name" />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" />
              </Field>
              <Field label="Register Number">
                <Input value={form.registerNo} onChange={(event) => setForm({ ...form, registerNo: event.target.value, registerNumber: event.target.value, regNo: event.target.value })} placeholder="Register Number" />
              </Field>
              <Field label="Roll Number">
                <Input value={form.registerNumber} onChange={(event) => setForm({ ...form, registerNumber: event.target.value, registerNo: event.target.value, regNo: event.target.value })} placeholder="Roll Number" />
              </Field>
              <Field label="School">
                <Select value={form.schoolId} onChange={(event) => {
                  const selectedSchoolId = event.target.value
                  const selectedSchool = lookups.schools.find((school) => school._id === selectedSchoolId)
                  setForm({ ...form, schoolId: selectedSchoolId, school: selectedSchool?.name || '', departmentId: '', department: '' })
                }}>
                  <option value="">Select school</option>
                  {lookups.schools.map((school) => <option key={school._id} value={school._id}>{school.name}</option>)}
                </Select>
              </Field>
              <Field label="Department">
                <Select value={form.departmentId} onChange={(event) => {
                  const selectedDepartmentId = event.target.value
                  const selectedDepartment = selectedDepartmentOptions.find((department) => department._id === selectedDepartmentId)
                  setForm({ ...form, departmentId: selectedDepartmentId, department: selectedDepartment?.name || '' })
                }}>
                  <option value="">Select department</option>
                  {selectedDepartmentOptions.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
                </Select>
              </Field>
              <Field label="Assigned Faculty">
                <Select value={form.assignedTeacher} onChange={(event) => setForm({ ...form, assignedTeacher: event.target.value, assignedFacultyId: event.target.value })}>
                  <option value="">Select assigned faculty</option>
                  {facultyForSelectedDepartment.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </Select>
              </Field>
              <Field label="Section">
                <Input value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })} placeholder="Section" />
              </Field>
              <Field label="Year">
                <Input value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} placeholder="Year" />
              </Field>
              <Field label="Batch">
                <Input value={form.batch} onChange={(event) => setForm({ ...form, batch: event.target.value })} placeholder="Batch" />
              </Field>
              <Field label="Semester Batch">
                <Input value={form.semesterBatch} onChange={(event) => setForm({ ...form, semesterBatch: event.target.value })} placeholder="Semester Batch" />
              </Field>
              <Field label="Assigned Year">
                <Input value={form.assignedYear} onChange={(event) => setForm({ ...form, assignedYear: event.target.value, yearAssigned: event.target.value })} placeholder="Assigned Year" />
              </Field>
              <Field label="Recommended School">
                <Input value={form.recommendedSchool} onChange={(event) => setForm({ ...form, recommendedSchool: event.target.value })} placeholder="Recommended School" />
              </Field>
              <Field label="Recommended Department">
                <Input value={form.recommendedDepartment} onChange={(event) => setForm({ ...form, recommendedDepartment: event.target.value })} placeholder="Recommended Department" />
              </Field>
              <Field label="Recommended Faculty">
                <Input value={form.recommendedFaculty} onChange={(event) => setForm({ ...form, recommendedFaculty: event.target.value })} placeholder="Recommended Faculty" />
              </Field>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/principal')}>Cancel</Button>
              <Button type="submit" loading={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
            </div>
          </form>
        </Card>
      </div>
    </Shell>
  )
}
