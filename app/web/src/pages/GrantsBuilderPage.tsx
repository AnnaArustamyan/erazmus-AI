import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useGrantInterview } from '../grants/GrantInterviewContext'
import { QUESTION_GRAPHS } from '../lib/grants/banks'
import { computeProgress } from '../lib/grants/grantGraph'
import { answersToMarkdown } from '../lib/grants/answersToMarkdown'
import { generateDocumentFromInterview } from '../api/documentsClient'
import { DraftNotReadyError } from '../api/http'
import { ActionTypePicker } from '../components/grants/ActionTypePicker'
import { InterviewStep } from '../components/grants/InterviewStep'
import { ReviewScreen } from '../components/grants/ReviewScreen'
import { ResultScreen } from '../components/grants/ResultScreen'

export function GrantsBuilderPage() {
  const { accessToken } = useAuth()
  const {
    step,
    actionCode,
    grantId,
    path,
    currentQuestionId,
    answers,
    grants,
    isGenerating,
    generateError,
    selectAction,
    answerCurrent,
    goBack,
    editAnswer,
    completeWithDocument,
    setGenerating,
  } = useGrantInterview()

  const grant = grants.find((row) => row.id === grantId)

  async function handleGenerate() {
    if (!actionCode || !grant) return
    const graph = QUESTION_GRAPHS[actionCode]
    const contentMd = answersToMarkdown(actionCode, grant.title, graph, path, answers)
    setGenerating(true)
    try {
      const doc = await generateDocumentFromInterview(accessToken, {
        actionCode,
        title: grant.title,
        contentMd,
      })
      completeWithDocument({
        contentMd: doc.contentMd ?? contentMd,
        documentId: doc.id,
        downloads: doc.downloads,
      })
    } catch (err) {
      const message =
        err instanceof DraftNotReadyError
          ? [err.message, ...err.gaps].join('\n')
          : err instanceof Error
            ? err.message
            : 'Could not generate the application'
      setGenerating(false, message)
    }
  }

  if (step === 'picker' || !actionCode) {
    return (
      <div className="h-full overflow-y-auto px-4 py-10 sm:px-8">
        <ActionTypePicker onSelect={(code) => selectAction(code)} />
      </div>
    )
  }

  const graph = QUESTION_GRAPHS[actionCode]
  if (!graph) return <Navigate to="/grants" replace />

  if (isGenerating) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-app-text-dim">
        Writing your application PDF…
        {generateError && <p className="text-app-danger">{generateError}</p>}
      </div>
    )
  }

  if (generateError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-app-danger whitespace-pre-line">{generateError}</p>
        <button type="button" onClick={() => setGenerating(false)} className="text-sm underline">
          Back to review
        </button>
      </div>
    )
  }

  if (step === 'interview' && currentQuestionId) {
    const question = graph.questions[currentQuestionId]
    return (
      <div className="h-full overflow-y-auto px-4 sm:px-8">
        <InterviewStep
          question={question}
          initialValue={answers[currentQuestionId] ?? ''}
          onSubmit={answerCurrent}
          onBack={goBack}
          canGoBack={path.length > 1}
          progress={computeProgress(graph, path)}
        />
      </div>
    )
  }

  if (step === 'review') {
    return (
      <div className="h-full overflow-y-auto px-4 sm:px-8">
        <ReviewScreen
          graph={graph}
          path={path}
          answers={answers}
          onEdit={editAnswer}
          onGenerate={() => void handleGenerate()}
          isGenerating={isGenerating}
        />
      </div>
    )
  }

  if (step === 'result' && grant) {
    return (
      <div className="h-full overflow-y-auto px-4 sm:px-8">
        <ResultScreen grant={grant} graph={graph} path={path} />
      </div>
    )
  }

  return <Navigate to="/grants" replace />
}
