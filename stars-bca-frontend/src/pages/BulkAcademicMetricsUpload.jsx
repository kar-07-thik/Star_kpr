import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import Shell from '../components/Shell.jsx'
import { Button, PageHeader, Card, Toast, Field, Input, Select, ConfirmDialog, EmptyState, Modal } from '../components/UI.jsx'
import { bulkUploadAcademicMetrics, downloadAcademicMetricsTemplate, downloadAcademicMetricsCsvTemplate, getStudentAcademicRecords, downloadPdfReport, updateAcademicRecord, deleteAcademicRecord, getAcademicMetricsRegNos } from '../utils/api.js'

const REQUIRED_HEADERS = [
  'Student Name',
  'Reg No',
  'Semester Percentage',
  'Attendance Percentage',
  'Library Usage'
]

const HEADER_ALIASES = {
  'student name': ['student name', 'name', 'full name', 'student'],
  'reg no': ['reg no', 'register no', 'register number', 'regno', 'registration no', 'registration number', 'student id', 'studentid'],
  'semester percentage': ['semester percentage', 'semester %', 'sem percentage', 'sem %', 'semesterpercentage', 'semesterpct'],
  'attendance percentage': ['attendance percentage', 'attendance %', 'attendance', 'attendancepercentage', 'attendancepct'],
  'library usage': ['library usage', 'library hours', 'library visits', 'libraryusage', 'libraryvisits']
}

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getValue(row, candidates = []) {
  for (const candidate of candidates) {
    const value = row?.[candidate]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value
    }
  }
  return ''
}

function isEmptyRow(row = {}) {
  return Object.values(row || {}).every((value) => {
    if (value === undefined || value === null) return true
    return String(value).trim() === ''
  })
}

function validateRow(row, index, existingRegNos) {
  const normalizedRow = {}
  Object.entries(row).forEach(([key, value]) => {
    normalizedRow[normalizeHeader(key)] = value
  })

  const errors = []
  const warnings = []

  const studentName = getValue(normalizedRow, HEADER_ALIASES['student name'])
  const regNo = getValue(normalizedRow, HEADER_ALIASES['reg no'])
  const semesterPct = getValue(normalizedRow, HEADER_ALIASES['semester percentage'])
  const attendancePct = getValue(normalizedRow, HEADER_ALIASES['attendance percentage'])
  const libraryUsage = getValue(normalizedRow, HEADER_ALIASES['library usage'])

  if (!String(studentName).trim()) {
    errors.push('Student Name is required')
  }

  if (!String(regNo).trim()) {
    errors.push('Reg No is required')
  } else if (!existingRegNos.has(String(regNo).trim())) {
    errors.push(`Reg No "${regNo}" not found in database`)
  }

  const semesterNum = Number(semesterPct)
  if (semesterPct === '' || semesterPct === null || semesterPct === undefined) {
    errors.push('Semester Percentage is required')
  } else if (isNaN(semesterNum) || semesterNum < 0 || semesterNum > 100) {
    errors.push('Semester Percentage must be a number between 0 and 100')
  }

  const attendanceNum = Number(attendancePct)
  if (attendancePct === '' || attendancePct === null || attendancePct === undefined) {
    errors.push('Attendance Percentage is required')
  } else if (isNaN(attendanceNum) || attendanceNum < 0 || attendanceNum > 100) {
    errors.push('Attendance Percentage must be a number between 0 and 100')
  }

  let libraryNum = 0
  if (libraryUsage !== '' && libraryUsage !== null && libraryUsage !== undefined) {
    libraryNum = Number(libraryUsage)
    if (isNaN(libraryNum) || libraryNum < 0) {
      warnings.push('Library Usage should be a non-negative number, defaulting to 0')
      libraryNum = 0
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    data: {
      studentName: String(studentName).trim(),
      regNo: String(regNo).trim(),
      semesterPercentage: semesterNum,
      attendancePercentage: attendanceNum,
      libraryUsage: libraryNum
    }
  }
}

export default function BulkAcademicMetricsUpload() {
  const [file, setFile] = useState(null)
  const [parsedRows, setParsedRows] = useState([])
  const [validatedRows, setValidatedRows] = useState([])
  const [uploading, setUploading] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [summary, setSummary] = useState(null)
  const [toast, setToast] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [existingRegNos, setExistingRegNos] = useState(new Set())
  const fileInputRef = useRef(null)
  const dragActive = useRef(false)

  const [students, setStudents] = useState([])
  const [studentSearch, setStudentSearch] = useState('')
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [activeTab, setActiveTab] = useState('upload')
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [editForm, setEditForm] = useState({ semesterPercentage: '', attendancePercentage: '', libraryUsage: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingStudent, setDeletingStudent] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('stars_user') || '{}')
    } catch {
      return {}
    }
  }, [])

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 4000)
  }, [])

  useEffect(() => {
    loadExistingRegNos()
    loadStudentRecords()
  }, [])

  async function loadExistingRegNos() {
    try {
      const data = await getAcademicMetricsRegNos()
      setExistingRegNos(new Set((data.data || []).map((r) => String(r).trim())))
    } catch (error) {
      console.error('Failed to load existing reg nos:', error)
    }
  }

  async function loadStudentRecords() {
    setLoadingRecords(true)
    try {
      const data = await getStudentAcademicRecords(studentSearch)
      setStudents(data.data?.students || [])
    } catch (error) {
      console.error('Failed to load student records:', error)
    } finally {
      setLoadingRecords(false)
    }
  }

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadStudentRecords()
    }, 300)
    return () => clearTimeout(debounce)
  }, [studentSearch])

  async function handleDownloadAcademicPdf() {
    setGeneratingPdf(true)
    try {
      await downloadPdfReport('academic-metrics')
      notify('Academic metrics PDF downloaded successfully')
    } catch (error) {
      notify(error.message || 'PDF download failed', 'error')
    } finally {
      setGeneratingPdf(false)
    }
  }

  function openEdit(student) {
    setEditingStudent(student)
    setEditForm({
      semesterPercentage: student.semesterPercentage ?? '',
      attendancePercentage: student.attendancePercentage ?? '',
      libraryUsage: student.libraryUsage ?? ''
    })
  }

  async function handleSaveEdit() {
    if (!editingStudent) return
    setSavingEdit(true)
    try {
      await updateAcademicRecord(editingStudent._id, editForm)
      notify(`Updated record for ${editingStudent.name}`)
      setEditingStudent(null)
      loadStudentRecords()
    } catch (error) {
      notify(error.message || 'Failed to update record', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteRecord() {
    if (!deletingStudent) return
    setDeleting(true)
    try {
      await deleteAcademicRecord(deletingStudent._id)
      notify(`Deleted record for ${deletingStudent.name}`)
      setDeletingStudent(null)
      loadStudentRecords()
    } catch (error) {
      notify(error.message || 'Failed to delete record', 'error')
    } finally {
      setDeleting(false)
    }
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!dragActive.current) {
      dragActive.current = true
    }
  }

  function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    dragActive.current = false
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    dragActive.current = false
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      processFile(droppedFile)
    }
  }

  function handleFileSelect(e) {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      processFile(selectedFile)
    }
  }

  function processFile(selectedFile) {
    const fileName = (selectedFile.name || '').toLowerCase()
    const validExtensions = ['.xlsx', '.xls', '.csv']
    const isValidExtension = validExtensions.some((ext) => fileName.endsWith(ext))

    if (!isValidExtension) {
      notify('Please upload a valid Excel file (.xlsx, .xls) or CSV file.', 'error')
      return
    }

    setFile(selectedFile)
    setSummary(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        let data
        if (fileName.endsWith('.csv')) {
          const text = event.target.result
          const workbook = XLSX.read(text, { type: 'string' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          data = XLSX.utils.sheet_to_json(firstSheet, { defval: '' }) || []
        } else {
          const buffer = event.target.result
          const workbook = XLSX.read(buffer, { type: 'buffer' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          data = XLSX.utils.sheet_to_json(firstSheet, { defval: '' }) || []
        }

        const filteredRows = data.filter((row) => !isEmptyRow(row))
        setParsedRows(filteredRows)

        const validated = filteredRows.map((row, index) => ({
          rowIndex: index + 1,
          ...validateRow(row, index, existingRegNos)
        }))
        setValidatedRows(validated)
      } catch (error) {
        console.error('Parse error:', error)
        notify('Failed to parse file. Please ensure it is a valid Excel/CSV file.', 'error')
      }
    }

    if (fileName.endsWith('.csv')) {
      reader.readAsText(selectedFile)
    } else {
      reader.readAsArrayBuffer(selectedFile)
    }
  }

  function handleDownloadTemplate() {
    setDownloadingTemplate(true)
    try {
      downloadAcademicMetricsTemplate()
    } catch (error) {
      notify(error.message || 'Unable to download template', 'error')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  function handleDownloadCsvTemplate() {
    setDownloadingTemplate(true)
    try {
      downloadAcademicMetricsCsvTemplate()
    } catch (error) {
      notify(error.message || 'Unable to download CSV template', 'error')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  function handleUpload() {
    setShowConfirm(true)
  }

  async function handleConfirmUpload() {
    const validRows = validatedRows.filter((r) => r.isValid).map((r) => r.data)
    if (validRows.length === 0) {
      notify('No valid rows to upload', 'error')
      return
    }

    setUploading(true)
    setShowConfirm(false)
    try {
      const data = await bulkUploadAcademicMetrics(validRows)
      setSummary(data.data || null)
      const { successCount = 0, failureCount = 0 } = data.data || {}
      notify(`Upload completed: ${successCount} updated, ${failureCount} failed`, failureCount > 0 ? 'warning' : 'success')
      setFile(null)
      setParsedRows([])
      setValidatedRows([])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error) {
      notify(error.message || 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  const validCount = validatedRows.filter((r) => r.isValid).length
  const invalidCount = validatedRows.filter((r) => !r.isValid).length

  return (
    <Shell
      role="faculty"
      userName={currentUser.name || 'Faculty'}
      department={currentUser.department || 'Department'}
    >
      <div className="max-w-7xl space-y-6">
        <PageHeader
          title="Bulk Upload — Academic Metrics"
          subtitle="Upload semester percentage, attendance percentage, and library usage for students via Excel/CSV."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleDownloadTemplate} loading={downloadingTemplate}>
                ⬇ Download Sample Template
              </Button>
              <Button variant="outline" onClick={handleDownloadAcademicPdf} loading={generatingPdf}>
                ⬇ Download PDF Report
              </Button>
            </div>
          }
        />

        {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

        <div className="flex items-center gap-6 border-b border-rule">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`relative pb-2 text-sm font-medium transition-colors ${
              activeTab === 'upload' ? 'text-ink' : 'text-slate-500 hover:text-ink'
            }`}
          >
            Bulk Upload
            {activeTab === 'upload' && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-500" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`relative pb-2 text-sm font-medium transition-colors ${
              activeTab === 'records' ? 'text-ink' : 'text-slate-500 hover:text-ink'
            }`}
          >
            Student Academic Records
            {activeTab === 'records' && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-500" />}
          </button>
        </div>

        {activeTab === 'upload' && (
          <>
            <Card className="p-6">
              <h2 className="font-display text-lg font-semibold text-ink mb-4">Excel Format Instructions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="font-medium text-slate-600 mb-2">Required columns (in order):</p>
                  <div className="space-y-1.5 font-mono text-xs text-ink bg-paper rounded-md p-3 border border-rule">
                    {REQUIRED_HEADERS.map((header, index) => (
                      <div key={header} className="flex items-center gap-2">
                        <span className="text-slate-400">{index + 1}.</span>
                        <span className="font-medium">{header}</span>
                        {index < 4 && <span className="text-rose-500">*</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-medium text-slate-600 mb-2">Column rules:</p>
                  <ul className="space-y-1.5 text-slate-600">
                    <li><span className="font-medium">Student Name:</span> Text, required (for display/verification only)</li>
                    <li><span className="font-medium">Reg No:</span> Text/number, required, must match existing student record</li>
                    <li><span className="font-medium">Semester Percentage:</span> Number 0–100, required</li>
                    <li><span className="font-medium">Attendance Percentage:</span> Number 0–100, required</li>
                    <li><span className="font-medium">Library Usage:</span> Number (hours or visit count), optional, defaults to 0</li>
                  </ul>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <Field label="Upload Excel/CSV file" hint="Drag and drop or click to select. Accepts .xlsx, .xls, .csv files.">
                <label className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed transition-colors cursor-pointer ${
                  dragActive.current
                    ? 'border-brand-500 bg-brand-50'
                    : file
                    ? 'border-leaf-300 bg-leaf-50'
                    : 'border-rule bg-paper hover:border-brand-500'
                }`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileSelect}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  />
                  {file ? (
                    <>
                      <span className="flex h-12 w-12 items-center justify-center rounded-md border border-leaf-200 bg-leaf-100/60 font-mono text-lg text-leaf-600">✓</span>
                      <p className="mt-2 text-sm font-semibold text-ink">{file.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB — click to change</p>
                    </>
                  ) : (
                    <>
                      <span className="flex h-12 w-12 items-center justify-center rounded-md border border-rule bg-card font-mono text-xl text-slate-400">↑</span>
                      <p className="mt-2 text-sm font-medium text-slate-500">Drag & drop your Excel/CSV file here</p>
                      <p className="mt-1 text-xs text-slate-400">or click to browse — .xlsx, .xls, .csv</p>
                    </>
                  )}
                </label>
              </Field>

              {parsedRows.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-display text-lg font-semibold text-ink">Preview ({parsedRows.length} rows)</p>
                    <div className="flex items-center gap-4">
                      <span className="rounded-full border border-leaf-300 bg-leaf-50 px-3 py-1 font-mono text-[11px] font-medium text-leaf-600">
                        {validCount} valid
                      </span>
                      {invalidCount > 0 && (
                        <span className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 font-mono text-[11px] font-medium text-rose-600">
                          {invalidCount} invalid
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-md border border-rule">
                    <table className="w-full text-sm min-w-[720px]">
                      <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                        <tr>
                          <th className="w-10 px-3 py-2 text-center">#</th>
                          <th className="text-left font-medium px-3 py-2">Student Name</th>
                          <th className="text-left font-medium px-3 py-2">Reg No</th>
                          <th className="text-left font-medium px-3 py-2">Semester %</th>
                          <th className="text-left font-medium px-3 py-2">Attendance %</th>
                          <th className="text-left font-medium px-3 py-2">Library Usage</th>
                          <th className="text-left font-medium px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validatedRows.map((row, index) => (
                          <tr
                            key={index}
                            className={`border-b border-rule ${!row.isValid ? 'bg-rose-50/50' : ''}`}
                          >
                            <td className="px-3 py-2 text-center text-slate-400 font-mono">{row.rowIndex}</td>
                            <td className="px-3 py-2 font-medium text-ink">{row.data.studentName || '—'}</td>
                            <td className="px-3 py-2 font-mono text-ink">{row.data.regNo || '—'}</td>
                            <td className="px-3 py-2 tabular text-ink">{row.data.semesterPercentage !== undefined ? row.data.semesterPercentage : '—'}</td>
                            <td className="px-3 py-2 tabular text-ink">{row.data.attendancePercentage !== undefined ? row.data.attendancePercentage : '—'}</td>
                            <td className="px-3 py-2 tabular text-ink">{row.data.libraryUsage !== undefined ? row.data.libraryUsage : '—'}</td>
                            <td className="px-3 py-2">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf-300 bg-leaf-50 px-2 py-0.5 font-mono text-[10px] font-medium text-leaf-600">
                                  <span className="h-1.5 w-1.5 rounded-full bg-leaf-500" />
                                  Valid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 font-mono text-[10px] font-medium text-rose-600">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                  Invalid
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {invalidCount > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold text-rose-600">Validation Errors</h3>
                      <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                        {validatedRows
                          .filter((r) => !r.isValid)
                          .map((row, index) => (
                            <div key={index} className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm">
                              <p className="font-medium text-rose-700">Row {row.rowIndex}: {row.data.studentName || row.data.regNo || 'Unknown'}</p>
                              <ul className="mt-1 list-disc pl-5 space-y-0.5 text-rose-600">
                                {row.errors.map((error, errorIndex) => (
                                  <li key={errorIndex}>{error}</li>
                                ))}
                              </ul>
                              {row.warnings.length > 0 && (
                                <ul className="mt-1 list-disc pl-5 space-y-0.5 text-amber-600">
                                  {row.warnings.map((warning, warningIndex) => (
                                    <li key={warningIndex}>{warning}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="success"
                      size="lg"
                      onClick={handleUpload}
                      disabled={validCount === 0 || uploading}
                      loading={uploading}
                    >
                      {validCount > 0 ? `Confirm & Upload ${validCount} Valid Row${validCount !== 1 ? 's' : ''}` : 'No valid rows to upload'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {summary && (
              <Card className="p-6">
                <h2 className="font-display text-lg font-semibold text-ink">Upload Summary</h2>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-md border border-rule bg-card p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">Total Processed</p>
                    <p className="mt-1 text-2xl font-semibold text-ink">{summary.totalRows || 0}</p>
                  </div>
                  <div className="rounded-md border border-leaf-200 bg-leaf-100/60 p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-leaf-600">Updated</p>
                    <p className="mt-1 text-2xl font-semibold text-leaf-600">{summary.successCount || 0}</p>
                  </div>
                  <div className="rounded-md border border-rose-200 bg-rose-50/60 p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-rose-600">Failed</p>
                    <p className="mt-1 text-2xl font-semibold text-rose-600">{summary.failureCount || 0}</p>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50/60 p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber-700">Skipped</p>
                    <p className="mt-1 text-2xl font-semibold text-amber-700">{summary.skippedCount || 0}</p>
                  </div>
                </div>

                {(summary.results || []).some((r) => !r.success) && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-rose-600">Failed Rows</h3>
                    <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                      {summary.results
                        .filter((r) => !r.success)
                        .map((result, index) => (
                          <div key={index} className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm">
                            <p className="font-medium text-rose-700">
                              Row {result.rowIndex}: {result.regNo} — {result.studentName}
                            </p>
                            <ul className="mt-1 list-disc pl-5 space-y-0.5 text-rose-600">
                              {result.errors?.map((error, errorIndex) => (
                                <li key={errorIndex}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </Card>
            )}
          </>
        )}

        {activeTab === 'records' && (
          <Card className="p-6">
            <div className="flex flex-col gap-4 mb-6">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Student Academic Records</h2>
                <p className="text-sm text-slate-500 mt-1">Record attendance %, semester %, and library hours for your assigned students.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleDownloadCsvTemplate} loading={downloadingTemplate}>
                  ⬇ Download CSV Format
                </Button>
                <Button variant="outline" onClick={handleDownloadAcademicPdf} loading={generatingPdf}>
                  ⬇ Download Records PDF
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-6">
              <Field label="Search students" hint="Search by name or register number.">
                <Input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search students..."
                />
              </Field>
            </div>

            {loadingRecords ? (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-400 animate-pulse">Loading student records...</p>
              </div>
            ) : students.length > 0 ? (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 font-mono text-[11px] font-medium text-brand-600">
                    {students.length} student{students.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-md border border-rule">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                      <tr>
                        <th className="text-left font-medium px-4 py-3">Student</th>
                        <th className="text-left font-medium px-4 py-3">Register No</th>
                        <th className="text-right font-medium px-4 py-3">Attendance %</th>
                        <th className="text-right font-medium px-4 py-3">Semester %</th>
                        <th className="text-right font-medium px-4 py-3">Library (hrs)</th>
                        <th className="text-right font-medium px-4 py-3">STAR Points</th>
                        <th className="text-center font-medium px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student._id} className="border-b border-rule transition-colors hover:bg-paper/60">
                          <td className="px-4 py-3">
                            <p className="font-medium text-ink">{student.name}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-ink">{student.registerNumber || student.regNo || '—'}</td>
                          <td className="px-4 py-3 text-right tabular font-medium text-ink">{student.attendancePercentage || 0}%</td>
                          <td className="px-4 py-3 text-right tabular font-medium text-ink">{student.semesterPercentage || 0}%</td>
                          <td className="px-4 py-3 text-right tabular font-medium text-ink">{student.libraryUsage || 0}</td>
                          <td className="px-4 py-3 text-right tabular font-display font-semibold text-brand-600">{student.totalPoints || 0} pts</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => openEdit(student)}>Edit</Button>
                              <Button size="sm" variant="danger" onClick={() => setDeletingStudent(student)}>Delete</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <EmptyState
                icon="📋"
                title="No student records found"
                description="No students are assigned to you yet, or no records match your search criteria."
              />
            )}
          </Card>
        )}

        <ConfirmDialog
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleConfirmUpload}
          title="Confirm Upload"
          message={`Upload ${validCount} valid row${validCount !== 1 ? 's' : ''}? Invalid rows (${invalidCount}) will be skipped.`}
          confirmLabel="Upload"
          tone="success"
          loading={uploading}
        />

        <Modal
          open={!!editingStudent}
          onClose={() => setEditingStudent(null)}
          title={`Edit record — ${editingStudent?.name || 'student'}`}
          footer={
            <>
              <Button variant="outline" onClick={() => setEditingStudent(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveEdit} loading={savingEdit}>Save changes</Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {editingStudent?.registerNumber || editingStudent?.regNo || '—'}
            </p>
            <Field label="Attendance %" hint="Number between 0 and 100.">
              <Input
                type="number"
                min="0"
                max="100"
                value={editForm.attendancePercentage}
                onChange={(e) => setEditForm({ ...editForm, attendancePercentage: e.target.value })}
                placeholder="e.g. 92"
              />
            </Field>
            <Field label="Semester %" hint="Number between 0 and 100.">
              <Input
                type="number"
                min="0"
                max="100"
                value={editForm.semesterPercentage}
                onChange={(e) => setEditForm({ ...editForm, semesterPercentage: e.target.value })}
                placeholder="e.g. 78"
              />
            </Field>
            <Field label="Library (hrs)" hint="Library usage in hours.">
              <Input
                type="number"
                min="0"
                value={editForm.libraryUsage}
                onChange={(e) => setEditForm({ ...editForm, libraryUsage: e.target.value })}
                placeholder="e.g. 12"
              />
            </Field>
          </div>
        </Modal>

        <ConfirmDialog
          open={!!deletingStudent}
          onClose={() => setDeletingStudent(null)}
          onConfirm={handleDeleteRecord}
          title="Delete student record"
          message={`Delete the record for ${deletingStudent?.name || 'this student'}? This action cannot be undone.`}
          confirmLabel="Delete"
          tone="danger"
          loading={deleting}
        />
      </div>
    </Shell>
  )
}