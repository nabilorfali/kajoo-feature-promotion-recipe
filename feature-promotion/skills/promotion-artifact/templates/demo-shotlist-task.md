# Plan demo clip <entry>

## Description

Workflow task: `demo.shotlist.<entry>`. Owner: orchestrator. Depends on `review.changelog.<entry>`. Link the run's promotion artifact.

## Inputs

- `drafts/<entry>/changelog.md`, approved at the text gate.
- The fact sheets of the stories in this entry: `stories/<KEY>.json`.
- `demo-recording` for the shot list rules.

## Output

- `drafts/<entry>/demo/shot-list.json`, shaped by `demo-recording/assets/shot-list.schema.json`, or a one-line reason why this entry cannot be filmed.

## Acceptance criteria

1. The shot list has 3 to 8 steps, each caption at most 8 words, and comes only from the story's acceptance criteria and the approved text.
2. The user saw the shot list in a normal message and approved it at the shot list gate, or chose to skip the video.
3. A saved sign-in of the demo account is attached in the chat before the record task starts.

## Lifecycle and handoff

Done when the shot list is approved and the sign-in is attached; the record task then names both paths. If the user skips the video, or the entry cannot be filmed, set this task and the record task to skipped with the reason. Never ask for a password.

## Technical report

Not recorded yet. During execution, replace this final section with the current attempt’s
outcome, outputs, checks and material limitations, blockers or next action, and the result
and evidence paths. Preserve all task requirements above this heading. Follow
`managing-kajoo-tasks` for report updates; keep chat summaries short.
