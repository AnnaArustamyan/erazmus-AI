import { describe, it, expect } from 'vitest';
import {
  assessBrief,
  assessGeneratedDraft,
  stripMarkdownFence,
} from './draftQuality.js';

const HOLLOW_GREEN_PLAN = `# Just Exchange for Green and Good Earth

## Summary
This Erasmus+ KA121 mobility project in vocational education and training proposes a two-week mobility in Albania for 10 VET learners.
The project’s stated theme is environmental responsibility and contributing to a “greener earth.”
The current brief is not yet sufficiently developed as a project strategy. It does not define the learners’ VET field.

## Objectives
The objective for this year is: —
Specific measurable targets are: —

## Target group
The project will involve 10 VET learners.
definition of the relevant VET field: —
eligibility requirements: —
interview criteria and weightings: —
The type of fewer opportunities and the related support measures are —.

## Activities and timeline
The following elements of the mobility are not yet defined:
VET occupational content: —
practical learning tasks: —
learning outcomes: —
daily timetable: —
A detailed day-by-day session plan for the two-week learner mobility is: —.

## Expected outcomes
Expected learner outcomes are: —
Expected organisational outcomes are: —
A realistic project-level impact and indicators are: —

## Risks
| Risk | Current position | Required response |
| The project’s environmental objective is too broad | “greener earth” | Define one specific environmental objective |
| Mobility activities are not occupationally defined | Practical tasks are — | Agree a written learning programme |

## Partners needed
organisation names: —
specific VET expertise: —
The participating organisation is —.
`;

const DENSE_PLAN = `# Waste-sorting mobility for VET hospitality learners

## Summary
A VET school in Porto will send 10 hospitality learners for 10 working days to a receiving VET institute in Tirana. The occupational problem is food waste in school canteens. Learners will practise a 4-step waste-audit method and return with a canteen action they will run at home.

## Objectives
By the last mobility day each learner will complete one supervised waste audit and one reduction proposal tied to hospitality practice, assessed by the host mentor.

## Target group
10 VET hospitality learners in the final year, selected by published criteria: motivation 40%, kitchen-practice hours 30%, fewer-opportunity barriers 30%. Four learners have economic barriers; the sending school covers prepaid meals and a buddy.

## Activities and timeline
Week −4: two preparation sessions (safety, language, audit method). Days 1–10 in Tirana: daily kitchen practice plus a documented waste audit. Week +3: each learner runs a 45-minute briefing for classmates; the school records one canteen change.

## Expected outcomes
10 audit sheets; 10 proposals; 1 canteen change within 6 weeks; pre/post mentor checklist on waste-audit competence.

## Risks
If the host kitchen cannot run an audit on two days, the backup is a classroom simulation using the same checklist, still assessed by the mentor.

## Partners needed
Sending: Porto VET school (hospitality department). Receiving: Tirana VET institute with a training kitchen and a named mentor for 10 learners.
`;

describe('draftQuality', () => {
  it('strips markdown fences', () => {
    expect(stripMarkdownFence('```md\n# Title\n```')).toBe('# Title');
  });

  it('rejects a thin slogan brief before generation', () => {
    const brief = assessBrief('green project for students');
    expect(brief.ready).toBe(false);
    expect(brief.gaps.length).toBeGreaterThan(0);
  });

  it('rejects the hollow “greener earth” KA121 plan as not exportable', () => {
    const result = assessGeneratedDraft(HOLLOW_GREEN_PLAN, {
      sourceText: 'KA121 10 VET learners two weeks Albania greener earth interviews',
      kind: 'plan',
    });
    expect(result.ready).toBe(false);
    expect(result.placeholderCount).toBeGreaterThanOrEqual(10);
    expect(result.gaps.some((gap) => /KA121|accreditation/i.test(gap))).toBe(true);
    expect(result.gaps.some((gap) => /placeholder|concept/i.test(gap))).toBe(true);
  });

  it('accepts a dense occupational plan with a real logic chain', () => {
    const result = assessGeneratedDraft(DENSE_PLAN, {
      sourceText:
        'Porto VET school, 10 hospitality learners, 10 days Tirana, food waste in canteens, host mentor, return with canteen action',
      kind: 'plan',
    });
    expect(result.ready).toBe(true);
    expect(result.placeholderCount).toBeLessThan(3);
  });
});
