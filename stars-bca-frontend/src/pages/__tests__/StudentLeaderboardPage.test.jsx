import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import StudentLeaderboardPage from '../StudentLeaderboardPage.jsx'
import { getStudentLeaderboard } from '../../utils/api.js'

vi.mock('../../utils/api.js', () => ({
  getStudentLeaderboard: vi.fn(),
}))

describe('StudentLeaderboardPage', () => {
  beforeEach(() => {
    localStorage.setItem('stars_user', JSON.stringify({ _id: 'user-2', name: 'Asha' }))
    vi.clearAllMocks()
  })

  it('renders summary cards and the top 3 podium from a populated leaderboard response', async () => {
    getStudentLeaderboard.mockResolvedValue({
      data: {
        currentStudent: { rank: 2, totalApprovedPoints: 320 },
        topThree: [
          { rank: 1, name: 'Nina', regNo: 'REG-001', department: 'Computer Science', totalApprovedPoints: 420, avatarInitial: 'N' },
          { rank: 2, name: 'Asha', regNo: 'REG-002', department: 'Computer Science', totalApprovedPoints: 320, avatarInitial: 'A', isCurrentUser: true },
          { rank: 3, name: 'Ravi', regNo: 'REG-003', department: 'Mathematics', totalApprovedPoints: 280, avatarInitial: 'R' },
        ],
        fullList: [
          { rank: 1, name: 'Nina', regNo: 'REG-001', department: 'Computer Science', totalApprovedPoints: 420, isCurrentUser: false },
          { rank: 2, name: 'Asha', regNo: 'REG-002', department: 'Computer Science', totalApprovedPoints: 320, isCurrentUser: true },
          { rank: 3, name: 'Ravi', regNo: 'REG-003', department: 'Mathematics', totalApprovedPoints: 280, isCurrentUser: false },
        ],
      },
    })

    render(<StudentLeaderboardPage />)

    await waitFor(() => expect(getStudentLeaderboard).toHaveBeenCalledTimes(1))

    expect(await screen.findByText(/your rank/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/approved points/i)).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Nina').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Asha').length).toBeGreaterThan(0)
    expect(screen.getAllByText('You').length).toBeGreaterThan(0)
  })

  it('shows the empty state only when the API returns no leaderboard entries', async () => {
    getStudentLeaderboard.mockResolvedValue({
      data: {
        currentStudent: null,
        topThree: [],
        fullList: [],
      },
    })

    render(<StudentLeaderboardPage />)

    expect(await screen.findByText(/no leaderboard data yet/i)).toBeInTheDocument()
  })
})
