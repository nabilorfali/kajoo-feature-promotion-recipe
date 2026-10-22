# Data contracts

JSON Schema draft 2020-12. Documents reject unknown fields. The scripts check the fields they rely on by hand; they are not a general schema engine. External validators may resolve the local relative schema references.

- `context.schema.json`: the run's `context.json`, the non-secret facts every agent reads first.
- `shortlist.schema.json`: the recommendation, then the user's approved choices.
- `story-facts.schema.json`: one `stories/<KEY>.json` fact sheet written by the researcher.
- `review.schema.json`: one `drafts/<entry>/review.json` verdict written by the reviewer.
- `task-result.schema.json`: one worker attempt result, `evidence/<task-id>/<attempt>/task-result.json`.
- `decision.schema.json`: one entry of `decisions.json`; the same contract as Sitecore Migration v3.
- `published.schema.json`: `reports/published.json`, what was created where.

See ../../references/state.md for where each file lives and ../../references/decisions-and-approvals.md for how decisions are checked.
