export type ActionGroup = 'KA1' | 'KA2'

export interface ActionType {
  code: string
  group: ActionGroup
  name: string
  description: string
  audience: string
  supported: boolean
}

export interface InterviewOption {
  value: string
  label: string
}

export interface InterviewQuestion {
  id: string
  formSection: string
  formFieldLabel: string
  question: string
  helpText?: string
  type: 'text' | 'textarea' | 'select'
  options?: InterviewOption[]
  next: string | null
  branches?: { equals: string; goto: string | null }[]
  characterLimit?: number
  wordLimit?: number
  minCharacters?: number
  factKey?: string
}

export interface QuestionGraph {
  startId: string
  questions: Record<string, InterviewQuestion>
}

export type GrantStatus = 'draft' | 'in_review' | 'ready'

export type FactSource = 'questionnaire' | 'chat' | 'document' | 'user'
export type FactConfidence = 'confirmed' | 'inferred' | 'suggested'
export type FactStatus = 'locked' | 'pending' | 'stale'

export interface ApplicationFact {
  key: string
  value: string | number
  source: FactSource
  sourceField?: string
  confidence: FactConfidence
  status: FactStatus
}

export interface GrantApplication {
  id: string
  actionCode: string
  callYear?: number
  title: string
  status: GrantStatus
  percentComplete: number
  answers: Record<string, string>
  path?: string[]
  facts?: ApplicationFact[]
  sections?: Record<string, string>
  contentMd?: string
  documentId?: string
  conversationId?: string
  actionConfirmed?: boolean
  downloads?: { pdf?: string; md?: string; docx?: string }
  createdAt: string
  updatedAt: string
}

export interface ProjectPlan {
  id: string
  title: string
  contentMd: string
  sourcePrompt: string
  documentId?: string
  downloads?: { pdf?: string; md?: string; docx?: string }
  createdAt: string
  updatedAt: string
}

export type BuilderStep = 'picker' | 'workspace' | 'interview' | 'review' | 'result'
