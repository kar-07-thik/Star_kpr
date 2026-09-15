import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Button, Card, Select, EmptyState } from '../components/UI.jsx'

const ACTIVITY_GROUP_STYLES = {
  'Internship / Case Study / Mini Project': 'border-cyan-200 bg-cyan-50/70',
  'Industrial / Institutional / International Visit': 'border-cyan-200 bg-cyan-50/70',
  'Online Certification': 'border-sky-200 bg-sky-50/70',
  'Value Added Course (VAC)': 'border-emerald-200 bg-emerald-50/70',
  'Technical Event (quiz / GD / Debugging / others)': 'border-cyan-200 bg-cyan-50/70',
  'Paper Presentation': 'border-cyan-200 bg-cyan-50/70',
  'Patent / Copyright / Trademark': 'border-cyan-200 bg-cyan-50/70',
}

const CATEGORY_STYLES = {
  cert: { label: 'Technical Certifications', className: 'border-emerald-200 bg-emerald-100 text-emerald-800' },
  intern: { label: 'Internship', className: 'border-amber-200 bg-amber-100 text-amber-800' },
  project: { label: 'Project Work', className: 'border-violet-200 bg-violet-100 text-violet-800' },
  research: { label: 'Research Activities', className: 'border-rose-200 bg-rose-100 text-rose-800' },
  skill: { label: 'Skill Development', className: 'border-blue-200 bg-blue-100 text-blue-800' },
  community: { label: 'Community Service', className: 'border-cyan-200 bg-cyan-100 text-cyan-800' },
  sports: { label: 'Sports & Cultural', className: 'border-orange-200 bg-orange-100 text-orange-800' },
}

const ACTIVITIES_PER_PAGE = 6

function activityCategory(task) {
  const name = String(task.parentName || task.name || '').toLowerCase()
  if (name.includes('internship')) return 'intern'
  if (name.includes('project') || name.includes('portfolio') || name.includes('startup') || name.includes('genai')) return 'project'
  if (name.includes('paper') || name.includes('patent') || name.includes('journal') || name.includes('conference')) return 'research'
  if (name.includes('nss') || name.includes('ncc') || name.includes('community') || name.includes('social')) return 'community'
  if (name.includes('sport') || name.includes('cultural')) return 'sports'
  if (name.includes('certification') || name.includes('course') || name.includes('nptel') || name.includes('scholarship')) return 'cert'
  return task.category || 'skill'
}

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

export default function StudentTasksPage({
  selectedVertical,
  setSelectedVertical,
  verticalOptions,
  groupedTasks,
  pendingTasks,
  openUpload,
  categoryById,
}) {
  const [searchText, setSearchText] = useState('')
  const [debouncedSearchText, setDebouncedSearchText] = useState('')
  const [pagesByVertical, setPagesByVertical] = useState({})

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText)
    }, 150)
    return () => clearTimeout(timer)
  }, [searchText])

  // Filter tasks based on search text
  const filteredGroupedTasks = useCallback(() => {
    if (!debouncedSearchText.trim()) {
      return groupedTasks
    }

    const searchLower = debouncedSearchText.toLowerCase()
    return groupedTasks
      .map((group) => ({
        ...group,
        items: group.items.filter((task) => {
          const nameMatch = task.name.toLowerCase().includes(searchLower)
          const descMatch = task.description?.toLowerCase().includes(searchLower)
          const categoryMatch = categoryById(task.category)?.name?.toLowerCase().includes(searchLower)
          return nameMatch || descMatch || categoryMatch
        }),
      }))
      .filter((group) => group.items.length > 0)
  }, [debouncedSearchText, groupedTasks, categoryById])

  const displayedTasks = filteredGroupedTasks()
  const hasSearchResults = debouncedSearchText.trim().length === 0 || displayedTasks.length > 0
  const currentPage = pagesByVertical[selectedVertical] || 1
  const totalActivities = displayedTasks.reduce((total, group) => total + group.items.length, 0)
  const paginatedPages = useMemo(() => {
    const pages = []
    let currentPageGroups = []
    let currentPageItemCount = 0
    const visitGroupName = 'Industrial / Institutional / International Visit'

    const startNextPage = () => {
      if (currentPageGroups.length > 0) pages.push(currentPageGroups)
      currentPageGroups = []
      currentPageItemCount = 0
    }

    displayedTasks.forEach((group) => {
      if (group.activityName === visitGroupName) {
        currentPageGroups.push(group)
        currentPageItemCount += group.items.length
        return
      }

      let itemStart = 0
      while (itemStart < group.items.length) {
        if (currentPageItemCount === ACTIVITIES_PER_PAGE) startNextPage()
        const itemEnd = Math.min(itemStart + ACTIVITIES_PER_PAGE - currentPageItemCount, group.items.length)
        currentPageGroups.push({ ...group, items: group.items.slice(itemStart, itemEnd) })
        currentPageItemCount += itemEnd - itemStart
        itemStart = itemEnd
      }
    })

    startNextPage()
    return pages
  }, [displayedTasks])
  const totalPages = Math.max(1, paginatedPages.length)
  const safePage = Math.min(currentPage, totalPages)
  const paginatedGroups = paginatedPages[safePage - 1] || []

  function setCurrentPage(page) {
    setPagesByVertical((current) => ({ ...current, [selectedVertical]: page }))
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">STAR Tasks</h1>
          <p className="mt-1.5 text-sm text-slate-500">Select a vertical and submit supporting evidence for the next activity.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
        <div className="flex-1">
          <label className="mb-1.5 block font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Search</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search activities..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full rounded-lg border border-rule bg-white py-2 pl-9 pr-9 font-mono text-sm text-black placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className="w-full max-w-xs md:w-auto md:max-w-none">
          <label className="mb-1.5 block font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Vertical</label>
          <Select value={selectedVertical} onChange={(e) => setSelectedVertical(e.target.value)}>
            {verticalOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        </div>
      </div>

      <Card>
        <div className="border-b border-rule px-6 py-3">
          <div className="flex flex-wrap gap-2">
            {['Academic Performance', 'Co-curricular', 'Extension', 'Research'].map((tag) => (
              <span key={tag} className="rounded-full border border-rule bg-paper px-3 py-0.5 font-mono text-[11px] text-slate-500">{tag}</span>
            ))}
          </div>
        </div>

        <div className="px-6 py-2">
          <h2 className="border-t border-rule py-5 font-display text-lg font-semibold tracking-tight text-ink">{selectedVertical}</h2>
          {!hasSearchResults && (
            <div className="py-8">
              <EmptyState
                icon="🔍"
                title={`No activities found for "${debouncedSearchText}"`}
                description="Try a different keyword or clear the search."
              />
            </div>
          )}

          {hasSearchResults && paginatedGroups.map((group) => (
            <section key={group.key} className={group.activityName ? `mb-3 rounded-lg border px-4 ${ACTIVITY_GROUP_STYLES[group.activityName] || ''}` : undefined}>
              {group.heading && <h3 className="border-t border-rule py-4 font-display text-base font-semibold tracking-tight text-ink">{group.heading}</h3>}
              {group.items.length > 0 ? group.items.map((task) => {
                const category = CATEGORY_STYLES[activityCategory(task)] || CATEGORY_STYLES.skill
                return (
                  <div key={task.id} className={`mb-3 flex flex-col gap-4 rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-start sm:justify-between ${task.reuploadRequired ? 'border-rose-400 bg-rose-50' : task.onlineCertificationGroup === 'course' ? 'border-sky-200 bg-sky-50/70' : task.onlineCertificationGroup === 'professional' ? 'border-violet-200 bg-violet-50/70' : 'border-rule bg-card'}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${category.className}`}>
                          {category.label}
                        </span>
                        {task.deadline && (
                          <span className={`font-mono text-xs ${task.important ? 'font-medium text-amber-600' : 'text-slate-400'}`}>
                            {task.important && <span className="mr-1 uppercase tracking-[0.1em]">Important</span>}Due {new Date(task.deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className={`mt-2 font-display text-base font-semibold ${task.onlineCertificationGroup === 'course' ? 'text-sky-900' : task.onlineCertificationGroup === 'professional' ? 'text-violet-900' : 'text-ink'}`}>{task.name}</p>
                      {task.reuploadRequired && <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Re-upload Required</p>}
                      <p className="mt-1 text-sm leading-5 text-slate-500">{task.description}</p>
                      {task.onlineCertificationGroup ? (
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          {task.levels.map((level) => <p key={level.label}>{level.label} — {level.points} pts</p>)}
                        </div>
                      ) : task.splitTierCard ? (
                        <p className="tabular mt-1 font-mono text-xs text-slate-400">{task.tierLabel} — {task.maxPoints} pts</p>
                      ) : task.levels?.length > 0 ? (
                        <div className="mt-2 space-y-1 text-xs text-slate-500">
                          {task.levels.map((level, index) => (
                            <p key={`${task.id}-${level.label}`} className="tabular">
                              <span className="font-medium text-ink">Tier {index + 1}:</span> {level.label} — {level.points} pts
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="tabular mt-1 font-mono text-xs text-slate-400">Max {task.maxPoints} pts · Max {task.maxStarPct}% STAR</p>
                      )}
                    </div>
                    <Button onClick={() => openUpload(task)} className={`shrink-0 self-start ${task.reuploadRequired ? '!bg-rose-600 hover:!bg-rose-700' : ''}`}>{task.reuploadRequired ? 'Re-upload' : 'Upload'}</Button>
                  </div>
                )
              }) : null}
            </section>
          ))}

          {hasSearchResults && pendingTasks.length === 0 && debouncedSearchText.trim() === '' && (
            <div className="py-6">
              <EmptyState
                icon="★"
                title="All caught up"
                description="You've submitted evidence for every available task — new tasks will appear here."
              />
            </div>
          )}

          {hasSearchResults && totalActivities > ACTIVITIES_PER_PAGE && (
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-rule py-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentPage(Math.max(1, safePage - 1))} disabled={safePage <= 1}>
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <Button key={page} variant={page === safePage ? 'outline' : 'ghost'} size="sm" onClick={() => setCurrentPage(page)}>
                  {page}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}>
                Next
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
