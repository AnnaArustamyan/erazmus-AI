import { useAuth } from '../../auth/AuthContext'

function formatTokens(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(value)))
}

export function UsagePage() {
  const { profile } = useAuth()
  if (!profile) return <p className="text-sm text-app-text-dim">Loading usage…</p>

  const features = profile.features
  const tokenPercent =
    profile.monthlyTokenLimit > 0
      ? Math.min(100, Math.round((profile.tokensUsed / profile.monthlyTokenLimit) * 100))
      : 100
  const docPercent =
    features.monthlyDocumentLimit > 0
      ? Math.min(
          100,
          Math.round((profile.documentsUsedThisMonth / features.monthlyDocumentLimit) * 100),
        )
      : 100

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Usage</h1>
      <p className="mb-5 text-sm text-app-text-dim">
        Free and paid use the same Erasmus+ pass-rate rules (Guide {profile.guideYear}). Paid
        unlocks a stronger model and higher limits — not the knowledge pack.
      </p>
      <dl className="grid max-w-lg gap-3 text-sm">
        <div className="rounded-xl border border-app-border bg-app-panel p-4">
          <dt className="text-app-text-dim">Plan</dt>
          <dd className="mt-1 font-semibold capitalize">{profile.plan}</dd>
        </div>
        <div className="rounded-xl border border-app-border bg-app-panel p-4">
          <dt className="text-app-text-dim">AI tier</dt>
          <dd className="mt-1 font-semibold">
            {features.aiTier === 'advanced' ? 'Advanced (Moonshot)' : 'Standard (OpenAI Luna)'}
          </dd>
        </div>
        <div className="rounded-xl border border-app-border bg-app-panel p-4">
          <dt className="text-app-text-dim">Tokens this month</dt>
          <dd className="mt-1 font-mono text-xs">
            {formatTokens(profile.tokensUsed)} / {formatTokens(profile.monthlyTokenLimit)}
          </dd>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-app-border">
            <div className="h-full bg-app-accent" style={{ width: `${tokenPercent}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-app-border bg-app-panel p-4">
          <dt className="text-app-text-dim">Application drafts this month</dt>
          <dd className="mt-1 font-mono text-xs">
            {profile.documentsUsedThisMonth} / {features.monthlyDocumentLimit}
          </dd>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-app-border">
            <div className="h-full bg-app-accent" style={{ width: `${docPercent}%` }} />
          </div>
        </div>
      </dl>
    </div>
  )
}
