/**
 * Layer A (deterministic) + Layer C (evidence tracing) for a locked action.
 * No model calls. Unit-tested.
 */

import { flattenFormFields, loadEvaluationSchema, loadFormSchema } from './formSchemas.js';
import { getFact, isUsableFact, missingGenerationFacts } from './facts.js';
import { requireConfirmedAction } from './actionLock.js';

const NEEDS_METHOD_OK = new Set(['survey', 'focus_group', 'mixed', 'interviews', 'focus']);
const SLOGAN_IMPACT_RE =
  /\b(become more aware|raise awareness|will be more aware|greater awareness|empower(?:ed|ing)?\b.{0,40}\byoung people)\b/i;
const INDICATOR_RE =
  /\b(indicator|measur(?:e|ed|ing)|survey|%|percent|within \d+|after \d+|youthpass|session plans? delivered|follow-?up)\b/i;
const YOUTH_EXCHANGE_RE =
  /\b(youth exchange|ice[- ]breakers? for (?:teens|teenagers|young people)|young people as participants|participants aged 13|teenagers? will travel)\b/i;
const WEIGHTING_RE =
  /\b(weight|weighting|scor(?:e|ing)|priority|ranked|points?|percent|applies)\b|\d\s*%/i;

function answerOf(answers, id) {
  const value = answers?.[id];
  return typeof value === 'string' ? value.trim() : '';
}

function extractCounts(text) {
  const matches = String(text).matchAll(
    /(\d+)\s*(?:youth workers?|participants?|people|staff|workers?)/gi,
  );
  return [...matches].map((m) => Number(m[1]));
}

function finding(partial) {
  return {
    level: 'critical',
    layer: 'schema',
    gate: 'schema',
    ...partial,
  };
}

function isFieldApplicable(field, answers) {
  if (!field.conditionalOn) return true;
  return answerOf(answers, field.conditionalOn.field) === field.conditionalOn.equals;
}

export function assessAnswerQuality(field, value) {
  const issues = [];
  const text = (value || '').trim();
  if (field.required && isFieldApplicable(field, { [field.id]: text }) && !text) {
    issues.push(`This field is required.`);
  }
  if (text && field.minCharacters && text.length < field.minCharacters) {
    issues.push(`This field requires at least ${field.minCharacters} characters.`);
  }
  if (text && field.characterLimit && text.length > field.characterLimit) {
    issues.push(`This field exceeds the ${field.characterLimit} character limit.`);
  }
  if (text && field.wordLimit) {
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words > field.wordLimit) {
      issues.push(`This field exceeds the ${field.wordLimit} word limit.`);
    }
  }
  return issues;
}

function layerA(schema, answers, facts) {
  const findings = [];
  const fields = flattenFormFields(schema);

  for (const field of fields) {
    if (!isFieldApplicable(field, answers)) continue;
    const value = answerOf(answers, field.id);
    for (const issue of assessAnswerQuality(field, value)) {
      findings.push(
        finding({
          id: `schema_${field.id}`,
          ruleId: 'required_or_limit',
          message: `${field.label}: ${issue}`,
          location: field.id,
          expected: field.required ? 'A complete answer within limits' : 'Within limits',
          found: value ? `${value.length} characters` : 'empty',
          source: schema.source,
          level: field.required && !value ? 'critical' : 'major',
        }),
      );
    }
  }

  const primary = answerOf(answers, 'participants.primary_type');
  if (primary === 'young_people') {
    findings.push(
      finding({
        id: 'ka153_beneficiary',
        ruleId: 'ka153_beneficiary',
        gate: 'compliance',
        layer: 'compliance',
        message: 'Primary participants of KA153 must be youth workers, not young people.',
        location: 'participants.primary_type',
        expected: 'Youth workers / youth-work staff',
        found: 'Young people as primary participants',
        source: 'Programme Guide 2026, Part B, Mobility of Youth Workers, Award Criteria',
        negativeExample: 'EX-2024-A, EX-2024-B',
      }),
    );
  }

  const method = answerOf(answers, 'needs.method') || String(getFact(facts, 'needs_method')?.value || '');
  if (!method || method === 'none' || !NEEDS_METHOD_OK.has(method)) {
    const evidence = answerOf(answers, 'needs.evidence');
    const hasNamedMethod = /\b(survey|focus group|interview|questionnaire|organisational (?:records|plan))\b/i.test(
      `${method} ${evidence} ${answerOf(answers, 'needs.analysis')}`,
    );
    if (!hasNamedMethod) {
      findings.push(
        finding({
          id: 'ka153_needs_method',
          ruleId: 'ka153_needs_method',
          gate: 'compliance',
          layer: 'compliance',
          message: 'Needs analysis has no survey, focus group, or other named evidence method.',
          location: 'needs.method',
          expected: 'Named method, when, who was asked',
          found: method || 'missing',
          source: 'Programme Guide 2026, Part B, Mobility of Youth Workers, Award Criteria',
          negativeExample: 'EX-2024-A, EX-2024-C',
        }),
      );
    }
  }

  const countField = answerOf(answers, 'participants.number');
  const factCount = getFact(facts, 'participant_count');
  const declared = Number.parseInt(String(countField || factCount?.value || '').replace(/[^\d]/g, ''), 10);
  const countScope = [
    'project.summary',
    'participants.profile',
    'activities.programme',
    'activities.preparation',
    'management.impact',
    'management.evaluation',
    'annexes.timetable',
  ]
    .map((id) => answerOf(answers, id))
    .join('\n');
  const mentioned = extractCounts(countScope);
  if (Number.isFinite(declared) && mentioned.some((n) => n !== declared && n > 0 && Math.abs(n - declared) >= 1)) {
    const other = mentioned.find((n) => n !== declared);
    findings.push(
      finding({
        id: 'ka153_participant_count_consistency',
        ruleId: 'ka153_participant_count',
        gate: 'consistency',
        layer: 'consistency',
        message: 'Participant count changes between sections.',
        location: 'participants.number',
        expected: `The same number (${declared}) in every section`,
        found: `Also found ${other}`,
        source: 'Programme Guide 2026 — internal consistency; NA failure mode EX-2025-E',
        level: 'critical',
      }),
    );
  }

  const apv = answerOf(answers, 'activities.apv');
  const apvPlan = answerOf(answers, 'annexes.apv_programme');
  if (apv === 'yes' && apvPlan.length < 80) {
    findings.push(
      finding({
        id: 'ka153_apv_programme',
        ruleId: 'ka153_apv',
        gate: 'compliance',
        layer: 'compliance',
        message: 'A preparatory visit is requested but no session plan is annexed.',
        location: 'annexes.apv_programme',
        expected: 'Day-by-day APV programme (who, when, what each session is for)',
        found: apvPlan || 'empty',
        source: 'Programme Guide 2026 — Preparatory visits',
        negativeExample: 'EX-2025-D, EX-2025-E',
      }),
    );
  }

  const impact = answerOf(answers, 'management.impact');
  if (impact && SLOGAN_IMPACT_RE.test(impact) && !INDICATOR_RE.test(impact)) {
    findings.push(
      finding({
        id: 'ka153_slogan_impact',
        ruleId: 'ka153_impact_indicator',
        gate: 'quality',
        layer: 'quality',
        level: 'major',
        message: 'Impact is a slogan with no indicator or measurement method.',
        location: 'management.impact',
        expected: 'Expected change · indicator · measurement method · timeline',
        found: impact.slice(0, 180),
        source: 'Programme Guide 2026, Award criteria, Management; NA failure mode EX-2024-B',
      }),
    );
  }

  const programme = `${answerOf(answers, 'activities.programme')} ${answerOf(answers, 'project.summary')}`;
  if (YOUTH_EXCHANGE_RE.test(programme) || primary === 'young_people') {
    if (YOUTH_EXCHANGE_RE.test(programme)) {
      findings.push(
        finding({
          id: 'ka153_youth_exchange_logic',
          ruleId: 'ka153_action_fit',
          gate: 'compliance',
          layer: 'compliance',
          message: 'The draft uses youth-exchange logic in a youth-worker mobility.',
          location: 'activities.programme',
          expected: 'Professional development of youth workers (PDA)',
          found: 'Youth-exchange framing',
          source: 'Programme Guide 2026 — What the Action is for; Never mix Youth Exchange logic',
          negativeExample: 'EX-2024-B',
        }),
      );
    }
  }

  const objectives = answerOf(answers, 'relevance.objectives');
  if (objectives && answerOf(answers, 'activities.programme')) {
    const objTokens = [...tokenize(objectives)];
    const actTokens = tokenize(answerOf(answers, 'activities.programme'));
    const overlap = objTokens.filter((t) => actTokens.has(t));
    if (objTokens.length >= 4 && overlap.length === 0) {
      findings.push(
        finding({
          id: 'ka153_objective_activity_chain',
          ruleId: 'ka153_logic_chain',
          gate: 'consistency',
          layer: 'consistency',
          level: 'major',
          message: 'Objectives do not chain to the activity programme (no shared specific terms).',
          location: 'activities.programme',
          expected: 'Activities that implement the stated objectives',
          found: 'No overlapping content words between objectives and programme',
          source: 'Programme Guide 2026 — Design: consistency between needs, objectives, activities',
          negativeExample: 'EX-2025-E',
        }),
      );
    }
  }

  const duration = Number.parseInt(
    String(answerOf(answers, 'activities.duration_days') || getFact(facts, 'activity_duration_days')?.value || ''),
    10,
  );
  const timetable = answerOf(answers, 'annexes.timetable');
  if (Number.isFinite(duration) && duration > 0 && timetable) {
    const dayMarks = timetable.match(/\bday\s*\d+\b/gi) || [];
    const uniqueDays = new Set(dayMarks.map((d) => d.toLowerCase()));
    if (uniqueDays.size > 0 && Math.abs(uniqueDays.size - duration) >= 2) {
      findings.push(
        finding({
          id: 'ka153_duration_timetable',
          ruleId: 'ka153_duration',
          gate: 'consistency',
          layer: 'consistency',
          level: 'major',
          message: 'Activity duration contradicts the timetable.',
          location: 'annexes.timetable',
          expected: `${duration} activity days`,
          found: `${uniqueDays.size} distinct day headings`,
          source: 'Programme Guide 2026 — PDA duration 2–60 days; annex timetable',
        }),
      );
    }
  }

  const eligibility = schema.eligibility || {};
  const orgText = answerOf(answers, 'organisations.partners');
  const orgCount =
    getFact(facts, 'participating_organisations')?.value ??
    Number.parseInt(String(orgText).match(/\b(\d+)\b/)?.[1] || '', 10);
  if (Number.isFinite(Number(orgCount)) && Number(orgCount) < (eligibility.minPartners || 2)) {
    findings.push(
      finding({
        id: 'ka153_min_partners',
        ruleId: 'ka153_eligibility_partners',
        gate: 'compliance',
        layer: 'compliance',
        message: `KA153 requires at least ${eligibility.minPartners || 2} participating organisations from different countries.`,
        location: 'organisations.partners',
        expected: `≥ ${eligibility.minPartners || 2} organisations`,
        found: String(orgCount),
        source: eligibility.source || schema.source,
      }),
    );
  }

  return findings;
}

function tokenize(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 4),
  );
}

function isSpecificEnough(text, expected) {
  const t = (text || '').trim();
  if (t.length < 60) return false;
  if (/selected carefully|various workshops|as appropriate|to be confirmed|tbd\b/i.test(t)) return false;
  if (expected.some((item) => /weight/i.test(item)) && !WEIGHTING_RE.test(t) && /selection/i.test(expected.join(' '))) {
    return false;
  }
  return true;
}

export function traceEvidence(evaluationSchema, answers) {
  const findings = [];
  for (const criterion of evaluationSchema.criteria || []) {
    for (const sub of criterion.subCriteria || []) {
      const mapped = sub.mappedFormFields || [];
      if (mapped.length === 0) {
        findings.push(
          finding({
            id: `schema_gap_${sub.id}`,
            ruleId: 'schema_gap',
            gate: 'evidence',
            layer: 'evidence',
            level: 'critical',
            message: `Schema gap: sub-criterion ${sub.id} has no mappedFormFields.`,
            location: sub.id,
            expected: 'At least one form field mapping',
            found: 'none',
            source: sub.source,
          }),
        );
        continue;
      }
      const located = mapped.map((id) => ({ id, value: answerOf(answers, id) }));
      const empty = located.filter((row) => !row.value);
      const weak = located.filter((row) => row.value && !isSpecificEnough(row.value, sub.evidenceExpected || []));
      if (empty.length === located.length || weak.length === located.length) {
        const found = located
          .map((row) => `${row.id}: ${row.value ? row.value.slice(0, 120) : '(empty)'}`)
          .join(' | ');
        findings.push(
          finding({
            id: `evidence_${sub.id}`,
            ruleId: sub.id,
            gate: 'evidence',
            layer: 'evidence',
            level: empty.length === located.length ? 'critical' : 'major',
            message: `Missing evidence: ${sub.description}`,
            location: mapped[0],
            mappedFormFields: mapped,
            expected: (sub.evidenceExpected || []).join('; '),
            found,
            source: sub.source,
          }),
        );
      }
    }
  }
  return findings;
}

function gateStatus(findings, gate, failLevels = ['critical']) {
  const hits = findings.filter((f) => f.gate === gate);
  if (hits.some((f) => failLevels.includes(f.level))) return 'fail';
  if (hits.length) return 'review';
  return 'pass';
}

export function summarizeReadiness(findings) {
  const counts = { critical: 0, major: 0, minor: 0 };
  for (const f of findings) {
    if (counts[f.level] != null) counts[f.level] += 1;
  }
  const gates = {
    schema: gateStatus(findings, 'schema'),
    compliance: gateStatus(findings, 'compliance'),
    consistency: gateStatus(findings, 'consistency'),
    evidence: gateStatus(findings, 'evidence'),
    quality: 'review',
  };
  const blocking = counts.critical > 0 || gates.schema === 'fail' || gates.compliance === 'fail';
  return {
    status: blocking ? 'not_ready' : 'in_review',
    counts,
    gates,
  };
}

/**
 * @param {{ actionCode: string, answers?: Record<string, string>, facts?: object[], callYear?: number }} input
 */
export function validateApplication(input) {
  const lock = requireConfirmedAction(input.actionCode);
  if (!lock.ok) {
    return {
      actionCode: input.actionCode || null,
      findings: [
        finding({
          id: 'action_lock',
          ruleId: 'action_lock',
          message: lock.error,
          location: 'actionCode',
          expected: 'User-confirmed exact action code',
          found: String(input.actionCode || 'missing'),
          source: 'APPLICATION-ENGINE.md §4',
        }),
      ],
      readiness: {
        status: 'not_ready',
        counts: { critical: 1, major: 0, minor: 0 },
        gates: {
          schema: 'fail',
          compliance: 'fail',
          consistency: 'fail',
          evidence: 'fail',
          quality: 'review',
        },
      },
    };
  }

  const answers = input.answers && typeof input.answers === 'object' ? input.answers : {};
  const facts = Array.isArray(input.facts) ? input.facts : [];
  const schema = loadFormSchema(lock.actionCode, input.callYear || 2026);
  const evaluation = loadEvaluationSchema(lock.actionCode, input.callYear || 2026);

  if (!schema) {
    return {
      actionCode: lock.actionCode,
      findings: [],
      readiness: {
        status: 'in_review',
        counts: { critical: 0, major: 0, minor: 0 },
        gates: {
          schema: 'pass',
          compliance: 'review',
          consistency: 'review',
          evidence: 'review',
          quality: 'review',
        },
      },
      note: `No form schema shipped for ${lock.actionCode} yet. KA153 is Slice 1.`,
    };
  }

  const findings = [...layerA(schema, answers, facts)];
  if (evaluation) {
    findings.push(...traceEvidence(evaluation, answers));
  }

  const missing = schema.minimumFacts
    ? missingGenerationFacts(facts.length ? facts : [], schema.minimumFacts).filter((key) => {
        const field = flattenFormFields(schema).find((f) => f.factKey === key);
        return !field || !answerOf(answers, field.id);
      })
    : [];
  for (const key of missing) {
    if (findings.some((f) => f.id === `missing_fact_${key}`)) continue;
    const usable = isUsableFact(getFact(facts, key));
    if (usable) continue;
    findings.push(
      finding({
        id: `missing_fact_${key}`,
        ruleId: 'minimum_facts',
        gate: 'schema',
        message: `Generation requires confirmed fact “${key}”.`,
        location: key,
        expected: 'locked + confirmed',
        found: getFact(facts, key)?.status || 'missing',
        source: schema.source,
      }),
    );
  }

  return {
    actionCode: lock.actionCode,
    findings,
    readiness: summarizeReadiness(findings),
  };
}
