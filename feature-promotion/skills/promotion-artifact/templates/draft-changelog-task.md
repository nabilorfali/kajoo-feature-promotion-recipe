# Draft changelog entry <entry>

## Description

Workflow task: `draft.changelog.<entry>`. Owner: writer. Entry: `<entry>`, a headline story key or `grouped`. Link the run's promotion artifact.

## Inputs

- `shortlist.json`, the approved version.
- The fact sheets of the stories in this entry: `stories/<KEY>.json`.
- On a rework only: `drafts/<entry>/review.json` or the user's requested changes.

## Output

- `drafts/<entry>/changelog.md`, in the format of `channel-copy/references/changelog.md`.
- `evidence/draft.changelog.<entry>/<attempt>/task-result.json`.

## Acceptance criteria

1. The header has title, type, slug and stories.
2. Every sentence is backed by a listed fact sheet.
3. No ticket keys, placeholders or promises about the future in the title or body.
4. Open questions and the least certain sentence are in the Technical report.
5. The task result validates with `validate-task-result.mjs`.

## Lifecycle and handoff

Mark in-progress before writing. On a rework, change only what the review or the user asked for, and say what changed. Never publish.

## Technical report

Not recorded yet. During execution, replace this final section with the current attempt’s
outcome, outputs, checks and material limitations, blockers or next action, and the result
and evidence paths. Preserve all task requirements above this heading. Follow
`managing-kajoo-tasks` for report updates; keep chat summaries short.
