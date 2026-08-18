import { describe, it, expect } from 'vitest';
import {
  recommendActionCode,
  requireConfirmedAction,
  SUPPORTED_ACTION_CODES,
} from './actionLock.js';

describe('action lock', () => {
  it('recommends exact youth codes and never a bundled KA152-154', () => {
    expect(recommendActionCode('KA153 mobility of youth workers')).toBe('KA153');
    expect(recommendActionCode('youth workers training course')).toBe('KA153');
    expect(recommendActionCode('youth exchange in Portugal')).toBe('KA152');
    expect(recommendActionCode('youth participation activities')).toBe('KA154');
    expect(recommendActionCode('I want a youth project about the environment')).toBeNull();
    expect(recommendActionCode('hello')).toBeNull();
  });

  it('refuses generation without an explicit confirmed code', () => {
    expect(requireConfirmedAction(null).code).toBe('ACTION_NOT_CONFIRMED');
    expect(requireConfirmedAction('KA152-154').code).toBe('ACTION_NOT_CONFIRMED');
    expect(requireConfirmedAction('KA210').code).toBe('ACTION_NOT_SUPPORTED');
    expect(requireConfirmedAction('KA220').ok).toBe(false);
    expect(requireConfirmedAction('KA153')).toEqual({ ok: true, actionCode: 'KA153' });
  });

  it('keeps KA2 visible but not generatable', () => {
    expect(SUPPORTED_ACTION_CODES.has('KA210')).toBe(false);
    expect(SUPPORTED_ACTION_CODES.has('KA153')).toBe(true);
  });
});
