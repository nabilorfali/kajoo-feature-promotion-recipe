# Collect and shortlist

You recommend. The user decides. Nothing is drafted until they approve the shortlist.

Collect is the first phase: the researcher writes a fact sheet per story (`collect.stories`), then the orchestrator recommends what to promote (`collect.recommend`) and asks gate 1.

## What counts as a customer-facing story

Ask of each story: would a customer notice it on screen, in their results, or in how safe and reliable the product feels, without being told? If not, it is not a candidate.

Skip by default, and say so in the reason:

- Bugs. List them with role `skip`. The user may promote one at gate 1, for example a fix customers were waiting for.
- Internal and operational work: CI, infrastructure, tests, refactors, dependency upgrades, super admin screens, billing or cost plumbing, logging and tracing.
- Work with no user-visible result, even if it took a long time.
- Anything the ticket says is behind a feature flag that is off, or still in review or QA.

## Roles

- **headline**: a clear, visible improvement most customers would care about. Gets its own changelog entry. Choose at most three per run. A run with more than three strong candidates keeps the three with the widest reach and moves the rest to supporting.
- **supporting**: real but smaller. All supporting stories share one grouped entry.
- **skip**: not promoted, with the reason.

Weigh, in this order: how many customers it reaches, how visible it is, how easy the benefit is to state in one sentence, and whether it is live for everyone today.

## Live status

Set `live` per item from what the ticket says:

- `yes` only when the ticket says it shipped to all customers.
- `no` when it is flagged off, partial, or limited to some organizations.
- `unknown` when the ticket does not say. Do not guess.

The user confirms live status at gate 1. In this version only live work gets a changelog entry. A story marked `no` or `unknown` cannot be a headline or supporting item until the user changes it to `yes`.

## Writing the reasons

One short sentence per item, in plain words a customer would use. Say what changes for them, not what the team built. No ticket jargon.

## Presenting gate 1

1. Write a normal message first: the target and run id, then a table with one row per story: key, title, role, reason, live. Put headlines first, then supporting, then skipped.
2. Then call `ask-user-input` alone with one single-select question under 500 characters, for example "Approve this shortlist as shown?" with options "Approve as shown", "I want to change it" and "Stop here". Details never go inside the question.
3. If they want changes, they answer in chat. Apply their words exactly, show the updated table, and ask again.
4. Only on "Approve as shown" write the final `shortlist.json`, hash it and record the decision. See [decisions and approvals](../decisions-and-approvals.md).

A request for one story still goes through gate 1 as a one-row table. A request for coming soon work stops here: write the shortlist, tell the user that changelog entries are for shipped work and the other channels are not part of this version yet, and end the run without drafting.
