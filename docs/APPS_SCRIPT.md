# Maker Lab in Google Apps Script

The same site, run as a Google Apps Script web app in the teacher's school account: no hosting,
no passwords, and student work stays in the teacher's Google Drive.

**To install or update it, follow [dist/apps-script/INSTALL.md](../dist/apps-script/INSTALL.md).**
You paste 4 Script files and the `appsscript.json` manifest into a project, run `setup` once, and deploy.

## How it works for students and teachers

* **Sign-in:** everyone is identified by their school Google account. The script's owner is the teacher;
  everyone else is a student. A student types the class's 6-letter join code and their name once.
* **Getting code onto a micro:bit:** **Download .hex**, then drag the file onto the MICROBIT drive in the
  Files app. Google's Apps Script frame blocks USB, so one-click **Send to micro:bit** isn't available here
  (the school check confirmed this on student Chromebooks). The simulator works.
  The **micro:bit setup** page (in the menu, and suggested on a student's dashboard until they finish it) shows how to
  turn on Chrome's "Ask where to save each file", so a download can be saved straight onto MICROBIT.
* **Saving:** each student's work is one file in **My Drive → Maker Lab data → students**, so a whole class
  saving at once never waits in line (the school check measured 30 saves in about 5 seconds this way,
  compared with up to 20 seconds, or failures, with one shared Sheet).
* **Gradebook:** reads a summary that catches up with new work within about a minute.
* **Bonus XP and Teacher's Pick:** show up the next time the student opens Maker Lab.
* **Google Classroom classes and students:** **My classes → Import classes** copies your active Classroom classes
  and their rosters (read-only). Students on a roster are in the class the first time they open Maker Lab, with
  their Classroom name and no join code. **Update roster** picks up students who joined or left.
* **Partners on one Chromebook:** at the top of any lesson a student picks a classmate. Their work so far is
  combined, then everything they do saves to both students' files (and both get the XP). The gradebook shows 👥.
* **Finding their way:** every step starts with a yellow **What to do** box, Next stays at the bottom of the
  screen and turns green when a step is done, Home has one big **Keep going** button, and the first lesson visit
  shows a 4-step tour (replay it with **❓ How does this work?**).
* **Class display:** a class's **📺 Class display** button opens a projector page: time left until the bell
  (set "Class ends at" in ⚙ Set up), an activity timer, the question and standard of the day, where every
  student is with their robot, and recent wins (badges, finished lessons, perfect quizzes). It catches up with
  new work within about a minute.
* **Google Classroom grades:** a class's **Google Classroom** page copies the same grades package as the
  Flask site, for the existing sender (`app/static/apps-script/maker-lab-classroom.gs`).

## What the Flask site has that this version doesn't (yet)

* The per-assignment "everyone's answers" page and CSV export (use the Google Classroom package instead)
* Re-opening a student's debug challenge
* Passwords and password resets (not needed: Google handles sign-in)

## For developers

```
apps_script/server/*.js   the Apps Script server, concatenated into Code.gs
apps_script/client/*.js   browser code: shim.js (fetch → google.script.run, links, filling in saved work)
                          and pages.js (dashboard, map, profile, teacher pages)
tools/build_apps_script.py  builds dist/apps-script/
dist/apps-script/         the files teachers paste (generated: don't edit)
tests/apps_script_app/    fake Google services, an API test, and a local server for browser testing
```

* **Lesson pages** are rendered by the real Flask templates at build time, gzip-compressed into
  `Pages1.gs`, and filled in with the student's saved work in the browser.
* **Lesson code** (`lesson.js`, `editor.js`, `map.js`, `profile.js`, the visuals) is the same file the Flask
  site uses. `shim.js` turns its `fetch('/api/...')` calls into `google.script.run.api(...)`.
* **Why there are no HTML files:** Apps Script strips `//` and `/* */` comments from `<script>` blocks, and it
  doesn't notice when they're inside strings (`"https://…"`, Python's `102 // 180`). That broke the page. So the
  CSS and JavaScript live gzip-compressed in `Assets.gs`, and each page has just two small scripts written
  without any slashes. All real code and data travel as web-safe base64, which a loader decodes and runs. The
  fake Google in the tests strips comments the same way, so a regression fails the tests.
* **Rules:** XP values, levels, badges, the map and avatar parts come from `app/gamify.py` through
  `Data.gs`. The logic is ported to `apps_script/server/30_rewards.js`.
* **Grading:** checks run as JavaScript regexes, and Python's `ast.parse` is replaced by a small syntax
  checker in `20_grading.js`. **The build compares both with Python on every code sample in every lesson and
  fails if they disagree.**

After changing lessons or code, rebuild and commit `dist/`:

```bash
python tools/build_apps_script.py
```

`pytest` fails if `dist/apps-script` is out of date.

To click through the Apps Script version locally (fake Google, nothing leaves the computer):

```bash
node tests/apps_script_app/serve.js dist/apps-script 5055
```

Open http://localhost:5055/exec (you're the teacher). Add `?as=sam@students.school.org` to be a student.
