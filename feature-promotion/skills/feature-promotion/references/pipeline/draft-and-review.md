# Draft and review

After gate 1, `materialize-shortlist.mjs` adds one draft task and one review task per approved entry. An entry is a headline story key, or `grouped` for every approved supporting story.

1. The writer drafts `drafts/<entry>/changelog.md` from the fact sheets its task lists, following `channel-copy`, and returns a TASK_RESULT.
2. The orchestrator validates the result, then dispatches the reviewer on the matching review task.
3. The reviewer opens the tickets again, judges every sentence, writes `drafts/<entry>/review.json` and returns a TASK_RESULT. A pass is advice, not approval.
4. On a fail, the orchestrator adds the review path to the draft task's inputs and sends it back to the same writer for one new attempt, then reviews again. After two failed reviews of one entry it stops and shows the user the findings.
5. Gate 2: the orchestrator shows the exact text and the reviewer's notes in a normal message, then asks one single-select question per entry in one call: "Is this changelog text ready?" with "Yes, it is accurate", "Needs changes" and "Pause". It records one `verification` decision per entry. "Needs changes" sends the user's words to the writer as a new attempt; the earlier approval no longer counts.

Entries are independent and can run in parallel. Two workers never write the same entry's files.
