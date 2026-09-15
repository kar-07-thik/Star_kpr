import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, Toast, StatusBadge, ConfirmDialog, EmptyState } from '../UI.jsx'

describe('Button', () => {
  it('renders children and default primary variant', () => {
    render(<Button>Save</Button>)
    const button = screen.getByRole('button', { name: /save/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('bg-brand-600')
  })

  it('is disabled while loading', () => {
    render(<Button loading>Save</Button>)
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })

  it('applies danger variant class', () => {
    render(<Button variant="danger">Delete</Button>)
    expect(screen.getByRole('button', { name: /delete/i })).toHaveClass('bg-rose-500')
  })
})

describe('Toast', () => {
  it('shows the message and calls onDismiss', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    render(<Toast message="Saved successfully" onDismiss={onDismiss} />)
    expect(screen.getByText(/saved successfully/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('StatusBadge', () => {
  it.each(['Pending', 'Approved', 'Rejected', 'FacultyApproved', 'HODRejected'])('renders %s without crashing', (status) => {
    render(<StatusBadge status={status} />)
    expect(screen.getByText(status)).toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ConfirmDialog open={false} onClose={() => {}} title="Delete" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders title, message and confirm button when open', () => {
    render(<ConfirmDialog open onClose={() => {}} onConfirm={() => {}} title="Delete user" message="Are you sure?" confirmLabel="Delete" />)
    expect(screen.getByText('Delete user')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('triggers onConfirm and onClose actions', async () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ConfirmDialog open onClose={onClose} onConfirm={onConfirm} title="Delete user" confirmLabel="Delete" />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="Nothing here" description="Try again later" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(screen.getByText('Try again later')).toBeInTheDocument()
  })
})
