import { describe, it, expect } from 'vitest';
import {
  canGenerateFromFacts,
  confirmFact,
  factsFromAnswers,
  getFact,
  isUsableFact,
  KA153_MINIMUM_FACTS,
  makeFact,
  missingGenerationFacts,
  upsertFact,
} from './facts.js';

describe('facts provenance', () => {
  it('treats suggested facts as pending and unusable for generation', () => {
    const fact = makeFact({
      key: 'participant_count',
      value: 2,
      source: 'chat',
      confidence: 'suggested',
      kind: 'recommendation',
      feasibility: 'unknown',
      rationale: 'Conservative first-time scale.',
    });
    expect(fact.status).toBe('pending');
    expect(fact.kind).toBe('recommendation');
    expect(isUsableFact(fact)).toBe(false);
  });

  it('treats inferred chat facts as pending and unusable for generation', () => {
    const fact = makeFact({
      key: 'participant_count',
      value: 24,
      source: 'chat',
      confidence: 'inferred',
    });
    expect(fact.status).toBe('pending');
    expect(isUsableFact(fact)).toBe(false);
  });

  it('locks confirmed questionnaire facts', () => {
    const facts = factsFromAnswers(
      [{ id: 'participants.number', factKey: 'participant_count' }],
      { 'participants.number': '24' },
    );
    const fact = getFact(facts, 'participant_count');
    expect(fact).toMatchObject({
      value: 24,
      source: 'questionnaire',
      confidence: 'confirmed',
      status: 'locked',
    });
  });

  it('marks a locked fact stale when a conflicting value arrives', () => {
    const locked = [
      makeFact({
        key: 'participant_count',
        value: 24,
        source: 'questionnaire',
        sourceField: 'participants.number',
        confidence: 'confirmed',
        status: 'locked',
      }),
    ];
    const next = upsertFact(
      locked,
      makeFact({
        key: 'participant_count',
        value: 30,
        source: 'questionnaire',
        sourceField: 'activities.programme',
        confidence: 'confirmed',
        status: 'locked',
      }),
    );
    expect(getFact(next, 'participant_count').status).toBe('stale');
    expect(getFact(next, 'participant_count__conflict').value).toBe(30);
  });

  it('refuses generation until every KA153 minimum fact is locked', () => {
    const facts = KA153_MINIMUM_FACTS.map((key) =>
      makeFact({ key, value: key === 'needs_method' ? 'survey' : 2, confidence: 'confirmed', status: 'locked' }),
    );
    expect(canGenerateFromFacts(facts)).toBe(true);
    facts.pop();
    expect(missingGenerationFacts(facts, KA153_MINIMUM_FACTS)).toContain('venue_country');
    expect(canGenerateFromFacts(facts)).toBe(false);
  });

  it('promotes an inferred fact when the user confirms it', () => {
    const pending = [
      makeFact({ key: 'countries', value: 'AM, PT', source: 'chat', confidence: 'inferred' }),
    ];
    const confirmed = confirmFact(pending, 'countries');
    expect(isUsableFact(getFact(confirmed, 'countries'))).toBe(true);
  });
});
