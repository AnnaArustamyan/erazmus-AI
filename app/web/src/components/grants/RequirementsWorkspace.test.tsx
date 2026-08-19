import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequirementsWorkspace } from './RequirementsWorkspace'
import type { RequirementItem } from '../../lib/grants/gaps'

const items: RequirementItem[] = [
  {
    fieldId: 'relevance.objectives',
    label: 'Objectives',
    section: 'Relevance',
    status: 'missing',
    issues: ['This field is required.'],
    required: true,
    source: 'schema',
  },
  {
    fieldId: 'organisations.applicant',
    label: 'Applicant organisation',
    section: 'Relevance',
    status: 'complete',
    issues: [],
    required: true,
    source: 'schema',
  },
  {
    fieldId: 'participants.number',
    label: 'Number of participants',
    section: 'Quality of project design',
    status: 'proposed',
    issues: ['AI suggestion · Confirm or change'],
    required: true,
    source: 'proposal',
    proposedValue: '2 learners',
  },
]

describe('RequirementsWorkspace', () => {
  it('lets the user open any gap, not only the first unanswered field', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<RequirementsWorkspace actionCode="KA153" callYear={2026} items={items} onOpen={onOpen} />)

    expect(screen.getByText(/1 of 3 required fields complete/i)).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /objectives/i })[0])
    expect(onOpen).toHaveBeenCalledWith('relevance.objectives')

    await user.click(screen.getAllByRole('button', { name: /number of participants/i })[0])
    expect(onOpen).toHaveBeenCalledWith('participants.number')
  })

  it('lets the user confirm a proposed value without opening the editor', async () => {
    const user = userEvent.setup()
    const onConfirmProposal = vi.fn()
    render(
      <RequirementsWorkspace
        actionCode="KA121"
        callYear={2026}
        items={items}
        onOpen={vi.fn()}
        onConfirmProposal={onConfirmProposal}
      />,
    )
    await user.click(screen.getAllByRole('button', { name: /^confirm$/i })[0])
    expect(onConfirmProposal).toHaveBeenCalledWith('participants.number', '2 learners')
  })
})
