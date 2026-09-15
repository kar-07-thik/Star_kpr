import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, EmptyState, LoadingState, Toast } from '../components/UI.jsx'
import { getStudentLeaderboard } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const rankTone = {
  1: 'bg-amber-100 text-amber-700 border-amber-200',
  2: 'bg-slate-200 text-slate-700 border-slate-300',
  3: 'bg-orange-100 text-orange-700 border-orange-200',
  default: 'bg-slate-100 text-slate-600 border-slate-200',
}

const formatInitials = (name) => {
  if (!name) return 'S'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'S'
}

export default function StudentLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState({
    currentStudent: null,
    topThree: [],
    fullList: [],
  })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const currentUserId = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('stars_user') || '{}')._id || ''
    } catch {
      return ''
    }
  }, [])

  const loadLeaderboard = useCallback(async () => {
    setLoading(true)
    setToast('')
    try {
      const res = await getStudentLeaderboard()
      const data = res?.data || {}

      const normalized = {
        currentStudent: data.currentStudent || null,
        topThree: Array.isArray(data.topThree) ? data.topThree : [],
        fullList: Array.isArray(data.fullList) ? data.fullList : [],
      }

      if (!normalized.currentStudent && data.myRank) {
        normalized.currentStudent = {
          rank: data.myRank.rank ?? data.myRank,
          totalApprovedPoints: data.myPoints ?? 0,
        }
      }

      if (normalized.fullList.length === 0 && Array.isArray(data.leaderboard)) {
        normalized.fullList = data.leaderboard.map((student) => ({
          rank: student.rank,
          name: student.name,
          regNo: student.registerNumber || student.regNo || 'N/A',
          department: student.department || 'Unassigned',
          totalApprovedPoints: student.totalPoints || 0,
          isCurrentUser: String(student._id) === String(currentUserId),
        }))
      }

      setLeaderboard(normalized)
    } catch (error) {
      setToast(error.message || 'Unable to load leaderboard right now. Please try again.')
      setLeaderboard({ currentStudent: null, topThree: [], fullList: [] })
    } finally {
      setLoading(false)
    }
  }, [currentUserId])

  useEffect(() => {
    loadLeaderboard()
  }, [loadLeaderboard])

  const currentStudent = leaderboard.currentStudent || null
  const fullList = leaderboard.fullList || []
  const filteredTopThree = useMemo(() => {
    const topThree = leaderboard.topThree || []
    const ordered = [...topThree].sort((a, b) => a.rank - b.rank)
    const rank2 = ordered.find((entry) => entry.rank === 2)
    const rank1 = ordered.find((entry) => entry.rank === 1)
    const rank3 = ordered.find((entry) => entry.rank === 3)
    return [rank2, rank1, rank3].filter(Boolean)
  }, [leaderboard.topThree])

  if (loading) return <LoadingState rows={4} />

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast} tone="error" onDismiss={() => setToast('')} />}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">Leaderboard</h1>
          <p className="mt-1.5 text-sm text-slate-500">Your classmates ranked by approved STAR points.</p>
        </div>
        <Button variant="outline" onClick={loadLeaderboard}>Refresh</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 text-center">
          <p className="font-display text-3xl font-semibold text-ink">#{currentStudent?.rank || 0}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">Your Rank</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="font-display text-3xl font-semibold text-ink">{currentStudent?.totalApprovedPoints ?? 0}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">Approved Points</p>
        </Card>
      </div>

      {filteredTopThree.length > 0 ? (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold text-ink">Top 3</p>
              <p className="text-sm text-slate-400">Best performers this cycle</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end">
            {filteredTopThree.map((entry, index) => {
              const isCurrentUser = Boolean(entry.isCurrentUser)
              const isChampion = entry.rank === 1
              const podiumOrder = [1, 0, 2]
              const visualRank = podiumOrder[index] ?? index
              const placement = visualRank === 0 ? 2 : visualRank === 1 ? 1 : 3
              const cardClass = isChampion ? 'md:-translate-y-2 border-amber-300 bg-amber-50/40' : isCurrentUser ? 'border-blue-200 bg-blue-50/60' : 'border-rule bg-card'

              return (
                <div
                  key={`${entry.rank}-${entry.name}-${index}`}
                  className={`rounded-xl border p-3 text-center shadow-sm transition-all ${cardClass} ${isChampion ? 'ring-1 ring-amber-200' : ''}`}
                >
                  <div className="mb-2 flex items-center justify-center gap-2">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${rankTone[entry.rank] || rankTone.default}`}>
                      #{entry.rank}
                    </span>
                    {isCurrentUser && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">
                        You
                      </span>
                    )}
                  </div>

                  <div className={`mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border text-lg font-display font-semibold ${isChampion ? 'border-amber-300 bg-amber-100 text-amber-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                    {formatInitials(entry.name)}
                  </div>

                  <p className="font-display text-lg font-semibold text-ink">{entry.name}</p>
                  <p className="mt-0.5 text-xs uppercase tracking-[0.12em] text-slate-400">{entry.department}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">{entry.regNo}</p>
                  <p className="mt-2 font-display text-2xl font-semibold text-ink">{entry.totalApprovedPoints} <span className="text-base text-slate-400">pts</span></p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-400">Rank {placement}</p>
                </div>
              )
            })}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="p-5">
            <EmptyState icon="☆" title="No leaderboard data yet" description="Earn approved STAR points to appear on the leaderboard." />
          </div>
        </Card>
      )}

      {fullList.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 pt-5">
            <p className="font-display text-lg font-semibold text-ink">Full Leaderboard</p>
            <p className="text-sm text-slate-400">All ranked students in your batch.</p>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper/60">
                  <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Rank</th>
                  <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Student</th>
                  <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Points</th>
                </tr>
              </thead>
              <tbody>
                {fullList.map((entry) => (
                  <tr key={`${entry.rank}-${entry.name}`} className={`border-b border-rule transition-colors hover:bg-paper/60 ${entry.isCurrentUser ? 'bg-brand-50/50' : ''}`}>
                    <td className="px-5 py-3">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-semibold bg-paper text-slate-500 border border-rule">
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{entry.name} {entry.isCurrentUser && <span className="text-xs text-blue-600">(You)</span>}</p>
                      <p className="text-xs text-slate-400">{entry.regNo}</p>
                    </td>
                    <td className="px-5 py-3 tabular text-slate-500">{entry.totalApprovedPoints} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
