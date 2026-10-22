# Changelog entries for docs.kajoo.ai

The existing changelog entry is the May 2026 platform launch. It is a long announcement. Feature entries are shorter.

## File format

Each entry is one file, `drafts/<entry>/changelog.md`, with a header and then the body in Markdown:

```
---
title: See which model Auto picked
type: improved
slug: see-which-model-auto-picked
stories: [KAJOO-5292]
---
Auto mode now shows the model it chose for each answer...
```

- `title`: 3 to 10 words, starts with a verb or the thing that changed, no trailing period, at most 90 characters.
- `type`: `added` for something new, `improved` for something better, `fixed` for a repair. Use only these.
- `slug`: lowercase letters, digits and dashes. Short and readable. No ticket key.
- `stories`: the story keys covered. For the grouped entry, every supporting key. The keys stay in the header only. The build script removes the header, so keys never reach the public text.

## Body of a headline entry

Aim for 60 to 180 words.

1. One sentence on what is new or better, from the customer's side.
2. Two to four short bullets on what they can now do, each backed by the ticket.
3. One sentence on where to find it, only if the ticket says.

No headings needed for entries this short.

## Body of the grouped entry

Title: `Improvements in <release name as customers know it>` or `More improvements this release`. Type `improved`. One bullet per story, one sentence each, same rules.

## Example shape

```
Auto mode now tells you which model answered.

- See the model name next to each response while Auto is on.
- Check it any time to understand why an answer looks the way it does.
```

This is a shape, not a fact. Never copy example wording into a real draft.
