# Make changelog entry <entry> public

## Description

Workflow task: `publish.public.<entry>`. Owner: orchestrator. Depends on `publish.hidden.<entry>`. Link the run's promotion artifact.

## Inputs

- `publish/<entry>/hidden-readback.json` and `drafts/<entry>/changelog.md`.

## Output

- The entry set public, `publish/<entry>/public-readback.json`, `madePublicAt` in `reports/published.json`.

## Acceptance criteria

1. Gate 4 is current and approving immediately before the call.
2. The read-back shows the entry public.
3. The artifact records public visibility and the link.

## Lifecycle and handoff

If the user keeps it hidden, mark the task done with that choice in the Technical report. Never delete or edit a public entry.

## Technical report

Not recorded yet. During execution, replace this final section with the current attempt’s
outcome, outputs, checks and material limitations, blockers or next action, and the result
and evidence paths. Preserve all task requirements above this heading. Follow
`managing-kajoo-tasks` for report updates; keep chat summaries short.
