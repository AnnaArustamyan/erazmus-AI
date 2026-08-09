import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileMenu } from './ProfileMenu'

const BASE_PROPS = {
  name: 'Nikita G.',
  email: 'n.gr@ngo-example.org',
  plan: 'pro',
  tokensUsed: 1_240_000,
  tokenLimit: 3_000_000,
  onSignOut: vi.fn(),
}

describe('ProfileMenu', () => {
  it('renders a closed trigger button with initials', () => {
    render(<ProfileMenu {...BASE_PROPS} />)
    const trigger = screen.getByRole('button', { name: /profile menu/i })
    expect(trigger).toHaveTextContent('NG')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens on click and shows name, email, plan, and token usage', async () => {
    const user = userEvent.setup()
    render(<ProfileMenu {...BASE_PROPS} />)

    await user.click(screen.getByRole('button', { name: /profile menu/i }))

    const menu = screen.getByRole('menu', { name: /account/i })
    expect(menu).toBeInTheDocument()
    expect(screen.getByText('Nikita G.')).toBeInTheDocument()
    expect(screen.getByText('n.gr@ngo-example.org')).toBeInTheDocument()
    expect(screen.getByText('Pro plan')).toBeInTheDocument()
    expect(screen.getByText('1,240,000 / 3,000,000 tokens')).toBeInTheDocument()

    const bar = screen.getByRole('progressbar', { name: /tokens used this billing period/i })
    expect(bar).toHaveAttribute('aria-valuenow', '1240000')
  })

  it('falls back to the email as the header when no name is set', async () => {
    const user = userEvent.setup()
    render(<ProfileMenu {...BASE_PROPS} name={null} />)

    const trigger = screen.getByRole('button', { name: /profile menu/i })
    expect(trigger).toHaveTextContent('N.')

    await user.click(trigger)
    expect(screen.getByText('n.gr@ngo-example.org')).toBeInTheDocument()
  })

  it('toggles closed when the trigger is clicked again', async () => {
    const user = userEvent.setup()
    render(<ProfileMenu {...BASE_PROPS} />)

    const trigger = screen.getByRole('button', { name: /profile menu/i })
    await user.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes when clicking outside', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <ProfileMenu {...BASE_PROPS} />
        <button type="button">Outside</button>
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /profile menu/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<ProfileMenu {...BASE_PROPS} />)

    await user.click(screen.getByRole('button', { name: /profile menu/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('calls onSignOut and closes the menu when Sign out is clicked', async () => {
    const user = userEvent.setup()
    const onSignOut = vi.fn()
    render(<ProfileMenu {...BASE_PROPS} onSignOut={onSignOut} />)

    await user.click(screen.getByRole('button', { name: /profile menu/i }))
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }))

    expect(onSignOut).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
