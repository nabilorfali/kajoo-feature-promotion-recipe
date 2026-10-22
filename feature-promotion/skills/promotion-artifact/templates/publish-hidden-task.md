# Create hidden changelog entry <entry>

## Description

Workflow task: `publish.hidden.<entry>`. Owner: orchestrator. Depends on `review.changelog.<entry>`. Link the run's promotion artifact.

## Inputs

- `drafts/<entry>/changelog.md` with a current gate 2 decision.

## Output

- `drafts/<entry>/readme-create.json` built by `build-readme-request.mjs`.
- A hidden ReadMe changelog entry, `publish/<entry>/hidden-readback.json`, and its line in `reports/published.json`.

## Acceptance criteria

1. Gate 3 is current and approving immediately before the create call.
2. The slug was free, or the existing entry is this run's own.
3. The read-back is hidden and its title, type and body equal the draft.
4. The artifact records the entry's title, stories, link and hidden visibility.

## Lifecycle and handoff

Follow `readme-changelog` exactly. Show the user the link. Making it public is the next task and needs its own approval. Mark the task done only when the read-back is hidden and equals the draft. If the user pauses at gate 3, record a `pause` decision and set this step to `blocked` in `workflow.json` and on the Kajoo task, with "Waiting for the user's OK to create the hidden entry" in the Technical report.

## Technical report

Not recorded yet. During execution, replace this final section with the current attempt’s
outcome, outputs, checks and material limitations, blockers or next action, and the result
and evidence paths. Preserve all task requirements above this heading. Follow
`managing-kajoo-tasks` for report updates; keep chat summaries short.
