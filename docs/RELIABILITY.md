# Reliability: how Maker Lab keeps data safe and copes with a busy class

Maker Lab was audited against the reliability guide written after the Scratch Quest incident (an app that
"reset" itself when Google was busy). What Maker Lab does now, and where:

## Data is never replaced or reset (`apps_script/server/10_storage.js`)

- **An error is never "missing".** Opening the data folder, a student's file or the settings file is tried 4 times;
  if it still fails the request stops with `BUSY` ("Maker Lab is very busy right now. Your work is safe."). New
  folders and files are only made when no id has *ever* been saved for them, inside a lock that re-checks first.
- **No blank records.** A student's record is `null` only when they never had one. A read error throws instead, so
  joining again, pairing with a partner or any save can't write an empty record over real work. A damaged file
  throws too (it is never treated as `{}`).
- **A failed save never makes a second file** or moves the pointer to a new one.
- **Every storage id is remembered** (`storage:history` in script properties).

## Backups and the owner's "Your data" card (`apps_script/server/65_backup.js`)

- Once a day, every student record and the settings go into one file: `Maker Lab data/backups/Maker Lab Backup
  YYYY-MM-DD.json`. It is built a few students at a time while the teacher uses Maker Lab (My classes, the class
  display), so no student ever waits for it. The last 8 are kept.
- **My classes → 🗄️ Your data** (teacher only): the data folder (link), number of students and classes, today's
  backup, links to the backups, **Back up now**, and a warning if Drive has other "Maker Lab data" folders.

## Staying under Google's limit of ~30 requests at once

- **Browser** (`apps_script/client/shim.js`): every call goes through one line, one request at a time per browser;
  identical waiting requests are shared; back-to-back saves merge; "busy" answers (Google's *too many simultaneous
  invocations*, lock timeouts, the server's `BUSY`) are tried again up to 5 times with growing, spread-out waits,
  with a "⏳ Busy… saving your work" note. A page that can't load because of `BUSY` reloads itself in 4–8 s.
- **Polling:** the class display checks for help every 10 s (not 5) and the student help status every 30 s, never
  from a background tab. The display's main refresh is 20 s and skips background tabs.
- **Server:** a student click reads only that student's file (test: 300 other students, ≤3 reads). The class-wide
  summary is shared through the cache for 20 s and only one request rebuilds it at a time. Teacher setting changes
  take turns in a short lock; slow work (Google Classroom, giving everyone play time, backups) never holds the lock.
  Student saves don't take the lock at all.

## Tests

- `tests/apps_script_app/reliability_check.js` (runs with pytest): Drive failing to open, read or write never
  creates storage, never changes a storage id and never overwrites a student; one click reads one student; the
  summary is rebuilt once when 20 students open the Arcade; backups (one per day, 8 kept); the data card; owner only;
  two first visitors make one data folder.
- `tests/browser/busy_retry.js` (Playwright): the server turns away 3 requests while a student ticks a box; the busy
  note shows, no error appears, and the tick is saved.

## For the teacher

- Deploying a new version never touches data.
- If students see "Busy… saving your work" for more than a few seconds at a time, check Apps Script → Executions
  for failures and slow runs, and tell Claude which actions are slow.
- If students or classes ever look missing, **don't re-create them**. Open **My classes → Your data** first: it shows
  which folder Maker Lab is using and how many students are in it. Your data is not lost; nothing new is made on errors.
- Backups are in the data folder's `backups` folder. A backup file can be opened in Drive; ask Claude to restore
  from one if you ever need it.
