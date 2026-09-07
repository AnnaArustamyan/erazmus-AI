import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { EvaluatePage } from './EvaluatePage'
import { validateGrant, type ValidationReport } from '../api/grantsClient'
import type { GrantApplication } from '../lib/grants/types'

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ accessToken: 'test-token' }),
}))

const ACTIVE_GRANT: GrantApplication = {
  id: 'grant-1',
  actionCode: 'KA153',
  callYear: 2026,
  title: 'Youth worker exchange',
  answers: {},
  facts: [],
  path: [],
  status: 'draft',
  percentComplete: 10,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
} as unknown as GrantApplication

vi.mock('../grants/GrantInterviewContext', () => ({
  useGrantInterview: () => ({ activeGrant: ACTIVE_GRANT }),
}))

vi.mock('../api/grantsClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/grantsClient')>()
  return { ...actual, validateGrant: vi.fn() }
})

// Realistic nested shape straight from validateApplication.js — this is the
// contract the frontend must read correctly (see Phase 1 fix).
function makeReport(overrides: Partial<ValidationReport> = {}): ValidationReport {
  return {
    actionCode: 'KA153',
    findings: [
      {
        id: 'schema_needs.evidence',
        level: 'critical',
        gate: 'schema',
        layer: 'schema',
        location: 'needs.evidence',
        message: 'Needs evidence: This field is required.',
      },
    ],
    readiness: {
      status: 'not_ready',
      counts: { critical: 1, major: 0, minor: 0 },
      gates: {
        schema: 'fail',
        compliance: 'pass',
        consistency: 'pass',
        evidence: 'review',
        quality: 'review',
      },
    },
    ...overrides,
  }
}

describe('EvaluatePage', () => {
  it('renders the gate summary and a working "Fix this field" link from the nested readiness.gates shape', async () => {
    vi.mocked(validateGrant).mockResolvedValue({ grant: ACTIVE_GRANT, report: makeReport() })

    render(
      <MemoryRouter>
        <EvaluatePage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Not ready')).toBeInTheDocument()

    // Gate summary must render — this was silently missing when the client read
    // the nonexistent top-level `report.gates` instead of `report.readiness.gates`.
    expect(screen.getByText('Gates')).toBeInTheDocument()
    expect(screen.getByText('Fail')).toBeInTheDocument()
    expect(screen.getByText('Quality')).toBeInTheDocument()
    // evidence and quality are both 'review' in this fixture, so two badges say this
    expect(screen.getAllByText('Review needed').length).toBeGreaterThanOrEqual(1)

    // The finding uses `location`, not `field` — the link must still appear.
    const fixLink = screen.getByRole('button', { name: /fix this field/i })
    const user = userEvent.setup()
    await user.click(fixLink)
    // No throw = it read `finding.location` successfully.
  })

  it('shows "Needs review" instead of a false "Ready" when there are no blocking findings', async () => {
    vi.mocked(validateGrant).mockResolvedValue({
      grant: ACTIVE_GRANT,
      report: makeReport({
        findings: [],
        readiness: {
          status: 'in_review',
          counts: { critical: 0, major: 0, minor: 0 },
          gates: {
            schema: 'pass',
            compliance: 'pass',
            consistency: 'pass',
            evidence: 'review',
            quality: 'review',
          },
        },
      }),
    })

    render(
      <MemoryRouter>
        <EvaluatePage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/needs review/i)).toBeInTheDocument()
    expect(screen.getByText('Deterministic checks pass')).toBeInTheDocument()
    expect(screen.queryByText(/^ready$/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Not ready')).not.toBeInTheDocument()
  })
})
