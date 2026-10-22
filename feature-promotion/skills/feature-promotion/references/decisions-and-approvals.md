# Decisions and approvals

Keep concise keyed decisions in `decisions.json` as `{ "version": 1, "decisions": [...] }`, one entry per answer, shaped by ../assets/contracts/decision.schema.json. A decision approves only when the user's own answer (`userResponse`, copied as given) and the time it arrived (`at`) are recorded and every file it covered still hashes to the recorded SHA-256.

## Gates

| Gate | Kind | scopeId | Approving choice | Files it covers |
| --- | --- | --- | --- | --- |
| 1 Shortlist | `workflow-plan` | `shortlist:<runId>` | `approve` | `shortlist.json` |
| 2 Draft text | `verification` | `draft:changelog:<entry>` | `verified` | `drafts/<entry>/changelog.md`, `drafts/<entry>/review.json` |
| Demo shot list | `workflow-plan` | `demo-shotlist:<entry>` | `approve` | `drafts/<entry>/demo/shot-list.json` |
| Demo clip | `verification` | `demo:<entry>` | `verified` | `drafts/<entry>/demo/demo-16x9.mp4`, `drafts/<entry>/demo/demo-4x5.mp4`, `drafts/<entry>/demo/cover.png`, `drafts/<entry>/demo/steps.json` |
| 3 Create hidden | `mutation` | `publish-hidden:changelog:<entry>` | `approve-execution` | `drafts/<entry>/changelog.md`, `drafts/<entry>/readme-create.json` |
| 4 Make public | `mutation` | `publish-public:changelog:<entry>` | `approve-execution` | `drafts/<entry>/changelog.md`, `publish/<entry>/hidden-readback.json` |

Other answers are recorded too and never approve: `needs-rework` and `pause` for a verification, `pause` for a mutation, and `skip` for either demo gate. The two demo gates never block publishing: a skipped video lets the entry go on to gate 3. A newer decision for the same kind and scope replaces the older one, which stays as history.

## Asking

Every gate is an `ask-user-input` question, the only tool call in its turn, under 500 characters, with the details written as a normal message first. The user sees only chat messages, never command output, file reads or task cards, so a question may refer only to what that message shows. Questions always reach a person, even when a chat runs in Auto or Bypass approval. Approval of one gate never implies the next. Technical success, a passing review or a previous chat summary is never approval.

## Recording and checking

1. Write the files the gate covers first. For gate 1, write the user's final choices into `shortlist.json` before hashing it.
2. From inside the run folder, compute each covered file's hash with `sha256sum <file>`.
3. Append the decision with `id`, `kind`, `scopeId`, `choice`, `rationale`, `userResponse`, `at` and `inputs`, then read `decisions.json` back.
4. Immediately before any step that needs the approval, run the gate check:

```
node /mnt/skills/workspace/feature-promotion/scripts/check-decisions.mjs <run folder> --require <kind>:<scopeId>
```

Exit 0 means every required decision is current and approving. Exit 1 says per gate why not: no decision, a covered file changed or is missing, a choice that is not an approval, or no recorded user response. When a gate is stale, tell the user plainly which file changed and ask again; never re-record an old answer.

## Approval mode

Run this recipe on Default approval. The readme connector's request tool is set to ask before every call, which is a second check after the gate. Auto approval can let an AI approve that tool call and Bypass skips it, so neither is allowed for a workspace or scheduled job running this recipe.
