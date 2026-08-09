import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'

export interface ProfileMenuProps {
  name: string | null
  email: string
  plan: string
  tokensUsed: number
  tokenLimit: number
  onSignOut: () => void
}

function formatTokens(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(value)))
}

function getInitials(name: string | null, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    const first = parts[0]?.[0] ?? ''
    const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
    return (first + second).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function capitalize(value: string): string {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value
}

export function ProfileMenu({ name, email, plan, tokensUsed, tokenLimit, onSignOut }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const close = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) close()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, close])

  const usagePercent =
    tokenLimit > 0 ? Math.min(100, Math.round((tokensUsed / tokenLimit) * 100)) : 100
  const initials = getInitials(name, email)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label="Profile menu"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-accent-soft font-mono text-[10px] font-bold text-app-accent hover:opacity-85 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
      >
        {initials}
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-10 z-50 w-64 rounded-2xl border border-app-border bg-app-bg p-2 shadow-lg"
        >
          <div className="mb-2 flex items-center gap-2.5 border-b border-app-border px-2 pb-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-accent-soft font-mono text-xs font-bold text-app-accent">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-app-text">{name || email}</div>
              {name && <div className="truncate text-xs text-app-text-dim">{email}</div>}
            </div>
          </div>

          <div className="mb-2 rounded-lg bg-app-panel p-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-bold text-app-text">{capitalize(plan)} plan</span>
            </div>
            <div className="mb-1.5 font-mono text-[10.5px] text-app-text-dim">
              {formatTokens(tokensUsed)} / {formatTokens(tokenLimit)} tokens
            </div>
            <div
              role="progressbar"
              aria-label="Tokens used this billing period"
              aria-valuenow={tokensUsed}
              aria-valuemin={0}
              aria-valuemax={tokenLimit}
              className="h-1 w-full overflow-hidden rounded-full bg-app-border"
            >
              <div
                className="h-full rounded-full bg-app-accent"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close()
              onSignOut()
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-app-danger hover:bg-app-panel-2 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
          >
            <LogOut size={14} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default ProfileMenu
