import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Shell from '../components/Shell.jsx'
import { Button, PageHeader, Card, Modal, Toast, Field, Select } from '../components/UI.jsx'
import { getLookups, bulkUploadUsers, bulkUpdateUsers, downloadBulkTemplate, bulkAssignFaculty } from '../utils/api.js'

/* Hallmark Â· genre: editorial Â· macrostructure: Workbench Â· design-system: design.md Â· designed-as-app */

export default function BulkStudentUpload() {
  const [schools, setSchools] = useState([])
  const [departments, setDepartments] = useState([])
  const [faculty, setFaculty] = useState([])
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [selectedFacultyId, setSelectedFacultyId] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [summary, setSummary] = useState(null)
  const [updateFile, setUpdateFile] = useState(null)
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [updateUploading, setUpdateUploading] = useState(false)
  const [updateSummary, setUpdateSummary] = useState(null)
  const [toast, setToast] = useState(null)
  const [assignFile, setAssignFile] = useState(null)
  const [assignUploading, setAssignUploading] = useState(false)
  const [assignSummary, setAssignSummary] = useState(null)

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('stars_user') || '{}')
    } catch {
      return {}
    }
  }, [])

  const shellRole = currentUser?.accountType === 'hod' ? 'hod' : 'principal'
  const roleLabel = currentUser?.accountType === 'hod' ? 'HOD' : currentUser?.accountType === 'dean' ? 'Dean' : 'Principal'

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    loadLookups()
  }, [])

  useEffect(() => {
    if (currentUser?.accountType !== 'hod') return
    if (currentUser?.schoolId) {
      setSelectedSchoolId(currentUser.schoolId)
    }
    if (currentUser?.departmentId) {
      setSelectedDepartmentId(currentUser.departmentId)
    }
  }, [currentUser?.accountType, currentUser?.schoolId, currentUser?.departmentId])

  async function loadLookups() {
    try {
      const data = await getLookups()
      setSchools(data.data?.schools || [])
      setDepartments(data.data?.departments || [])
      setFaculty(data.data?.faculty || [])
    } catch (error) {
      console.error(error)
    }
  }

  const visibleDepartments = useMemo(() => {
    if (!selectedSchoolId) return departments
    return departments.filter((department) => {
      const departmentSchoolId = department.schoolId?._id || department.schoolId || ''
      return departmentSchoolId.toString() === selectedSchoolId.toString()
    })
  }, [departments, selectedSchoolId])

  const visibleFaculty = useMemo(() => {
    if (!selectedDepartmentId) return faculty
    return faculty.filter((member) => {
      const memberDepartmentId = member.departmentId?._id || member.departmentId || ''
      return memberDepartmentId.toString() === selectedDepartmentId.toString()
    })
  }, [faculty, selectedDepartmentId])

  async function handleUpload(event) {
    event.preventDefault()
    if (!file || !selectedSchoolId || !selectedDepartmentId || !selectedFacultyId) {
      notify('Select the school, department, faculty, and Excel file before uploading.', 'error')
      return
    }

    try {
      setUploading(true)
      setToast(null)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('schoolId', selectedSchoolId)
      formData.append('departmentId', selectedDepartmentId)
      formData.append('facultyId', selectedFacultyId)

      const data = await bulkUploadUsers(formData)
      setSummary(data.data || null)
      notify('Bulk upload completed.')
      event.target.reset()
      setFile(null)
      setSelectedSchoolId('')
      setSelectedDepartmentId('')
      setSelectedFacultyId('')
    } catch (error) {
      notify(error.message || 'Unable to upload students', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownloadTemplate() {
    setDownloadingTemplate(true)
    try {
      await downloadBulkTemplate()
    } catch (error) {
      notify(error.message || 'Unable to download template', 'error')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  async function handleBulkUpdate(event) {
    event.preventDefault()
    if (!updateFile) {
      notify('Choose an Excel file before updating.', 'error')
      return
    }

    try {
      setUpdateUploading(true)
      const formData = new FormData()
      formData.append('file', updateFile)
      const data = await bulkUpdateUsers(formData)
      setUpdateSummary(data.data || null)
      setUpdateModalOpen(false)
      event.target.reset()
      setUpdateFile(null)
      notify('Bulk update completed.')
    } catch (error) {
      notify(error.message || 'Unable to update users', 'error')
    } finally {
      setUpdateUploading(false)
    }
  }

  async function handleAssignFaculty(event) {
    event.preventDefault()
    if (!assignFile) {
      notify('Choose an Excel file before assigning.', 'error')
      return
    }
    try {
      setAssignUploading(true)
      const formData = new FormData()
      formData.append('file', assignFile)
      const data = await bulkAssignFaculty(formData)
      const result = data.data || {}
      setAssignSummary(result)
      const failed = (result.failureCount || 0) + (result.notFoundCount || 0)
      if (failed > 0) {
        notify(`Faculty assignment finished with ${failed} row${failed === 1 ? '' : 's'} not assigned. Review the summary below.`, 'error')
      } else {
        notify(`Faculty assignment completed: ${result.successCount || 0} assigned.`)
      }
      event.target.reset()
      setAssignFile(null)
    } catch (error) {
      notify(error.message || 'Unable to assign faculty', 'error')
    } finally {
      setAssignUploading(false)
    }
  }

  return (
    <Shell role={shellRole} roleLabel={roleLabel} userName={currentUser.name || 'Admin'} department={currentUser.department || 'Bulk Upload'}>
      <div className="max-w-5xl space-y-6">
        <PageHeader
          title="Bulk Upload"
          subtitle="Upload an Excel sheet of students with a recommended school, department, and faculty â€” or reassign faculty members across departments."
          actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setUpdateModalOpen(true)}>Bulk Update</Button><Button variant="outline" onClick={handleDownloadTemplate} loading={downloadingTemplate}>â¬‡ Student Template</Button></div>}
        />

        {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

        <div className="rounded-md border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-amber-300 bg-amber-100 font-mono text-[11px] font-medium">!</span>
            Excel format instructions
          </h2>
          <p className="mt-2 text-sm text-amber-700">The Excel file should contain these columns in order:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {['student name', 'reg no', 'email', 'password', 'section', 'year', 'batch'].map((column) => (
              <span key={column} className="rounded-full bg-card px-3 py-1 text-sm font-medium text-amber-800 border border-amber-200">
                {column}
              </span>
            ))}
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={handleUpload} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Recommended School">
                <Select value={selectedSchoolId} onChange={(event) => {
                  setSelectedSchoolId(event.target.value)
                  setSelectedDepartmentId('')
                  setSelectedFacultyId('')
                }}>
                  <option value="">Select school</option>
                  {schools.map((school) => <option key={school._id} value={school._id}>{school.name}</option>)}
                </Select>
              </Field>
              <Field label="Recommended Department">
                <Select value={selectedDepartmentId} onChange={(event) => {
                  setSelectedDepartmentId(event.target.value)
                  setSelectedFacultyId('')
                }} disabled={!selectedSchoolId}>
                  <option value="">Select department</option>
                  {visibleDepartments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
                </Select>
              </Field>
              <Field label="Recommended Faculty">
                <Select value={selectedFacultyId} onChange={(event) => setSelectedFacultyId(event.target.value)} disabled={!selectedDepartmentId}>
                  <option value="">Select faculty</option>
                  {visibleFaculty.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
                </Select>
              </Field>
            </div>

            <Field label="Excel file" hint="Only .xlsx and .xls files are accepted.">
              <label className="flex flex-col items-center justify-center rounded-md border border-dashed border-rule bg-paper px-6 py-8 text-center cursor-pointer hover:border-brand-500 transition-colors">
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                {file ? (
                  <>
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-leaf-200 bg-leaf-100/60 font-mono text-sm text-leaf-600">âœ“</span>
                    <p className="mt-2 text-sm font-semibold text-ink">{file.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB â€” click to change</p>
                  </>
                ) : (
                  <>
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-rule bg-card font-mono text-base text-slate-400">â†‘</span>
                    <p className="mt-2 text-sm font-medium text-slate-500">Click to choose your Excel file</p>
                    <p className="mt-1 text-xs text-slate-400">.xlsx or .xls</p>
                  </>
                )}
              </label>
            </Field>

            <Button type="submit" loading={uploading} disabled={!file || !selectedSchoolId || !selectedDepartmentId || !selectedFacultyId} className="w-full md:w-auto">
              {uploading ? 'Uploadingâ€¦' : 'Upload Students'}
            </Button>
          </form>
        </Card>

        <Modal open={updateModalOpen} onClose={() => setUpdateModalOpen(false)} title="Bulk Update" subtitle="Update existing users using the same seven-column Excel format" footer={<Button variant="outline" onClick={() => setUpdateModalOpen(false)}>Close</Button>}>
          <form onSubmit={handleBulkUpdate} className="space-y-5">
            <p className="text-sm text-slate-500">Use the existing columns: student name, reg no, email, password, section, year, batch. Names must match exactly one existing user.</p>
            <Field label="Excel file" hint="Only .xlsx and .xls files are accepted.">
              <label className="flex flex-col items-center justify-center rounded-md border border-dashed border-rule bg-paper px-6 py-8 text-center cursor-pointer hover:border-brand-500 transition-colors">
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => setUpdateFile(event.target.files?.[0] || null)} />
                <p className="text-sm font-medium text-slate-500">{updateFile ? updateFile.name : 'Click to choose your Excel file'}</p>
              </label>
            </Field>
            <Button type="submit" loading={updateUploading} disabled={!updateFile}>{updateUploading ? 'Updatingâ€¦' : 'Update Users'}</Button>
          </form>
        </Modal>

        <Modal open={Boolean(updateSummary)} onClose={() => setUpdateSummary(null)} title="Bulk Update Summary" subtitle="Existing user records processed from the workbook" footer={<Button variant="outline" onClick={() => setUpdateSummary(null)}>Close</Button>}>
          {updateSummary && (
            <div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-md border border-rule bg-card p-4"><p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">Total rows</p><p className="mt-1 text-2xl font-semibold text-ink">{updateSummary.totalRows || 0}</p></div>
                <div className="rounded-md border border-leaf-200 bg-leaf-100/60 p-4"><p className="font-mono text-[11px] uppercase tracking-[0.14em] text-leaf-600">Updated</p><p className="mt-1 text-2xl font-semibold text-leaf-600">{updateSummary.updatedCount || 0}</p></div>
                <div className="rounded-md border border-rule bg-card p-4"><p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">No changes</p><p className="mt-1 text-2xl font-semibold text-ink">{updateSummary.noChangeCount || 0}</p></div>
                <div className="rounded-md border border-rose-200 bg-rose-50/60 p-4"><p className="font-mono text-[11px] uppercase tracking-[0.14em] text-rose-600">Errors</p><p className="mt-1 text-2xl font-semibold text-rose-600">{updateSummary.failureCount || 0}</p></div>
              </div>
              {updateSummary.validationErrors?.length > 0 && <div className="mt-6 space-y-2">{updateSummary.validationErrors.map((item, index) => <div key={`${item.rowNumber}-${index}`} className="rounded-md border border-rule p-3 text-sm text-slate-600"><p className="font-medium text-ink">Row {item.rowNumber}</p><ul className="mt-1 list-disc pl-5 space-y-1">{item.errors.map((error, errorIndex) => <li key={`${error}-${errorIndex}`}>{error}</li>)}</ul></div>)}</div>}
            </div>
          )}
        </Modal>

        <Modal open={Boolean(summary)} onClose={() => setSummary(null)} title="Upload Summary" subtitle="Student records processed from the uploaded workbook" footer={<Button variant="outline" onClick={() => setSummary(null)}>Close</Button>}>
          {summary && (
            <div>
            <h2 className="font-display text-lg font-semibold text-ink">Upload Summary</h2>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-md border border-rule bg-card p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">Total rows</p>
                <p className="mt-1 text-2xl font-semibold text-ink">{summary.totalRows || 0}</p>
              </div>
              <div className="rounded-md border border-leaf-200 bg-leaf-100/60 p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-leaf-600">Inserted</p>
                <p className="mt-1 text-2xl font-semibold text-leaf-600">{summary.successCount || 0}</p>
              </div>
              <div className="rounded-md border border-rose-200 bg-rose-50/60 p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-rose-600">Failed rows</p>
                <p className="mt-1 text-2xl font-semibold text-rose-600">{summary.failureCount || 0}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50/60 p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber-700">Duplicates</p>
                <p className="mt-1 text-2xl font-semibold text-amber-700">{summary.duplicateCount || 0}</p>
              </div>
            </div>

            {summary.validationErrors?.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-ink">Validation errors</h3>
                <div className="mt-3 space-y-2">
                  {summary.validationErrors.map((item, index) => (
                    <div key={`${item.rowNumber}-${index}`} className="rounded-md border border-rule p-3 text-sm text-slate-600">
                      <p className="font-medium text-ink">Row {item.rowNumber}</p>
                      <ul className="mt-1 list-disc pl-5 space-y-1">
                        {item.errors.map((error, errorIndex) => <li key={`${error}-${errorIndex}`}>{error}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          )}
        </Modal>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Bulk Assign Faculty</h2>
          <p className="mt-1 text-sm text-slate-400">
            Upload an Excel sheet with columns <span className="font-mono text-xs">email</span> (or <span className="font-mono text-xs">name</span>) and{' '}
            <span className="font-mono text-xs">department</span> to move faculty members between departments in one action.
          </p>
          <form onSubmit={handleAssignFaculty} className="mt-4 space-y-4">
            <Field label="Excel file" hint="Only .xlsx and .xls files are accepted.">
              <label className="flex flex-col items-center justify-center rounded-md border border-dashed border-rule bg-paper px-6 py-8 text-center cursor-pointer hover:border-brand-500 transition-colors">
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => setAssignFile(event.target.files?.[0] || null)} />
                {assignFile ? (
                  <>
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-leaf-200 bg-leaf-100/60 font-mono text-sm text-leaf-600">âœ“</span>
                    <p className="mt-2 text-sm font-semibold text-ink">{assignFile.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{(assignFile.size / 1024).toFixed(1)} KB â€” click to change</p>
                  </>
                ) : (
                  <>
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-rule bg-card font-mono text-base text-slate-400">â†‘</span>
                    <p className="mt-2 text-sm font-medium text-slate-500">Click to choose your Excel file</p>
                    <p className="mt-1 text-xs text-slate-400">.xlsx or .xls</p>
                  </>
                )}
              </label>
            </Field>
            <Button type="submit" loading={assignUploading} disabled={!assignFile} className="w-full md:w-auto">
              {assignUploading ? 'Assigningâ€¦' : 'Assign Faculty'}
            </Button>
          </form>

          {assignSummary && (
            <Modal open={Boolean(assignSummary)} onClose={() => setAssignSummary(null)} title="Assignment Summary" subtitle="Faculty assignment results" footer={<Button variant="outline" onClick={() => setAssignSummary(null)}>Close</Button>}>
            <div>
              <h3 className="text-sm font-semibold text-ink">Assignment summary</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-rule bg-card p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">Total rows</p>
                  <p className="mt-1 text-2xl font-semibold text-ink">{assignSummary.totalRows || 0}</p>
                </div>
                <div className="rounded-md border border-leaf-200 bg-leaf-100/60 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-leaf-600">Assigned</p>
                  <p className="mt-1 text-2xl font-semibold text-leaf-600">{assignSummary.successCount || 0}</p>
                </div>
                <div className="rounded-md border border-rose-200 bg-rose-50/60 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-rose-600">Not assigned</p>
                  <p className="mt-1 text-2xl font-semibold text-rose-600">{(assignSummary.failureCount || 0) + (assignSummary.notFoundCount || 0)}</p>
                </div>
              </div>

              {assignSummary.validationErrors?.length > 0 && (
                <div className="mt-5 space-y-2">
                  {assignSummary.validationErrors.map((item, index) => (
                    <div key={`${item.rowNumber}-${index}`} className="rounded-md border border-rule p-3 text-sm text-slate-600">
                      <p className="font-medium text-ink">Row {item.rowNumber}</p>
                      <ul className="mt-1 list-disc pl-5 space-y-1">
                        {item.errors.map((error, errorIndex) => <li key={`${error}-${errorIndex}`}>{error}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </Modal>
          )}
        </Card>
      </div>
    </Shell>
  )
}
