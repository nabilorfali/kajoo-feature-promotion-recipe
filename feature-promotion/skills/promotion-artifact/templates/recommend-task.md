# Recommend what to promote

## Description

Workflow task: `collect.recommend`. Owner: orchestrator. Depends on `collect.stories`. Link the run's promotion artifact.

## Inputs

- `stories/*.json` from the Collect stories task.

## Output

- `shortlist.json` as a recommendation, shaped by `feature-promotion/assets/contracts/shortlist.schema.json`.

## Acceptance criteria

1. Every story appears once with a role and a plain reason, following `feature-promotion/references/pipeline/collect.md`.
2. At most three headlines. Stories whose `live` is not `yes` are not headline or supporting.
3. The readme connector passed its read check.

## Lifecycle and handoff

Mark done when the recommendation is written. Asking gate 1 and recording the user's answer happen after this task and are not part of it.

## Technical report

Not recorded yet. During execution, replace this final section with the current attempt’s
outcome, outputs, checks and material limitations, blockers or next action, and the result
and evidence paths. Preserve all task requirements above this heading. Follow
`managing-kajoo-tasks` for report updates; keep chat summaries short.
