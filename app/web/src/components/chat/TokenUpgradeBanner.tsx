/**
 * TokenUpgradeBanner — inline, dismissible upgrade CTA.
 *
 * Shows in two states:
 *  - "exhausted"  → tokens are at 0, input is blocked
 *  - "near-limit" → ≤10% remaining, user can still send but is close
 *
 * Never a blocking modal. Sits just above the composer so context is clear.
 * Dismissed state is per-session (in-memory) so it re-appears on next load
 * if the user hasn't upgraded.
 */
import { useState } from 'react'
import { X, Zap } from 'lucide-react'

interface TokenUpgradeBannerProps {
  /** 0–100 percent of quota used */
  usagePercent: number
  /** Tokens remaining */
  remaining: number
  /** Monthly limit */
  limit: number
  /** Called when the user clicks Upgrade */
  onUpgrade?: () => void
}

function formatRemaining(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`
  return String(tokens)
}

export function TokenUpgradeBanner({
  usagePercent,
  remaining,
  limit,
  onUpgrade,
}: TokenUpgradeBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  const isExhausted = remaining <= 0
  const isNearLimit = !isExhausted && usagePercent >= 90

  // Only render in the two trigger states
  if (dismissed || (!isExhausted && !isNearLimit)) return null

  const handleUpgrade = () => {
    onUpgrade?.()
    // Navigate to settings/usage if no handler provided
    if (!onUpgrade) {
      window.location.href = '/settings/usage'
    }
  }

  if (isExhausted) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="mx-auto mb-3 flex max-w-2xl items-start gap-3 rounded-xl border border-app-danger/30 bg-app-danger/8 px-4 py-3"
      >
        <Zap
          size={15}
          className="mt-0.5 shrink-0 text-app-danger"
          strokeWidth={2}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-app-danger">
            You've used all {formatRemaining(limit)} monthly tokens.
          </p>
          <p className="mt-0.5 text-xs text-app-text-dim">
            Upgrade to Basic for 500k tokens/month, a stronger AI model, and 20 application
            drafts instead of 3.
          </p>
          <button
            type="button"
            onClick={handleUpgrade}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-app-accent bg-app-accent px-3 py-1.5 text-xs font-semibold text-app-surface hover:opacity-90 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
          >
            <Zap size={11} strokeWidth={2.5} aria-hidden="true" />
            Upgrade plan
          </button>
        </div>
        <button
          type="button"
          aria-label="Dismiss upgrade prompt"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-0.5 text-app-text-dim hover:text-app-text"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  // Near-limit (≥90% used)
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto mb-3 flex max-w-2xl items-center gap-3 rounded-xl border border-app-warn/30 bg-app-warn-soft px-4 py-2.5"
    >
      <Zap
        size={13}
        className="shrink-0 text-app-warn"
        strokeWidth={2}
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 text-xs text-app-warn">
        <span className="font-medium">{formatRemaining(remaining)} tokens remaining.</span>{' '}
        Upgrade for more capacity and a stronger model.
      </p>
      <button
        type="button"
        onClick={handleUpgrade}
        className="shrink-0 text-xs font-semibold text-app-warn underline transition-colors duration-150 hover:text-app-text"
      >
        Upgrade
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-app-warn transition-colors duration-150 hover:text-app-text"
      >
        <X size={13} />
      </button>
    </div>
  )
}
