import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, ShieldAlert, AlertTriangle, Info, ChevronRight } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useGrantInterview } from '../grants/GrantInterviewContext'
import { confirmedActionCode } from '../lib/grants/activeGrant'
import { validateGrant, type GateStatus, type ValidationReport } from '../api/grantsClient'
import { requirementPath } from '../lib/grants/gaps'
import { Card } from '../components/ui/Card'

const GATE_LABELS: Record<string, string> = {
  schema: 'Schema',
  compliance: 'Compliance',
  consistency: 'Consistency',
  evidence: 'Evidence',
  quality: 'Quality',
}

const LEVEL_CONFIG = {
  critical: {
    icon: ShieldAlert,
    color: 'text-app-danger',
    bg: 'bg-app-danger/8 border-app-danger/30',
    label: 'Critical',
  },
  major: {
    icon: AlertTriangle,
    color: 'text-app-warn',
    bg: 'bg-app-warn-soft border-app-warn/30',
    label: 'Major',
  },
  minor: {
    icon: Info,
    color: 'text-app-text-dim',
    bg: 'bg-app-surface border-app-border',
    label: 'Minor',
  },
} as const

const GATE_STATUS_STYLE: Record<GateStatus, string> = {
  pass: 'bg-app-good-soft text-app-good',
  fail: 'bg-app-danger/10 text-app-danger',
  review: 'bg-app-warn-soft text-app-warn',
}

const GATE_STATUS_LABEL: Record<GateStatus, string> = {
  pass: 'Pass',
  fail: 'Fail',
  review: 'Review needed',
}

function GateRow({ label, status }: { label: string; status: GateStatus | undefined }) {
  if (!status) return null
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-app-text">{label}</span>
      <span
        className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${GATE_STATUS_STYLE[status]}`}
      >
        {GATE_STATUS_LABEL[status]}
      </span>
    </div>
  )
}

function FindingCard({
  finding,
  onGoToField,
}: {
  finding: ValidationReport['findings'][number]
  onGoToField: (fieldId: string) => void
}) {
  const cfg = LEVEL_CONFIG[finding.level] ?? LEVEL_CONFIG.minor
  const Icon = cfg.icon
  return (
    <div className={`rounded-lg border px-4 py-3 shadow-app-sm transition-all duration-150 ${cfg.bg}`}>
      <div className="flex items-start gap-2.5">
        <Icon size={15} className={`mt-0.5 shrink-0 ${cfg.color}`} strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-app-text-dim">·</span>
            <span className="text-[10px] uppercase tracking-wide text-app-text-dim">
              {GATE_LABELS[finding.gate] ?? finding.gate}
            </span>
          </div>
          <p className="mt-1 text-sm text-app-text">{finding.message}</p>
          {finding.suggestion && (
            <p className="mt-1 text-xs text-app-text-dim">{finding.suggestion}</p>
          )}
          {finding.location && (
            <button
              type="button"
              onClick={() => onGoToField(finding.location!)}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-app-accent hover:underline"
            >
              Fix this field
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function OnboardingNote({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Card className="py-4">
      <h2 className="text-sm font-semibold text-app-text">How Evaluate works</h2>
      <p className="mt-1.5 text-sm text-app-text-dim">
        We check your application against the structural rules, eligibility criteria, and evidence
        requirements for your action type.
      </p>
      <p className="mt-2 text-sm text-app-text-dim">
        You get a gate-by-gate status (pass/fail), a list of issues by severity, and pointers to
        the fields that need fixing.
      </p>
      <p className="mt-2 text-sm text-app-text-dim">
        <strong className="font-medium text-app-text">No percentage score.</strong> A number
        without calibration is read as a funding probability — which no tool can honestly give you.
        Gate pass/fail tells you exactly where your application stands.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 text-xs font-medium text-app-accent hover:underline"
      >
        Got it
      </button>
    </Card>
  )
}

const ONBOARDING_KEY = 'erasmus.evaluate.onboarding_seen'

export function EvaluatePage() {
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const { activeGrant } = useGrantInterview()

  const [report, setReport] = useState<ValidationReport | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem(ONBOARDING_KEY),
  )

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
  }, [])

  const runValidation = useCallback(async () => {
    if (!accessToken || !activeGrant?.id) return
    setIsRunning(true)
    setError(null)
    try {
      const result = await validateGrant(accessToken, activeGrant.id)
      setReport(result.report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed')
    } finally {
      setIsRunning(false)
    }
  }, [accessToken, activeGrant?.id])

  // Auto-run on mount if there's an active confirmed-action grant
  useEffect(() => {
    if (activeGrant && confirmedActionCode(activeGrant) && !report && !isRunning) {
      void runValidation()
    }
  }, [activeGrant?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleGoToField(fieldId: string) {
    navigate(requirementPath(fieldId))
  }

  // No active grant
  if (!activeGrant) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6">
        <ShieldCheck size={22} className="mb-3 text-app-text-dim" strokeWidth={1.75} />
        <h1 className="font-display text-lg font-semibold text-app-text">Evaluate</h1>
        <p className="mt-1.5 max-w-sm text-center text-sm text-app-text-dim">
          Start or open an application to run an evaluation. You'll get a gate-by-gate status and a
          list of issues to fix.
        </p>
        <button
          type="button"
          onClick={() => navigate('/grants/builder')}
          className="mt-5 rounded-lg border border-app-accent bg-app-accent px-3 py-2 text-sm font-medium text-app-surface shadow-app-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-app-md"
        >
          Open Application Form
        </button>
      </div>
    )
  }

  const actionCode = confirmedActionCode(activeGrant)

  // Action not confirmed yet
  if (!actionCode) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6">
        <ShieldCheck size={22} className="mb-3 text-app-text-dim" strokeWidth={1.75} />
        <h1 className="font-display text-lg font-semibold text-app-text">Evaluate</h1>
        <p className="mt-1.5 max-w-sm text-center text-sm text-app-text-dim">
          Confirm the action type in Application Form before running validation. The evaluator
          can't check rules it doesn't know apply.
        </p>
        <button
          type="button"
          onClick={() => navigate('/grants/builder')}
          className="mt-5 rounded-lg border border-app-accent bg-app-accent px-3 py-2 text-sm font-medium text-app-surface shadow-app-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-app-md"
        >
          Confirm action type
        </button>
      </div>
    )
  }

  const findings = report?.findings ?? []
  const critical = findings.filter((f) => f.level === 'critical')
  const major = findings.filter((f) => f.level === 'major')
  const minor = findings.filter((f) => f.level === 'minor')
  const gates = report?.readiness.gates
  // No status ever means fully "ready" yet — Quality (Layer D / Gate 5) isn't built.
  // "not_ready" means a blocking issue was found; otherwise deterministic checks are clean
  // but full readiness still depends on the Quality gate.
  const isBlocked = report?.readiness.status === 'not_ready'

  return (
    <div className="h-full overflow-y-auto px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-2xl space-y-5">
        {showOnboarding && <OnboardingNote onDismiss={dismissOnboarding} />}

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-dim">
              {actionCode} · {activeGrant.callYear ?? 2026}
            </p>
            <h1 className="mt-0.5 font-display text-lg font-semibold text-app-text">
              {activeGrant.title}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void runValidation()}
            disabled={isRunning}
            className="shrink-0 rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-sm text-app-text shadow-app-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-app-md hover:bg-app-panel disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
          >
            {isRunning ? 'Running…' : 'Re-run'}
          </button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-app-danger">
            {error}
          </p>
        )}

        {isRunning && !report && (
          <p className="text-sm text-app-text-dim">Checking your application…</p>
        )}

        {report && (
          <>
            {/* Status banner */}
            <div className="flex items-center gap-4 rounded-lg border border-app-border bg-app-surface px-5 py-4 shadow-app-md">
              <div className={`stamp ${isBlocked ? 'bad' : ''}`}>{isBlocked ? 'Not Ready' : 'Needs Review'}</div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-app-text">
                  {isBlocked ? 'Not ready' : 'Deterministic checks pass'}
                </p>
                {!isBlocked && (
                  <p className="mt-1 text-xs text-app-text-dim">
                    Quality scoring isn't available yet, so this can't be marked fully ready.
                  </p>
                )}
                {(critical.length > 0 || major.length > 0 || minor.length > 0) && (
                  <p className="mt-1 text-xs text-app-text-dim">
                    {critical.length > 0 && `🔴 ${critical.length} critical  `}
                    {major.length > 0 && `🟠 ${major.length} major  `}
                    {minor.length > 0 && `🟡 ${minor.length} minor`}
                  </p>
                )}
                <p className="mt-2 text-xs text-app-text-dim">
                  Ready means the draft satisfies known structural, compliance, and evidence
                  requirements for this action and programme year. It does not predict funding.
                </p>
              </div>
            </div>

            {/* Gate summary */}
            {gates && (
              <Card className="py-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-app-text-dim">
                  Gates
                </p>
                <GateRow label="Schema" status={gates.schema} />
                <GateRow label="Compliance" status={gates.compliance} />
                <GateRow label="Consistency" status={gates.consistency} />
                <GateRow label="Evidence" status={gates.evidence} />
                <GateRow label="Quality" status={gates.quality} />
              </Card>
            )}

            {/* Findings */}
            {findings.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-dim">
                  Issues
                </p>
                {[...critical, ...major, ...minor].map((f) => (
                  <FindingCard key={f.id} finding={f} onGoToField={handleGoToField} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-app-text-dim">
                No issues found. All deterministic checks passed.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
