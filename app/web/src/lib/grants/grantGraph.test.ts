import { describe, it, expect } from 'vitest'
import { buildPathFromAnswers, computeProgress, resolveNext } from './grantGraph'
import { ka122Graph } from './banks/ka122'
import { QUESTION_GRAPHS } from './banks'

describe('grantGraph', () => {
  it('branches KA122 organisation type into the matching needs question', () => {
    const orgType = ka122Graph.questions.org_type
    expect(resolveNext(orgType, 'vet')).toBe('needs_vet')
    expect(resolveNext(orgType, 'school')).toBe('needs_school')
  })

  it('resumes a partial KA122 draft at the first unanswered question', () => {
    const { path, currentQuestionId, isComplete } = buildPathFromAnswers(ka122Graph, {
      summary: 'Three teachers to Finland for digital storytelling.',
      org_type: 'school',
    })
    expect(path).toEqual(['summary', 'org_type', 'needs_school'])
    expect(currentQuestionId).toBe('needs_school')
    expect(isComplete).toBe(false)
  })

  it('marks the interview complete when the path reaches a dead end', () => {
    const answers: Record<string, string> = {
      summary: 'Staff course in Spain',
      org_type: 'adult',
      needs_adult: 'Tutors need digital assessment methods',
      needs_method: 'survey',
      needs_evidence: '18 tutors asked for observation practice',
      partners: 'yes',
      partner_names: 'A VET centre in Valencia',
      destination: 'Spain, because the host runs the method we need',
      participant_count: '6',
      participant_profile: 'Adult-education tutors, internal call',
      fewer_opportunities: 'no',
      mobility_type: 'staff',
      activities_staff: 'Five-day training course',
      duration: 'March 2027, 5 days',
      objectives: 'Tutors apply one new assessment method within 6 months',
      learning_outcomes: 'Skills: design a digital rubric',
      preparation: 'Online briefing two weeks before',
      follow_up: 'Peer observation in the following term',
      impact: 'Six tutors use the rubric with their groups',
      dissemination: 'Internal workshop in April',
      risks: 'Drop-out — reserve list of two',
      added_value: 'The method is not available locally',
    }
    const { isComplete, currentQuestionId } = buildPathFromAnswers(ka122Graph, answers)
    expect(isComplete).toBe(true)
    expect(currentQuestionId).toBeNull()
    expect(computeProgress(ka122Graph, buildPathFromAnswers(ka122Graph, answers).path)).toBe(100)
  })

  it('ships a graph for every KA1 and KA2 action', () => {
    expect(Object.keys(QUESTION_GRAPHS).sort()).toEqual(
      ['KA121', 'KA122', 'KA131/171', 'KA152-154', 'KA210', 'KA220'].sort(),
    )
  })

  it('branches youth mobility into KA152 / KA153 / KA154', () => {
    const youthAction = QUESTION_GRAPHS['KA152-154'].questions.youth_action
    expect(resolveNext(youthAction, 'ka153')).toBe('summary')
  })
})
