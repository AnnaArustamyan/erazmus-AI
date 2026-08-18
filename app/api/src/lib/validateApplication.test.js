import { describe, it, expect } from 'vitest';
import { factsFromAnswers } from './facts.js';
import { flattenFormFields, loadEvaluationSchema, loadFormSchema } from './formSchemas.js';
import { validateApplication } from './validateApplication.js';

const form = loadFormSchema('KA153');
const fields = flattenFormFields(form);

const VALID = {
  'project.summary':
    'Two youth organisations in Armenia and Portugal send 12 youth workers to a five-day training course on digital youth-work methods for rural clubs.',
  'organisations.applicant':
    'A youth NGO in Yerevan running weekly open youth clubs with 40 young people and 8 youth workers.',
  'organisations.partners':
    '2 organisations: the Armenian applicant (sending) and a Lisbon youth centre (receiving).',
  'organisations.countries': 'Armenia, Portugal',
  'participants.primary_type': 'youth_workers',
  'needs.analysis':
    'Youth workers in both organisations lack structured methods for digital participation in rural clubs. Staff said they improvise every session and asked for practice they can use next month with the same groups of young people.',
  'needs.method': 'survey',
  'needs.evidence':
    'March 2026 staff survey, 14 youth workers. Main finding: no shared session template for online/offline club work; they want peer practice, not a lecture.',
  'priorities.eu':
    'Digital transformation is delivered by practising one digital youth-work method per worker, not by ticking the box.',
  'relevance.objectives':
    'O1: 12 youth workers design one digital club session they will run within 6 weeks. O2: both organisations adopt a shared session template.',
  'participants.number': '12',
  'participants.profile':
    '12 youth workers employed or volunteering in the two participating organisations, already working with local young people.',
  'participants.selection_criteria':
    'Criteria: (1) active youth worker in a partner organisation 40%, (2) commitment to run a follow-up session 30%, (3) fewer-opportunity profile 20%, (4) gender balance 10%. The sending coordinator applies the grid.',
  'participants.fewer_opportunities':
    'Four workers from rural clubs; travel advance and an extra briefing day. Barrier: geographic isolation, not a slogan.',
  'activities.venue': 'Lisbon, at the receiving organisation, so host-country workers join the PDA.',
  'activities.duration_days': '5',
  'activities.dates': 'October 2026',
  'activities.programme':
    'Five-day training course: peer learning, simulation of a digital club session, job-shadowing of the Lisbon team, daily reflection linked to O1 and O2.',
  'activities.methods':
    'Non-formal: simulations, peer learning, daily reflection. Each method maps to O1 session design.',
  'activities.apv': 'no',
  'activities.learning_outcomes':
    'Knowledge of one digital youth-work method; skill to facilitate a hybrid club session; attitude of documenting learning with Youthpass.',
  'activities.youthpass':
    'Daily reflection and Youthpass at the end of the course; sending orgs review certificates in the follow-up meeting.',
  'activities.preparation':
    'Before: online briefing and needs recap. During: PDA as above. After: each worker runs one club session; coordinators collect the 12 session plans.',
  'management.impact':
    'Expected change: 12 digital club sessions delivered within 6 weeks. Indicator: 12 session plans on file. Method: follow-up survey in November 2026. Audience: partner staff and local clubs.',
  'management.safety':
    'Travel insurance, emergency contact sheet, safeguarding briefing on day 0.',
  'management.evaluation':
    'Daily pulse check during the course; November survey of 12 workers against O1/O2.',
  'management.roles':
    'Applicant coordinates; Lisbon hosts; WhatsApp + one shared folder. Same title, 12 workers, O1 and O2 everywhere.',
  'annexes.timetable':
    'Day 1 arrival and needs recap. Day 2 digital methods lab. Day 3 job-shadowing. Day 4 session design studio (O1). Day 5 Youthpass and follow-up contracts (O2).',
};

function report(overrides = {}) {
  const answers = { ...VALID, ...overrides };
  const facts = factsFromAnswers(fields, answers);
  return validateApplication({ actionCode: 'KA153', answers, facts, callYear: 2026 });
}

describe('KA153 form and evaluation schemas', () => {
  it('loads versioned KA153-YOU 2026 schemas with mappedFormFields', () => {
    expect(form.id).toBe('KA153-YOU-2026-form-v1');
    const evaluation = loadEvaluationSchema('KA153');
    expect(evaluation.passingCondition).toMatch(/60/);
    for (const criterion of evaluation.criteria) {
      for (const sub of criterion.subCriteria) {
        expect(sub.mappedFormFields.length).toBeGreaterThan(0);
        expect(sub.source).toMatch(/Guide 2026/);
      }
    }
  });
});

describe('KA153 deterministic validators', () => {
  it('passes a structurally valid draft on schema/compliance/consistency/evidence', () => {
    const result = report();
    const critical = result.findings.filter((f) => f.level === 'critical');
    expect(critical).toEqual([]);
    expect(result.readiness.gates.schema).toBe('pass');
    expect(result.readiness.gates.compliance).toBe('pass');
    expect(result.readiness.gates.consistency).toBe('pass');
    expect(result.readiness.gates.evidence).toBe('pass');
  });

  it('catches young people listed as primary participants', () => {
    const result = report({ 'participants.primary_type': 'young_people' });
    expect(result.findings.some((f) => f.id === 'ka153_beneficiary')).toBe(true);
    expect(result.readiness.gates.compliance).toBe('fail');
  });

  it('catches a missing needs method', () => {
    const result = report({
      'needs.method': 'none',
      'needs.evidence': 'We know young people use social media.',
      'needs.analysis': 'Young people use social media so workers should learn something.',
    });
    expect(result.findings.some((f) => f.id === 'ka153_needs_method')).toBe(true);
  });

  it('catches participant counts that change between sections', () => {
    const result = report({
      'activities.programme':
        'Five-day training course for 8 youth workers with simulations linked to O1 and O2.',
    });
    expect(result.findings.some((f) => f.id === 'ka153_participant_count_consistency')).toBe(true);
  });

  it('catches an APV without a session plan', () => {
    const result = report({ 'activities.apv': 'yes', 'annexes.apv_programme': '' });
    expect(result.findings.some((f) => f.id === 'ka153_apv_programme')).toBe(true);
  });

  it('catches slogan impact with no indicator', () => {
    const result = report({
      'management.impact': 'Participants will become more aware of digital youth work.',
    });
    expect(result.findings.some((f) => f.id === 'ka153_slogan_impact')).toBe(true);
  });

  it('catches youth-exchange logic in a youth-worker draft', () => {
    const result = report({
      'activities.programme':
        'This youth exchange sends teenagers to Portugal for ice-breakers for young people and cultural nights.',
    });
    expect(result.findings.some((f) => f.id === 'ka153_youth_exchange_logic')).toBe(true);
  });

  it('catches objectives that do not chain to activities', () => {
    const result = report({
      'relevance.objectives':
        'Establish a municipal filmmaking cooperative with distribution contracts and festival awards.',
      'activities.programme':
        'Five-day training course: peer learning, simulation of a digital club session, job-shadowing of the Lisbon team.',
    });
    expect(result.findings.some((f) => f.id === 'ka153_objective_activity_chain')).toBe(true);
  });

  it('traces missing selection evidence to the mapped form field', () => {
    const result = report({
      'participants.selection_criteria': 'Participants will be selected carefully.',
    });
    const hit = result.findings.find((f) => f.id === 'evidence_design_selection');
    expect(hit).toBeTruthy();
    expect(hit.location).toBe('participants.selection_criteria');
    expect(hit.mappedFormFields).toContain('participants.selection_criteria');
    expect(hit.found).toMatch(/selected carefully/i);
  });

  it('refuses to validate generation when the action is not confirmed', () => {
    const result = validateApplication({ actionCode: 'KA152-154', answers: VALID });
    expect(result.findings[0].id).toBe('action_lock');
    expect(result.readiness.status).toBe('not_ready');
  });
});
