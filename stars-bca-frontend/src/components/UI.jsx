import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const LEDGER_TICKS = {
  brand: 'bg-brand-500',
  leaf: 'bg-leaf-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
}

const ACCENT_ICON_STYLES = {
  brand: 'border-brand-200 bg-brand-50 text-brand-600',
  leaf: 'border-leaf-200 bg-leaf-50 text-leaf-600',
  amber: 'border-amber-200 bg-amber-50 text-amber-600',
  rose: 'border-rose-200 bg-rose-50 text-rose-600',
}

export function StatCard({ label, value, sub, accent = 'brand', icon: Icon, onClick, className = '' }) {
  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border border-rule bg-card p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] ${className} ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${LEDGER_TICKS[accent] || LEDGER_TICKS.brand}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="min-w-0">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="tabular mt-2 font-display text-3xl font-semibold leading-none text-ink">{value}</p>
          {sub && <p className="mt-1.5 text-xs text-slate-400">{sub}</p>}
        </div>

        {Icon && (
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${ACCENT_ICON_STYLES[accent] || ACCENT_ICON_STYLES.brand}`}>
            <Icon className="h-4 w-4" strokeWidth={2.1} aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  )
}

const STATUS_TONES = {
  Approved: 'bg-leaf-100 text-leaf-600 border-leaf-300/50',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  FacultyApproved: 'bg-brand-50 text-brand-700 border-brand-200',
  HODApproved: 'bg-leaf-100 text-leaf-600 border-leaf-300/50',
  Rejected: 'bg-rose-50 text-rose-600 border-rose-200',
  HODRejected: 'bg-rose-50 text-rose-600 border-rose-200',
  Active: 'bg-leaf-100 text-leaf-600 border-leaf-300/50',
  Inactive: 'bg-rose-50 text-rose-600 border-rose-200',
}

export function StatusBadge({ status }) {
  const tone = STATUS_TONES[status] || 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

export function ProgressRing({ percent = 0, size: _size = 88, stroke: _stroke = 9, color = 'var(--color-brand-500)' }) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)))
  return (
    <div className="w-full">
      <p className="tabular font-display text-4xl font-semibold leading-none text-ink">{clamped}%</p>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, subtitle, children, footer }) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      requestAnimationFrame(() => setVisible(true))
      return undefined
    }

    setVisible(false)
    const timer = window.setTimeout(() => setMounted(false), 200)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!mounted) return null

  return createPortal(
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-3 transition-opacity duration-200 sm:p-4 lg:p-6 ${visible ? 'opacity-100' : 'opacity-0'}`} role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60" onClick={onClose} />
      <div onClick={(event) => event.stopPropagation()} className={`relative flex max-h-[90vh] w-full max-w-[90vw] flex-col overflow-hidden rounded-xl border border-rule bg-card shadow-modal transition duration-200 ease-out lg:max-w-[1280px] ${visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
        <div className="flex items-center justify-between border-b border-rule px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold text-ink">{title}</h3>
            {subtitle && <p className="mt-0.5 truncate text-xs text-slate-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="ml-4 shrink-0 rounded-full p-1 text-2xl leading-none text-slate-400 transition-colors hover:text-ink focus-ring" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-rule bg-card px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function CategoryTag({ category }) {
  if (!category) return null
  return (
    <span
      className="whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium"
      style={{ backgroundColor: `${category.color}14`, color: category.color, borderColor: `${category.color}30` }}
    >
      {category.name}
    </span>
  )
}

export function Button({ children, variant = 'primary', size = 'md', loading = false, className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-md font-medium focus-ring transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-brand-600 text-paper hover:bg-brand-700',
    success: 'bg-leaf-500 text-white hover:bg-leaf-600',
    danger: 'bg-rose-500 text-white hover:bg-rose-600',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-ink',
    outline: 'bg-transparent text-ink border border-rule hover:border-slate-300 hover:bg-card',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  }
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={props.disabled || loading} {...props}>
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
        </svg>
      )}
      {children}
    </button>
  )
}

export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }
  return (
    <svg className={`animate-spin text-brand-500 ${sizes[size]} ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

const inputBase =
  'w-full rounded-md border border-rule bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-400 focus-ring focus:border-brand-400 disabled:opacity-50 disabled:cursor-not-allowed'

export function Field({ label, hint, error, children, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="mb-1.5 block text-sm font-medium text-slate-600">{label}</label>}
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1.5 text-xs font-medium text-rose-500">{error}</p>}
    </div>
  )
}

export function Input({ className = '', invalid, ...props }) {
  return <input className={`${inputBase} ${invalid ? '!border-rose-300 !bg-rose-50' : ''} ${className}`} {...props} />
}

export function Select({ className = '', invalid, children, ...props }) {
  return (
    <select className={`${inputBase} ${invalid ? '!border-rose-300 !bg-rose-50' : ''} ${className}`} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ className = '', invalid, ...props }) {
  return <textarea className={`${inputBase} ${invalid ? '!border-rose-300 !bg-rose-50' : ''} ${className}`} {...props} />
}

const TOAST_TONES = {
  success: 'border-leaf-300 bg-leaf-100/70 text-leaf-700',
  error: 'border-rose-300 bg-rose-100/70 text-rose-700',
  info: 'border-brand-300 bg-brand-100/70 text-brand-800',
  warning: 'border-amber-300 bg-amber-100/70 text-amber-800',
}

export function Toast({ message, tone = 'success', onDismiss }) {
  useEffect(() => {
    if (!onDismiss) return undefined
    const timer = window.setTimeout(onDismiss, 4000)
    return () => window.clearTimeout(timer)
  }, [message, onDismiss])

  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(92vw,24rem)] flex-col gap-3" aria-live="polite">
      <div role="status" className={`pointer-events-auto relative flex items-start justify-between gap-3 overflow-hidden rounded-lg border px-4 py-3 text-sm font-medium shadow-lg animate-[toastIn_0.2s_ease-out] ${TOAST_TONES[tone] || TOAST_TONES.success}`}>
        <span>{message}</span>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="shrink-0 leading-none opacity-60 hover:opacity-100" aria-label="Dismiss">&times;</button>
        )}
        <span className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-current opacity-30 animate-[toastProgress_4s_linear_forwards]" />
      </div>
    </div>,
    document.body,
  )
}

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  const showToast = useCallback(({ message, type = 'success', tone, duration = 4000 }) => {
    const id = `${Date.now()}-${Math.random()}`
    const toast = { id, message, tone: tone || type }
    setToasts((current) => [...current, toast])
    timers.current.set(id, window.setTimeout(() => dismissToast(id), duration))
    return id
  }, [dismissToast])

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), [])

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(92vw,24rem)] flex-col gap-3" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} role="status" className={`pointer-events-auto relative flex items-start justify-between gap-3 overflow-hidden rounded-lg border px-4 py-3 text-sm font-medium shadow-lg animate-[toastIn_0.2s_ease-out] ${TOAST_TONES[toast.tone] || TOAST_TONES.success}`}>
              <span>{toast.message}</span>
              <button type="button" onClick={() => dismissToast(toast.id)} className="shrink-0 leading-none opacity-60 hover:opacity-100" aria-label="Dismiss">&times;</button>
              <span className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-current opacity-30 animate-[toastProgress_4s_linear_forwards]" />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`rounded-lg border border-rule bg-card ${className}`} {...props}>
      {children}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, icon: Icon }) {
  return (
    <div className="mb-8 flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-600 shadow-sm">
              <Icon className="h-4 w-4" strokeWidth={2.1} aria-hidden="true" />
            </span>
          )}
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink uppercase md:text-3xl">{title}</h1>
        </div>
        {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon = '·', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-rule bg-card/50 px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-rule bg-paper font-display text-lg text-slate-400">{icon}</div>
      <p className="mt-3 font-display text-base font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingState({ rows = 1, className = '' }) {
  return (
    <div className={`space-y-3 animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-lg border border-rule bg-card p-5">
          <div className="h-4 w-1/3 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-full rounded bg-slate-100" />
          <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'danger', loading = false, inputLabel, inputValue, onInputChange, inputPlaceholder = '' }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={tone === 'success' ? 'success' : tone === 'primary' ? 'primary' : 'danger'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {message && <p className="text-sm text-slate-500">{message}</p>}
        {inputLabel && (
          <Field label={inputLabel} hint="This feedback will be visible to the student.">
            <Textarea
              value={inputValue || ''}
              onChange={(e) => onInputChange?.(e.target.value)}
              placeholder={inputPlaceholder}
              rows={3}
            />
          </Field>
        )}
      </div>
    </Modal>
  )
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('stars_dark_mode') === 'true' } catch { return false }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    try { localStorage.setItem('stars_dark_mode', String(darkMode)) } catch { /* storage may be unavailable */ }
  }, [darkMode])

  return <ThemeContext.Provider value={{ darkMode, setDarkMode }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}

export function ThemeToggle() {
  const { darkMode, setDarkMode } = useTheme()

  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-rule bg-paper px-3 py-3 text-sm text-ink">
      <span>
        <span className="block font-medium">Dark mode</span>
        <span className="mt-0.5 block text-xs text-slate-500">Use a darker dashboard theme</span>
      </span>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={darkMode}
          onChange={(event) => setDarkMode(event.target.checked)}
          aria-label="Enable dark mode"
        />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-paper" />
        <span className="pointer-events-none absolute left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}