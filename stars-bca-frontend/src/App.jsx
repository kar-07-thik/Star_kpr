import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Spinner } from './components/UI.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

const Login = lazy(() => import('./pages/Login.jsx'))
const StudentDashboard = lazy(() => import('./pages/StudentDashboard.jsx'))
const FacultyDashboard = lazy(() => import('./pages/FacultyDashboard.jsx'))
const PrincipalDashboard = lazy(() => import('./pages/PrincipalDashboard.jsx'))
const HODDashboard = lazy(() => import('./pages/HODDashboard.jsx'))
const EditStudent = lazy(() => import('./pages/EditStudent.jsx'))

const ActivityManagement = lazy(() => import('./pages/ActivityManagement.jsx'))
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage.jsx'))
const AcademicYearPage = lazy(() => import('./pages/AcademicYearPage.jsx'))
const BulkStudentUpload = lazy(() => import('./pages/BulkStudentUpload.jsx'))

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/student/*"
          element={
            <ProtectedRoute roles={['student']}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/*"
          element={
            <ProtectedRoute roles={['faculty']}>
              <FacultyDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/principal"
          element={
            <ProtectedRoute roles={['admin']}>
              <PrincipalDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hod/*"
          element={
            <ProtectedRoute roles={['admin']}>
              <HODDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/principal/edit-student/:id"
          element={
            <ProtectedRoute roles={['admin']}>
              <EditStudent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hod/edit-student/:id"
          element={
            <ProtectedRoute roles={['admin']}>
              <EditStudent />
            </ProtectedRoute>
          }
        />

        <Route
          path="/principal/activities"
          element={
            <ProtectedRoute roles={['admin']}>
              <ActivityManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/principal/audit-logs"
          element={
            <ProtectedRoute roles={['admin']}>
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/principal/academic-year"
          element={
            <ProtectedRoute roles={['admin']}>
              <AcademicYearPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/principal/bulk-upload"
          element={
            <ProtectedRoute roles={['admin']}>
              <BulkStudentUpload />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hod/bulk-upload"
          element={
            <ProtectedRoute roles={['admin']}>
              <BulkStudentUpload />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
