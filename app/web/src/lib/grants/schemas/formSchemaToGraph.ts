import type { FieldAi, InterviewQuestion, QuestionGraph } from '../types'
import { defineGraph } from '../grantGraph'

export type { FieldAi }

export interface FormFieldOption {
  value: string
  label: string
}

export interface FormField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select'
  required?: boolean
  characterLimit?: number
  wordLimit?: number
  minCharacters?: number
  question?: string
  helpText?: string
  factKey?: string
  dependsOn?: string[]
  ai?: FieldAi
  options?: FormFieldOption[]
  formSection?: string
  conditionalOn?: { field: string; equals: string }
}

export interface FormSchema {
  id: string
  action: string
  callYear: number
  version: number
  minimumFacts?: string[]
  sections: { id: string; title: string; fields: FormField[] }[]
}

export function formSchemaToGraph(schema: FormSchema): QuestionGraph {
  const fields = schema.sections.flatMap((section) =>
    section.fields.map((field) => ({ ...field, formSection: section.title })),
  )
  const questions: InterviewQuestion[] = fields.map((field, index) => {
    const dependents = fields.filter((candidate) => candidate.conditionalOn?.field === field.id)
    const nextUnconditional = fields.slice(index + 1).find((candidate) => !candidate.conditionalOn)
    const next = nextUnconditional?.id ?? null
    const branches =
      field.options && dependents.length
        ? field.options.map((opt) => {
            const dest = dependents.find((d) => d.conditionalOn?.equals === opt.value)
            return { equals: opt.value, goto: dest?.id ?? next }
          })
        : undefined
    return {
      id: field.id,
      formSection: field.formSection,
      question: field.question || field.label,
      formFieldLabel: field.label,
      helpText: field.helpText,
      type: field.type,
      options: field.options,
      next,
      branches,
      characterLimit: field.characterLimit,
      wordLimit: field.wordLimit,
      minCharacters: field.minCharacters,
      factKey: field.factKey,
      dependsOn: field.dependsOn,
      ai: field.ai,
    }
  })
  return defineGraph(fields[0].id, questions)
}

export function flattenFormFields(schema: FormSchema): FormField[] {
  return schema.sections.flatMap((section) =>
    section.fields.map((field) => ({ ...field, formSection: section.title })),
  )
}

export function isFieldApplicable(
  field: Pick<FormField, 'conditionalOn'>,
  answers: Record<string, string>,
): boolean {
  if (!field.conditionalOn) return true
  return (answers[field.conditionalOn.field] ?? '').trim() === field.conditionalOn.equals
}

export function assessAnswer(
  field: Pick<InterviewQuestion | FormField, 'minCharacters' | 'characterLimit' | 'wordLimit'> & {
    required?: boolean
  },
  value: string,
): string[] {
  const issues: string[] = []
  const text = value.trim()
  const required = field.required !== false
  if (required && !text) issues.push('This field is required.')
  if (text && field.minCharacters && text.length < field.minCharacters) {
    issues.push(`This field requires at least ${field.minCharacters} characters.`)
  }
  if (text && field.characterLimit && text.length > field.characterLimit) {
    issues.push(`This field exceeds the ${field.characterLimit} character limit.`)
  }
  if (text && field.wordLimit) {
    const words = text.split(/\s+/).filter(Boolean).length
    if (words > field.wordLimit) {
      issues.push(`This field exceeds the ${field.wordLimit} word limit.`)
    }
  }
  return issues
}

export function toInterviewQuestion(field: FormField): InterviewQuestion {
  return {
    id: field.id,
    formSection: field.formSection ?? '',
    formFieldLabel: field.label,
    question: field.question || field.label,
    helpText: field.helpText,
    type: field.type,
    options: field.options,
    next: null,
    characterLimit: field.characterLimit,
    wordLimit: field.wordLimit,
    minCharacters: field.minCharacters,
    factKey: field.factKey,
    dependsOn: field.dependsOn,
    ai: field.ai,
  }
}
