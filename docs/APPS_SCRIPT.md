# Maker Lab in Google Apps Script

Maker Lab runs as a Google Apps Script web app in the teacher's school account: no hosting, no passwords, and student
work stays in the teacher's Google Drive. **To install or update it, follow
[dist/apps-script/INSTALL.md](../dist/apps-script/INSTALL.md).**

* **Sign-in:** everyone is identified by their school Google account. The script's owner is the teacher.
* **Coding:** students code in MakeCode (makecode.microbit.org) in a second tab. MakeCode's simulator and Download
  work there (the Apps Script frame can't use USB, but MakeCode's own tab can).
* **Turning in:** at the end of each lesson students paste their MakeCode share link; it shows in the gradebook.
* **Saving:** each student's work is one file in **My Drive → Maker Lab data → students**.
* **Gradebook and Class display:** catch up with new work within about a minute.

## How it's built

* `tools/build.py` checks `course/lessons/*.yaml`, turns their Markdown into HTML, and writes `Data.gs`.
* The CSS and browser code are gzip-compressed into `Assets.gs`, and every page has only two small scripts with no
  slashes, because Apps Script strips `//` and `/* */` from `<script>` and `<style>` blocks even inside strings.
* `tests/apps_script_app/` has fake Google services (they strip comments the same way), the app test, and a local
  server for clicking through in a browser.
