# Demo

The demo phase comes after review and before publish. It runs per entry once that entry's text is approved; entries stay independent. Follow `demo-recording` for the shot list rules, the sign-in, the scripts and the checks.

1. Decide whether the entry can be filmed. If not, set `demo.shotlist.<entry>` and `demo.record.<entry>` to skipped with a one-line reason, and say it in the chat. A `grouped` entry is usually not filmed.
2. Write `drafts/<entry>/demo/shot-list.json`. In a normal message show the title, the stage demo organization, the target length, both shapes, and each step as "what it shows: caption". In the same message ask for a saved sign-in of the demo account with the command from `demo-recording`, unless one was attached in this chat in the last 3 days.
3. Demo shot list gate: "Record this shot list?" with "Record it", "Change it" and "Skip the video". "Change it" applies the person's words, shows the list again and asks again. "Skip the video" skips both demo tasks.
4. Once the shot list is approved and the sign-in is attached, put the sign-in path into the record task, run the gate check, and dispatch the demo recorder with `Work on <kajoo-task taskId="..." name="..." />` only.
5. Validate the returned task result and read `report.json`. A blocked task with exit code 3 needs a new saved sign-in: ask for it, then send the task back.
6. Demo clip gate. First write a normal message with the length, the captions with their times, the recorder's checks, and where both clips and the cover are in the run folder (the Code tab opens and downloads them). Then ask "Is this demo ready?" with "Yes, it's ready", "Needs changes" and "Skip the video". "Needs changes" sends the person's words to the recorder as a new attempt; the earlier approval no longer counts. "Skip the video" keeps the text and drops the clip.
7. After approval, say which file suits which post: `demo-16x9.mp4` for desktop-first posts, `demo-4x5.mp4` for the mobile feed, `cover.png` as the thumbnail. The person uploads it in HubSpot's social composer. The recipe never uploads or posts a clip.
