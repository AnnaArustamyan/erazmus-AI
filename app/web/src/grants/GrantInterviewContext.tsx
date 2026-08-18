import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthContext'
import { createGrant, listGrants, updateGrant } from '../api/grantsClient'
import { QUESTION_GRAPHS } from '../lib/grants/banks'
import { factsFromAnswers } from '../lib/grants/facts'
import { flattenFormFields } from '../lib/grants/schemas/formSchemaToGraph'
import { ka153FormSchema } from '../lib/grants/schemas/ka153'
import { buildRequirementItems, completenessPercent, fieldsForAction } from '../lib/grants/gaps'
import { createId, loadGrants, saveGrants } from '../lib/grants/storage'
import {
  confirmedActionCode,
  isConfirmedAction,
  loadActiveGrantId,
  PENDING_ACTION,
  resolveActiveGrantId,
  saveActiveGrantId,
} from '../lib/grants/activeGrant'
import type { ApplicationFact, BuilderStep, GrantApplication } from '../lib/grants/types'

interface GrantInterviewValue {
  step: BuilderStep
  actionCode: string | null
  grantId: string | null
  activeGrant: GrantApplication | null
  path: string[]
  currentQuestionId: string | null
  answers: Record<string, string>
  seedText: string | null
  grants: GrantApplication[]
  isGenerating: boolean
  generateError: string | null
  setSeedText: (text: string | null) => void
  selectAction: (code: string, seedTitle?: string) => void
  answerField: (fieldId: string, value: string) => void
  answerCurrent: (value: string) => void
  goBack: () => void
  editAnswer: (questionId: string) => void
  setActiveGrant: (grantId: string) => void
  ensureActiveGrant: () => void
  startNewApplication: () => void
  linkConversation: (conversationId: string) => void
  resumeGrant: (grantId: string) => void
  reset: () => void
  completeWithDocument: (input: {
    contentMd: string
    documentId: string
    downloads?: GrantApplication['downloads']
  }) => void
  setGenerating: (value: boolean, error?: string | null) => void
}

const GrantInterviewContext = createContext<GrantInterviewValue | null>(null)

function factsFor(code: string, answers: Record<string, string>, existing: ApplicationFact[] = []): ApplicationFact[] {
  if (code !== 'KA153') return existing
  return factsFromAnswers(flattenFormFields(ka153FormSchema), answers, existing)
}

function isServerId(id: string): boolean {
  return !id.startsWith('grant_')
}

export function GrantInterviewProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth()
  const [grants, setGrants] = useState<GrantApplication[]>(() => loadGrants())
  const [step, setStep] = useState<BuilderStep>('picker')
  const [actionCode, setActionCode] = useState<string | null>(null)
  const [grantId, setGrantId] = useState<string | null>(() => loadActiveGrantId())
  const [path, setPath] = useState<string[]>([])
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [seedText, setSeedText] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(!accessToken)
  const grantIdRef = useRef(grantId)
  grantIdRef.current = grantId

  const persist = useCallback((next: GrantApplication[]) => {
    setGrants(next)
    saveGrants(next)
  }, [])

  const applyGrant = useCallback((grant: GrantApplication) => {
    const confirmed = confirmedActionCode(grant)
    setGrantId(grant.id)
    saveActiveGrantId(grant.id)
    setActionCode(confirmed)
    setAnswers(grant.answers ?? {})
    setGenerateError(null)
    if (!confirmed || !QUESTION_GRAPHS[confirmed]) {
      setStep('picker')
      setPath([])
      setCurrentQuestionId(null)
      return
    }
    const nextAnswers = grant.answers ?? {}
    setStep('workspace')
    setPath(Object.keys(nextAnswers).filter((id) => nextAnswers[id]?.trim()))
    setCurrentQuestionId(null)
  }, [])

  useEffect(() => {
    if (!accessToken) {
      const local = loadGrants()
      setGrants(local)
      const id = resolveActiveGrantId(local, loadActiveGrantId())
      const grant = id ? local.find((row) => row.id === id) : undefined
      if (grant) applyGrant(grant)
      setHydrated(true)
      return
    }
    let cancelled = false
    listGrants(accessToken)
      .then((remote) => {
        if (cancelled) return
        persist(remote)
        const current = grantIdRef.current
        const id =
          current && remote.some((row) => row.id === current)
            ? current
            : resolveActiveGrantId(remote, loadActiveGrantId())
        const grant = id ? remote.find((row) => row.id === id) : undefined
        if (grant) applyGrant(grant)
      })
      .catch(() => {
        if (!cancelled) setGrants(loadGrants())
      })
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, applyGrant, persist])

  const patchGrant = useCallback(
    (id: string, patch: Partial<GrantApplication>) => {
      const next = loadGrants().map((grant) =>
        grant.id === id ? { ...grant, ...patch, updatedAt: new Date().toISOString() } : grant,
      )
      persist(next)
      if (accessToken && isServerId(id)) {
        void updateGrant(accessToken, id, {
          title: patch.title,
          actionCode: patch.actionCode,
          answers: patch.answers,
          path: patch.path,
          facts: patch.facts,
          status: patch.status,
          percentComplete: patch.percentComplete,
          contentMd: patch.contentMd,
          documentId: patch.documentId ?? undefined,
          conversationId: patch.conversationId,
        }).catch(() => {
          /* local cache remains source until next refresh */
        })
      }
    },
    [accessToken, persist],
  )

  const replaceGrantId = useCallback((localId: string, saved: GrantApplication) => {
    persist(loadGrants().map((row) => (row.id === localId ? saved : row)))
    setGrantId((current) => {
      if (current !== localId) return current
      saveActiveGrantId(saved.id)
      return saved.id
    })
  }, [persist])

  const startNewApplication = useCallback(() => {
    const now = new Date().toISOString()
    const grant: GrantApplication = {
      id: createId('grant'),
      actionCode: PENDING_ACTION,
      title: 'Untitled application',
      status: 'draft',
      percentComplete: 0,
      answers: {},
      path: [],
      callYear: 2026,
      facts: [],
      actionConfirmed: false,
      createdAt: now,
      updatedAt: now,
    }
    persist([grant, ...loadGrants()])
    applyGrant(grant)
    setIsGenerating(false)
    if (accessToken) {
      void createGrant(accessToken, {
        title: grant.title,
        callYear: 2026,
        status: 'draft',
        percentComplete: 0,
      })
        .then((saved) => replaceGrantId(grant.id, saved))
        .catch(() => {
          /* keep the local draft */
        })
    }
  }, [accessToken, applyGrant, persist, replaceGrantId])

  const setActiveGrant = useCallback(
    (id: string) => {
      const grant = loadGrants().find((row) => row.id === id) ?? grants.find((row) => row.id === id)
      if (!grant) return
      applyGrant(grant)
    },
    [applyGrant, grants],
  )

  const ensureActiveGrant = useCallback(() => {
    if (!hydrated) return
    const current = grantIdRef.current
    if (current && (loadGrants().some((row) => row.id === current) || grants.some((row) => row.id === current))) {
      return
    }
    const id = resolveActiveGrantId(loadGrants().length ? loadGrants() : grants, loadActiveGrantId())
    if (id) {
      setActiveGrant(id)
      return
    }
    startNewApplication()
  }, [grants, hydrated, setActiveGrant, startNewApplication])

  const selectAction = useCallback(
    (code: string, seedTitle?: string) => {
      const graph = QUESTION_GRAPHS[code]
      if (!graph) return
      const current =
        (grantId && loadGrants().find((row) => row.id === grantId)) ||
        (grantId && grants.find((row) => row.id === grantId)) ||
        null
      const initialAnswers = seedText ? { [graph.startId]: seedText } : current?.answers ?? {}
      const now = new Date().toISOString()

      if (current && !isConfirmedAction(current)) {
        const next: GrantApplication = {
          ...current,
          actionCode: code,
          actionConfirmed: true,
          title: seedTitle?.trim() || current.title,
          answers: initialAnswers,
          path: [graph.startId],
          updatedAt: now,
        }
        persist(loadGrants().map((row) => (row.id === current.id ? next : row)))
        applyGrant(next)
        setSeedText(null)
        patchGrant(current.id, {
          actionCode: code,
          title: next.title,
          answers: initialAnswers,
          path: [graph.startId],
          status: 'draft',
        })
        return
      }

      const grant: GrantApplication = {
        id: createId('grant'),
        actionCode: code,
        title: seedTitle?.trim() || seedText?.slice(0, 60) || 'Untitled application',
        status: 'draft',
        percentComplete: 0,
        answers: initialAnswers,
        path: [graph.startId],
        callYear: 2026,
        facts: [],
        actionConfirmed: true,
        createdAt: now,
        updatedAt: now,
      }
      persist([grant, ...loadGrants()])
      applyGrant(grant)
      setSeedText(null)
      setGenerateError(null)

      if (accessToken) {
        void createGrant(accessToken, {
          actionCode: code,
          title: grant.title,
          answers: initialAnswers,
          path: [graph.startId],
          callYear: 2026,
          status: 'draft',
          percentComplete: 0,
        })
          .then((saved) => replaceGrantId(grant.id, saved))
          .catch(() => {
            /* keep the local draft */
          })
      }
    },
    [accessToken, applyGrant, grantId, grants, patchGrant, persist, replaceGrantId, seedText],
  )

  const answerField = useCallback(
    (fieldId: string, value: string) => {
      if (!actionCode || !grantId) return
      const graph = QUESTION_GRAPHS[actionCode]
      const nextAnswers = { ...answers, [fieldId]: value }
      const nextPath = Object.keys(nextAnswers).filter((id) => nextAnswers[id]?.trim())
      const existing = loadGrants().find((row) => row.id === grantId)
      const facts = factsFor(actionCode, nextAnswers, existing?.facts ?? [])
      const items = buildRequirementItems({
        fields: fieldsForAction(actionCode),
        answers: nextAnswers,
        facts,
      })
      const percent = completenessPercent(items)
      const requiredOpen = items.some((item) => item.required && item.status !== 'complete')
      setAnswers(nextAnswers)
      setPath(nextPath)
      setStep('workspace')
      const titleSource = graph?.startId === fieldId || fieldId === 'project.summary'
      patchGrant(grantId, {
        answers: nextAnswers,
        path: nextPath,
        facts,
        percentComplete: percent,
        title:
          titleSource && value.trim()
            ? value.trim().slice(0, 60)
            : existing?.title,
        status: requiredOpen ? 'draft' : 'in_review',
      })
    },
    [actionCode, answers, grantId, patchGrant],
  )

  const answerCurrent = useCallback(
    (value: string) => {
      if (!currentQuestionId) return
      answerField(currentQuestionId, value)
    },
    [answerField, currentQuestionId],
  )

  const goBack = useCallback(() => {
    if (path.length <= 1) return
    const nextPath = path.slice(0, -1)
    setPath(nextPath)
    setCurrentQuestionId(nextPath[nextPath.length - 1] ?? null)
    setStep('interview')
  }, [path])

  const editAnswer = useCallback(
    (questionId: string) => {
      const index = path.indexOf(questionId)
      if (index === -1) return
      setPath(path.slice(0, index + 1))
      setCurrentQuestionId(questionId)
      setStep('interview')
    },
    [path],
  )

  const resumeGrant = useCallback(
    (id: string) => {
      setActiveGrant(id)
    },
    [setActiveGrant],
  )

  const linkConversation = useCallback(
    (conversationId: string) => {
      const id = grantIdRef.current
      if (!id) return
      const current = loadGrants().find((row) => row.id === id)
      if (current?.conversationId === conversationId) return
      patchGrant(id, { conversationId })
    },
    [patchGrant],
  )

  const reset = useCallback(() => {
    startNewApplication()
  }, [startNewApplication])

  const completeWithDocument = useCallback(
    (input: {
      contentMd: string
      documentId: string
      downloads?: GrantApplication['downloads']
    }) => {
      if (!grantId || !actionCode) return
      patchGrant(grantId, {
        status: 'in_review',
        percentComplete: 100,
        contentMd: input.contentMd,
        documentId: input.documentId,
        downloads: input.downloads,
      })
      setStep('workspace')
      setIsGenerating(false)
    },
    [actionCode, grantId, patchGrant],
  )

  const setGenerating = useCallback((value: boolean, error: string | null = null) => {
    setIsGenerating(value)
    setGenerateError(error)
  }, [])

  const activeGrant = useMemo(
    () => grants.find((row) => row.id === grantId) ?? null,
    [grantId, grants],
  )

  const value = useMemo<GrantInterviewValue>(
    () => ({
      step,
      actionCode,
      grantId,
      activeGrant,
      path,
      currentQuestionId,
      answers,
      seedText,
      grants,
      isGenerating,
      generateError,
      setSeedText,
      selectAction,
      answerField,
      answerCurrent,
      goBack,
      editAnswer,
      setActiveGrant,
      ensureActiveGrant,
      startNewApplication,
      linkConversation,
      resumeGrant,
      reset,
      completeWithDocument,
      setGenerating,
    }),
    [
      actionCode,
      activeGrant,
      answerField,
      answerCurrent,
      answers,
      completeWithDocument,
      currentQuestionId,
      editAnswer,
      ensureActiveGrant,
      generateError,
      goBack,
      grantId,
      grants,
      isGenerating,
      linkConversation,
      path,
      reset,
      resumeGrant,
      selectAction,
      seedText,
      setActiveGrant,
      startNewApplication,
      step,
    ],
  )

  return <GrantInterviewContext.Provider value={value}>{children}</GrantInterviewContext.Provider>
}

export function useGrantInterview(): GrantInterviewValue {
  const value = useContext(GrantInterviewContext)
  if (!value) throw new Error('useGrantInterview must be used within GrantInterviewProvider')
  return value
}
