# Review changelog draft <entry>

## Description

Workflow task: `review.changelog.<entry>`. Owner: reviewer. Depends on `draft.changelog.<entry>`. Link the run's promotion artifact.

## Inputs

- `drafts/<entry>/changelog.md`.
- The Jira tickets in its `stories` header, opened again.

## Output

- `drafts/<entry>/review.json`, shaped by `feature-promotion/assets/contracts/review.schema.json`.
- `evidence/review.changelog.<entry>/<attempt>/task-result.json`.

## Acceptance criteria

1. Every sentence of the draft is judged supported, not supported or contradicted, with brief evidence from the ticket.
2. The verdict is pass only when every sentence is supported and none of the fail rules in `channel-copy` apply.
3. The task result validates with `validate-task-result.mjs`.

## Lifecycle and handoff

Read-only except for the review file. A fail is a finished review, so the task is done with verdict fail; the orchestrator sends the draft back. Never edit the draft and never approve it.

## Technical report

Not recorded yet. During execution, replace this final section with the current attempt’s
outcome, outputs, checks and material limitations, blockers or next action, and the result
and evidence paths. Preserve all task requirements above this heading. Follow
`managing-kajoo-tasks` for report updates; keep chat summaries short.
