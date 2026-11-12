# Installing Maker Lab in Google Apps Script

These files are **generated** by `python tools/build_apps_script.py`. Don't edit them here:
change the lessons or the code in the repository and build again.

## 1. Make the project (your teacher account)

1. Go to <https://script.google.com/home/projects/create> in Chrome, signed in to your school account.
2. Rename it **micro:bit Maker Lab** (click "Untitled project").
3. Add one **Script** file in the editor for each row below. Click **+** next to "Files", choose **Script**,
   and type the name exactly (Apps Script adds `.gs`). Open the file from this folder, select all, copy, and
   paste it in. `Code.gs` already exists: replace what's in it.

   Don't add HTML files: Apps Script strips parts of the code in HTML files, so everything is in these Script files.
   If you have `Styles`, `App` or `Editor` HTML files from an earlier version, delete them.

| File | Add it as | Size |
|---|---|---|
| `Assets.gs` | Script (+ → Script), name it `Assets` | 270 KB |
| `Code.gs` | Script (+ → Script), name it `Code` | 95 KB |
| `Data.gs` | Script (+ → Script), name it `Data` | 165 KB |
| `Pages1.gs` | Script (+ → Script), name it `Pages1` | 692 KB |

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

   The `dependencies` part turns on Google Classroom (read-only) so you can import your classes and students.
   The `oauthScopes` list is everything Maker Lab is allowed to do: your Drive files, downloading the firmware,
   knowing who's signed in, and reading (never changing) your Classroom classes, rosters and students' emails.

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

## Bring in your Google Classroom classes (optional)

1. On **My classes**, click **Import classes** on the Google Classroom card.
2. For each Classroom class, choose **New Maker Lab class**, **Link to:** an existing class, or **Skip**. Click **Import**.
3. Students on those rosters just open the web address. They're already in the class with their Classroom name: no join code.
4. When students are added to or leave a Classroom class, click **Update roster** on the class page (or
   **Update all rosters** on My classes). The join code still works for anyone not on a roster.

If the import page says the Classroom service isn't turned on, check `appsscript.json` matches step 2, save,
and run **checkInstall** once so Google asks you to allow Classroom access.

## Updating later

Paste the new files over the old ones, save, then **Deploy → Manage deployments → ✏️ → Version: New version →
Deploy**. The web address stays the same and student work is kept (it lives in your Drive, not in the code).
If `appsscript.json` changed, paste it too, then run **checkInstall** once so Google asks for any new access.

## Where the data lives

* **My Drive → Maker Lab data → students**: one small file per student (their work, XP, robot).
* **Maker Lab data → config.json**: your classes, assignments, videos, feedback and bonus XP.
* **Maker Lab data → summary.json**: the gradebook's quick copy, rebuilt as students work.

Don't edit these files by hand. To start over, delete the folder and run **setup** again.
