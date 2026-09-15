import React, { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { Card, EmptyState, LoadingState, PageHeader, Toast } from '../components/UI.jsx'
import { getStudentPointsHistory } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatMonthKey(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function groupByMonth(entries) {
  const groups = []
  let current = null
  for (const entry of entries) {
    const key = formatMonthKey(entry.date)
    if (!current || current.label !== key) {
      current = { label: key, entries: [] }
      groups.push(current)
    }
    current.entries.push(entry)
  }
  return groups
}

const VERTICAL_COLORS = {
  'Technical': 'text-brand-600',
  'Leadership': 'text-amber-600',
  'Community Service': 'text-leaf-600',
  'Sports': 'text-rose-600',
}

function pointsClass(points) {
  if (points > 0) return 'text-leaf-600'
  if (points < 0) return 'text-rose-600'
  return 'text-slate-500'
}

export default function StudentPointsLedgerPage() {
  const [ledger, setLedger] = useState([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await getStudentPointsHistory()
        setLedger(res.data?.ledger || [])
        setTotalPoints(res.data?.totalPoints || 0)
      } catch (error) {
        setToast({ message: error.message || 'Unable to load points history', tone: 'error' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const chartData = useMemo(() => {
    const monthly = []
    const byMonth = {}
    ledger.forEach((entry) => {
      const d = new Date(entry.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      byMonth[key] = byMonth[key] || 0
      byMonth[key] += Number(entry.points) || 0
    })
    Object.keys(byMonth).sort().forEach((key) => {
      const d = new Date(`${key}-01`)
      monthly.push({
        month: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        points: byMonth[key],
        cumulative: 0,
      })
    })
    let running = 0
    monthly.forEach((entry) => { running += entry.points; entry.cumulative = running })
    return monthly
  }, [ledger])

  if (loading) return <LoadingState rows={4} />

  const groups = groupByMonth(ledger)

  return (
    <div className="space-y-6">
      <PageHeader title="Points Ledger" subtitle="Your earned STAR points timeline" />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">Total Points</p>
          <p className="mt-2 font-mono text-4xl font-semibold tabular-nums leading-none text-ink">{totalPoints}</p>
        </Card>
        <Card className="p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">Entries</p>
          <p className="mt-2 font-mono text-4xl font-semibold tabular-nums leading-none text-ink">{ledger.length}</p>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="p-5">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Points earned over time</h2>
          <p className="mt-1 text-sm text-slate-400">Monthly points earned with a running cumulative total.</p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--color-slate-400)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-slate-400)', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  formatter={(value, name) => [value, name === 'points' ? 'Points earned' : 'Cumulative points']}
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)' }}
                />
                <Bar dataKey="points" radius={[3, 3, 0, 0]} fill="var(--color-brand-500)">
                  {chartData.map((entry, index) => (
                    <Cell key={`${entry.month}-${index}`} fill={entry.points >= 0 ? 'var(--color-brand-500)' : 'var(--color-rose-500)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--color-slate-400)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-slate-400)', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  formatter={(value, name) => [value, name === 'cumulative' ? 'Cumulative points' : value]}
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)' }}
                />
                <Line type="monotone" dataKey="cumulative" stroke="var(--color-leaf-500)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Timeline */}
      {groups.length > 0 ? (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{group.label}</h2>
              <Card className="divide-y divide-rule overflow-hidden">
                {group.entries.map((entry, i) => (
                  <div key={i} className="flex items-start gap-4 px-5 py-4">
                    <div className="mt-1 flex flex-col items-center">
                      <span className={`h-2 w-2 rounded-full ${entry.points >= 0 ? 'bg-leaf-500' : 'bg-rose-400'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{entry.activityName || 'Activity'}</span>
                        {entry.vertical && (
                          <span className={`font-mono text-[10px] uppercase tracking-[0.1em] ${VERTICAL_COLORS[entry.vertical] || 'text-slate-400'}`}>
                            {entry.vertical}
                          </span>
                        )}
                      </div>
                      {entry.note && (
                        <p className="mt-1 text-sm text-slate-500">{entry.note}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-mono text-sm font-semibold tabular-nums ${pointsClass(entry.points)}`}>
                        {entry.points > 0 ? '+' : ''}{entry.points}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400">{formatDate(entry.date)}</p>
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon="☆" title="No points yet" description="Your points history will appear here once your submissions are approved." />
      )}
    </div>
  )
}