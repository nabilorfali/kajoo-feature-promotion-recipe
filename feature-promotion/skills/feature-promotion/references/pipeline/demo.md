# Demo

The demo phase comes after review and before publish. It runs per entry once that entry's text is approved; entries stay independent. Follow `demo-recording` for the shot list rules, the sign-in, the scripts and the checks.

1. Decide whether the entry can be filmed. If not, set `demo.shotlist.<entry>` and `demo.record.<entry>` to skipped with a one-line reason, and say it in the chat. A `grouped` entry is usually not filmed.
2. Write `drafts/<entry>/demo/shot-list.json`. In a normal message show the title, the stage demo project (`demoUrl` in `context.json`), the target length, both shapes, and each step as "what it shows: caption". In the same message ask for a saved sign-in of the demo account with the command from `demo-recording`, unless one was attached in this chat in the last 3 days.
3. Demo shot list gate: "Record this shot list?" with "Record it", "Change it" and "Skip the video". "Change it" applies the person's words, shows the list again and asks again. "Skip the video" skips both demo tasks.
4. Once the shot list is approved and the sign-in is attached, put the sign-in path into the record task, run the gate check, and dispatch the demo recorder with `Work on <kajoo-task taskId="..." name="..." />` only.
5. Validate the returned task result and read `report.json`. A blocked task with exit code 3 needs a new saved sign-in: ask for it, then send the task back.
6. Demo clip gate. The person watches the clips, then answers. Do these in one reply, without waiting for the person in between:
   - Write a normal message with the length, each caption from `report.json` on its own line as "0:02–0:05 caption text", the recorder's checks, and where both clips and the cover are in the run folder.
   - Call `kajoo/show-videos` with exactly these arguments, each path being the run folder followed by the path shown: `layout` "row", then `drafts/<entry>/demo/demo-16x9.mp4` with `label` "16:9" and `width` 360, then `drafts/<entry>/demo/demo-4x5.mp4` with `label` "4:5" and `width` 240. Keep the SHA-256 it returns for each clip. If it fails, for example because a clip is over 25 MB, say why in one sentence and point to the files instead.
   - As soon as it returns, ask "Is this demo ready?" with "Yes, it's ready", "Needs changes" and "Skip the video", in a step of its own with `ask-user-input` as the only tool call. Never end your reply between the clips and the question.
   - When the answer arrives, run `sha256sum` on both clips from inside the run folder and compare with the hashes `show-videos` returned. If either differs, say which clip changed since it was shown, show both clips again and ask again; never record the earlier answer. Otherwise record the decision: its clip hashes are the clips the person watched.
   "Needs changes" sends the person's words to the recorder as a new attempt; the earlier approval no longer counts. "Skip the video" keeps the text and drops the clip.
7. After approval, say which file suits which post: `demo-16x9.mp4` for desktop-first posts, `demo-4x5.mp4` for the mobile feed, `cover.png` as the thumbnail. The person uploads it in HubSpot's social composer. The recipe never uploads or posts a clip.
