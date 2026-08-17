import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { QUESTION_GRAPHS } from '../lib/grants/banks'
import { buildPathFromAnswers, computeProgress, resolveNext } from '../lib/grants/grantGraph'
import { createId, loadGrants, saveGrants } from '../lib/grants/storage'
import type { BuilderStep, GrantApplication } from '../lib/grants/types'

interface GrantInterviewValue {
  step: BuilderStep
  actionCode: string | null
  grantId: string | null
  path: string[]
  currentQuestionId: string | null
  answers: Record<string, string>
  seedText: string | null
  grants: GrantApplication[]
  isGenerating: boolean
  generateError: string | null
  setSeedText: (text: string | null) => void
  selectAction: (code: string, seedTitle?: string) => void
  answerCurrent: (value: string) => void
  goBack: () => void
  editAnswer: (questionId: string) => void
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

export function GrantInterviewProvider({ children }: { children: ReactNode }) {
  const [grants, setGrants] = useState<GrantApplication[]>(() => loadGrants())
  const [step, setStep] = useState<BuilderStep>('picker')
  const [actionCode, setActionCode] = useState<string | null>(null)
  const [grantId, setGrantId] = useState<string | null>(null)
  const [path, setPath] = useState<string[]>([])
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [seedText, setSeedText] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const persist = useCallback((next: GrantApplication[]) => {
    setGrants(next)
    saveGrants(next)
  }, [])

  const patchGrant = useCallback(
    (id: string, patch: Partial<GrantApplication>) => {
      persist(
        loadGrants().map((grant) =>
          grant.id === id ? { ...grant, ...patch, updatedAt: new Date().toISOString() } : grant,
        ),
      )
    },
    [persist],
  )

  const selectAction = useCallback(
    (code: string, seedTitle?: string) => {
      const graph = QUESTION_GRAPHS[code]
      if (!graph) return
      const initialAnswers = seedText ? { [graph.startId]: seedText } : {}
      const now = new Date().toISOString()
      const grant: GrantApplication = {
        id: createId('grant'),
        actionCode: code,
        title: seedTitle?.trim() || seedText?.slice(0, 60) || 'Untitled application',
        status: 'draft',
        percentComplete: 0,
        answers: initialAnswers,
        createdAt: now,
        updatedAt: now,
      }
      persist([grant, ...loadGrants()])
      setStep('interview')
      setActionCode(code)
      setGrantId(grant.id)
      setPath([graph.startId])
      setCurrentQuestionId(graph.startId)
      setAnswers(initialAnswers)
      setSeedText(null)
      setGenerateError(null)
    },
    [persist, seedText],
  )

  const answerCurrent = useCallback(
    (value: string) => {
      if (!actionCode || !currentQuestionId || !grantId) return
      const graph = QUESTION_GRAPHS[actionCode]
      const question = graph.questions[currentQuestionId]
      const nextAnswers = { ...answers, [currentQuestionId]: value }
      const nextId = resolveNext(question, value)
      const nextPath = nextId ? [...path, nextId] : path
      setAnswers(nextAnswers)
      setPath(nextPath)
      setCurrentQuestionId(nextId)
      setStep(nextId ? 'interview' : 'review')
      const firstAnswer = Object.keys(answers).length === 0
      patchGrant(grantId, {
        answers: nextAnswers,
        percentComplete: nextId ? computeProgress(graph, nextPath) : 100,
        title:
          firstAnswer && currentQuestionId === graph.startId
            ? value.slice(0, 60)
            : loadGrants().find((g) => g.id === grantId)?.title,
        status: nextId ? 'draft' : 'in_review',
      })
    },
    [actionCode, answers, currentQuestionId, grantId, patchGrant, path],
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

  const resumeGrant = useCallback((id: string) => {
    const grant = loadGrants().find((row) => row.id === id)
    if (!grant) return
    const graph = QUESTION_GRAPHS[grant.actionCode]
    if (!graph) return
    setActionCode(grant.actionCode)
    setGrantId(grant.id)
    setAnswers(grant.answers)
    setGenerateError(null)
    if (grant.status === 'complete') {
      setStep('result')
      setPath(buildPathFromAnswers(graph, grant.answers).path)
      setCurrentQuestionId(null)
      return
    }
    const walked = buildPathFromAnswers(graph, grant.answers)
    setStep(walked.isComplete ? 'review' : 'interview')
    setPath(walked.path)
    setCurrentQuestionId(walked.isComplete ? null : walked.currentQuestionId)
  }, [])

  const reset = useCallback(() => {
    setStep('picker')
    setActionCode(null)
    setGrantId(null)
    setPath([])
    setCurrentQuestionId(null)
    setAnswers({})
    setIsGenerating(false)
    setGenerateError(null)
  }, [])

  const completeWithDocument = useCallback(
    (input: {
      contentMd: string
      documentId: string
      downloads?: GrantApplication['downloads']
    }) => {
      if (!grantId || !actionCode) return
      patchGrant(grantId, {
        status: 'complete',
        percentComplete: 100,
        contentMd: input.contentMd,
        documentId: input.documentId,
        downloads: input.downloads,
      })
      setStep('result')
      setIsGenerating(false)
    },
    [actionCode, grantId, patchGrant],
  )

  const setGenerating = useCallback((value: boolean, error: string | null = null) => {
    setIsGenerating(value)
    setGenerateError(error)
  }, [])

  const value = useMemo<GrantInterviewValue>(
    () => ({
      step,
      actionCode,
      grantId,
      path,
      currentQuestionId,
      answers,
      seedText,
      grants,
      isGenerating,
      generateError,
      setSeedText,
      selectAction,
      answerCurrent,
      goBack,
      editAnswer,
      resumeGrant,
      reset,
      completeWithDocument,
      setGenerating,
    }),
    [
      actionCode,
      answerCurrent,
      answers,
      completeWithDocument,
      currentQuestionId,
      editAnswer,
      generateError,
      goBack,
      grantId,
      grants,
      isGenerating,
      path,
      reset,
      resumeGrant,
      selectAction,
      seedText,
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
