import { describe, it, expect } from 'vitest';
import { loadSkill, loadSkillBody, parseSkillMarkdown } from './skills.js';

describe('product skills', () => {
  it('parses YAML frontmatter', () => {
    const parsed = parseSkillMarkdown(
      '---\nname: demo\ndescription: >\n  Does a thing.\n---\n\nHello skill.\n',
    );
    expect(parsed.name).toBe('demo');
    expect(parsed.description).toContain('Does a thing');
    expect(parsed.body).toBe('Hello skill.');
  });

  it('loads chat-coach, project-plan, and application-draft from disk', () => {
    expect(loadSkill('chat-coach').name).toBe('chat-coach');
    expect(loadSkillBody('project-plan')).toContain('Never write "—"');
    expect(loadSkillBody('application-draft')).toContain('Application form sections');
    expect(loadSkillBody('application-draft')).not.toContain('## Who');
    expect(loadSkillBody('application-draft')).not.toMatch(/Portugal and Poland/i);
  });
});
