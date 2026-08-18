import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useGrantInterview } from '../grants/GrantInterviewContext'
import { generateProjectPlan } from '../api/plansClient'
import { DraftNotReadyError } from '../api/http'
import { createId, loadPlans, savePlans } from '../lib/grants/storage'
import type { ProjectPlan } from '../lib/grants/types'
import { ProjectPlanDocument } from '../components/generator/ProjectPlanDocument'

export function GeneratorPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const setSeedText = useGrantInterview().setSeedText
  const [plans, setPlans] = useState<ProjectPlan[]>(() => loadPlans())
  const [activeId, setActiveId] = useState<string | null>(plans[0]?.id ?? null)
  const [prompt, setPrompt] = useState('')
  const [refineText, setRefineText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notReady, setNotReady] = useState<{ gaps: string[]; knownFacts: string[] } | null>(null)

  const activePlan = plans.find((plan) => plan.id === activeId) ?? null

  useEffect(() => {
    if ((location.state as { reset?: boolean } | null)?.reset) {
      setActiveId(null)
      setPrompt('')
      setError(null)
      setNotReady(null)
      navigate('/generator', { replace: true, state: {} })
    }
  }, [location.state, navigate])

  async function handleGenerate(source: string) {
    if (!source.trim()) return
    setIsGenerating(true)
    setError(null)
    setNotReady(null)
    try {
      const result = await generateProjectPlan(accessToken, source.trim())
      const plan: ProjectPlan = {
        id: createId('plan'),
        title: result.title,
        contentMd: result.contentMd ?? '',
        sourcePrompt: source.trim(),
        documentId: result.id,
        downloads: result.downloads,
        createdAt: result.createdAt,
        updatedAt: result.createdAt,
      }
      const next = [plan, ...loadPlans()]
      savePlans(next)
      setPlans(next)
      setActiveId(plan.id)
      setPrompt('')
      setRefineText('')
    } catch (err) {
      if (err instanceof DraftNotReadyError) {
        setPrompt(source)
        setNotReady({ gaps: err.gaps, knownFacts: err.knownFacts })
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Could not generate the plan')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  function handleTurnIntoGrant() {
    const seed = activePlan?.contentMd.split('\n').slice(0, 8).join('\n') || prompt
    if (!seed.trim()) return
    setSeedText(seed)
    navigate('/grants/builder')
  }

  if (isGenerating && !activePlan) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-app-text-dim">
        Drafting your project plan…
      </div>
    )
  }

  if (!activePlan) {
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto px-6 py-10">
        <div className="w-full max-w-2xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center bg-app-accent-soft text-app-accent">
              <Sparkles size={22} strokeWidth={1.75} />
            </div>
            <h1 className="font-display text-lg font-semibold text-app-text">
              Describe the project you have in mind
            </h1>
            <p className="mt-1.5 text-sm text-app-text-dim">
              Include the occupational field, who takes part, one specific need, hosts, and what
              people will do. If that is missing we will not invent a PDF — we will tell you what
              to add.
            </p>
          </div>
          <textarea
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Who is applying, who takes part and how many, the specific problem (not a slogan), where, and what they will physically do…"
            className="w-full border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
          {notReady && (
            <div role="alert" className="mt-4 border border-app-danger/40 bg-app-surface px-4 py-3">
              <p className="text-sm font-medium text-app-danger">{error}</p>
              {notReady.knownFacts.length > 0 && (
                <p className="mt-2 text-xs text-app-text-dim">
                  Known so far: {notReady.knownFacts.join(' · ')}
                </p>
              )}
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-app-text">
                {notReady.gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleTurnIntoGrant}
                className="mt-4 text-sm text-app-accent underline"
              >
                Continue in Requirements instead
              </button>
            </div>
          )}
          {error && !notReady && (
            <p role="alert" className="mt-3 text-xs text-app-danger">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => void handleGenerate(prompt)}
              disabled={!prompt.trim() || isGenerating}
              className="border border-app-accent bg-app-accent px-4 py-2 text-sm font-medium text-app-surface disabled:opacity-40"
            >
              Generate plan
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8">
        <ProjectPlanDocument plan={activePlan} onTurnIntoGrant={handleTurnIntoGrant} />
      </div>
      <div className="border-t border-app-border bg-app-bg px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleGenerate(`${activePlan.sourcePrompt}\n\nRevise: ${refineText}`)}
            placeholder="Add a missing fact or ask to revise a section…"
            disabled={isGenerating}
            className="min-w-0 flex-1 border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void handleGenerate(`${activePlan.sourcePrompt}\n\nRevise: ${refineText}`)}
            disabled={!refineText.trim() || isGenerating}
            className="border border-app-border px-3 py-2 text-sm text-app-text disabled:opacity-40"
          >
            {isGenerating ? 'Updating…' : 'Update'}
          </button>
        </div>
        {error && (
          <p role="alert" className="mx-auto mt-2 max-w-3xl text-xs text-app-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
