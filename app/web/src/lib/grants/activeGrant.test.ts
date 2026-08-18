import { describe, it, expect } from 'vitest'
import {
  confirmedActionCode,
  isConfirmedAction,
  PENDING_ACTION,
  resolveActiveGrantId,
  grantForConversation,
} from './activeGrant'
import type { GrantApplication } from './types'

function grant(partial: Partial<GrantApplication>): GrantApplication {
  return {
    id: 'g1',
    actionCode: 'KA153',
    title: 'Draft',
    status: 'draft',
    percentComplete: 0,
    answers: {},
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  }
}

describe('active grant resolution', () => {
  it('prefers the remembered id when it still exists', () => {
    const grants = [
      grant({ id: 'old', updatedAt: '2026-08-02T00:00:00.000Z' }),
      grant({ id: 'remembered', updatedAt: '2026-08-01T00:00:00.000Z' }),
    ]
    expect(resolveActiveGrantId(grants, 'remembered')).toBe('remembered')
  })

  it('falls back to the most recently updated grant', () => {
    const grants = [
      grant({ id: 'older', updatedAt: '2026-08-01T00:00:00.000Z' }),
      grant({ id: 'newer', updatedAt: '2026-08-03T00:00:00.000Z' }),
    ]
    expect(resolveActiveGrantId(grants, 'missing')).toBe('newer')
  })

  it('treats PENDING as unconfirmed even if actionConfirmed was omitted', () => {
    const pending = grant({ actionCode: PENDING_ACTION, actionConfirmed: false })
    expect(isConfirmedAction(pending)).toBe(false)
    expect(confirmedActionCode(pending)).toBeNull()
    expect(isConfirmedAction(grant({ actionCode: 'KA153', actionConfirmed: true }))).toBe(true)
  })

  it('finds the grant that owns a conversation', () => {
    const grants = [
      grant({ id: 'a', conversationId: 'conv-1' }),
      grant({ id: 'b', conversationId: 'conv-2' }),
    ]
    expect(grantForConversation(grants, 'conv-2')?.id).toBe('b')
  })
})
