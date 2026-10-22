# Promotion state

Each run has its own folder. The promotion artifact's `content.stateFileDir` names it; the default is `/workspace/.kajoo/<projectId>/promotion/<runId>`. Every path inside a decision, a task result or a report is relative to this folder. Anything that must outlive the chat goes here; `/workspace/tmp/chats/<chatId>/` is per-chat scratch.

`runId` is the date plus a short slug of the target, for example `2026-10-21-release-145` or `2026-10-21-story-kajoo-5292`.

```
<run folder>/
  context.json              non-secret facts every agent reads first
  workflow.json             the only task-status authority
  decisions.json            user approvals with file hashes
  shortlist.json            the recommendation, then the user's approved choices
  stories/<KEY>.json        researcher fact sheets
  drafts/<entry>/
    changelog.md            the exact text that would be published
    review.json             the reviewer's verdict
    readme-create.json      the exact request body for the hidden entry
    demo/                   shot list, steps, both clips, cover, frames and report (see demo-recording)
  publish/<entry>/
    hidden-readback.json    what ReadMe returned after the hidden create
    public-readback.json    what ReadMe returned after the public step
  evidence/<task-id>/<attempt>/task-result.json   one worker attempt result
  reports/
    published.json          what was created where, for idempotency
    kajoo-workflow-bindings.json  workflow task id to Kajoo task id
    run-summary.md          the final summary
```

Contracts for each document are in ../assets/contracts. The run's starting workflow is ../assets/profiles/changelog/workflow.json; create `workflow.json` from it only when absent and never overwrite progress on resume. Never put secrets, tokens or customer personal data in the run folder.

The coordinator is the only writer of `context.json`, `workflow.json`, `decisions.json`, `shortlist.json` and `reports/`. Workers write only the output files their Kajoo task names and their own attempt folder under `evidence/`.

## Inspect before initialization

The run folder may not exist yet. Check before listing it; a missing folder is expected for a new run:

```bash
RUN_DIR="<run folder>"
if [ -d "$RUN_DIR" ]; then ls -la "$RUN_DIR"; else echo "Promotion run has not been initialized yet: $RUN_DIR"; fi
```

Initialize with `mkdir -p` and write files only when absent:

```bash
RUN_DIR="<run folder>"
mkdir -p "$RUN_DIR/stories" "$RUN_DIR/drafts" "$RUN_DIR/publish" "$RUN_DIR/evidence" "$RUN_DIR/reports"
[ -f "$RUN_DIR/workflow.json" ] || cp /mnt/skills/workspace/feature-promotion/assets/profiles/changelog/workflow.json "$RUN_DIR/workflow.json"
```
