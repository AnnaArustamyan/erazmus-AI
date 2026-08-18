import type { QuestionGraph } from './types'

export function answersToMarkdown(
  actionCode: string,
  title: string,
  graph: QuestionGraph,
  path: string[],
  answers: Record<string, string>,
): string {
  const sections = new Map<string, string[]>()
  for (const id of path) {
    const question = graph.questions[id]
    if (!question) continue
    const list = sections.get(question.formSection) ?? []
    list.push(id)
    sections.set(question.formSection, list)
  }

  const blocks = [`# ${title}`, '', `Action: ${actionCode}`, '']
  for (const [section, ids] of sections) {
    blocks.push(`## ${section}`, '')
    for (const id of ids) {
      const question = graph.questions[id]
      const answer = answers[id]?.trim()
      if (!answer) continue
      blocks.push(`### ${question.formFieldLabel}`, '', answer, '')
    }
  }
  return blocks.join('\n')
}
