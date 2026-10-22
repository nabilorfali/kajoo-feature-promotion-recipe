---
name: readme-changelog
description: Use when creating, reading back or publishing a changelog entry on docs.kajoo.ai through the readme connector. Covers the exact calls, the hidden-then-public sequence and how to avoid creating an entry twice.
---

# ReadMe changelog

Only the orchestrator uses this skill, and only after the matching decision passes `check-decisions.mjs` from the `feature-promotion` skill. The connector is named `readme` and calls ReadMe API v2 through its `execute-request` tool. That tool is set to ask for approval on every call, so the user sees each call as well as the decision.

Never put an API key in a request, a file or a message. The connector carries the key. If a call is refused as unauthorized, stop, tell the user the readme connector needs its Authorization header set, and do nothing else.

## Before the first write in a run: read check

Call `execute-request` with title `ReadMe API` and this request. It only reads.

```json
{ "method": "get", "url": "https://api.readme.com/v2/changelogs?per_page=1" }
```

A successful answer shows the connector can reach the right project. Do this once per run, before drafting, so a broken connector surfaces early.

## Build the exact request

For each entry, after gate 2:

```
node /mnt/skills/workspace/readme-changelog/scripts/build-readme-request.mjs <run folder>/drafts/<entry>/changelog.md --out <run folder>/drafts/<entry>/readme-create.json
```

It checks the header, refuses ticket keys, placeholders and future promises, strips the header, and writes the body to send. It never overwrites a file. See [the script README](scripts/README.md). If it fails, send the problem back to the writer; do not fix the text yourself. The hash of `readme-create.json` is what gate 3 covers.

## Create hidden (gate 3)

1. Run the gate check for `mutation:publish-hidden:changelog:<entry>`. Stop if it fails.
2. Check `reports/published.json`. If the entry is there, skip to the read-back.
3. Check the slug is free with `execute-request`: `GET https://api.readme.com/v2/changelogs/<slug>`. A 404 means free. A 200 means something with that slug exists: stop and ask the user. Do not overwrite.
4. Create it with `execute-request`, title `ReadMe API`:

```json
{
  "method": "post",
  "url": "https://api.readme.com/v2/changelogs",
  "headers": [{ "name": "Content-Type", "value": "application/json" }],
  "postData": { "mimeType": "application/json", "text": "<the exact contents of readme-create.json>" }
}
```

5. A 201 answer includes `data.uri`. Write the entry into `reports/published.json` immediately, before anything else.
6. Read it back with `GET https://api.readme.com/v2/changelogs/<slug>`. Save `data` as `publish/<entry>/hidden-readback.json`. Check that `privacy.view` is `anyone_with_link`, `title` and `type` match the draft, and `content.body` equals the draft body exactly. Any difference is a failure: report it and stop.
7. Give the user the link to look at: `https://docs.kajoo.ai/changelog/<slug>`. A hidden entry opens for anyone who has that link.

## Make public (gate 4)

1. Run the gate check for `mutation:publish-public:changelog:<entry>`. It covers the draft and the hidden read-back, so a changed draft or a changed hidden entry blocks it.
2. Check the read-back is still hidden. If the entry is already public, record that in `published.json` and stop.
3. Set it public with `execute-request`:

```json
{
  "method": "patch",
  "url": "https://api.readme.com/v2/changelogs/<slug>",
  "headers": [{ "name": "Content-Type", "value": "application/json" }],
  "postData": { "mimeType": "application/json", "text": "{\"privacy\":{\"view\":\"public\"},\"allow_crawlers\":\"enabled\",\"created_at\":\"<now, ISO 8601>\"}" }
}
```

Setting `created_at` to now makes the changelog list the entry on the day it went live.

4. Read it back, save `data` as `publish/<entry>/public-readback.json`, confirm `privacy.view` is `public`, and set `madePublicAt` in `published.json`.
5. Tell the user the public link and ask them to open it. You cannot see the rendered page; the API read-back is what you verified.

## Never

- Never delete a changelog entry. If the user wants one removed, tell them to do it in ReadMe, or record a separate decision first.
- Never edit an entry after it is public. A correction is a new draft, a new review, and new decisions.
- Never send an entry that has not been through the reviewer and gate 2.
