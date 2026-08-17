import { describe, it, expect } from 'vitest';
import { detectDocumentAction } from './documentIntent.js';

describe('detectDocumentAction', () => {
  it('creates a document when the user asks to draft an application', () => {
    expect(detectDocumentAction('Draft a KA153 application for youth workers in Armenia')).toBe(
      'create',
    );
    expect(detectDocumentAction('Please generate the grant application from what we discussed')).toBe(
      'create',
    );
    expect(detectDocumentAction('Write the application now')).toBe('create');
  });

  it('stays in chat for questions and ordinary intake', () => {
    expect(detectDocumentAction('How do I draft an application?')).toBe('chat');
    expect(detectDocumentAction('What is KA153?')).toBe('chat');
    expect(detectDocumentAction('We are an NGO in Yerevan working with youth workers')).toBe(
      'chat',
    );
    expect(detectDocumentAction('hi how to get started')).toBe('chat');
  });

  it('revises when a document is already open and the user changes a section', () => {
    expect(
      detectDocumentAction('Make the objectives more concrete and measurable', {
        hasDocument: true,
      }),
    ).toBe('revise');
    expect(
      detectDocumentAction('Add a partner organisation from Georgia', { hasDocument: true }),
    ).toBe('revise');
    expect(detectDocumentAction('Rewrite the Who section', { hasDocument: true })).toBe('revise');
    expect(
      detectDocumentAction('Generate the application again with the new dates', {
        hasDocument: true,
      }),
    ).toBe('revise');
  });

  it('does not revise a closed canvas for casual follow-ups', () => {
    expect(detectDocumentAction('Add a partner organisation from Georgia')).toBe('chat');
    expect(
      detectDocumentAction('What are the award criteria?', { hasDocument: true }),
    ).toBe('chat');
  });
});
