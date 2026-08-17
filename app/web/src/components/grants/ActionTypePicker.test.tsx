import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionTypePicker } from './ActionTypePicker'

describe('ActionTypePicker', () => {
  it('lets the user pick KA1 and KA2 actions', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ActionTypePicker onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: /KA121/i }))
    expect(onSelect).toHaveBeenCalledWith('KA121')

    expect(screen.getByRole('button', { name: /KA122/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /KA152-154/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /KA210/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /KA220/i })).toBeEnabled()
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })
})
