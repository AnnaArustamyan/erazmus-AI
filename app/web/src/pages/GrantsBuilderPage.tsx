import { useEffect, useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useGrantInterview } from '../grants/GrantInterviewContext'
import { ActionTypePicker } from '../components/grants/ActionTypePicker'
import { RequirementEditor } from '../components/grants/RequirementEditor'
import { RequirementsWorkspace } from '../components/grants/RequirementsWorkspace'
import { confirmedActionCode } from '../lib/grants/activeGrant'
import {
  buildRequirementItems,
  completenessPercent,
  fieldById,
  fieldsForAction,
  requirementPath,
} from '../lib/grants/gaps'

export function GrantsBuilderPage() {
  const [params, setParams] = useSearchParams()
  const {
    grantId,
    answers,
    grants,
    selectAction,
    answerField,
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
    return buildRequirementItems({
      fields: fieldsForAction(actionCode),
      answers,
      facts: grant?.facts,
    })
  }, [actionCode, answers, grant?.facts])

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

  if (field) {
    return (
      <div className="h-full overflow-y-auto px-4 sm:px-8">
        <RequirementEditor
          field={field}
          value={answers[field.id] ?? ''}
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
        onOpen={(fieldId) => setParams({ field: fieldId })}
      />
    </div>
  )
}
