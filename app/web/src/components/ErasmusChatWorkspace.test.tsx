import type { ComponentProps } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ErasmusChatWorkspace,
  DEFAULT_AGENTS,
} from './ErasmusChatWorkspace'
import type { ConversationSummary, SendMessageFn } from './ErasmusChatWorkspace.types'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function renderWorkspace(
  props: Partial<ComponentProps<typeof ErasmusChatWorkspace>> = {},
) {
  return render(<ErasmusChatWorkspace {...props} />)
}

describe('ErasmusChatWorkspace — rendering', () => {
  it('renders the brand, all four agent tabs, and marks the first agent active', () => {
    renderWorkspace()

    expect(screen.getByText('Erasmus AI')).toBeInTheDocument()

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    expect(tabs.map((tab) => tab.textContent)).toEqual(
      DEFAULT_AGENTS.map((agent) => agent.name),
    )

    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('tabindex', '0')
    tabs.slice(1).forEach((tab) => {
      expect(tab).toHaveAttribute('aria-selected', 'false')
      expect(tab).toHaveAttribute('tabindex', '-1')
    })
  })

  it('renders the active agent pill matching the default agent', () => {
    renderWorkspace()
    expect(screen.getByTestId('active-agent-pill')).toHaveTextContent(
      'Compliance Officer',
    )
  })

  it('renders the token balance with progressbar and formatted counts', () => {
    renderWorkspace()
    const group = screen.getByRole('group', { name: /token balance/i })
    expect(within(group).getByText('0 / 3,000,000')).toBeInTheDocument()

    const bar = screen.getByRole('progressbar', {
      name: /tokens used this billing period/i,
    })
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '3000000')
  })

  it('renders the theme toggle with dark active by default', () => {
    renderWorkspace()
    expect(screen.getByRole('button', { name: /dark theme/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /light theme/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('renders the composer and a disabled send button when the draft is empty', () => {
    renderWorkspace()
    expect(
      screen.getByRole('textbox', { name: /message compliance officer/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
  })

  it('renders an empty-state prompt when there are no messages', () => {
    renderWorkspace()
    expect(
      screen.getByText(/ask compliance officer about your erasmus\+ application/i),
    ).toBeInTheDocument()
  })
})

describe('ErasmusChatWorkspace — agent switching', () => {
  it('switches the active agent on click and notifies onAgentChange', async () => {
    const user = userEvent.setup()
    const onAgentChange = vi.fn()
    renderWorkspace({ onAgentChange })

    await user.click(screen.getByRole('tab', { name: 'Budget Agent' }))

    expect(onAgentChange).toHaveBeenCalledWith('budget')
    expect(screen.getByRole('tab', { name: 'Budget Agent' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Compliance Officer' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
    expect(screen.getByTestId('active-agent-pill')).toHaveTextContent('Budget Agent')
    expect(
      screen.getByRole('textbox', { name: /message budget agent/i }),
    ).toBeInTheDocument()
  })

  it('navigates and selects tabs with arrow keys, wrapping at the edges', () => {
    renderWorkspace()
    const tabs = screen.getAllByRole('tab')

    tabs[0].focus()
    expect(tabs[0]).toHaveFocus()

    fireEvent.keyDown(tabs[0], { key: 'ArrowDown' })
    expect(tabs[1]).toHaveFocus()
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(tabs[1], { key: 'End' })
    expect(tabs[3]).toHaveFocus()
    expect(tabs[3]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(tabs[3], { key: 'ArrowRight' })
    expect(tabs[0]).toHaveFocus()
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(tabs[0], { key: 'Home' })
    expect(tabs[0]).toHaveFocus()
  })
})

describe('ErasmusChatWorkspace — message dispatching', () => {
  it('sends a message on button click, shows a pending state, then renders the reply', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<string>()
    const sendMessage = vi.fn<SendMessageFn>(() => deferred.promise)
    const onTokenBalanceChange = vi.fn()

    renderWorkspace({ sendMessage, onTokenBalanceChange })

    const textbox = screen.getByRole('textbox', { name: /message compliance officer/i })
    await user.type(textbox, 'What are the eligible countries for KA2?')
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(
      screen.getByText('What are the eligible countries for KA2?'),
    ).toBeInTheDocument()
    expect(textbox).toHaveValue('')
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
    expect(screen.getByText(/compliance officer is thinking/i)).toBeInTheDocument()
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'What are the eligible countries for KA2?',
        agentId: 'compliance',
      }),
      expect.any(Function),
    )

    deferred.resolve('Here are the eligible KA2 countries…')

    expect(
      await screen.findByText('Here are the eligible KA2 countries…'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/compliance officer is thinking/i)).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: /token balance/i })).toHaveTextContent(
      '500 / 3,000,000',
    )
    expect(onTokenBalanceChange).toHaveBeenCalledWith({ used: 500, limit: 3_000_000 })
  })

  it('sends a message when pressing Enter, and inserts a newline on Shift+Enter', async () => {
    const user = userEvent.setup()
    const sendMessage = vi.fn<SendMessageFn>().mockResolvedValue('ok')
    renderWorkspace({ sendMessage })

    const textbox = screen.getByRole('textbox', { name: /message compliance officer/i })
    await user.type(textbox, 'line one{Shift>}{Enter}{/Shift}line two')
    expect(textbox).toHaveValue('line one\nline two')
    expect(sendMessage).not.toHaveBeenCalled()

    await user.type(textbox, '{Enter}')
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(textbox).toHaveValue('')
  })

  it('does not send an empty or whitespace-only message', async () => {
    const user = userEvent.setup()
    const sendMessage = vi.fn<SendMessageFn>().mockResolvedValue('ok')
    renderWorkspace({ sendMessage })

    const sendButton = screen.getByRole('button', { name: /send message/i })
    expect(sendButton).toBeDisabled()

    const textbox = screen.getByRole('textbox', { name: /message compliance officer/i })
    await user.type(textbox, '   ')
    expect(sendButton).toBeDisabled()

    await user.type(textbox, '{Enter}')
    expect(sendMessage).not.toHaveBeenCalled()
    expect(
      screen.getByText(/ask compliance officer about your erasmus\+ application/i),
    ).toBeInTheDocument()
  })

  it('shows an error banner and a retry action when the network request fails, then recovers on retry', async () => {
    const user = userEvent.setup()
    const sendMessage = vi
      .fn<SendMessageFn>()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce('Recovered reply from the compliance agent.')

    renderWorkspace({ sendMessage })

    const textbox = screen.getByRole('textbox', { name: /message compliance officer/i })
    await user.type(textbox, 'Check section D please')
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Network request failed',
    )
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(
      screen.queryByText('Recovered reply from the compliance agent.'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry/i }))

    expect(
      await screen.findByText('Recovered reply from the compliance agent.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
    expect(sendMessage).toHaveBeenCalledTimes(2)
  })
})

describe('ErasmusChatWorkspace — streaming', () => {
  it('renders each delta as it arrives, before the promise resolves', async () => {
    const user = userEvent.setup()
    let deliverDeltas!: () => void
    const sendMessage = vi.fn<SendMessageFn>((_, onDelta) => {
      const gate = new Promise<void>((resolve) => {
        deliverDeltas = () => {
          onDelta?.('Hello')
          onDelta?.(' world')
          resolve()
        }
      })
      return gate.then(() => 'Hello world')
    })

    renderWorkspace({ sendMessage })

    const textbox = screen.getByRole('textbox', { name: /message compliance officer/i })
    await user.type(textbox, 'Stream this please')
    await user.click(screen.getByRole('button', { name: /send message/i }))

    deliverDeltas()

    expect(await screen.findByText('Hello world')).toBeInTheDocument()
  })

  it('drops the placeholder assistant bubble if the stream errors out mid-flight', async () => {
    const user = userEvent.setup()
    const sendMessage = vi.fn<SendMessageFn>((_, onDelta) => {
      onDelta?.('Partial')
      return Promise.reject(new Error('Connection lost'))
    })

    renderWorkspace({ sendMessage })

    const textbox = screen.getByRole('textbox', { name: /message compliance officer/i })
    await user.type(textbox, 'Will this fail?')
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost')
    expect(screen.queryByText('Partial')).not.toBeInTheDocument()
  })
})

describe('ErasmusChatWorkspace — attachments', () => {
  it('hides the attach button when uploadFile is omitted', () => {
    renderWorkspace()
    expect(screen.queryByRole('button', { name: /attach file/i })).not.toBeInTheDocument()
  })

  it('uploads a selected file and shows a pending chip, then lets it be removed', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<{ path: string; name: string }>()
    const uploadFile = vi.fn(() => deferred.promise)
    renderWorkspace({ uploadFile })

    const file = new File(['hello'], 'budget.pdf', { type: 'application/pdf' })
    const input = screen.getByTestId('attachment-input')
    await user.upload(input, file)

    expect(uploadFile).toHaveBeenCalledWith(file)
    expect(screen.getByText(/uploading/i)).toBeInTheDocument()

    deferred.resolve({ path: 'user-1/abc-budget.pdf', name: 'budget.pdf' })
    expect(await screen.findByText('budget.pdf')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /remove attachment "budget\.pdf"/i }))
    expect(screen.queryByText('budget.pdf')).not.toBeInTheDocument()
  })

  it('shows an error banner when the upload fails', async () => {
    const user = userEvent.setup()
    const uploadFile = vi.fn().mockRejectedValue(new Error('File too large'))
    renderWorkspace({ uploadFile })

    const file = new File(['x'], 'huge.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByTestId('attachment-input'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent('File too large')
  })

  it('sends a pending attachment with the message and renders it on the sent bubble', async () => {
    const user = userEvent.setup()
    const uploadFile = vi.fn().mockResolvedValue({ path: 'user-1/abc-plan.pdf', name: 'plan.pdf' })
    const sendMessage = vi.fn<SendMessageFn>().mockResolvedValue('Got the file, thanks.')
    renderWorkspace({ uploadFile, sendMessage })

    await user.upload(
      screen.getByTestId('attachment-input'),
      new File(['x'], 'plan.pdf', { type: 'application/pdf' }),
    )
    expect(await screen.findByText('plan.pdf')).toBeInTheDocument()

    await user.type(
      screen.getByRole('textbox', { name: /message compliance officer/i }),
      'Review this please',
    )
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Review this please',
        attachment: { path: 'user-1/abc-plan.pdf', name: 'plan.pdf' },
      }),
      expect.any(Function),
    )
    // Chip now belongs to the sent message, not the (cleared) composer.
    const composerForm = screen.getByRole('textbox', { name: /message compliance officer/i }).closest('form')
    expect(within(composerForm as HTMLElement).queryByText('plan.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('plan.pdf')).toBeInTheDocument()
  })

  it('allows sending a file with no text at all', async () => {
    const user = userEvent.setup()
    const uploadFile = vi.fn().mockResolvedValue({ path: 'user-1/abc-scan.png', name: 'scan.png' })
    const sendMessage = vi.fn<SendMessageFn>().mockResolvedValue('Received.')
    renderWorkspace({ uploadFile, sendMessage })

    await user.upload(
      screen.getByTestId('attachment-input'),
      new File(['x'], 'scan.png', { type: 'image/png' }),
    )
    await screen.findByText('scan.png')

    const sendButton = screen.getByRole('button', { name: /send message/i })
    expect(sendButton).toBeEnabled()
    await user.click(sendButton)

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: '', attachment: { path: 'user-1/abc-scan.png', name: 'scan.png' } }),
      expect.any(Function),
    )
  })
})

describe('ErasmusChatWorkspace — token exhaustion guard', () => {
  it('disables the composer and blocks sending when the token quota is at zero', async () => {
    const user = userEvent.setup()
    const sendMessage = vi.fn<SendMessageFn>().mockResolvedValue('should not be called')

    renderWorkspace({
      sendMessage,
      tokenBalance: { used: 100_000, limit: 100_000 },
    })

    const textbox = screen.getByRole('textbox', { name: /message compliance officer/i })
    expect(textbox).toBeDisabled()
    expect(textbox).toHaveAttribute(
      'placeholder',
      'Token quota exhausted — upgrade to continue',
    )

    const sendButton = screen.getByRole('button', { name: /send message/i })
    expect(sendButton).toBeDisabled()

    await user.click(sendButton)
    expect(sendMessage).not.toHaveBeenCalled()

    expect(screen.getByRole('alert')).toHaveTextContent(/upgrade your plan/i)
  })
})

describe('ErasmusChatWorkspace — theme switching', () => {
  it('defaults to dark theme on the workspace root', () => {
    renderWorkspace()
    expect(screen.getByTestId('erasmus-chat-workspace')).toHaveAttribute(
      'data-theme',
      'dark',
    )
  })

  it('switches to light theme on click and calls onThemeChange', async () => {
    const user = userEvent.setup()
    const onThemeChange = vi.fn()
    renderWorkspace({ onThemeChange })

    await user.click(screen.getByRole('button', { name: /light theme/i }))

    expect(screen.getByTestId('erasmus-chat-workspace')).toHaveAttribute(
      'data-theme',
      'light',
    )
    expect(screen.getByRole('button', { name: /light theme/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /dark theme/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(onThemeChange).toHaveBeenCalledWith('light')
  })

  it('honors an initialTheme prop of light', () => {
    renderWorkspace({ initialTheme: 'light' })
    expect(screen.getByTestId('erasmus-chat-workspace')).toHaveAttribute(
      'data-theme',
      'light',
    )
  })
})

describe('ErasmusChatWorkspace — conversation history', () => {
  const CONVERSATIONS: ConversationSummary[] = [
    { id: 'c1', agentId: 'compliance', title: 'KA2 partnership check' },
    { id: 'c2', agentId: 'budget', title: 'Travel band calculation' },
  ]

  it('hides the history section entirely when the conversations prop is omitted', () => {
    renderWorkspace()
    expect(screen.queryByRole('list', { name: /conversation history/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new chat/i })).not.toBeInTheDocument()
  })

  it('renders an empty-history message when conversations is an empty array', () => {
    renderWorkspace({ conversations: [] })
    expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument()
    expect(screen.getByText(/no previous chats yet/i)).toBeInTheDocument()
  })

  it('renders each conversation and marks the active one', () => {
    renderWorkspace({ conversations: CONVERSATIONS, activeConversationId: 'c2' })

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(screen.getByText('KA2 partnership check')).toBeInTheDocument()
    expect(screen.getByText('Travel band calculation')).toBeInTheDocument()

    const activeButton = screen.getByRole('button', { name: 'Travel band calculation' })
    expect(activeButton).toHaveAttribute('aria-current', 'true')
    const inactiveButton = screen.getByRole('button', { name: 'KA2 partnership check' })
    expect(inactiveButton).not.toHaveAttribute('aria-current')
  })

  it('calls onSelectConversation when a history item is clicked', async () => {
    const user = userEvent.setup()
    const onSelectConversation = vi.fn()
    renderWorkspace({ conversations: CONVERSATIONS, onSelectConversation })

    await user.click(screen.getByRole('button', { name: 'Travel band calculation' }))
    expect(onSelectConversation).toHaveBeenCalledWith('c2')
  })

  it('calls onDeleteConversation without triggering onSelectConversation', async () => {
    const user = userEvent.setup()
    const onSelectConversation = vi.fn()
    const onDeleteConversation = vi.fn()
    renderWorkspace({ conversations: CONVERSATIONS, onSelectConversation, onDeleteConversation })

    await user.click(screen.getByRole('button', { name: /delete "ka2 partnership check"/i }))
    expect(onDeleteConversation).toHaveBeenCalledWith('c1')
    expect(onSelectConversation).not.toHaveBeenCalled()
  })

  it('calls onNewChat when the New chat button is clicked', async () => {
    const user = userEvent.setup()
    const onNewChat = vi.fn()
    renderWorkspace({ conversations: CONVERSATIONS, onNewChat })

    await user.click(screen.getByRole('button', { name: /new chat/i }))
    expect(onNewChat).toHaveBeenCalledTimes(1)
  })
})
