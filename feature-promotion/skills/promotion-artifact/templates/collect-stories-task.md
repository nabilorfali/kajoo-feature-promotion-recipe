# Read the stories and their context

## Description

Workflow task: `collect.stories`. Owner: researcher. Link the run's promotion artifact. Run folder: the artifact's `stateFileDir`.

## Inputs

- `context.json`: the target (a Jira fix version, an epic key or a story key), the Jira project, and `jiraSite`, passed as `cloudId` in every Jira call.

## Output

- `stories/<KEY>.json` for every story in the target, shaped by `feature-promotion/assets/contracts/story-facts.schema.json`.
- `evidence/collect.stories/<attempt>/task-result.json`.

## Acceptance criteria

1. Every issue in the target is read, across all result pages.
2. Each fact sheet copies facts from the ticket only; anything the ticket does not say is `null` or `unknown` and listed in `notStated`.
3. Bugs are included with their type, so the recommendation can skip them.
4. The task result validates with `validate-task-result.mjs`.

## Lifecycle and handoff

Mark in-progress before reading. Mark done only when every criterion holds; blocked with the exact gap otherwise. Do not recommend, draft or touch any system except Jira reads.

## Technical report

Not recorded yet. During execution, replace this final section with the current attempt’s
outcome, outputs, checks and material limitations, blockers or next action, and the result
and evidence paths. Preserve all task requirements above this heading. Follow
`managing-kajoo-tasks` for report updates; keep chat summaries short.
