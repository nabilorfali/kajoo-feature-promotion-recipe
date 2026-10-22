# Task result contract

Workers write one complete TASK_RESULT for each attempt at `evidence/<task-id>/<attempt>/task-result.json`, shaped by ../assets/contracts/task-result.schema.json. Attempts are numbered from 1; a rework is a new attempt and earlier attempts stay as history.

- `taskId`: the exact workflow task id from the Kajoo task description.
- `outcome`: `success`, `failed`, `blocked`, `needs-redo` or `skipped`.
- `summary`: a short factual outcome.
- `evidence`: each output file with its kind, run-folder path, SHA-256 and what was observed.
- `changedFiles`: the run-folder files this attempt wrote.
- `checkpoint`: always `null`; promotion workers change no repository.
- `unresolved`: gaps that stop the task's acceptance criteria. A successful result has none.

Before returning, the worker runs:

```
node /mnt/skills/workspace/feature-promotion/scripts/validate-task-result.mjs <run folder> evidence/<task-id>/<attempt>/task-result.json --task <task-id>
```

If it fails, the worker fixes only its own result or files and runs it again. The orchestrator runs the same check after the worker returns. A missing or invalid result is an incomplete attempt, not success. This is an attempt record, not a second status store: the worker sets its own Kajoo task status and Technical report, and only the orchestrator records the outcome in `workflow.json`.

## Chat communication

Write for the person running the promotion. Start each task with one short sentence on what you will do before the first tool call. Give a brief update at real milestones, not for every tool call. Keep detail in the task's Technical report and finish chat with a short outcome, any blocker, and the task link.
