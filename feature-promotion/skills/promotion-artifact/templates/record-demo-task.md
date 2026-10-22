# Record demo clip <entry>

## Description

Workflow task: `demo.record.<entry>`. Owner: demo-recorder. Depends on `demo.shotlist.<entry>`. Link the run's promotion artifact.

## Inputs

- `drafts/<entry>/demo/shot-list.json`, the approved version.
- The saved sign-in of the demo account at `<sign-in path under /mnt/uploads>`. Never print, copy or quote it.
- `demo-recording` for the procedure, scripts and checks.

## Output

- `drafts/<entry>/demo/steps.json`, with the shot list's captions in the same order.
- `drafts/<entry>/demo/demo-16x9.mp4`, `drafts/<entry>/demo/demo-4x5.mp4`, `drafts/<entry>/demo/cover.png`, `drafts/<entry>/demo/frames/` and `drafts/<entry>/demo/report.json`.
- `evidence/demo.record.<entry>/<attempt>/task-result.json`.

## Acceptance criteria

1. `record.cjs record` and `encode.mjs` both report ok.
2. Every frame in `frames/` was inspected and passes the checks in `demo-recording`.
3. The clip is 15 to 90 seconds long and shows only the demo workspace named by `demoUrl`.
4. The task result lists both clips, the cover and `report.json` as evidence with their hashes, and validates with `validate-task-result.mjs`.

## Lifecycle and handoff

Mark in-progress before recording. On a rework, change only what the user asked for and record again. Exit code 3 means the sign-in is missing or expired: set the task to blocked and say a new saved sign-in is needed. Never post or upload the clip anywhere.

## Technical report

Not recorded yet. During execution, replace this final section with the current attempt’s
outcome, outputs, checks and material limitations, blockers or next action, and the result
and evidence paths. Preserve all task requirements above this heading. Follow
`managing-kajoo-tasks` for report updates; keep chat summaries short.
