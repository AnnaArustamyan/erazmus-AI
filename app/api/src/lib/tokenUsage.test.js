import { describe, it, expect } from 'vitest';
import { estimateTokensFromText, readUsageTotalTokens } from './tokenUsage.js';

describe('readUsageTotalTokens', () => {
  it('prefers total_tokens when present', () => {
    expect(readUsageTotalTokens({ total_tokens: 42, prompt_tokens: 10, completion_tokens: 5 })).toBe(
      42,
    );
  });

  it('sums prompt and completion when total is missing', () => {
    expect(readUsageTotalTokens({ prompt_tokens: 10, completion_tokens: 5 })).toBe(15);
  });

  it('accepts input_tokens / output_tokens aliases', () => {
    expect(readUsageTotalTokens({ input_tokens: 8, output_tokens: 4 })).toBe(12);
  });

  it('returns 0 for empty payloads', () => {
    expect(readUsageTotalTokens(null)).toBe(0);
    expect(readUsageTotalTokens({})).toBe(0);
  });
});

describe('estimateTokensFromText', () => {
  it('estimates from character length', () => {
    expect(estimateTokensFromText('abcd'.repeat(10))).toBe(10);
  });

  it('returns 0 for empty text', () => {
    expect(estimateTokensFromText('   ')).toBe(0);
  });
});
