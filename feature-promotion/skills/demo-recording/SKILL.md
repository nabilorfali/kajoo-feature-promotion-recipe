---
name: demo-recording
description: Use when planning, recording or checking a short demo clip of a promoted feature in the Kajoo web app, from an approved shot list, in the workspace sandbox.
---

# Demo recording

## Supporting file paths

This workspace skill is mounted at `/mnt/skills/workspace/demo-recording/`. Read this file with `read` before listing the folder; the scripts appear once it has been read. Scripts: `scripts/record.cjs` and `scripts/encode.mjs`. Examples: `assets/shot-list.example.json`, `assets/steps.example.json`. Format of the shot list: `assets/shot-list.schema.json`.

## What a demo is

One clip per filmable entry, 30 to 60 seconds and never more than 90, with no sound. It opens on the result within 3 seconds, shows a title, one short caption per step and a visible cursor. It comes in two files, `demo-16x9.mp4` (1920×1080) and `demo-4x5.mp4` (1080×1350), plus `cover.png`. It records the real app on stage, signed in to the demo organization, which holds only made-up data.

## Shot list (orchestrator)

`drafts/<entry>/demo/shot-list.json`, shaped by `assets/shot-list.schema.json`:

- `environment` is `https://stage2.kajoo.ai`.
- 3 to 8 steps. Each has `shows` (what is on screen, plain words) and `caption` (at most 8 words).
- Steps come from the story's acceptance criteria and the approved changelog text only. Captions follow `channel-copy`: facts only, no ticket keys, no promises, no internal names.
- The first step already shows the feature or its starting point; never a sign-in page or a settings tour.
- An entry is not filmable when its criteria change nothing on screen (for example a speed-up, a back-end fix or a permission rule). Say why in one line and skip it.

## Sign-in

The recorder never asks for or handles a password. The person creates a saved sign-in of the demo account on their own computer and attaches it in the chat:

```
npx playwright open --save-storage=kajoo-demo.json https://stage2.kajoo.ai
```

They sign in, close the window, and attach `kajoo-demo.json`. It lands read-only under `/mnt/uploads/<chatId>/`. `record.cjs` keeps only the stage app's own cookies from it, in memory. The app session lasts at most 3 days, so ask for a new file when the script reports exit code 3. Never print, copy, summarize or quote the file.

## Recording (demo recorder)

1. Plan with `probe`. It opens one page signed in and saves a screenshot and the page's accessibility tree, so you can pick targets by role and name. Start from `/` to find the demo workspace and project.

   ```
   node /mnt/skills/workspace/demo-recording/scripts/record.cjs probe --sign-in <file> --url https://stage2.kajoo.ai/ --out <demo-dir>/probe
   ```

2. Write `drafts/<entry>/demo/steps.json` like `assets/steps.example.json`. Captions must be the approved shot list's captions, in the same order. Actions: `goto` (a path on the app), `click`, `hover`, `type` (`text`, optional `target`), `press`, `waitFor`, `pause`, `scroll`. Targets use exactly one of `role` (with `name`), `label`, `placeholder`, `text`, `testId` or `selector`; prefer `role` and `name`. Mark waits for an AI answer or a slow load with `"cut": true` so they are removed from the clip. A step's `hold` (default 1600 ms) keeps its caption on screen.

3. Record. Run it with a bash `timeout` of at least 300 seconds; the script stops itself after 240.

   ```
   node /mnt/skills/workspace/demo-recording/scripts/record.cjs record --sign-in <file> --steps <demo-dir>/steps.json --shot-list <demo-dir>/shot-list.json --out <demo-dir>
   ```

   Exit codes: 2 bad input, 3 sign-in missing, expired or rejected, 4 a step failed (see `failed-step-<n>.png`), 5 the sandbox cannot reach the app (run `sudo /usr/local/bin/start-proxy.sh`, then retry once), 6 time limit.

4. Encode. It installs a full ffmpeg on first use (`imageio-ffmpeg`, about 5 seconds), trims the blank start and the cuts, draws the title and captions, and writes both clips, the cover, `frames/` and `report.json`.

   ```
   node /mnt/skills/workspace/demo-recording/scripts/encode.mjs <demo-dir>
   ```

## Checking the clip

Look at every image in `frames/` with `read` before handing over. Fail and record again when any of these is true:

- a blank, white or loading frame, or a spinner where the result should be;
- a caption that is cut off, overlaps the feature, or does not match what is on screen;
- anything outside the demo organization: a real person's name or email, a customer, a token or an error;
- the clip is shorter than 15 or longer than 90 seconds (`report.json`).

Two failed recordings of one entry: stop and report what went wrong. Never hand over a clip that failed a check.

## Files

All under `drafts/<entry>/demo/` in the run folder: `shot-list.json`, `steps.json`, `timing.json`, `raw/raw.webm`, `captions-16x9.ass`, `captions-4x5.ass`, `demo-16x9.mp4`, `demo-4x5.mp4`, `cover.png`, `frames/`, `report.json`. The Code tab can open and download them because they are under `/workspace`.

Run the tests from the recipe folder with `node --test skills/demo-recording/tests/*.test.mjs`.
