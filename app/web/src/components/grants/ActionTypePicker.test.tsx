import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionTypePicker } from './ActionTypePicker'

describe('ActionTypePicker', () => {
  it('only enables actions with a reviewed schema in the manifest (KA153 today)', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ActionTypePicker onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: /KA153/i }))
    expect(onSelect).toHaveBeenCalledWith('KA153')

    expect(screen.getByRole('button', { name: /KA153/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /KA121/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /KA122/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /KA152/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /KA154/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /KA210/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /KA220/i })).toBeDisabled()
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThanOrEqual(6)
  })
})
