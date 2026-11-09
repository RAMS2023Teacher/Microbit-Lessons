# Installing Maker Lab in Google Apps Script

These files are **generated** by `python tools/build_apps_script.py`. Don't edit them here:
change the lessons or the code in the repository and build again.

## 1. Make the project (your teacher account)

1. Go to <https://script.google.com/home/projects/create> in Chrome, signed in to your school account.
2. Rename it **micro:bit Maker Lab** (click "Untitled project").
3. Add one file in the editor for each row below. Click **+** next to "Files", choose the type, and type the
   name exactly (Apps Script adds the `.gs` or `.html`). Open the file from this folder, select all, copy,
   and paste it in. `Code.gs` already exists: replace what's in it.

| File | Add it as | Size |
|---|---|---|
| `Code.gs` | Script (+ → Script), name it `Code` | 61 KB |
| `Data.gs` | Script (+ → Script), name it `Data` | 108 KB |
| `Pages1.gs` | Script (+ → Script), name it `Pages1` | 653 KB |
| `Styles.html` | HTML (+ → HTML), name it `Styles` | 65 KB |
| `App.html` | HTML (+ → HTML), name it `App` | 105 KB |
| `Editor.html` | HTML (+ → HTML), name it `Editor` | 502 KB |

4. Press **Ctrl+S**.

## 2. Settings (one time)

1. Click the **gear (Project Settings)**, tick **Show "appsscript.json" manifest file in editor**, then
   open `appsscript.json` and replace it with:

```json
{
  "timeZone": "America/New_York",
  "runtimeVersion": "V8",
  "exceptionLogging": "STACKDRIVER",
  "webapp": { "executeAs": "USER_DEPLOYING", "access": "DOMAIN" }
}
```

2. Open `Code.gs`, choose **setup** in the function menu at the top, and press **Run**. Allow access when Google
   asks ("Advanced → Go to micro:bit Maker Lab" if it warns you). This makes the **Maker Lab data** folder in your
   Drive and downloads the micro:bit firmware for .hex files. It should finish with "Set up: …".

## 3. Deploy

1. **Deploy → New deployment**. Gear → **Web app**.
2. **Execute as: Me**. **Who has access: Anyone within** your school.
3. **Deploy**, then copy the **Web app URL** (it ends in `/exec`).

Open that address yourself first: you're the teacher, so you'll see **My classes**. Make a class, assign lessons,
then share the address and the class's join code with students. Students sign in with their school Google
account, type the code and their name once, and they're in.

## Updating later

Paste the new files over the old ones, save, then **Deploy → Manage deployments → ✏️ → Version: New version →
Deploy**. The web address stays the same and student work is kept (it lives in your Drive, not in the code).

## Where the data lives

* **My Drive → Maker Lab data → students**: one small file per student (their work, XP, robot).
* **Maker Lab data → config.json**: your classes, assignments, videos, feedback and bonus XP.
* **Maker Lab data → summary.json**: the gradebook's quick copy, rebuilt as students work.

Don't edit these files by hand. To start over, delete the folder and run **setup** again.
