# Publish

Publishing belongs to the orchestrator and follows the `readme-changelog` skill. It runs per entry after gate 2.

1. Build the exact request body with `build-readme-request.mjs`. A failure goes back to the writer; the orchestrator never edits the text.
2. Gate 3: state the exact title and type, and that anyone with the link can open a hidden entry. Options "Create it hidden" and "Pause". Check the gate, then create the entry hidden, record it in `reports/published.json` at once, read it back and show the link.
3. Gate 4: first write a normal message with the hidden link and what the read-back confirmed, and ask the user to open it. Then ask "Make it public now?" with "Make it public" and "Keep it hidden". Check the gate, set it public, read it back and record the time. "Keep it hidden" records a `pause` and leaves the step `blocked`, never done, as the [make public template](../../../promotion-artifact/templates/publish-public-task.md) says. The run summary then calls the run paused.
4. Close: write `reports/run-summary.md` with each entry's public link or hidden status, what was not published and why, and the writers' open questions. Update the promotion artifact with the same durable facts.

Never delete or edit an entry after it is public. A correction is a new draft, a new review and new decisions.
