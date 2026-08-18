import { QUESTION_GRAPHS } from './banks'
import { ka153FormSchema } from './schemas/ka153'
import {
  assessAnswer,
  flattenFormFields,
  isFieldApplicable,
  type FormField,
} from './schemas/formSchemaToGraph'
import type { ApplicationFact, QuestionGraph } from './types'

export type RequirementStatus = 'missing' | 'weak' | 'confirm' | 'complete'

export interface RequirementItem {
  fieldId: string
  label: string
  section: string
  status: RequirementStatus
  issues: string[]
  required: boolean
  source: 'schema' | 'chat'
}

export function requirementPath(fieldId?: string): string {
  if (!fieldId) return '/grants/builder'
  return `/grants/builder?field=${encodeURIComponent(fieldId)}`
}

export function controllingCondition(
  graph: QuestionGraph,
  questionId: string,
): { field: string; equals: string } | undefined {
  for (const question of Object.values(graph.questions)) {
    const branch = question.branches?.find((b) => b.goto === questionId)
    if (branch) return { field: question.id, equals: branch.equals }
  }
  return undefined
}

export function fieldsForGraph(graph: QuestionGraph): FormField[] {
  return Object.values(graph.questions).map((question) => ({
    id: question.id,
    label: question.formFieldLabel,
    type: question.type,
    required: true,
    characterLimit: question.characterLimit,
    wordLimit: question.wordLimit,
    minCharacters: question.minCharacters,
    question: question.question,
    helpText: question.helpText,
    factKey: question.factKey,
    options: question.options,
    formSection: question.formSection,
    conditionalOn: controllingCondition(graph, question.id),
  }))
}

export function fieldsForAction(actionCode: string): FormField[] {
  if (actionCode === 'KA153') return flattenFormFields(ka153FormSchema)
  const graph = QUESTION_GRAPHS[actionCode]
  return graph ? fieldsForGraph(graph) : []
}

export function fieldById(actionCode: string, fieldId: string): FormField | undefined {
  return fieldsForAction(actionCode).find((field) => field.id === fieldId)
}

function pendingFactForField(facts: ApplicationFact[], fieldId: string): ApplicationFact | undefined {
  return facts.find(
    (fact) =>
      fact.sourceField === fieldId &&
      fact.source === 'chat' &&
      (fact.status === 'pending' || fact.confidence === 'inferred'),
  )
}

export function buildRequirementItems(input: {
  fields: FormField[]
  answers: Record<string, string>
  facts?: ApplicationFact[]
}): RequirementItem[] {
  const facts = input.facts ?? []
  return input.fields.filter((field) => isFieldApplicable(field, input.answers)).map((field) => {
    const value = input.answers[field.id] ?? ''
    const issues = assessAnswer(field, value)
    const pending = pendingFactForField(facts, field.id)
    const required = field.required !== false || Boolean(field.conditionalOn)
    let status: RequirementStatus = 'complete'
    let source: RequirementItem['source'] = 'schema'
    if (pending) {
      status = 'confirm'
      source = 'chat'
      const preview = String(pending.value).trim()
      if (preview) {
        issues.push(`Confirm this from Chat: ${preview}`)
      } else {
        issues.push('Confirm this fact from Chat.')
      }
    } else if (!value.trim() && required) {
      status = 'missing'
    } else if (issues.length > 0) {
      status = 'weak'
    }
    return {
      fieldId: field.id,
      label: field.label,
      section: field.formSection ?? '',
      status,
      issues,
      required,
      source,
    }
  })
}

export function completenessPercent(items: RequirementItem[]): number {
  const required = items.filter((item) => item.required)
  if (required.length === 0) return 0
  const done = required.filter((item) => item.status === 'complete').length
  return Math.min(100, Math.round((done / required.length) * 100))
}

export function groupRequirementsBySection(items: RequirementItem[]): { section: string; items: RequirementItem[] }[] {
  const order: string[] = []
  const buckets = new Map<string, RequirementItem[]>()
  for (const item of items) {
    const section = item.section || 'Requirements'
    if (!buckets.has(section)) {
      order.push(section)
      buckets.set(section, [])
    }
    buckets.get(section)!.push(item)
  }
  return order.map((section) => ({ section, items: buckets.get(section) ?? [] }))
}

export function needsAttention(items: RequirementItem[]): RequirementItem[] {
  return items.filter((item) => item.status !== 'complete')
}
