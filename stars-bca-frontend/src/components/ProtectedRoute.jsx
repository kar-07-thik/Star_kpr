import React from 'react'
import { Navigate } from 'react-router-dom'

const HOME_BY_ROLE = {
  student: '/student',
  faculty: '/faculty',
  admin: '/principal',
}

export default function ProtectedRoute({ roles, children }) {
  let token = null
  let user = {}
  try {
    token = localStorage.getItem('stars_token')
    user = JSON.parse(localStorage.getItem('stars_user') || '{}')
  } catch {
    user = {}
  }

  if (!token || !user?.role || typeof window === 'undefined') {
    return <Navigate to="/" replace />
  }
  if (roles && Array.isArray(roles) && !roles.includes(user.role)) {
    if (user.role === 'admin' && user.accountType === 'hod') {
      return <Navigate to="/hod" replace />
    }
    return <Navigate to={HOME_BY_ROLE[user.role] || '/'} replace />
  }
  return children
}
