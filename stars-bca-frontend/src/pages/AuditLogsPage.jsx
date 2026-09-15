import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Shell from '../components/Shell.jsx'
import { Card, Input, EmptyState, LoadingState, Toast, Button, ConfirmDialog } from '../components/UI.jsx'
import { getAuditLogs, deleteAuditLog, clearAuditLogs } from '../utils/api.js'

/* Hallmark Â· genre: editorial Â· macrostructure: Workbench Â· design-system: design.md Â· designed-as-app */

export default function AuditLogsPage({ embedded = false }) {
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('stars_user') || '{}') } catch { return {} }
  }, [])
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const notify = useCallback((message, tone = 'error') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      load()
    }, 250)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query])

  async function load() {
    try {
      setLoading(true)
      const res = await getAuditLogs(page, 25, query)
      setLogs(res.data?.logs || [])
      setTotal(res.data?.total || 0)
    } catch (error) {
      notify(error.message || 'Unable to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(logId) {
    setDeleting(true)
    try {
      await deleteAuditLog(logId)
      notify('Audit log removed.', 'success')
      if (logs.length === 1 && page > 1) setPage((prev) => prev - 1)
      else await load()
    } catch (error) {
      notify(error.message || 'Unable to delete audit log', 'error')
    } finally {
      setDeleting(false)
      setConfirm(null)
    }
  }

  async function handleClearAll() {
    setDeleting(true)
    try {
      const res = await clearAuditLogs()
      notify(res.message || 'Audit logs cleared.', 'success')
      setLogs([])
      setTotal(0)
      setPage(1)
    } catch (error) {
      notify(error.message || 'Unable to clear audit logs', 'error')
    } finally {
      setDeleting(false)
      setConfirm(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 25))

  return (
    <PageFrame embedded={embedded} currentUser={currentUser}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">Audit Logs</h1>
          <p className="mt-1.5 text-sm text-slate-500">{currentUser?.accountType === 'hod' ? 'Actions taken within your department.' : 'A record of user, department, activity, and review actions across the system.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by actionâ€¦" className="!w-full md:!w-64 !bg-card !border-rule" />
          <Button
            variant="danger"
            disabled={total === 0 || deleting}
            onClick={() =>
              setConfirm({
                id: 'all',
                title: 'Clear all audit logs',
                message: `Delete all ${total} audit log${total === 1 ? '' : 's'}? This action cannot be undone.`,
                confirmLabel: 'Clear all',
                onConfirm: handleClearAll,
              })
            }
          >
            Clear all
          </Button>
        </div>
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      <Card className="mt-6 overflow-hidden">
        {loading ? (
          <LoadingState rows={5} />
        ) : logs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="border-b border-rule bg-paper/60">
                    <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Action</th>
                    <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Actor</th>
                    <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Entity</th>
                    <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Details</th>
                    <th className="px-5 py-3 text-right font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">When</th>
                    <th className="px-5 py-3 text-right font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id} className="border-b border-rule align-top transition-colors hover:bg-paper/60">
                      <td className="px-5 py-3.5">
                        <span className="rounded-full border border-rule px-2.5 py-0.5 font-mono text-[11px] text-slate-600">{log.action}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-ink">{log.actorId?.name || 'System'}</p>
                        <p className="text-xs text-slate-400">{log.actorId?.email || ''}</p>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{log.entityType || 'â€”'}</td>
                      <td className="px-5 py-3.5 text-slate-500 max-w-[280px]">
                        {log.details ? <span className="block truncate font-mono text-xs">{JSON.stringify(log.details)}</span> : 'â€”'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deleting}
                          onClick={() =>
                            setConfirm({
                              id: log._id,
                              title: 'Remove audit log',
                              message: `Remove this audit log (${log.action})? This action cannot be undone.`,
                              confirmLabel: 'Remove',
                              onConfirm: () => handleDelete(log._id),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <p className="font-mono text-xs text-slate-400">{total} log{total === 1 ? '' : 's'}</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Prev</Button>
                <span className="font-mono text-xs text-slate-500">Page {page} of {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)}>Next</Button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6">
            <EmptyState icon="â‰¡" title="No audit logs" description={query ? 'No logs match that action filter.' : 'Actions will be recorded here as they happen.'} />
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        loading={deleting}
        onConfirm={confirm?.onConfirm}
      />
    </PageFrame>
  )
}

function PageFrame({ embedded, currentUser, children }) {
  if (embedded) return <>{children}</>
  return (
    <Shell role="principal" roleLabel={currentUser?.accountType === 'dean' ? 'Dean' : 'Principal'} userName={currentUser.name || 'Admin'} department={currentUser.department || 'Audit Logs'}>
      {children}
    </Shell>
  )
}