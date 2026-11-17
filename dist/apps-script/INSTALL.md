# Installing Maker Lab in Google Apps Script

These files are **generated** by `python tools/build.py`. Don't edit them here: change the lessons
(`course/lessons/`) or the code in the repository and build again.

## 1. Make the project (your teacher account)

1. Go to <https://script.google.com/home/projects/create> in Chrome, signed in to your school account.
2. Rename it **micro:bit Maker Lab** (click "Untitled project").
3. Add one **Script** file for each row below. Click **+** next to "Files", choose **Script**, and type the name
   exactly (Apps Script adds `.gs`). Open the file from this folder, select all, copy, and paste it in.
   `Code.gs` already exists: replace what's in it.

| File | Add it as | Size |
|---|---|---|
| `Assets.gs` | Script (+ → Script), name it `Assets` | 83 KB |
| `Code.gs` | Script (+ → Script), name it `Code` | 82 KB |
| `Data.gs` | Script (+ → Script), name it `Data` | 256 KB |

   **Updating from the earlier version?** Delete the old `Pages1` file (and any `Styles`, `App` or `Editor` HTML files).

4. Press **Ctrl+S**.

## 2. Settings (one time)

1. Click the **gear (Project Settings)**, tick **Show "appsscript.json" manifest file in editor**, then
   open `appsscript.json` and replace it with:

```json
{
  "timeZone": "America/New_York",
  "runtimeVersion": "V8",
  "exceptionLogging": "STACKDRIVER",
  "webapp": { "executeAs": "USER_DEPLOYING", "access": "DOMAIN" },
  "dependencies": {
    "enabledAdvancedServices": [{ "userSymbol": "Classroom", "serviceId": "classroom", "version": "v1" }]
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.rosters.readonly",
    "https://www.googleapis.com/auth/classroom.profile.emails"
  ]
}
```

2. Open `Code.gs`, choose **setup** in the function menu at the top, and press **Run**. Allow access when Google
   asks ("Advanced → Go to micro:bit Maker Lab" if it warns you). It makes the **Maker Lab data** folder in your Drive.

## 3. Deploy

1. **Deploy → New deployment**. Gear → **Web app**.
2. **Execute as: Me**. **Who has access: Anyone within** your school.
3. **Deploy**, then copy the **Web app URL** (it ends in `/exec`).

Open it yourself first: you're the teacher, so you'll see **My classes**. Make a class (or import from Google
Classroom), assign lessons, then share the address and the class's join code. Students code in **MakeCode**
(makecode.microbit.org) in a second tab and turn in their MakeCode **share link** at the end of each lesson.

## Updating later

Paste the new files over the old ones, save, then **Deploy → Manage deployments → ✏️ → Version: New version →
Deploy**. The web address stays the same and student work is kept (it lives in your Drive, not in the code).

## Where the data lives

* **My Drive → Maker Lab data → students**: one small file per student (their work, XP, robot).
* **Maker Lab data → config.json**: your classes, assignments, videos, feedback and bonus XP.
* **Maker Lab data → summary.json**: the gradebook's quick copy, rebuilt as students work.
