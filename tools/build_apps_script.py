"""Build the Google Apps Script version of Maker Lab.

    python tools/build_apps_script.py

Writes dist/apps-script/: the files to paste into an Apps Script project, plus INSTALL.md.

* Lesson pages are rendered by the real Flask templates, so they look the same.
* The XP, badge, map and avatar settings come from app/gamify.py.
* Before writing anything, it checks that the JavaScript grading (code checks and the
  syntax checker) gives the same answers as Python on every code sample in every lesson.
"""
import ast
import base64
import gzip
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from flask_login import login_user  # noqa: E402

from app import create_app, gamify  # noqa: E402
from app import lessons as L  # noqa: E402
from app.models import User, db  # noqa: E402

OUT = Path(os.environ.get("MAKERLAB_APPS_SCRIPT_OUT") or ROOT / "dist" / "apps-script")
STATIC = ROOT / "app" / "static"
MAX_FILE = 700_000            # characters per pasted .gs file, to keep the Apps Script editor happy


def extract(html, start_pattern, end="</main>"):
    m = re.search(start_pattern, html)
    if not m:
        raise SystemExit(f"could not find {start_pattern!r} in a rendered page")
    tail = html[m.end():]
    return tail[: tail.rindex(end)] if end == "</main>" else tail[: tail.index(end) + len(end)]


def render_pages(app):
    pages = {}
    with app.app_context():
        db.create_all()
        student = User(username="build_student", display_name="Student", role="student")
        teacher = User(username="build_teacher", display_name="Teacher", role="teacher")
        for u in (student, teacher):
            u.set_password("unused-password")
            db.session.add(u)
        db.session.commit()
        view = app.view_functions
        for lesson in L.all_lessons():
            lid = lesson["id"]
            with app.test_request_context(f"/lessons/{lid}"):
                login_user(student)
                html = view["student.lesson"](lesson_id=lid)
                body = extract(html, r'<main class="lesson-layout">')
            with app.test_request_context(f"/lessons/{lid}"):
                login_user(teacher)
                key = extract(view["student.lesson"](lesson_id=lid), r'(?=<details class="card teacher-key">)', "</details>")
            pages[lid] = {"html": body, "view": L.public_view(lesson), "teacher_key": key}
        with app.test_request_context("/editor"):
            login_user(student)
            pages["_playground"] = {"html": extract(view["student.playground"](), r'<main class="container">')}
        with app.test_request_context("/teacher/standards"):
            login_user(teacher)
            pages["_standards"] = {"html": extract(view["teacher.standards"](), r'<main class="container wide">')}
        data = build_data()
    return pages, data


def build_data():
    from app import standards as STD
    lessons = {}
    for lesson in L.all_lessons():
        stepped = lesson.get("circuit") or lesson.get("lab") or {}
        dbg, prac, code = lesson.get("debug"), lesson.get("practice"), lesson.get("code") or {}
        lessons[lesson["id"]] = {
            "id": lesson["id"], "title": lesson["title"], "number": lesson["number"], "unit": lesson["unit"],
            "kind": lesson.get("kind") or "lesson", "section_keys": L.section_keys(lesson),
            "has_debug": bool(dbg), "possible_xp": gamify.possible_xp(lesson),
            "quiz": [{"answer": q["answer"], "explain": q["explain"]} for q in lesson["quiz"]],
            "debug": {"buggy_code": dbg["buggy_code"], "checks": dbg["checks"]} if dbg else None,
            "practice": {"checks": prac["checks"]} if prac else None,
            "starter": code.get("starter", ""), "buggy": dbg["buggy_code"] if dbg else "",
            "practice_starter": prac["starter"] if prac else "",
            "stepped_count": len(stepped.get("steps") or []),
            "stepped_key": "circuit" if lesson.get("circuit") else "lab",
            "card": {"id": lesson["id"], "number": lesson["number"], "title": lesson["title"],
                     "subtitle": lesson.get("subtitle", ""), "duration_minutes": lesson["duration_minutes"],
                     "level": lesson.get("level", ""), "circuit": bool(lesson.get("circuit")), "lab": bool(lesson.get("lab")),
                     "standards": [s["code"] for s in STD.for_lesson(lesson)]},
        }
    tree = {lid: {"requires": t["requires"], "or_after": t.get("or_after", []), "pos": list(t["pos"])}
            for lid, t in gamify.tree().items()}
    return {
        "lessons": lessons, "order": [l["id"] for l in L.all_lessons()],
        "units": {str(n): u for n, u in L.UNITS.items() if any(l["unit"] == n for l in L.all_lessons())},
        "tree": tree, "xp": gamify.XP, "section_labels": gamify.SECTION_LABELS,
        "levels": [list(x) for x in gamify.LEVELS], "badges": [list(b) for b in gamify.BADGES],
        "avatar_options": {part: [[o[0], o[1], list(o[2]) if o[2] else None] for o in opts]
                           for part, opts in gamify.AVATAR_OPTIONS.items()},
        "avatar_parts": gamify.AVATAR_PARTS, "default_avatar": gamify.DEFAULT_AVATAR,
        "sprint": {"trunk": L.SPRINT_TRUNK, "branches": L.SPRINT_BRANCHES},
    }


# ---------------------------------------------------------------- JS vs Python grading
def parity_cases():
    cases = []
    for lesson in L.all_lessons():
        dbg, prac, code = lesson.get("debug"), lesson.get("practice"), lesson.get("code") or {}
        samples = [code.get("starter"), (dbg or {}).get("solution"), (dbg or {}).get("buggy_code"),
                   (prac or {}).get("solution"), (prac or {}).get("starter")]
        for sample in filter(None, samples):
            try:
                ast.parse(sample)
                syntax_ok = True
            except SyntaxError:
                syntax_ok = False
            row = {"lesson": lesson["id"], "code": sample, "syntax_ok": syntax_ok, "checks": []}
            for name, task in (("debug", dbg), ("practice", prac)):
                if task:
                    row["checks"].append({"task": name, "checks": task["checks"],
                                          "ok": [r["ok"] for r in L.run_checks(sample, task["checks"])]})
            cases.append(row)
    return cases


def check_parity(code_gs):
    if not shutil.which("node"):
        print("! Node.js not found: skipping the JavaScript grading check")
        return
    with tempfile.TemporaryDirectory() as tmp:
        cases = Path(tmp) / "cases.json"
        cases.write_text(json.dumps(parity_cases()))
        script = Path(tmp) / "parity.js"
        script.write_text("""
const fs = require('fs'), vm = require('vm');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), ctx);
const cases = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
let bad = 0;
for (const c of cases) {
  const js = ctx.pythonSyntaxError_(c.code);
  if (!!js === c.syntax_ok) { bad++; console.log('SYNTAX differs in ' + c.lesson + ': Python ok=' + c.syntax_ok + ', JS says: ' + (js || 'ok') + '\\n' + c.code); }
  for (const t of c.checks) {
    const got = ctx.runChecks_(c.code, t.checks).map(r => r.ok);
    if (JSON.stringify(got) !== JSON.stringify(t.ok)) { bad++; console.log('CHECKS differ in ' + c.lesson + ' ' + t.task + ': Python ' + JSON.stringify(t.ok) + ' JS ' + JSON.stringify(got)); }
  }
}
console.log(cases.length + ' code samples compared, ' + bad + ' differences');
process.exit(bad ? 1 : 0);
""")
        r = subprocess.run(["node", str(script), str(code_gs), str(cases)], capture_output=True, text=True)
        print(r.stdout.strip())
        if r.returncode:
            raise SystemExit("The JavaScript grading doesn't match Python. Fix apps_script/server/20_grading.js.\n" + r.stderr)


# ---------------------------------------------------------------- assets
def script_safe(js):
    return js.replace("</script", "<\\/script")


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


def build_assets():
    css = "\n".join(read(p) for p in ("app/static/vendor/codemirror/codemirror.css", "app/static/css/style.css", "app/static/css/aero.css"))
    app_js = "\n".join([
        read("apps_script/client/shim.js"), read("app/static/js/avatar.js"), read("app/static/js/rewards.js"),
        read("app/static/js/breadboard.js"), read("app/static/js/visuals.js"),
        "window.__runMap = function () {\n" + read("app/static/js/map.js") + "\n};",
        "window.__runProfile = function () {\n" + read("app/static/js/profile.js") + "\n};",
        read("apps_script/client/pages.js"),
    ])
    editor_js = "\n".join([
        read("app/static/vendor/codemirror/codemirror.js"), read("app/static/vendor/codemirror/mode/python.js"),
        read("app/static/vendor/codemirror/addon/matchbrackets.js"), read("app/static/vendor/microbit/microbit-fs.min.js"),
        read("app/static/js/microbit.js"), read("app/static/js/editor.js"),
        "if (window.LESSON) {\n" + read("app/static/js/lesson.js") + "\n}",
    ])
    return {
        "Styles.html": "<style>\n" + css + "\n</style>\n",
        "App.html": "<script>\n" + script_safe(app_js) + "\n</script>\n",
        "Editor.html": "<script>\n" + script_safe(editor_js) + "\n</script>\n",
    }


def pack(value):
    """JSON -> gzip -> base64. The server unpacks one page per request with Utilities.ungzip."""
    raw = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.b64encode(gzip.compress(raw, 9, mtime=0)).decode("ascii")


def stamp(files):
    """Gives every file the same build id and an end marker, so the app can tell when a file is
    missing, cut short while pasting, or left over from an older build."""
    build = hashlib.sha1("".join(files[k] for k in sorted(files)).encode("utf-8")).hexdigest()[:10]
    for name in list(files):
        if name.endswith(".gs"):
            key = name[:-3]
            files[name] = files[name] + f"\nvar BUILD_STAMPS = BUILD_STAMPS || {{}};\nBUILD_STAMPS[{json.dumps(key)}] = {json.dumps(build)};\n"
        else:
            files[name] = files[name] + f"<!-- maker-lab-end {build} -->\n"
    files["Code.gs"] = files["Code.gs"] + f"var BUILD_ID = {json.dumps(build)};\nvar BUILD_FILES = {json.dumps(sorted(files))};\n"


def split_gs(name, header, entries):
    """Writes `header` then entries into as many .gs files as needed to stay under MAX_FILE."""
    files, cur, size, n = {}, [header], len(header), 1
    for e in entries:
        if size + len(e) > MAX_FILE and len(cur) > 1:
            files[f"{name}{n}.gs"] = "\n".join(cur) + "\n"
            n += 1
            cur, size = [header], len(header)
        cur.append(e)
        size += len(e) + 1
    files[f"{name}{n}.gs"] = "\n".join(cur) + "\n"
    return files


def main():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite://", "SERVER_NAME": "makerlab.local"})
    pages, data = render_pages(app)

    code = "\n".join(p.read_text(encoding="utf-8") for p in sorted((ROOT / "apps_script" / "server").glob("*.js")))
    files = {"Code.gs": code}
    files["Data.gs"] = ("// GENERATED by tools/build_apps_script.py from the lessons and app/gamify.py. Don't edit.\n"
                        "var DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    header = ("// GENERATED by tools/build_apps_script.py: lesson pages, gzip-compressed. Don't edit.\n"
              "var PAGES_GZ = PAGES_GZ || {};")
    entries = [f"PAGES_GZ[{json.dumps(k)}] = {json.dumps(pack(v))};" for k, v in pages.items()]
    files.update(split_gs("Pages", header, entries))
    files.update(build_assets())
    stamp(files)

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    for name, text in files.items():
        (OUT / name).write_text(text, encoding="utf-8")
    check_parity(OUT / "Code.gs")
    (OUT / "INSTALL.md").write_text(install_md(files), encoding="utf-8")
    for name in sorted(files, key=lambda n: (not n.endswith(".gs"), n)):
        print(f"  {name:14} {len(files[name]) / 1000:8.0f} KB")
    print(f"Built {len(pages) - 2} lesson pages into {OUT}")


def install_md(files):
    gs = sorted(n for n in files if n.endswith(".gs"))
    html = ["Styles.html", "App.html", "Editor.html"]
    rows = "\n".join(f"| `{n}` | Script (+ → Script), name it `{n[:-3]}` | {len(files[n]) // 1000} KB |" for n in gs) + "\n" + \
        "\n".join(f"| `{n}` | HTML (+ → HTML), name it `{n[:-5]}` | {len(files[n]) // 1000} KB |" for n in html)
    return f"""# Installing Maker Lab in Google Apps Script

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
{rows}

4. Press **Ctrl+S**.

## 2. Settings (one time)

1. Click the **gear (Project Settings)**, tick **Show "appsscript.json" manifest file in editor**, then
   open `appsscript.json` and replace it with:

```json
{{
  "timeZone": "America/New_York",
  "runtimeVersion": "V8",
  "exceptionLogging": "STACKDRIVER",
  "webapp": {{ "executeAs": "USER_DEPLOYING", "access": "DOMAIN" }}
}}
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
"""


if __name__ == "__main__":
    main()
