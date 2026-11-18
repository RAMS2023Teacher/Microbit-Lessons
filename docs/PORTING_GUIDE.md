# Maker Lab systems: a guide for building the same features on another platform

This describes six systems built into Maker Lab (micro:bit course, Google Apps Script web app). It is written so
another developer, or another Claude session, can build matching versions on a different course platform.
For each system: what students and the teacher see, the data, the server calls, and the details that matter.
Reference code is in the Maker Lab repository (paths given), but nothing here depends on micro:bit.

Shared assumptions: each student has one saved record (Maker Lab: one JSON file per student in Drive), the teacher
has one settings record, students belong to classes, and lessons are made of steps, a quiz and a final "ship" stage.
Students earn **XP** for steps, quizzes and finished lessons, and have **levels** and **badges**.

---

## 1. Game feel: locked buttons, sounds, celebrations

**Why:** students should always know what to do next, and wins should feel like a game.

**Locked buttons.** A "Next" / "Check my answers" / "Mission accepted" / "Buy" button that isn't ready yet is
**grey, but still clickable** (a `locked` class plus `aria-disabled="true"`, not the `disabled` attribute, so the
click can be handled). Clicking it:
- plays a low buzz,
- flashes the button red and shakes it for ~0.6 s, then it goes back to grey,
- flashes the "To go on: …" note red,
- outlines in red exactly what's missing (unticked checkboxes, empty answer box, blank fields, unanswered quiz
  questions) and scrolls to the first one.
When the last requirement is met, the button turns green with a small bounce and a two-note "ready" chime.

**Sounds** (made in the browser with the Web Audio API, no sound files). Reference: `apps_script/client/lib/sfx.js`.

| Event | Sound |
|---|---|
| Tick a checkbox / pick a quiz answer | short soft blip |
| Step done / XP earned | two-note coin "ding" |
| Quiz passed, project shipped, lesson complete | short fanfare (+ confetti on lesson complete) |
| Badge | sparkly arpeggio |
| Level up | bigger fanfare |
| Buy in the shop | "ka-ching" |
| Locked button clicked / quiz failed | low buzz |
| Help request (teacher display) | doorbell, twice |

- A 🔊/🔇 toggle in the top bar, remembered per device in localStorage.
- Browsers only allow audio after a click or key press: create/resume the AudioContext on the first pointerdown.

**Animations** (reference: `apps_script/client/lib/rewards.js`):
- "+35 XP" floats up from where the student clicked, and 5–10 ⭐ fly into the XP bar in the top bar, which "bumps".
- New badge: a full-screen spotlight card (big icon, spinning gold rays, name, description, "tap to keep going",
  auto-closes after ~4 s), plus a toast.
- Level up: confetti + toast.
- Buying: a coin burst around the button.
- Respect `prefers-reduced-motion`: keep sounds, drop motion.

One function decides the sound for a reward response: level up → level-up fanfare; quiz passed / shipped /
lesson complete → fanfare; badge → badge sound; otherwise coin.

---

## 2. Shop, "XP to spend", and Robot Rush (the arcade game)

### XP to spend
- **Levels use all the XP ever earned and never go down.** The shop spends from a separate balance:
  `spendable = xp_earned_total − xp_spent`. Store `spent` on the student record.
- Items: **cosmetics** (avatar parts with a price, unlock type `("cost", n)` next to the existing
  `("level", n)` and `("badge", id)` unlocks) and **power-ups** with levels (each level has its own price).
- The server checks the price and the balance; buying records `owned["part:eyes:star"]` or `powerups.turbo = 2`
  and a `shop_log` entry. Grey "locked" Buy buttons when the student can't afford it (click explains how much more
  XP they need).

Maker Lab's power-ups (prices per level):

| Power-up | Effect in the game | Prices |
|---|---|---|
| ⚡ Turbo | runs faster (+12% per level) | 100 / 200 / 350 |
| 🛡️ Shield | blocks one hit per level | 120 / 240 / 400 |
| 🧲 Bolt magnet | pulls in pickups from farther | 80 / 160 / 300 |
| 🚀 Rocket dash | Space = speed burst that smashes enemies, one per level | 100 / 200 / 350 |
| ⏱️ Overtime | +5 s race clock per level | 150 / 300 |

### The arcade game (Robot Rush)
- A 45-second, three-lane side-scrolling race on a `<canvas>` with the student's **own avatar** (drawn without its
  background square). ↑/↓ or W/S switch lanes, Space dashes, plus on-screen Up/Dash/Down buttons for touchscreens.
- Enemies (🐛, then lane-hopping 👾 from 12 s, then 🧱 from 26 s) slow you down for ~1 s; shields block hits;
  pickups (🔩) add points; speed rises over time.
- Score = distance/10 + 25 × pickups + 50 × enemies smashed with a dash.
- Reference: `apps_script/client/lib/game.js` (one file, ~230 lines).

### When students can play (the important rules)
- **The arcade is closed unless the teacher opens it for a class** (from the class display or the class page).
  It opens "until the bell" if the class end time is set, otherwise for an hour; the teacher can close it any time.
- **Students earn play time**: finishing a lesson adds **5 minutes** to their bank (capped at 15). Each race uses its
  length from the bank. They can only spend it while the arcade is open **for their own class**, so playing in
  another period is impossible. The teacher can also "Give everyone 5 minutes".
- The student's top bar shows "🎮 Arcade open · 4:10 to play" when they can play.

### Anti-cheat (scores come from the browser, so check them)
- A race must be **started on the server** (`/arcade/start` returns a run id and deducts the time).
- `/arcade/finish {run_id, score}` is rejected if the run id is unknown or already used, if less than
  race-length − 3 s has passed since the start, or if the score is above race_seconds × 250.

### Leaderboard
- Per class: **today** and **all time**, top 10, first names (or avatar names) and avatars, the student's own row
  highlighted. Stored per student: `best`, `day`, `day_best`; the board is built from all students in the class.

### Data on the student record
`spent, owned{}, powerups{}, shop_log[], arcade{ bank, runs[{id, at}], plays, best, best_at, day, day_best, last }`
On the class: `arcade_until` (ISO time, empty = closed).

Reference: `apps_script/server/35_arcade.js`, `course/rules.py` (`POWERUPS`, `ARCADE`, `AVATAR_OPTIONS`).

---

## 3. ✋ "I'm stuck" help requests

**Why:** students who won't raise their hand can still ask.

**Student:** every lesson has "✋ I'm stuck: ask for help" in the side panel → optional note ("What are you stuck
on?", max 140 chars) → the box turns yellow: "Help is on the way! Keep trying while you wait…" with
"I figured it out 👍" (cancel). The page checks every 20 s and resets when the teacher marks it helped.

**Teacher's class display:**
- A doorbell sound (twice) for each **new** request.
- A red, pulsing "✋ 2 need help" button in the header.
- The student's avatar on the race track turns red with a waving ✋.
- A "Needs help" list: avatar, name, exact place ("Dodge the Drop · Step 5: Read the tilt"), their note, how long
  ago, and a "✓ Helped" button that clears it.
- The display polls for requests every **5 s** (separately from its normal 20 s refresh).
- A 🔔 button plays a test doorbell (and unlocks audio on that computer).

**Data:** one request per student, stored somewhere fast to read (Maker Lab: script properties,
`help:<email>` → `{who, name, classes, at, where, note, avatar}`), expiring after an hour. The display never gets
emails: each request carries a short hash id (`who`) that the "✓ Helped" call sends back.
Also count requests per lesson step on the student record (`lesson_fb[lesson].help[step]++`) for the feedback report.

Reference: `apps_script/server/37_help.js`, help parts of `client/lesson.js` and `client/lib/screen.js`.

---

## 4. Lesson feedback + a report to improve lessons with Claude

**Student side:**
- **🤔 Confusing?** under every build step and every quiz question → pick a reason (😵 Instructions unclear,
  🐞 Code didn't work, 🧗 Too hard, 😴 Too easy, 💬 Other) + optional note → "Thanks! Your teacher will see this."
- **⭐ Rate this lesson** at the end (Ship it stage): five faces 😣😕😐🙂🤩, plus optional "What was the hardest
  part?" and "What would make this lesson better?". Rating gives **+10 XP** (that's why students actually do it);
  they can change it later.
- Automatically recorded: **first-try quiz answers** (`quiz_first`, set once) and help requests per step.

**Data:** keep feedback on the student record **outside lesson progress**
(`lesson_fb[lesson] = {flags{"step:3": {reason, note, at}}, help{step: n}, rating, hardest, change}`), because
partner features copy progress between students and would overwrite it. Same for `quiz_first`: when progress is
copied to a partner, keep each student's own first try.

**Teacher Feedback page** (per grade/course):
- Per lesson: average rating and count, started/finished counts, the most-flagged steps (flags ×2 + help requests)
  with reasons and notes, quiz questions missed by ≥30% on the first try, and student quotes.
- **📋 Copy report for Claude**, **Copy this lesson**, **⬇ Download .md**: a Markdown report with, for each lesson,
  the lesson's source **file path**, step numbers and titles as students see them, flag counts by reason,
  help requests per step, student notes, quiz miss rates with the question text, ratings, and comments.
  **No names.** Paste it to Claude and ask it to improve the lessons.
- Copying inside a sandboxed iframe: `navigator.clipboard` may be blocked, so fall back to a hidden textarea +
  `document.execCommand('copy')`.

Report format: see `docs/sample-feedback-report.md`. Reference: `apps_script/server/60_feedback.js`,
`pages.feedback` in `apps_script/client/pages.js`.

---

## 5. Class display (projector) additions

- **Fits any screen:** lay out at a fixed 1600×900 and scale with a CSS transform.
- **Clock card:** big countdown to the bell ("Time left in class"), with "Now 3:18 PM · Class ends 3:55 PM" under it;
  orange in the last 5 min, red at the bell. Before an end time is set: the time now plus a quick
  "Class ends at [time] Count down" box. (An extra activity timer was removed: two clocks confused people.)
- **Question of the day** = the lesson's short "big question" (enduring understanding, ≤15 words), editable.
- **Race track** of lesson stages with each student's avatar at their stage; avatars are sized to the largest size
  that still fits (measure on the page after layout, re-measure after fonts load), and busier stops get wider columns.
- **Class XP goal for today:** a header bar adding up XP everyone earned since midnight vs. a goal
  (default 60 × students, teacher can set a number or 0 = off); turns green with "🎉 Goal reached!".
- **Recent wins** card: badges, finished lessons, perfect quizzes.
- **Set up panel:** opens below the header buttons and closes with ✕, Done, Esc, the Set up button, or a click
  outside. (It used to cover its own button.)
- Buttons: 🎮 Open arcade / Arcade open · Close, 🔔, ⚙ Set up, Full screen, Exit; the ✋ help button and list.

Reference: `apps_script/client/lib/screen.js`, `screenPayload_` in `apps_script/server/45_teacher.js`.

---

## 6. Two grades (courses) in one app

- Each class is set to a course (here: 6th = MakeCode Blocks; 7th = MakeCode Python). The grade is **required**
  when creating a class or importing from Google Classroom (pre-picked from "6th"/"7th" in the class name), and can
  be switched on the class page (work and XP are kept).
- Students see only their course's lessons, skill tree, badges and home stats; opening another grade's lesson
  shows "this is a lesson for another grade". XP, levels, avatars, shop and arcade are shared.
- Teacher pages show every course, with a course switch where needed.
- Lessons for each course live in their own folder; each course has its own plan (order, prerequisites, map
  positions); badges tied to one lesson only show to that course.

---

## Lessons learned (do these from the start)

1. **Route every browser→server call through one function.** In Apps Script, calling a new server function directly
   can fail with "Cannot read properties of undefined (reading 'apply')" when the browser's copy of the page doesn't
   know that function yet. Maker Lab sends everything through `api('/api/run', {fn, args})` and the server
   dispatches from an allow-list; each function still checks who is calling.
2. **Never trust scores or prices from the browser**: start runs on the server, check elapsed time, cap scores,
   check balances.
3. **Anything that changes every few seconds** (help requests) shouldn't wait for a cached summary; store it where
   it's cheap to read.
4. **Partner features copy progress**: keep per-student things (feedback, first-try answers) outside the copied data.
5. **Inserting a step into a live lesson shifts saved progress by index** (finished students can become unfinished).
   Change a step's content in place instead, or give steps stable ids.
6. **Grey ≠ disabled**: a disabled button can't explain itself. Use a locked style and handle the click.
7. **Audio needs a user gesture**; give the teacher's display a button that unlocks and tests it.
8. Keep students' names out of anything meant to be pasted into an AI tool, and warn that typed notes may contain names.
