---
name: promotion-artifact
description: Create, resume or update the Kajoo artifact of a feature promotion run, its run folder and its Collect phase. One artifact per run.
---

# Promotion artifact

## Supporting file paths

This workspace skill is mounted at `/mnt/skills/workspace/promotion-artifact/`. Resolve links from the file containing them. For example, the draft template is `/mnt/skills/workspace/promotion-artifact/templates/draft-changelog-task.md`.

Use the actual UTC clock for timestamps. Never invent or backdate an answer time. Never store credentials in the artifact, task descriptions or the run folder.

## Worker entry

A worker assigned a task reads the actual Kajoo task first, then the template its description names, and works only from them. It does not create artifacts, phases or other tasks.

## What the artifact holds

One `application/json` artifact per run, named `Promotion <runId>`, in the current project. Its content is the durable, user-visible record of the run:

```json
{
  "runId": "2026-10-21-release-145",
  "target": { "kind": "release", "ref": "(Agentic) Release - 145" },
  "mode": "shipped",
  "stateFileDir": "/workspace/.kajoo/<projectId>/promotion/2026-10-21-release-145",
  "epicId": "<24-character epic id>",
  "entries": {
    "KAJOO-5292": { "title": "See which model Auto picked", "stories": ["KAJOO-5292"], "visibility": "public", "link": "https://docs.kajoo.ai/changelog/see-which-model-auto-picked" }
  }
}
```

`entries` starts empty and gains an entry only when it is created on ReadMe. Workflow status, approvals, review findings, raw API answers and errors stay in the run folder. Before each update, read the artifact, merge only verified facts into its full content, update it, and read it back. Never overwrite a fact with an empty guess.

## Resolve the run

This step only reads. For a request that names a run or resumes one, list the project's artifacts and reuse the one whose `content.runId` matches. A new request gets a new run id and a new artifact. Never reuse another run's artifact, epic or tasks, and never adopt an epic by its name. A failed lookup is not proof the artifact is absent.

## Create a new run

Check the tools the whole step needs before the first write: `create-artifact`, `update-artifact`, `create-epic`, `bulk-create-tasks` or `create-task`, `update-task`. If one is missing, say which and change nothing.

1. Create the artifact with empty `entries` and the run folder path. Use the returned id; never invent ids.
2. Initialize the run folder as [state](../feature-promotion/references/state.md) shows, and write `context.json` with the artifact id. Copy `jiraProject` and `jiraSite` from `feature-promotion/assets/profiles/changelog/context.json`.
3. Create the epic `Promotion <runId>` and record its id in the artifact.
4. Create the two Collect tasks as `todo`, linked to the epic, with ranks 1000 and 2000 and the second depending on the first: `collect.stories` from [collect stories](templates/collect-stories-task.md), assigned to the researcher, and `collect.recommend` from [recommend](templates/recommend-task.md), assigned to the orchestrator.
5. Write `reports/kajoo-workflow-bindings.json` and read back the tasks.

## Load files only when needed

| Trigger | File to read |
| --- | --- |
| Creating the Collect tasks | [collect stories](templates/collect-stories-task.md), [recommend](templates/recommend-task.md) |
| Creating tasks after the shortlist is approved | [draft](templates/draft-changelog-task.md), [review](templates/review-changelog-task.md), [create hidden](templates/publish-hidden-task.md), [make public](templates/publish-public-task.md) |
| A worker starting its task | the one template its task names |

Fill a template at its execution step with verified values. Keep the template's sections and its final Technical report section. Omit unknown optional facts rather than inventing them.

## Specialist roster

When a task assigns or suggests an agent, resolve its id from the available-agent roster and dispatch directly. Do not call list-agents or get-agent, or inspect a worker's skills, tools or connectors to recheck it. Look one up only when the named agent is missing, or after an actual execution failure.
