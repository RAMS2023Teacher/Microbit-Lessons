# Update brief: bring another course app in line with Maker Lab

**Who this is for.** An AI model (or developer) updating an existing course web app, for example the MIT App
Inventor course app, so it has the same systems as *micro:bit Maker Lab* as of 19 November 2026. Paste this whole
document into that project and ask the model to follow it.

**What to keep.** Keep the other app's look: its colours, fonts, layout, mascot and wording style. This brief is about
behaviour, data and rules. Where Maker Lab uses a micro:bit idea (robot avatar, circuit-board game, "MakeCode share
link"), swap in the other course's equivalent (see "Adapting to your course" at the end).

**How to use it.**
1. Read "Ground rules" and "Step 0: audit" and do the audit first. Report what the app already has.
2. Build the systems in the order under "Suggested order". Reliability comes first because everything else saves data.
3. After each system, run its "Done when" checks. Do not skip the tests for reliability.
4. Never change or migrate saved student data without a backup and without telling the teacher.

Shared assumptions (same as Maker Lab): one saved record per student, one settings record for the teacher, students
belong to classes, and a lesson has four stages: **Mission → Build (steps) → Quiz → Ship it**. Students earn **XP**,
have **levels** and **badges**. Maker Lab is a Google Apps Script web app that stores JSON files in Google Drive;
adapt the storage notes if the other app stores data differently.

---

## Ground rules (apply to everything)

- **One door to the server.** Every browser→server call goes through one function with an allow-list on the server
  (Maker Lab: `api(path, body)`; teacher actions go through `api('/api/run', {fn, args})`). Each server function
  still checks who is calling. Calling new server functions directly from an old cached page fails in Apps Script
  ("Cannot read properties of undefined (reading 'apply')").
- **Never trust the browser** for scores, prices, unlocks or who the user is. The server checks all of them.
- **No student emails or full names on shared screens.** The class display gets first names (or avatar names) and a
  short hash id per student, never emails.
- **Grey is not disabled.** A button that isn't ready is grey but clickable, so the click can explain what's missing.
- **Respect "less motion"** (the user's setting and the system's `prefers-reduced-motion`): keep sounds and static
  highlights, drop movement.
- **Changing a live lesson:** never insert or delete steps in a lesson students have started if progress is saved by
  step number. Change a step in place, or give steps stable ids.
- **Things that copy between partners** (lesson progress) must not carry per-student data (feedback, first quiz
  try). Keep those outside the copied object.

---

## Step 0: audit (do this before changing anything)

List, for the app as it is now:
- Where data is stored, and what happens on a read error, a write error and a missing record.
- Every place storage (folders, files, sheets, records) can be created.
- Every timer or poll in the browser and how often it runs.
- Which of the systems below already exist, partly exist or are missing.

Report the audit to the teacher before building.

## Suggested order

1. Reliability and backups (section 1)
2. Game feel, XP, levels, badges (2) and the shop (3)
3. Help requests (6), idle hints (7), partners (8)
4. Feedback and the report (9)
5. Class display (10)
6. Arcade games (4) and calling cards and unlocks (5)
7. Skill tree (11), accessibility, translation, bug reports, student view (12)
8. Multiple courses (13), only if the app has more than one grade or course

---

## 1. Reliability and backups

**Why:** a sister app once "reset" itself when Google was busy: a failed read was treated as "no data yet" and a
blank record was saved over real work. These rules prevent that.

### Data is never replaced or reset
- **An error is not "missing".** Reads of the data folder, a student record or the settings are tried up to 4 times.
  If they still fail, stop the request with a `BUSY` error ("The app is very busy right now. Your work is safe.").
  Do not continue with an empty value.
- **A student record is "none" only when that student never had one.** Keep a pointer per student (Maker Lab: script
  property `student:<email>` → file id). If the pointer exists and the read fails, throw. Never build a blank record.
- **Damaged data throws.** A file that doesn't parse is an error, never `{}`.
- **Create storage only when no id was ever saved for it**, inside a lock, re-checking inside the lock (two first
  visitors must make one folder, not two).
- **A failed save never creates a second file** and never moves the pointer.
- Remember every storage id ever used (Maker Lab: `storage:history`), so an owner can find old data.

### Coping with a busy class (Apps Script allows about 30 requests at once)
- **Browser queue:** one request at a time per browser; identical waiting requests share one call; back-to-back
  saves of the same thing merge into the newest. "Busy" answers (Google's *too many simultaneous invocations*, lock
  timeouts, the server's `BUSY`) are retried up to 5 times with growing, randomised waits, showing a small
  "⏳ Busy… saving your work" note. No error dialog for busy. A page that can't load because of `BUSY` shows a
  friendly page and reloads itself after 4–8 seconds.
- **Polling limits:** class display main refresh every 20 s; help list every 10 s; a student's own help status every
  30 s. Never poll from a background tab (`document.hidden`).
- **Server:** a student's click reads only that student's record. The class-wide summary is cached (Maker Lab:
  60 s in a file, plus a 20 s shared cache copy, with a "building" guard so only one request rebuilds it). Teacher
  setting changes take a short lock; student saves take no lock; slow work (roster sync, gifting play time, backups)
  never holds the lock.

### Backups
- Once a day, all student records and the settings go into one dated backup file, built **a few students at a time**
  while the teacher uses the app (teacher home, class display), so no student waits. Keep the last 8.
- Teacher home has a **"🗄️ Your data"** card: link to the data folder, number of students and classes, today's
  backup status, links to backups, a **Back up now** button, and a warning if more than one data folder exists.
- Deploying a new version must never touch data.

### Done when (write these as automated tests)
- Storage failing to open, read or write never creates storage, never changes a stored id and never overwrites a
  student record.
- One student click reads at most 3 files with 300 other students present.
- 20 students opening the same page rebuild the summary once.
- One backup per day, 8 kept, "Back up now" redoes today's.
- Browser test: the server turns away 3 requests while a student ticks a box; the busy note shows, no error appears,
  and the tick is saved.

---

## 2. Game feel, XP, levels, badges

### XP (Maker Lab's numbers)
| Event | XP |
|---|---|
| Mission accepted (answered the partner talk question) | 10 |
| Each build step with all its checks ticked | 10 |
| Quiz passed (75% or better) | 30 |
| Perfect quiz / perfect on the first try | +20 / +10 |
| Each extension added | 25 |
| Project shipped (link turned in) | 50 |
| Rated the lesson | 10 |
| Whole lesson complete | 50 |
| Every badge | 25 |

Give each award a unique key so it can never be paid twice. Keep a short log of recent XP for the profile page.

### Levels
12 levels at 0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250, 3850 XP, each with a title. **Levels count
all XP ever earned and never go down**, even when XP is spent in the shop.

### Badges
Rule types Maker Lab uses: N steps done, a named lesson complete, N lessons complete, N perfect quizzes, N first-try
perfects, N extensions, N projects shipped, a lesson complete with a partner, customised the avatar, finished an
assignment early, given by the teacher, whole course complete. A badge tied to one lesson only shows in that course.

### Locked buttons
"Next", "Check my answers", "Start building", "Buy" are grey (class `locked`, `aria-disabled="true"`) until ready.
Clicking a locked button: low buzz, the button flashes red and shakes for about 0.6 s, the "To go on: …" note turns
red, and exactly what's missing is outlined in red and scrolled into view. When the last requirement is met the
button turns green with a small bounce and a "ready" chime.

### Sounds (Web Audio, no files) and animations
Sounds: tick, step/XP coin, pass fanfare, badge arpeggio, level-up fanfare, buy "ka-ching", locked buzz, help
doorbell. A 🔊/🔇 toggle in the top bar, remembered per device. Audio only starts after the first click or key.

Animations: "+35 XP" floats up and stars fly into the XP bar; a new badge gets a full-screen spotlight card
(auto-closes after about 4 s); level up and lesson complete get confetti; buying gets a coin burst.

---

## 3. Shop and "XP to spend"

- `spendable = total XP earned − XP spent`. Store `spent`. Show "⚡ 165 XP to spend".
- **Cosmetics:** avatar parts with a price. **Power-ups:** each has levels, each level its own price.
- The server checks price and balance. Record `owned["part:<slot>:<id>"]`, `powerups.<id> = level`, and a
  `shop_log` entry. Buy buttons the student can't afford are grey and explain how much more XP is needed.

Power-ups (prices per level): ⚡ Turbo 100/200/350 (faster) · 🛡️ Shield 120/240/400 (blocks one hit per level) ·
🧲 Magnet 80/160/300 (pulls pickups) · 🚀 Rocket dash 100/200/350 (boosts at the start of each race) ·
⏱️ Overtime 150/300 (+5 s per level) · 🛞 Grip tires 90/180/320 (second game only: less slowdown off the track).

---

## 4. The arcade: two games, play time, leaderboards

### When students can play (the important rules)
- **The arcade is closed unless the teacher opens it for a class**, from the class display or the class page. It
  opens for a set time (default 60 minutes, or until the bell) and can be closed any time. Store `arcade_until` on
  the class.
- **Students earn play time:** finishing a lesson banks 5 minutes (cap 15 minutes). Each race uses its length (45 s,
  plus Overtime) from the bank. Play only counts while the arcade is open **for the student's own class**, so
  playing in another period is impossible. The teacher can "Give everyone 5 minutes".
- The student's top bar shows "🎮 Arcade open · 4:10 to play" when they can play.

### Games
The arcade page has a game picker; each game has its own class leaderboard and its own best scores.

1. **Robot Rush** (always available): a 45-second three-lane side-scroller with the student's own avatar. Up/Down
   switch lanes, Space dashes. Enemies slow you for about 1 s, shields block hits, pickups score.
   Score = distance/10 + 25 × pickups + 50 × enemies smashed. Server cap: 250 points per second.
2. **Circuit Driver** (unlocks at **level 3**): a top-down race around a closed track drawn as a copper trace on a
   circuit board. The kart drives itself; Left/Right steer, Space uses a boost. Parts on the board behave like the
   real thing: **LEDs** light as you pass (light all 8, then cross the start line for a lap), **resistors** sit on
   half the track and slow you down, **capacitors** give a free burst, **batteries** are boost pickups,
   **short-circuit sparks** spin you out, and the bare board off the trace is slow.
   Score = 300 × laps + 40 × LEDs + 20 × pickups + 50 × sparks smashed + distance/20. Server cap: 300 points per second.

Both need on-screen buttons for touch screens. Each game is one self-contained canvas file that returns a result
object when the clock ends.

### Anti-cheat
- A race is **started on the server** (`/arcade/start {game}` checks the arcade is open, the game is unlocked and
  there is play time; returns a run id and the race length; deducts the time).
- `/arcade/finish {run_id, score}` is refused if the run is unknown or already used, if less than race length − 3 s
  has passed, or if the score is above race seconds × that game's cap.

### Leaderboards
Per class and per game: **today** and **all time**, top 10, first names and avatars, the student's own row
highlighted. Stored per student per game: `best`, `day`, `day_best`.

### Data
Student: `spent, owned{}, powerups{}, shop_log[], arcade{ bank, runs[{id, at, game}], plays, best, day, day_best,
games{ <game id>: { best, day, day_best } } }`. Class: `arcade_until`.

---

## 5. Things to unlock: avatar parts and calling cards

Every unlockable item has one unlock rule:

| Rule | Meaning |
|---|---|
| none | free |
| `level n` | reach level n |
| `badge id` | earn that badge |
| `cost n` | buy it with n XP to spend |
| `<game id> n` | score n points in one race of that game (cannot be bought) |

Locked items show how to get them ("Reach level 6", "Score 2000 in Circuit Driver"). The server refuses to save an
avatar that uses a locked item. When a race result wins an item, the result card says so and plays confetti.

**Avatar parts:** body, colour, eyes, mouth, antenna, accessory, background. Maker Lab has about 80, a mix of all
five rule types.

**Calling cards:** a title the student wears under their name. They are stored as one more avatar slot (`card`), so
they use the same unlock, buy and save code. Three looks: *earned* (serious; navy and gold), *silly* (bought; bright
and tilted), *arcade* (won; neon). Maker Lab's list:
- Free: 🔰 New Maker
- Levels: 🐛 Bug Squasher (2), 🔁 Loop Master (4), 💻 Expert Coder (6), 🐍 Python Pro (8), 👑 Lab Legend (10)
- Badges: 🔌 Circuit Builder, 🪄 Wire Wizard, 🎮 Game Maker, 🎵 Micro Maestro, 📡 Sensor Specialist, 🤖 Robot
  Engineer, 🧠 Quiz Whiz, 🎯 Sharpshooter, 🤝 Team Player, 🎨 Remix Artist, 🧬 AI Trainer, 🕹️ Game Designer,
  🎓 Master Maker, 🍎 Teacher's Pick
- Bought (60–150 XP): 📢 Beep Boop Beep, 🍕 Powered by Snacks, 🔘 Button Masher, 🪫 Low Battery, 😱 Forgot the
  Indent, 😴 Professional Napper, 🍌 Certified Banana, 🤷 It Worked on My Chromebook, 🍝 Spaghetti Wiring Expert,
  🔍 404: Title Not Found, 🌪️ Agent of (Organized) Chaos, 🦆 Rubber Duck Debugger, 🔂 Just One More Try
- Won: 🏃 Bug Dodger, 🏆 Arcade Champion, 🛞 Pit Crew, 🏎️ Speed Demon

The card's text and look travel with the avatar wherever it is sent, so every screen can show it: the student's home
page, the profile page, arcade leaderboards and the class display.

---

## 6. ✋ "I'm stuck" help requests

**Student:** every lesson has "✋ I'm stuck: ask for help" → optional note (max 140 characters) → the box turns
yellow: "Help is on the way! Keep trying while you wait…" with "I figured it out 👍" to cancel. The page checks
every 30 s and resets when the teacher marks it helped.

**Class display:** a doorbell (twice) for each new request; a red pulsing "✋ 2 need help" button in the header; the
student's avatar turns red with a waving ✋; a "Needs help" list with avatar, name, exact place ("Dodge the Drop ·
Step 5: Read the tilt"), their note, how long ago, and a "✓ Helped" button. The display checks every 10 s. A 🔔
button plays a test doorbell and unlocks audio on that computer.

**Data:** one request per student, stored somewhere cheap to read (not inside the big summary), expiring after an
hour: `{who (hash), name, classes, at, where, note, avatar}`. Count requests per lesson step on the student record
for the feedback report.

---

## 7. Idle hints ("what do I do next?")

**Student's screen**
- After **45 seconds** with no click, key press, mouse move or scroll, the next thing to do gets a pulsing glow and a
  small 👉 bubble saying what it is.
- After **2 minutes**, the glow gets stronger and the ✋ help button glows too, with "Still stuck? Press ✋ and your
  teacher will come over." It never raises the help request for them.
- Coming back to the tab after 20 seconds or more away (for example from the code editor) shows the hint within a
  few seconds with "Welcome back!". **Time in another tab does not count as idle.**
- If the target is off screen, the bubble docks at the bottom with 👇; clicking it scrolls there.
- Any click or key clears the hint at once; mouse movement lets it fade after about 7 seconds.
- No hints while a video plays or a settings panel is open. Teachers only see hints in student view.

**What it points at** (worked out from what is on the page, so new lessons need no extra code): join page → class
code, name, Join. Home → the "next mission" button. Mission → the talk box, then Start. Build → the step's to-do
list, then the first unticked check, then any blank or question, then Next. Quiz → first unanswered question, then
Check. Ship → reflection, share link, Ship. Any element can opt in with `data-nudge="what to do"`.

**Class display**
- At the 2-minute mark the page reports the student as idle; when they act, or switch tabs, it reports them back.
- Kept in a short-lived cache only (no file writes, no lock), refreshed every 2 minutes, forgotten after 5 minutes so
  a closed laptop doesn't stay marked.
- The display greys that student's avatar and adds 💤, and the header counts "💤 2 idle".

---

## 8. Partners

- Two students share one computer. In a lesson, a student picks a classmate from a list. There is no accept step
  (the partner is sitting next to them).
- Both students' progress on that lesson is merged (whatever either finished counts), and from then on every save
  is copied to the partner's record. Both get the XP.
- **The picked student is told who picked them**: a highlighted note "👋 Ben K. picked you as their partner for this
  lesson", and the panel flashes when the lesson opens. The picker sees "You picked Sam K. as your partner."
- **Either student can remove the partnership.** It clears for both; work already done stays with both.
- Store `partner` and `partner_by` (who picked) on that lesson's progress. Each student keeps their own first quiz
  try and their own feedback.

---

## 9. Lesson feedback and the improvement report

**Student side**
- **🤔 Confusing?** under every build step and quiz question → reason (Instructions unclear, Code didn't work, Too
  hard, Too easy, Other) plus an optional note.
- **⭐ Rate this lesson** at the end: five faces, plus optional "What was the hardest part?" and "What would make
  this lesson better?". Rating gives +10 XP.
- Recorded automatically: first-try quiz answers (set once) and help requests per step.

**Data:** `lesson_fb[lesson] = { flags{"step:3": {reason, note, at}}, help{step: n}, rating, hardest, change }`,
kept outside lesson progress.

**Teacher Feedback page:** per lesson, the average rating, started and finished counts, the most-flagged steps
(flags count double, help requests single) with reasons and notes, quiz questions missed by 30% or more on the first
try, and student quotes. Buttons: **Copy report**, **Copy this lesson**, **Download .md**. The report is Markdown
with each lesson's source file path, step numbers and titles as students see them, counts and notes. **No student
names.** The teacher pastes it into an AI model to improve the lessons. In a sandboxed iframe the clipboard may be
blocked: fall back to a hidden textarea and `document.execCommand('copy')`.

---

## 10. Class display (the projector board)

- **Fits any screen:** laid out on a fixed 1600×900 stage and scaled with a CSS transform. Measure with screen
  coordinates when fitting things.
- **Header (one row, fixed height):** class name and today's lesson; **class XP goal for today** (XP earned since
  midnight against a goal; default 60 × students, the teacher can set a number or turn it off; turns green at the
  goal); total class XP; buttons: 🔔 test bell, 🎮 Open arcade / Close, ⚙ Set up, Full screen, Exit; the ✋ help
  button. Long class names shrink and never push the board down.
- **Race to the finish:** a track with stops Start → Mission → **one stop per Build step** → Quiz → Ship it →
  Finish. Each student's avatar sits on the stop they're working on, so the class is spread along the track. Stops
  with nobody are small ticks; busy stops share the width. Three layouts, best first: (1) avatar with name and full
  calling card underneath, when there's room; (2) one student per row, avatar then name; (3) rows with the calling
  card shown as its emoji on the avatar, when the words would be cut off. Avatars are sized to the largest that
  fits; names shrink to fit rather than being cut off. Re-measure after fonts load.
- **Markers on avatars:** red with ✋ = asked for help; grey with 💤 = idle; ⭐ hop when they move forward.
- **Clock card:** time now, a "Class ends at" box, then a big countdown to the bell (orange in the last 5 minutes,
  red at the bell). One clock only.
- **Question of the day:** the lesson's short "big question" (15 words or fewer), editable.
- **Recent wins:** badges, finished lessons and perfect quizzes from the last 12 hours.
- **Standards we're working on**, and an "On other lessons" strip for students not on today's lesson.
- **Set up panel:** today's lesson, the question, how names are shown (first names or avatar names), whether XP is
  shown, the XP goal, track or cards view. Closes with ✕, Done, Esc or a click outside.
- **Each refresh (20 s) also** advances the daily backup a little.

---

## 11. Skill tree

A page showing every lesson as a station on a path, with prerequisites. States: locked, unlocked, in progress,
complete; three stars per lesson (perfect quiz, an extension, shipped); 📌 for assigned lessons; the student's
avatar stands on their current lesson; clicking a lesson shows details and a Start/Continue button. Assigning a
lesson unlocks it even if earlier lessons aren't done.

Maker Lab draws it as pixel art: a **lab scene at the top that fills up** as lessons are finished (each lesson adds
its own gadget to a shelf, and a robot is built one part per lesson, in the student's avatar colour; lights, a
window, a sign and plants appear at 25%, 50% and 75%), with a line like "5 of 13 gadgets built · Robot 38% built ·
Next up: finish X to add Y". Keep your own art style; the idea to copy is **a picture that visibly grows with every
finished lesson**, plus telling the student exactly what the next lesson adds.

---

## 12. Accessibility, translation, bug reports, student view

### Display settings ("Aa" in the top bar)
Font (standard, Lexend, Atkinson Hyperlegible, system), text size (4 sizes), line spacing, high contrast, less
motion, language. Saved per device and applied as classes on `<html>` before the page draws.

### Translation (Maker Lab: Brazilian Portuguese)
- Picked in the Aa panel. The page finds each "sentence" (an element whose children are only text and inline tags),
  swaps code, numbers and anything marked `translate="no"` (names, robot names) for placeholders, and asks the
  server for the ones it hasn't seen.
- The server translates with Google's `LanguageApp`, caches results (cache plus stored files) and works within a
  time budget of about 8 seconds per call; the browser also keeps translations per device.
- If a placeholder goes missing in a translation, keep the English for that sentence.
- New content (the next step, a toast) is translated as it appears. Code is never translated.

### 🐞 Report a problem
In the Aa panel and the page footer: pick a kind (Something didn't work, Words are wrong or confusing, I can't find
something, Something else) and describe it. The report adds the page, lesson, stage, step, language, browser, screen
size, app version and the page's last errors. Page errors are also reported automatically (at most 3 per visit,
repeats dropped, at most 10 reports per user per day). The teacher has a Reports page: list, mark fixed, delete.

### Student view
On a class page the teacher can press **Student view** to see the app as a student in that class would (lessons,
skill tree, arcade, hints), with a bar across the top and an Exit button. Nothing done in student view is saved.

---

## 13. Multiple courses or grades in one app (only if needed)

Each class is set to a course; the grade is required when a class is created or imported, and can be switched later
without losing work. Students see only their course's lessons, skill tree and badges; XP, levels, avatar, shop and
arcade are shared. Teacher pages show every course with a switch.

---

## Adapting to your course (example: MIT App Inventor)

| Maker Lab | Use instead |
|---|---|
| MakeCode share link in "Ship it" | The App Inventor project link, gallery link or exported file the course already collects |
| "Open MakeCode" button | "Open App Inventor" |
| Robot avatar | The app's existing avatar or mascot; keep the slots idea (parts with unlock rules) |
| Gadgets on the lab shelves, one per lesson | One item per lesson that fits the course (for example an app icon on a phone home screen that fills up) |
| Circuit Driver's LEDs, resistors, capacitors, batteries | Parts from the course's world (for example components, blocks and events as pickups and obstacles) |
| Card names like Circuit Builder, Wire Wizard, Python Pro | Titles from the course (for example Block Builder, Screen Designer, Event Expert), plus the silly ones as they are |
| Level titles (Spark, Blinker, Wire Wrangler…) | The app's own titles |

Keep the numbers (XP values, prices, timings, caps) unless the teacher says otherwise; they were tuned in a real
class.

---

## Final checklist

- [ ] Audit reported; storage rules in section 1 in place, with tests
- [ ] Daily backups and the "Your data" card
- [ ] Browser queue with busy retries; polling limits; nothing polls from a background tab
- [ ] XP, levels, badges, locked buttons, sounds, celebrations
- [ ] Shop with "XP to spend"; levels never go down
- [ ] Arcade closed unless the teacher opens it; earned play time; two games; per-game leaderboards; server checks
- [ ] Unlock rules (free, level, badge, cost, game score); calling cards
- [ ] ✋ Help requests with the doorbell on the display
- [ ] Idle hints on the student's screen; 💤 on the display
- [ ] Partners: merged progress, who picked whom, either can remove
- [ ] Feedback flags, lesson rating, and the report with no names
- [ ] Class display: one-row header, XP goal, race with one stop per step, clock, wins, set-up panel
- [ ] Skill tree that grows with every finished lesson
- [ ] Display settings, translation, bug reports, student view
- [ ] No emails on shared screens; nothing saved in teacher preview or student view
