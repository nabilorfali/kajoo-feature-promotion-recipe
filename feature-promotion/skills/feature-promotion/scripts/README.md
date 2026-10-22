# Promotion filesystem CLIs

Requires Node.js 20+, no install, connectors or database. Read the skill first to stage these files at `/mnt/skills/workspace/feature-promotion/scripts`. Every path a script reads is relative to the run folder and must stay inside it. Scripts never change existing files: outputs go to a new file named with `--out`, and an existing destination is refused. Stdout is one JSON summary; exit 1 means invalid input or a failed check.

| Script | Inputs | Output and effects | Acceptance cases |
| --- | --- | --- | --- |
| check-decisions.mjs | run folder, `--require kind:scopeId` once per gate | per decision: current, stale or missing, and whether it approves; per gate: ok or the reason | edited or missing covered file, wrong choice, missing user response or time, newer decision overrides older, malformed documents |
| materialize-shortlist.mjs | run folder with `workflow.json`, `shortlist.json`, `decisions.json`; `--out <new file>` | a new workflow with Draft, Review and Publish tasks per approved entry; never changes the current one | no or stale shortlist approval, recommendation not done, phases already present, empty or malformed shortlist |
| validate-task-result.mjs | run folder, the result path, `--task <workflow task id>` | whether one worker attempt result is complete and its evidence still matches the files | wrong task, unknown fields, changed or missing evidence, success with gaps, paths outside the run folder |

After `materialize-shortlist.mjs`, promote its output to `workflow.json` and run the shared validator: `node /mnt/skills/workspace/workflow/scripts/validate.mjs <run folder>/workflow.json`.

See ../references/decisions-and-approvals.md for the gate table and ../references/task-results.md for the result contract. Run the tests with the command in ../tests/README.md.
