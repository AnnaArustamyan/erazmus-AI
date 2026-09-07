# Product skills

These are **Claude-style skills for the EU Grantwriter models**, not Cursor coding skills.

| Layer | Lives in | Job |
|---|---|---|
| **Skills** (how) | `skills/*/SKILL.md` | Procedure for chat, generator, or application PDF |
| **Knowledge** (what) | `derived/` | Programme Guide excerpts, pass-rate rules, failed-grant notes |

Do not put fake project stories (“youth exchange between Portugal and Poland”) in the UI or in skills. Users supply facts. Skills say what to ask for and how to write. `derived/assessments/` are **negative** examples with internal IDs only.

## When each skill loads

| Skill | Loaded for |
|---|---|
| `chat-coach` | Ordinary chat |
| `project-plan` | `POST /api/plans` |
| `application-draft` | Chat “generate application”, questionnaire → PDF |

## Authoring

Follow the same shape as Claude/Cursor skills: YAML frontmatter (`name`, `description`) then instructions. Keep `SKILL.md` short. Put Guide text in `derived/`, not here.

Yearly Guide refresh still happens in `derived/` — bump skills only if the **procedure** changes (new action types, new output sections).
