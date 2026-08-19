import { useEffect, useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useGrantInterview } from '../grants/GrantInterviewContext'
import { ActionTypePicker } from '../components/grants/ActionTypePicker'
import { RequirementEditor } from '../components/grants/RequirementEditor'
import { RequirementsWorkspace } from '../components/grants/RequirementsWorkspace'
import { confirmedActionCode } from '../lib/grants/activeGrant'
import {
  applyWorkingScenario,
  buildRequirementItems,
  completenessPercent,
  fieldById,
  fieldsForAction,
  requirementPath,
} from '../lib/grants/gaps'
import { confirmableItems, contextFromAnswers, proposeWorkingScenario } from '../lib/grants/proposals'

export function GrantsBuilderPage() {
  const [params, setParams] = useSearchParams()
  const {
    grantId,
    answers,
    grants,
    selectAction,
    answerField,
    answerFields,
    ensureActiveGrant,
  } = useGrantInterview()

  useEffect(() => {
    ensureActiveGrant()
  }, [ensureActiveGrant])

  const grant = grants.find((row) => row.id === grantId)
  const actionCode = grant ? confirmedActionCode(grant) : null
  const editingId = params.get('field')

  const items = useMemo(() => {
    if (!actionCode) return []
    const base = buildRequirementItems({
      fields: fieldsForAction(actionCode),
      answers,
      facts: grant?.facts,
    })
    if (actionCode !== 'KA121') return base
    const scenario = proposeWorkingScenario(contextFromAnswers(actionCode, answers))
    return applyWorkingScenario(base, scenario, answers)
  }, [actionCode, answers, grant?.facts])

  const scenario = useMemo(() => {
    if (actionCode !== 'KA121') return null
    return proposeWorkingScenario(contextFromAnswers(actionCode, answers))
  }, [actionCode, answers])

  if (!grant || !actionCode) {
    return (
      <div className="h-full overflow-y-auto px-4 py-10 sm:px-8">
        <p className="mx-auto mb-6 max-w-3xl text-center text-sm text-app-text-dim">
          Action is not confirmed yet. That is a gap on this application — Chat will not guess KA152 vs KA153 vs KA154.
        </p>
        <ActionTypePicker onSelect={(code) => selectAction(code)} />
      </div>
    )
  }

  const field = editingId ? fieldById(actionCode, editingId) : undefined
  if (editingId && !field) return <Navigate to={requirementPath()} replace />

  const proposedForField = field
    ? items.find((item) => item.fieldId === field.id && item.status === 'proposed')?.proposedValue
    : undefined

  if (field) {
    return (
      <div className="h-full overflow-y-auto px-4 sm:px-8">
        <RequirementEditor
          field={field}
          value={answers[field.id] || proposedForField || ''}
          completeness={completenessPercent(items)}
          onSave={(value) => {
            answerField(field.id, value)
            setParams({}, { replace: true })
          }}
          onBack={() => setParams({}, { replace: true })}
        />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8">
      <RequirementsWorkspace
        actionCode={actionCode}
        callYear={grant.callYear}
        items={items}
        scenario={scenario}
        onOpen={(fieldId) => setParams({ field: fieldId })}
        onConfirmProposal={(fieldId, value) => answerField(fieldId, value)}
        onUseWorkingScenario={() => {
          if (!scenario) return
          const updates: Record<string, string> = {}
          for (const row of confirmableItems(scenario)) {
            if (!answers[row.fieldId]?.trim()) updates[row.fieldId] = row.answerValue
          }
          if (Object.keys(updates).length) answerFields(updates)
        }}
      />
    </div>
  )
}
