import type { InterviewQuestion, QuestionGraph } from './types'

export function resolveNext(question: InterviewQuestion, answer: string): string | null {
  const branch = question.branches?.find((b) => b.equals === answer)
  if (branch) return branch.goto
  return question.next
}

export function buildPathFromAnswers(
  graph: QuestionGraph,
  answers: Record<string, string>,
): { path: string[]; currentQuestionId: string | null; isComplete: boolean } {
  const path: string[] = []
  let currentId: string | null = graph.startId

  while (currentId) {
    path.push(currentId)
    const question = graph.questions[currentId]
    if (!question) {
      return { path, currentQuestionId: currentId, isComplete: false }
    }
    const answer = answers[currentId]
    if (!answer) {
      return { path, currentQuestionId: currentId, isComplete: false }
    }
    currentId = resolveNext(question, answer)
  }

  return { path, currentQuestionId: null, isComplete: true }
}

export function computeProgress(graph: QuestionGraph, path: string[]): number {
  const totalSections = new Set(Object.values(graph.questions).map((q) => q.formSection)).size
  const visitedSections = new Set(path.map((id) => graph.questions[id]?.formSection)).size
  if (totalSections === 0) return 0
  return Math.min(100, Math.round((visitedSections / totalSections) * 100))
}

export function defineGraph(startId: string, questions: InterviewQuestion[]): QuestionGraph {
  return {
    startId,
    questions: Object.fromEntries(questions.map((question) => [question.id, question])),
  }
}
