# Skill-first feature promotion

Four agents turn shipped Jira work into docs.kajoo.ai changelog entries through four approval gates, using native workspace tools, focused skills and small tested scripts. The recipe supplies procedures and local contracts; each real run still depends on the live Jira and ReadMe connectors.

## Responsibility map

- `feature-promotion`: phases, gates, run state, decisions, task results and the changelog profile.
- `promotion-artifact`: the run's Kajoo artifact, its run folder, the Collect phase and every task template.
- `channel-copy`: the rules every customer-facing sentence follows, and the changelog format.
- `readme-changelog`: the read check, hidden create, read-back and public step on ReadMe, and the request builder.
- `workflow` and `managing-kajoo-tasks`: shared with Sitecore Migration v3, bundled here as recipe skills and staged on demand at `/mnt/skills/workspace/<name>`.

## Execution and distribution

1. Load workflow and feature-promotion. Read the run's `context.json`. The starting workflow is `feature-promotion/assets/profiles/changelog/workflow.json`; later phases are created only after the shortlist is approved.
2. The orchestrator owns one workflow file and the decisions. Workers receive a Kajoo task with its inputs, outputs and acceptance criteria, and return one task result. Independent entries may run in parallel; each gate needs the user's explicit answer.
3. Use native read/write/edit/bash tools for the run folder. Jira and ReadMe are reached only through their connectors; the ReadMe API key lives in the readme connector, never in files or chat.
4. Run this recipe on Default approval only. The gates are questions only a person answers; the readme request tool also asks before every call, which Auto approval can let an AI approve and Bypass skips.
5. This is an internal TechGuilds recipe. It is published with the other recipes and starts Hidden in the Kajoo library, so no organization sees it. To create a workspace from it, a super admin refreshes the Kajoo library, makes the recipe Available, a TechGuilds user creates the workspace at once, and the super admin hides it again. A workspace made from it keeps receiving Recipe Sync updates while it is hidden.
6. After creating the workspace, connect `jira` with OAuth, and on `readme` add the header `Authorization` with the value `Bearer` followed by the ReadMe API key of the docs.kajoo.ai project. Custom connector headers are stored as plain text today, like other custom connector credentials.

## Verification boundaries

- `check-decisions.mjs` proves an approval still matches the files it covered; it does not prove the text is accurate.
- The reviewer checks drafts against the Jira tickets; a pass is advice, not approval.
- `build-readme-request.mjs` refuses ticket keys, placeholders and future promises; it cannot judge tone or truth.
- The API read-back proves what ReadMe stored. Only the user can confirm the rendered page.

Run authoring checks from this recipe folder with:

```
node --test tests/*.test.mjs skills/feature-promotion/tests/*.test.mjs skills/readme-changelog/tests/*.test.mjs skills/workflow/scripts/validate.test.mjs
```
