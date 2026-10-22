# Kajoo project plan sync

`workflow.json` is the execution record. The Kajoo project's epic and tasks are the user-visible projection of it. Keep them in step, never as two plans. Load `managing-kajoo-tasks` for every task and epic write; it covers revisions, bulk writes, ranks and the Technical report. The shared `workflow` skill's plan-sync reference describes the general rules; this file is the promotion specifics.

- One epic per run, named `Promotion <runId>`. Do not adopt an unrelated epic with a similar name.
- Create the epic and the two Collect tasks at the start. Create Draft, Review and Publish tasks only after gate 1 and `materialize-shortlist.mjs`, with one `bulk-create-tasks` call, so the plan never shows work the user did not approve.
- Copy the workflow's dependencies into the tasks' `dependsOn` and give every task a rank spaced by 1000 in workflow order.
- Write each task's description from its template in the `promotion-artifact` skill before dispatching it.
- Record each pair in `reports/kajoo-workflow-bindings.json` as workflow task id to Kajoo task id. Match by binding, never by title. Read the binding and the plan before every reconciliation.

## Who writes what

- A worker owns its Kajoo task: it sets `in-progress`, writes its output files and the task's `## Technical report`, and sets the honest final status.
- The orchestrator checks the worker's output files against the acceptance criteria, then records the result in `workflow.json`. It never rewrites a worker's report or finishes a worker's task for it. A rejected result goes back to the same worker.
- The orchestrator owns `collect.recommend` and the publish tasks and updates them itself.

| Workflow status | Kajoo task status |
| --- | --- |
| pending | todo |
| running | in-progress |
| done | done |
| blocked | blocked |
| failed | blocked, with the failure in the Technical report |
| skipped | done, only with an explicit user decision noted in the Technical report |

If a Kajoo task cannot be saved, say the saved status is stale and do not start any task that depends on it.
