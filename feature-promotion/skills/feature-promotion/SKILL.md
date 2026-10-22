---
name: feature-promotion
description: Use when running, resuming or checking a feature promotion run that turns shipped Jira work into approved docs.kajoo.ai changelog entries.
---

# Feature promotion

Use the shared `workflow` contract for phases, tasks and dependencies. This skill adds the promotion phases, the approval gates, the run state and the evidence rules. It does not write copy; `channel-copy` owns wording and `readme-changelog` owns every call to ReadMe.

[Filesystem scripts](scripts/README.md) check approvals against file hashes, turn the approved shortlist into tasks, and validate worker results. Every agent reads the run's `context.json` first. Every Jira call passes its `jiraSite` as `cloudId`; never guess, look up or try another site, and if Jira refuses it, stop and report the exact error. Contracts are in [assets/contracts](assets/contracts/README.md).

## Start and resume

The `promotion-artifact` skill owns the run's Kajoo artifact, its run folder and the Collect phase. Enter this skill once the artifact and Collect tasks exist. Read [state](references/state.md) before touching the run folder. Inspect the folder before reading it; a new run has none.

Keep progress in one `workflow.json`, outputs in the run folder, and lessons only in platform memory. On resume, read `workflow.json`, `decisions.json`, `reports/published.json` and the latest task results before acting. A task marked running after an interruption is not proof it failed; look for its result first. A new chat reads the same files and never rebuilds approvals from the conversation.

A run that waits more than 24 hours for an answer is closed by Kajoo. Nothing is lost: when the user writes again, read the run folder and ask the pending question again. Silence is never an answer.

## Phases

| Phase | Tasks | Owner | Procedure |
| --- | --- | --- | --- |
| Collect | `collect.stories`, `collect.recommend` | researcher, orchestrator | [collect](references/pipeline/collect.md) |
| Draft | `draft.changelog.<entry>` | writer | [draft and review](references/pipeline/draft-and-review.md) |
| Review | `review.changelog.<entry>` | reviewer | [draft and review](references/pipeline/draft-and-review.md) |
| Demo | `demo.shotlist.<entry>`, `demo.record.<entry>` | orchestrator, demo-recorder | [demo](references/pipeline/demo.md) |
| Publish | `publish.hidden.<entry>`, `publish.public.<entry>` | orchestrator | [publish](references/pipeline/publish.md) |

Collect is the only phase that exists before gate 1. The starting workflow is `assets/profiles/changelog/workflow.json`; the later phases are listed in `assets/profiles/changelog/phase-catalog.json` and created by `materialize-shortlist.mjs` only after the shortlist is approved. A coming-soon request stops after the shortlist: changelog entries are for shipped work only.

## Coordination

The orchestrator alone writes `workflow.json`, `decisions.json`, `shortlist.json`, `context.json` and `reports/`. Workers receive a Kajoo task whose description names their inputs, outputs and acceptance criteria, and return one [task result](references/task-results.md). Dispatch with `Work on <kajoo-task taskId="..." name="..." />` only. If a task is missing something, fix its description before dispatch.

After a worker returns, validate its result with `validate-task-result.mjs`, check its output files, and only then record the outcome in `workflow.json` and the Kajoo plan per [plan sync](references/plan-sync.md). A rejected result goes back to the same worker. Entries are independent and can run in parallel; two workers never write the same files.

## Gates

Four publishing gates and two demo gates, all `ask-user-input` questions answered by the user, each recorded as a decision tied to the hashes of the files it covers. See [decisions and approvals](references/decisions-and-approvals.md). Nothing is created or changed outside the run folder until `check-decisions.mjs` reports the matching decision as current and approving. An edit to a covered file makes its approval stale; ask again.

A phase completion is never permission to start the next gate's action. Technical success, a passing review or a clean script run is never approval.

## Evidence and recovery

- Every external write is idempotent: check `reports/published.json` and ask ReadMe whether the slug exists before creating anything.
- Write `reports/published.json` right after a successful create, before anything else.
- A failed or blocked task needs the user's choice to retry, repair or stop. Review and approval are never skipped to get past a gate.
- If the stories or their acceptance criteria change after gate 1, reopen the affected tasks and ask for the shortlist again.

## Promotion artifact boundary

The promotion artifact is the durable, user-visible description of the run: target, mode, run folder, epic, and the final link and visibility of each entry. Workflow status, approvals, review findings and raw API answers stay in the run folder. Read [promotion-artifact](../promotion-artifact/SKILL.md) before recording anything in the artifact.
