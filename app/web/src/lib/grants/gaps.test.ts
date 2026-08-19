import { describe, it, expect } from 'vitest'
import { ka122Graph } from './banks/ka122'
import { ka153FormSchema } from './schemas/ka153'
import { flattenFormFields } from './schemas/formSchemaToGraph'
import {
  buildRequirementItems,
  completenessPercent,
  controllingCondition,
  fieldsForAction,
  fieldsForGraph,
  needsAttention,
  requirementPath,
} from './gaps'

describe('requirement gaps', () => {
  it('lists KA153 schema fields in any order — summary is not a forced first step', () => {
    const fields = fieldsForAction('KA153')
    const ids = fields.map((field) => field.id)
    expect(ids).toContain('project.summary')
    expect(ids).toContain('relevance.objectives')
    expect(ids).toContain('participants.number')
    expect(ids.indexOf('relevance.objectives')).not.toBe(0)

    const items = buildRequirementItems({ fields, answers: {} })
    expect(items.find((item) => item.fieldId === 'relevance.objectives')?.status).toBe('missing')
    expect(items.find((item) => item.fieldId === 'annexes.apv_programme')).toBeUndefined()
    expect(completenessPercent(items)).toBe(0)
  })

  it('shows the APV programme only when APV is yes', () => {
    const fields = flattenFormFields(ka153FormSchema)
    const hidden = buildRequirementItems({ fields, answers: { 'activities.apv': 'no' } })
    expect(hidden.some((item) => item.fieldId === 'annexes.apv_programme')).toBe(false)

    const shown = buildRequirementItems({ fields, answers: { 'activities.apv': 'yes' } })
    expect(shown.find((item) => item.fieldId === 'annexes.apv_programme')?.status).toBe('missing')
  })

  it('marks a filled-but-short answer as weak, not missing', () => {
    const fields = flattenFormFields(ka153FormSchema)
    const items = buildRequirementItems({
      fields,
      answers: { 'project.summary': 'Too short.' },
    })
    const summary = items.find((item) => item.fieldId === 'project.summary')
    expect(summary?.status).toBe('weak')
    expect(summary?.issues.some((issue) => /at least/i.test(issue))).toBe(true)
  })

  it('marks suggested Chat facts as proposed, not complete', () => {
    const fields = flattenFormFields(ka153FormSchema)
    const items = buildRequirementItems({
      fields,
      answers: {},
      facts: [
        {
          key: 'participant_count',
          value: 2,
          source: 'chat',
          sourceField: 'participants.number',
          confidence: 'suggested',
          status: 'pending',
          kind: 'recommendation',
          rationale: 'Conservative first-time scale.',
        },
      ],
    })
    const row = items.find((item) => item.fieldId === 'participants.number')
    expect(row?.status).toBe('proposed')
    expect(row?.source).toBe('proposal')
    expect(row?.proposedValue).toBe('2')
  })

  it('uses Chat pending facts as confirm-the-same-row gaps, not a parallel list', () => {
    const fields = flattenFormFields(ka153FormSchema)
    const items = buildRequirementItems({
      fields,
      answers: { 'participants.number': '24' },
      facts: [
        {
          key: 'participant_count',
          value: 24,
          source: 'chat',
          sourceField: 'participants.number',
          confidence: 'inferred',
          status: 'pending',
        },
      ],
    })
    const row = items.find((item) => item.fieldId === 'participants.number')
    expect(row?.status).toBe('confirm')
    expect(row?.source).toBe('chat')
    expect(row?.issues[0]).toMatch(/Confirm this from Chat/)
  })

  it('hides KA122 branch siblings until the controlling answer is set', () => {
    expect(controllingCondition(ka122Graph, 'needs_vet')).toEqual({ field: 'org_type', equals: 'vet' })
    const fields = fieldsForGraph(ka122Graph)
    const before = buildRequirementItems({ fields, answers: {} })
    expect(before.some((item) => item.fieldId === 'needs_vet')).toBe(false)
    expect(before.some((item) => item.fieldId === 'summary')).toBe(true)
    expect(before.some((item) => item.fieldId === 'destination')).toBe(true)

    const after = buildRequirementItems({ fields, answers: { org_type: 'vet' } })
    expect(after.some((item) => item.fieldId === 'needs_vet')).toBe(true)
    expect(after.some((item) => item.fieldId === 'needs_school')).toBe(false)
  })

  it('counts only required complete fields toward percent', () => {
    const items = buildRequirementItems({
      fields: fieldsForAction('KA153'),
      answers: {
        'project.summary':
          'A youth-worker training course in Lisbon on outdoor methods, hosted by a Portuguese partner, for 18 youth workers from Armenia and Portugal over 6 days.',
      },
    })
    expect(completenessPercent(items)).toBeGreaterThan(0)
    expect(completenessPercent(items)).toBeLessThan(100)
    expect(needsAttention(items).length).toBeGreaterThan(10)
  })

  it('builds a deep-link to the same requirement row', () => {
    expect(requirementPath('needs.analysis')).toBe('/grants/builder?field=needs.analysis')
  })
})
