import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Activity, Bell, CalendarDays, ClipboardCheck, CloudUpload, Home, LayoutDashboard, LockKeyhole, ShieldCheck, Star, Trophy, ClipboardList, Upload, UserRound, UsersRound, LogOut } from 'lucide-react'
import faviconLogo from '../assets/favicon.svg'
import { Modal, Button, ThemeToggle } from './UI.jsx'

/* Hallmark Â· genre: editorial Â· macrostructure: Workbench Â· design-system: design.md Â· designed-as-app */

export function Logo({ size = 40, className = '' }) {
  return (
    <img
      src={faviconLogo}
      alt="STARS-BCA logo"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  )
}

const NAV = {
  student: [
    { to: '/student', label: 'DASHBOARD', icon: 'home' },
    { to: '/student/tasks', label: 'STAR TASKS', icon: 'star' },
    { to: '/student/submissions', label: 'MY SUBMISSIONS', icon: 'submissions' },
    { to: '/student/leaderboard', label: 'LEADERBOARD', icon: 'trophy' },
    { to: '/student/notifications', label: 'NOTIFICATIONS', icon: 'notifications' },
  ],
  faculty: [
    { to: '/faculty', label: 'Dashboard', icon: 'dashboard' },
    { to: '/faculty/reviews', label: 'Review Submissions', icon: 'reviews' },
    { to: '/faculty/bulk-academic-metrics', label: 'Bulk Upload & Records', icon: 'upload' },
    { to: '/faculty/scoreboard', label: 'Scoreboard', icon: 'scoreboard' },
    { to: '/faculty/notifications', label: 'Notifications', icon: 'notifications' },
  ],
  principal: [
    { to: '/principal', label: 'Performance Dashboard', icon: 'dashboard' },
    { to: '/principal/activities', label: 'Activities', icon: 'activities' },
    { to: '/principal/bulk-upload', label: 'Bulk Upload', icon: 'upload' },
    { to: '/principal/audit-logs', label: 'Audit Logs', icon: 'audit' },
    { to: '/principal/academic-year', label: 'Academic Year', icon: 'academic' },
  ],
  hod: [
    { to: '/hod', label: 'Performance Dashboard', icon: 'dashboard' },
    { to: '/hod/faculty', label: 'Faculty Overview', icon: 'faculty' },
    { to: '/hod/leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
    { to: '/hod/users', label: 'User Management', icon: 'users' },
    { to: '/hod/bulk-upload', label: 'Bulk Upload', icon: 'upload' },
    { to: '/hod/semester', label: 'Semester Lock', icon: 'semester' },
  ],
}

const ROLE_LABEL = { student: 'Student', faculty: 'Faculty', principal: 'Principal', hod: 'HOD' }
const STUDENT_ICONS = { home: Home, star: Star, submissions: ClipboardCheck, trophy: Trophy, notifications: Bell }
const FACULTY_ICONS = { dashboard: LayoutDashboard, reviews: ClipboardList, upload: CloudUpload, scoreboard: Trophy, notifications: Bell }
const PRINCIPAL_ICONS = { dashboard: LayoutDashboard, activities: Activity, upload: Upload, audit: ClipboardList, academic: CalendarDays }
const HOD_ICONS = { dashboard: LayoutDashboard, verify: ShieldCheck, faculty: UsersRound, leaderboard: Trophy, users: UserRound, upload: Upload, semester: LockKeyhole }
const STUDENT_NAV_TRANSITION = { duration: 0.22, ease: 'easeOut' }

export default function Shell({ role, userName, _department, children, profileTrigger = null, badges = {}, roleLabel = null, className = '' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const links = NAV[role] || []
  const portalLabel = roleLabel || ROLE_LABEL[role] || ''
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem('stars_user') || '{}') } catch { return {} }
  })()
  const shellClassName = role === 'faculty'
    ? 'min-h-screen flex flex-col bg-paper faculty-dashboard-shell'
    : 'min-h-screen flex flex-col bg-paper'

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  function signOut() {
    localStorage.removeItem('stars_token')
    localStorage.removeItem('stars_user')
    navigate('/')
  }

  function openProfile() {
    setMenuOpen(false)
    if (profileTrigger) {
      profileTrigger()
    } else {
      setAccountOpen(true)
    }
  }

  function navLink(link, mobile = false) {
    const count = badges[link.to]
    const isStudent = role === 'student'
    const StudentIcon = isStudent ? STUDENT_ICONS[link.icon] : null
    const FacultyIcon = role === 'faculty' ? FACULTY_ICONS[link.icon] : null
    const AdminIcon = role === 'principal' ? PRINCIPAL_ICONS[link.icon] : null
    const HodIcon = role === 'hod' ? HOD_ICONS[link.icon] : null
    const isPrincipalNav = role === 'principal'

    if (isStudent) {
      const LinkComponent = mobile ? NavLink : motion(NavLink)
      return (
        <LinkComponent
          key={link.to}
          to={link.to}
          end
          whileHover={mobile ? undefined : { backgroundColor: 'rgba(42, 120, 214, 0.08)', color: 'var(--color-brand-600)' }}
          transition={STUDENT_NAV_TRANSITION}
          className={({ isActive }) => mobile
            ? `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold uppercase tracking-[0.06em] transition-colors ${isActive ? 'bg-ink text-paper' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'}`
            : `group relative flex items-center gap-2.5 px-3 py-3 text-xs font-bold uppercase tracking-[0.06em] transition-colors ${isActive ? 'text-brand-600' : 'text-slate-600 hover:text-brand-600'}`}
        >
          {({ isActive }) => (
            <>
              <motion.span
                className="flex h-4 w-4 shrink-0 items-center justify-center"
                animate={{ color: isActive ? 'var(--color-brand-600)' : 'currentColor' }}
                whileHover={{ scale: 1.08 }}
                transition={STUDENT_NAV_TRANSITION}
              >
                <StudentIcon size={16} strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
              </motion.span>
              <span>{link.label}</span>
              {count > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 font-mono text-[10px] font-medium text-paper">
                  {count > 99 ? '99+' : count}
                </span>
              )}
              {!mobile && isActive && (
                <motion.span layoutId="student-nav-underline" className="absolute inset-x-3 -bottom-px h-0.5 bg-brand-500" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
              )}
            </>
          )}
        </LinkComponent>
      )
    }

    const IconComponent = FacultyIcon || AdminIcon || HodIcon

    return (
      <NavLink
        key={link.to}
        to={link.to}
        end
        className={({ isActive }) =>
          mobile
            ? `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-ink text-paper' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
              }`
            : `group relative inline-flex items-center gap-2.5 rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                isPrincipalNav
                  ? isActive
                    ? 'bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-brand-700 hover:shadow-sm'
                  : isActive
                    ? 'bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm'
              }`
        }
      >
        {({ isActive }) => (
          <>
            <span className="flex h-4 w-4 shrink-0 items-center justify-center transition-colors duration-200">
              {IconComponent ? (
                <IconComponent className="h-4 w-4" strokeWidth={isActive ? 2.1 : 1.9} aria-hidden="true" />
              ) : (
                <span className="text-xs">{link.icon}</span>
              )}
            </span>
            <span className="whitespace-nowrap">{link.label}</span>
            {count > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 font-mono text-[10px] font-medium text-paper">
                {count > 99 ? '99+' : count}
              </span>
            )}
            {!mobile && isActive && <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand-500" />}
          </>
        )}
      </NavLink>
    )
  }

  const avatar = (
    <button
      type="button"
      onClick={profileTrigger || undefined}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-sm font-semibold text-paper transition-colors hover:bg-slate-800 focus-ring"
      aria-label="Open profile"
    >
      {userName?.[0] || '?'}
    </button>
  )

  return (
    <div className={`${shellClassName} ${className}`.trim()}>
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur">
        {/* Issue row â€” serif small caps */}
        <div className="hidden border-b border-rule px-6 py-1.5 lg:flex lg:items-center lg:justify-between lg:px-10">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">
            KPR College of Arts and Science Â· STAR Framework
          </p>
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Academic Year {new Date().getFullYear()}
          </p>
        </div>

        {/* Wordmark row */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-rule bg-card shadow-soft">
              <Logo size={26} />
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold leading-none tracking-tight">STARS-BCA</p>
              <p className="mt-1 font-display text-[10px] uppercase tracking-[0.22em] text-slate-400">
                {portalLabel} Portal
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-4 lg:flex">
            {profileTrigger ? (
              <div className="flex items-center gap-2">
                {avatar}
                <span className="hidden text-sm font-medium text-ink lg:inline">{userName}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-sm font-semibold text-paper">{userName?.[0] || '?'}</div>
                <span className="hidden text-sm font-medium text-ink lg:inline">{userName}</span>
              </div>
            )}
            <button
              type="button"
              onClick={signOut}
              className="rounded-full border border-rule px-3.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-ink focus-ring"
            >
              Sign out
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 focus-ring lg:hidden"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Nav row â€” desktop */}
        <nav className="hidden border-t border-rule lg:block">
          <div className="flex items-center gap-2 px-4 sm:px-6 lg:px-10">{links.map((link) => navLink(link))}</div>
        </nav>
      </header>

      <main className="min-w-0 flex-1 overflow-x-clip px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>

      {/* Colophon */}
      <footer className="border-t border-rule px-4 py-5 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">STARS-BCA Â· STAR Framework Management System</p>
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">KPR College of Arts and Science, Coimbatore</p>
        </div>
      </footer>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 transform flex-col bg-card shadow-modal transition-transform duration-200 ease-out">
            <div className="flex items-center justify-between border-b border-rule px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-rule bg-paper">
                  <Logo size={22} />
                </div>
                <p className="font-display text-base font-semibold tracking-tight">STARS-BCA</p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="text-2xl leading-none text-slate-400 hover:text-ink"
                aria-label="Close menu"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              <p className="px-3 pb-2 font-display text-[10px] uppercase tracking-[0.22em] text-slate-400">
                {portalLabel} Portal Â· {userName || ''}
              </p>
              {links.map((link) => navLink(link, true))}
              <button
                type="button"
                onClick={openProfile}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-ink"
              >
                <UserRound className="h-4 w-4" aria-hidden="true" />
                Profile
              </button>
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        title="Profile"
        footer={<Button variant="outline" onClick={() => setAccountOpen(false)}>Close</Button>}
      >
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3 border-b border-rule pb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink font-display text-lg font-semibold text-paper">
              {userName?.[0] || '?'}
            </div>
            <div>
              <p className="font-semibold text-ink">{userName || 'User'}</p>
              <p className="text-slate-500">{portalLabel}</p>
            </div>
          </div>
          <p><span className="font-medium text-slate-500">Email:</span> {storedUser.email || 'Not available'}</p>
          <p><span className="font-medium text-slate-500">Department:</span> {storedUser.department || _department || 'Not available'}</p>
          <ThemeToggle />
        </div>
      </Modal>
    </div>
  )
}