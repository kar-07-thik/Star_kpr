import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginUser } from '../utils/api.js'
import { Logo } from '../components/Shell.jsx'
import { Modal, Button } from '../components/UI.jsx'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2C11 5.1 11.5 5 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-3.4 4.3M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.3 0 2.5-.2 3.6-.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}

const ROLES = [
  { id: 'student', label: 'Student' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'admin', label: 'Admin' },
]

const STUDENT_EMAIL_PATTERN = /^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*@kprcas\.ac\.in$/
const STUDENT_EMAIL_ERROR = 'Student email must use a valid @kprcas.ac.in address'

export default function Login() {
  const [role, setRole] = useState('student')
  const [showPassword, setShowPassword] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    const nextEmailError = role === 'student' && !STUDENT_EMAIL_PATTERN.test(identifier) ? STUDENT_EMAIL_ERROR : ''
    setEmailError(nextEmailError)
    if (nextEmailError) return

    if (!identifier || !password) {
      setError('Please fill in both fields to continue.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const response = await loginUser(role, identifier, password)
      const authData = response?.data || response
      if (!authData?.token) {
        throw new Error('Authentication did not return a token')
      }
      localStorage.setItem('stars_token', authData.token)
      localStorage.setItem('stars_user', JSON.stringify(authData.user || {}))
      const user = authData.user || {}
      let redirectPath = '/faculty'
      if (user.role === 'student') {
        redirectPath = '/student'
      } else if (user.role === 'admin') {
        redirectPath = user.accountType === 'hod' ? '/hod' : '/principal'
      }
      navigate(redirectPath)
    } catch (err) {
      const message = err?.message || 'Login failed'
      setError(message.includes('Invalid') || message.includes('credentials') ? 'Invalid credentials. Please check your username and password.' : message)
    } finally {
      setLoading(false)
    }
  }

  const idLabel = role === 'student' ? 'Email' : role === 'faculty' ? 'Faculty email' : 'Admin email'
  const idPlaceholder =
    role === 'student' ? 'Enter your email' : role === 'faculty' ? 'Enter your faculty email' : 'Enter your admin email'

  return (
    <div className="box-border flex min-h-screen w-full min-w-0 flex-col bg-paper lg:flex-row">
      {/* Masthead column */}
      <div className="hidden h-[100svh] min-h-[100svh] w-full shrink-0 flex-col justify-between bg-brand-500 px-5 py-5 text-white sm:px-10 sm:py-10 lg:flex lg:h-auto lg:min-h-screen lg:w-1/2 lg:p-14">
        <div className="login-entrance-down login-delay-1 flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-rule bg-card shadow-soft">
            <Logo size={28} />
          </div>
          <p className="min-w-0 break-words font-display text-[10px] uppercase tracking-[0.12em] text-white">KPR College of Arts Science and Research</p>
        </div>

        <div className="max-w-md self-start py-4 sm:py-0">
          <h1 className="login-entrance font-display text-4xl font-semibold leading-none tracking-tight text-white sm:text-5xl lg:text-6xl">STAR KPR</h1>
          <div className="login-entrance login-delay-1 mt-4 w-20 border-t-2 border-white" aria-hidden="true" />
          <p className="login-entrance login-delay-2 mt-5 text-sm leading-relaxed text-white/80 sm:mt-7 sm:text-[15px]">
            The Student STAR Framework keeps a running record of achievement across ten verticals — academic, innovation,
            leadership, and community — in one maintained ledger.
          </p>
        </div>

        <div className="space-y-6">
          <p className="login-entrance font-display text-[11px] uppercase tracking-[0.18em] text-white/70">STAR Framework · Management System</p>
          <footer className="login-entrance login-delay-1 flex flex-col items-start gap-3 border-t border-white/25 pt-4 text-[9px] leading-relaxed text-white/70 sm:flex-row sm:items-center sm:gap-4">
            <p className="max-w-[15rem]">© 2025 KPR College of Arts Science and Research.<br />All rights reserved.</p>
            <p className="border-t border-white/25 pt-3 font-display font-semibold uppercase tracking-[0.12em] text-white/80 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">Developed by Department of BCA</p>
          </footer>
        </div>
      </div>

      {/* Hairline divider */}
      <div className="hidden w-px bg-rule lg:block" aria-hidden="true" />

      {/* Form column */}
      <div className="login-mobile-surface box-border flex w-full min-w-0 flex-1 items-center justify-center px-4 py-6 sm:px-10 sm:py-10 md:px-16 md:py-12">
        <div className="login-mobile-card box-border w-full min-w-0 max-w-sm rounded-[1.75rem] bg-card p-5 shadow-modal sm:p-7 md:max-w-lg md:p-8 lg:max-w-sm lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="mb-5 flex min-w-0 items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-white shadow-soft">
              <Logo size={28} />
            </div>
            <p className="min-w-0 break-words font-display text-[11px] font-semibold uppercase leading-[1.35] tracking-[0.08em] text-brand-700">KPR College of Arts Science and Research</p>
          </div>

          <div className="login-portal-strip mb-5 lg:hidden">
            <div className="login-portal-strip__mark" aria-hidden="true">
              <span className="login-portal-strip__star">★</span>
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-[11px] font-semibold text-brand-700">STAR ACADEMIC PORTAL</p>
              <p className="truncate text-[9px] leading-tight text-slate-500">KPR STUDENT INFORMATION SYSTEM</p>
            </div>
            <span className="login-portal-strip__status"><span className="login-portal-strip__status-dot" aria-hidden="true" />SECURE</span>
          </div>

          <h2 className="login-entrance font-display text-xl font-semibold tracking-tight text-brand-600">WELCOME BACK!</h2>
          <p className="login-entrance login-delay-1 mt-1.5 text-sm text-slate-500">Pick your role to sign in.</p>

          <div className="login-entrance login-delay-2 mt-7 flex overflow-hidden rounded-md border border-rule bg-slate-100">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setRole(r.id)
                  setEmailError('')
                }}
                className={`w-1/3 py-2.5 text-sm font-medium transition-colors focus-ring ${
                  role === r.id ? 'bg-brand-500 text-white lg:bg-leaf-500' : 'bg-slate-100 text-slate-500 hover:text-ink'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="login-entrance login-delay-3">
              <label className="text-sm font-medium uppercase text-slate-600">{idLabel}</label>
              <input
                type="email"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value)
                  if (emailError) setEmailError('')
                }}
                onBlur={() => {
                  if (role === 'student' && identifier && !STUDENT_EMAIL_PATTERN.test(identifier)) {
                    setEmailError(STUDENT_EMAIL_ERROR)
                  }
                }}
                aria-invalid={Boolean(emailError)}
                placeholder={idPlaceholder}
                className={`mt-2 w-full rounded-md border bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-400 focus-ring focus:border-brand-400 ${emailError ? 'border-rose-400' : 'border-rule'}`}
              />
              {emailError && <p className="mt-1.5 text-xs text-rose-500">{emailError}</p>}
            </div>
            <div className="login-entrance login-delay-4">
              <label className="text-sm font-medium uppercase text-slate-600">Password</label>
              <div className="relative mt-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-md border border-rule bg-card px-3.5 py-2.5 pr-11 text-sm text-ink placeholder:text-slate-400 focus-ring focus:border-brand-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <div className="login-entrance login-delay-5 flex justify-end">
              <button type="button" onClick={() => setShowForgot(true)} className="text-xs font-medium text-brand-500 hover:text-brand-600">
                Forgot Password?
              </button>
            </div>

            {error && <p className="text-sm text-rose-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="login-entrance login-delay-6 w-full rounded-md bg-brand-600 py-3 font-medium text-paper transition-colors hover:bg-brand-700 lg:bg-ink lg:hover:bg-slate-800 focus-ring disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Login →'}
            </button>
          </form>

          <footer className="mt-6 border-t border-rule pt-4 text-center text-[10px] leading-relaxed text-slate-400 lg:hidden">
            <p>© 2025 KPR College of Arts Science and Research. All rights reserved.</p>
            <p className="mt-1 font-display font-semibold uppercase tracking-[0.08em] text-slate-500">Developed by Department of BCA</p>
          </footer>
        </div>
      </div>

      <Modal
        open={showForgot}
        onClose={() => setShowForgot(false)}
        title="Reset your password"
        footer={
          <Button onClick={() => setShowForgot(false)}>Got it</Button>
        }
      >
        <div className="space-y-4 text-sm text-slate-600">
          <div className="rounded-md bg-brand-50 p-4">
            <p className="font-semibold text-ink">Password resets are handled by your department admin.</p>
          </div>
          <ul className="space-y-2 list-disc pl-5">
            <li><span className="font-medium text-ink">Students &amp; faculty:</span> ask your HOD or department admin to reset your password. They can do this from the Admin dashboard.</li>
            <li><span className="font-medium text-ink">Admins (HOD/Dean):</span> sign in with your existing credentials, then reset your own password from the user management panel.</li>
            <li>After a reset, your password is set to <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">Welcome@123</code>. Change it the next time you sign in.</li>
          </ul>
          <p className="text-xs text-slate-400">If you still cannot sign in, contact the system administrator.</p>
        </div>
      </Modal>
    </div>
  )
}