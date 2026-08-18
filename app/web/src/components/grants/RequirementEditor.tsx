import { toInterviewQuestion, type FormField } from '../../lib/grants/schemas/formSchemaToGraph'
import { InterviewStep } from './InterviewStep'

interface RequirementEditorProps {
  field: FormField
  value: string
  completeness: number
  onSave: (value: string) => void
  onBack: () => void
}

export function RequirementEditor({
  field,
  value,
  completeness,
  onSave,
  onBack,
}: RequirementEditorProps) {
  return (
    <InterviewStep
      question={toInterviewQuestion(field)}
      initialValue={value}
      onSubmit={onSave}
      onBack={onBack}
      canGoBack
      progress={completeness}
      submitLabel="Save"
    />
  )
}
