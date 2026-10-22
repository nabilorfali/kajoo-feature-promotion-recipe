# ReadMe request builder

Requires Node.js 20+, no install. Read the skill first to stage it at `/mnt/skills/workspace/readme-changelog/scripts`.

| Script | Inputs | Output and effects | Acceptance cases |
| --- | --- | --- | --- |
| build-readme-request.mjs | one `drafts/<entry>/changelog.md`, `--out <new file>` | the exact create body: title, slug, type, body without the header, hidden, not indexed; never overwrites | missing or unreadable header, title over 90 characters or ending in punctuation, unknown type, bad slug, ticket key in title, body or slug, placeholders, future promises, empty or oversized body |

It reads no network and changes nothing but its new output file. Calling ReadMe is the orchestrator's job, through the readme connector, after the gate check. Run the tests with the command in ../tests/README.md.
