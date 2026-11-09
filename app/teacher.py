import csv
import io
import secrets
from datetime import date, datetime

from flask import (Blueprint, Response, abort, flash, jsonify, redirect, render_template, request,
                   url_for)
from flask_login import current_user

from . import gamify
from . import lessons as L
from . import partners
from . import standards as STD
from .auth import teacher_required
from .models import Assignment, Classroom, LessonVideo, Progress, User, db, new_join_code
from .videos import all_video_urls, embed_info

bp = Blueprint("teacher", __name__, url_prefix="/teacher")


def _own_class(cid) -> Classroom:
    c = db.session.get(Classroom, cid)
    if not c or c.teacher_id != current_user.id:
        abort(404)
    return c


def _student_in(c, sid) -> User:
    s = db.session.get(User, sid)
    if not s or s not in c.students:
        abort(404)
    return s


def status_cell(lesson, p, due):
    if not p:
        status = "not-started"
        pct = 0
    else:
        pct = p.percent(L.section_keys(lesson))
        status = "complete" if pct == 100 else "in-progress"
    late = bool(due and due < date.today() and status != "complete")
    return {"p": p, "pct": pct, "status": status, "late": late}


def gradebook(c):
    students = c.students
    lesson_ids = [a.lesson_id for a in c.assignments]
    progress = {}
    if students and lesson_ids:
        for p in Progress.query.filter(Progress.user_id.in_([s.id for s in students]),
                                       Progress.lesson_id.in_(lesson_ids)):
            progress[(p.user_id, p.lesson_id)] = p
    cols = [(a, L.get_lesson(a.lesson_id)) for a in c.assignments if L.get_lesson(a.lesson_id)]
    started = {s.id: {lid for (uid, lid) in progress if uid == s.id} for s in students}
    mates = partners.names_for({s.id for s in students}, lesson_ids)
    grid = {}
    for s in students:
        for a, lesson in cols:
            if L.owes_assignment(a, started[s.id]):
                grid[(s.id, a.id)] = status_cell(lesson, progress.get((s.id, a.lesson_id)), a.due_date)
                grid[(s.id, a.id)]["partner"] = mates.get((s.id, a.lesson_id))
            else:
                grid[(s.id, a.id)] = {"p": None, "pct": 0, "status": "other-branch", "late": False}
    return cols, grid


@bp.route("/")
@teacher_required
def home():
    classes = Classroom.query.filter_by(teacher_id=current_user.id).order_by(Classroom.created_at).all()
    return render_template("teacher/home.html", classes=classes)


@bp.post("/classes")
@teacher_required
def create_class():
    name = request.form.get("name", "").strip()[:80]
    if not name:
        flash("Give the class a name.", "error")
        return redirect(url_for("teacher.home"))
    c = Classroom(name=name, join_code=new_join_code(), teacher_id=current_user.id)
    db.session.add(c)
    db.session.commit()
    flash(f"Created {name}. Students join with code {c.join_code}.", "success")
    return redirect(url_for("teacher.classroom", cid=c.id))


@bp.route("/classes/<int:cid>")
@teacher_required
def classroom(cid):
    c = _own_class(cid)
    cols, grid = gradebook(c)
    assigned = {a.lesson_id for a in c.assignments}
    levels = {st.id: gamify.level_info(st.xp or 0) for st in c.students}
    return render_template("teacher/classroom.html", c=c, cols=cols, grid=grid, levels=levels,
                           units=L.lessons_by_unit(), assigned=assigned)


@bp.post("/classes/<int:cid>/delete")
@teacher_required
def delete_class(cid):
    c = _own_class(cid)
    if request.form.get("confirm") != c.name:
        flash("Type the class name exactly to delete it.", "error")
        return redirect(url_for("teacher.classroom", cid=cid))
    db.session.delete(c)
    db.session.commit()
    flash("Class deleted. Student accounts were kept.", "info")
    return redirect(url_for("teacher.home"))


@bp.post("/classes/<int:cid>/assign")
@teacher_required
def assign(cid):
    c = _own_class(cid)
    ids = request.form.getlist("lesson_id")
    due_raw = request.form.get("due_date", "")
    try:
        due = datetime.strptime(due_raw, "%Y-%m-%d").date() if due_raw else None
    except ValueError:
        due = None
    note = request.form.get("note", "").strip()[:500]
    existing = {a.lesson_id for a in c.assignments}
    added = 0
    for lid in ids:
        if L.get_lesson(lid) and lid not in existing:
            db.session.add(Assignment(classroom=c, lesson_id=lid, due_date=due, note=note))
            added += 1
    db.session.commit()
    flash(f"Assigned {added} lesson(s)." if added else "Nothing new to assign.", "success" if added else "info")
    return redirect(url_for("teacher.classroom", cid=cid))


@bp.post("/classes/<int:cid>/assign-sprint")
@teacher_required
def assign_sprint(cid):
    c = _own_class(cid)
    choice = request.form.get("branch", "")
    if choice != "choice" and choice not in L.SPRINT_BRANCHES:
        abort(400)
    try:
        due = datetime.strptime(request.form.get("due_date", ""), "%Y-%m-%d").date()
    except ValueError:
        flash("Pick a due date for the Sprint.", "error")
        return redirect(url_for("teacher.classroom", cid=cid))
    note = request.form.get("note", "").strip()[:500]
    wanted = [(lid, None) for lid in L.SPRINT_TRUNK]
    if choice == "choice":
        wanted += [(lid, name) for name, ids in L.SPRINT_BRANCHES.items() for lid in ids]
    else:
        wanted += [(lid, None) for lid in L.SPRINT_BRANCHES[choice]]
    existing = {a.lesson_id: a for a in c.assignments}
    added = 0
    for lid, branch in wanted:
        if not L.get_lesson(lid):
            continue
        if lid in existing:                 # assigning again updates the date
            existing[lid].due_date = due
            existing[lid].branch = branch
        else:
            db.session.add(Assignment(classroom=c, lesson_id=lid, due_date=due, note=note, branch=branch))
            added += 1
    db.session.commit()
    flash(f"Robot Sprint assigned: {added} new lesson(s), due {due.strftime('%b %-d')}.", "success")
    return redirect(url_for("teacher.classroom", cid=cid))


def _shown_names(students, mode):
    """First names for the projector, with an initial when two students share one."""
    def first(s):
        return (s.display_name.split() or ["Student"])[0]
    counts = {}
    for s in students:
        counts[first(s)] = counts.get(first(s), 0) + 1
    names = {}
    for s in students:
        parts = s.display_name.split()
        name = first(s)
        if counts[name] > 1 and len(parts) > 1:
            name = f"{name} {parts[1][0]}."
        if mode == "robot":
            name = (s.avatar or {}).get("name") or name
        names[s.id] = name
    return names


def _where(student, progress):
    """A student's most recent unfinished lesson, or their last finished one."""
    rows = sorted(progress, key=lambda p: p.updated_at or p.started_at, reverse=True)
    rows = [(p, L.get_lesson(p.lesson_id)) for p in rows if L.get_lesson(p.lesson_id)]
    for p, lesson in rows:
        pct = p.percent(L.section_keys(lesson))
        if pct < 100:
            return {"where": f"{lesson['number']}. {lesson['title']}", "pct": pct, "status": "working"}
    if rows:
        p, lesson = rows[0]
        return {"where": f"✓ {lesson['number']}. {lesson['title']}", "pct": 100, "status": "done"}
    return {"where": "Not started", "pct": 0, "status": "waiting"}


def _screen_payload(c):
    saved = dict(c.screen or {})
    settings = {"lesson_id": saved.get("lesson_id", ""), "question": saved.get("question", ""),
                "standard": saved.get("standard", ""), "names": saved.get("names", "first"),
                "xp": saved.get("xp", "each")}
    lesson = L.get_lesson(settings["lesson_id"])
    if not lesson:                          # default: the next assignment due
        dated = sorted(c.assignments, key=lambda a: (a.due_date is None, a.due_date or date.max, a.created_at))
        upcoming = [a for a in dated if not a.due_date or a.due_date >= date.today()] or dated
        upcoming = [a for a in upcoming if L.get_lesson(a.lesson_id)]
        lesson = L.get_lesson(upcoming[0].lesson_id) if upcoming else L.all_lessons()[0]
    standards = STD.for_lesson(lesson)
    standard = next((s for s in standards if s["code"] == settings["standard"]), standards[0] if standards else None)
    by_student = {}
    if c.students:
        for p in Progress.query.filter(Progress.user_id.in_([s.id for s in c.students])):
            by_student.setdefault(p.user_id, []).append(p)
    names = _shown_names(c.students, settings["names"])
    students = []
    for s in sorted(c.students, key=lambda st: names[st.id].lower()):
        row = {"name": names[s.id], "avatar": gamify.avatar_of(s), **_where(s, by_student.get(s.id, []))}
        if settings["xp"] == "each":        # hidden XP never reaches the browser
            row["xp"] = s.xp or 0
        students.append(row)
    return {"settings": settings, "students": students,
            "total_xp": 0 if settings["xp"] == "hide" else sum(s.xp or 0 for s in c.students),
            "lesson": {"id": lesson["id"], "number": lesson["number"], "title": lesson["title"]},
            "question": settings["question"] or (lesson.get("warmup") or {}).get("prompt", ""),
            "standard": {"code": standard["code"], "text": standard["text"]} if standard else None,
            "standards": [{"code": s["code"], "text": s["text"]} for s in standards]}


@bp.route("/classes/<int:cid>/google-classroom")
@teacher_required
def google(cid):
    c = _own_class(cid)
    cols, _ = gradebook(c)
    return render_template("teacher/google.html", c=c, cols=cols)


def _score(cell, how):
    """A 0-100 grade, or None if there's nothing to grade yet."""
    p = cell["p"]
    if not p:
        return None
    quiz = round(100 * (p.quiz_best or 0) / p.quiz_total) if p.quiz_total else None
    if how == "complete":
        return cell["pct"]
    if how == "quiz":
        return quiz
    return round((cell["pct"] + quiz) / 2) if quiz is not None else None


@bp.post("/classes/<int:cid>/google-classroom/package")
@teacher_required
def google_package(cid):
    c = _own_class(cid)
    data = request.get_json(silent=True) or {}
    how = data.get("score")
    wanted = data.get("lessons")
    if how not in ("complete", "quiz", "both") or not isinstance(wanted, list):
        abort(400)
    cols, grid = gradebook(c)
    cols = [(a, lesson) for a, lesson in cols if lesson["id"] in wanted]
    students = []
    for s in c.students:
        grades = {}
        for a, lesson in cols:
            score = _score(grid[(s.id, a.id)], how)
            if score is not None:
                grades[lesson["id"]] = score
        students.append({"ref": str(s.id), "name": s.display_name, "grades": grades})
    return jsonify({"source": "microbit-maker-lab", "version": 1, "class": c.name, "students": students,
                    "assignments": [{"key": lesson["id"], "title": f"{lesson['number']}. {lesson['title']}",
                                     "due": a.due_date.isoformat() if a.due_date else ""} for a, lesson in cols]})


@bp.route("/classes/<int:cid>/screen")
@teacher_required
def screen(cid):
    return render_template("teacher/screen.html", c=_own_class(cid), units=L.lessons_by_unit())


@bp.route("/classes/<int:cid>/screen/data")
@teacher_required
def screen_data(cid):
    return jsonify(_screen_payload(_own_class(cid)))


@bp.post("/classes/<int:cid>/screen/settings")
@teacher_required
def screen_settings(cid):
    c = _own_class(cid)
    data = request.get_json(silent=True) or {}
    lesson_id = data.get("lesson_id", "")
    c.screen = {"lesson_id": lesson_id if L.get_lesson(lesson_id) else "",
                "question": str(data.get("question", "")).strip()[:300],
                "standard": str(data.get("standard", ""))[:20],
                "names": "robot" if data.get("names") == "robot" else "first",
                "xp": data.get("xp") if data.get("xp") in ("each", "total", "hide") else "each"}
    db.session.commit()
    return jsonify(_screen_payload(c))


@bp.post("/assignments/<int:aid>/update")
@teacher_required
def update_assignment(aid):
    a = db.session.get(Assignment, aid)
    if not a or a.classroom.teacher_id != current_user.id:
        abort(404)
    if request.form.get("action") == "delete":
        cid = a.classroom_id
        db.session.delete(a)
        db.session.commit()
        flash("Assignment removed (student work is kept).", "info")
        return redirect(url_for("teacher.classroom", cid=cid))
    due_raw = request.form.get("due_date", "")
    try:
        a.due_date = datetime.strptime(due_raw, "%Y-%m-%d").date() if due_raw else None
    except ValueError:
        flash("Bad date.", "error")
    a.note = request.form.get("note", "").strip()[:500]
    db.session.commit()
    flash("Assignment updated.", "success")
    return redirect(url_for("teacher.assignment", aid=aid))


@bp.route("/assignments/<int:aid>")
@teacher_required
def assignment(aid):
    a = db.session.get(Assignment, aid)
    if not a or a.classroom.teacher_id != current_user.id:
        abort(404)
    lesson = L.get_lesson(a.lesson_id)
    if not lesson:
        abort(404)
    ps = {p.user_id: p for p in Progress.query.filter(
        Progress.lesson_id == a.lesson_id,
        Progress.user_id.in_([s.id for s in a.classroom.students] or [0]))}
    rows = [(s, status_cell(lesson, ps.get(s.id), a.due_date)) for s in a.classroom.students]
    return render_template("teacher/assignment.html", a=a, c=a.classroom, lesson=lesson, rows=rows,
                           keys=L.section_keys(lesson))


@bp.route("/classes/<int:cid>/students/<int:sid>")
@teacher_required
def student(cid, sid):
    c = _own_class(cid)
    s = _student_in(c, sid)
    pm = {p.lesson_id: p for p in s.progress}
    mates = partners.names_for({s.id}, list(pm))
    items = []
    for lesson in L.all_lessons():
        p = pm.get(lesson["id"])
        assigned = any(a.lesson_id == lesson["id"] for a in c.assignments)
        if p or assigned:
            items.append({"lesson": lesson, "p": p, "assigned": assigned, "partner": mates.get((s.id, lesson["id"])),
                          "pct": p.percent(L.section_keys(lesson)) if p else 0})
    return render_template("teacher/student.html", c=c, s=s, items=items,
                           level=gamify.level_info(s.xp or 0), badges=gamify.badge_list(s))


@bp.post("/classes/<int:cid>/students/<int:sid>/bonus")
@teacher_required
def bonus(cid, sid):
    c = _own_class(cid)
    s = _student_in(c, sid)
    reason = request.form.get("reason", "").strip()[:120] or "Great work"
    try:
        amount = int(request.form.get("amount") or 0)
    except ValueError:
        amount = 0
    got = gamify.give_bonus(s, current_user, amount, reason, bool(request.form.get("badge")))
    flash(f"Gave {s.display_name} {got['xp']} XP." if got["xp"] else "Nothing to give (they may already have that badge).",
          "success" if got["xp"] else "info")
    return redirect(url_for("teacher.student", cid=cid, sid=sid))


@bp.post("/progress/<int:pid>/feedback")
@teacher_required
def feedback(pid):
    p = db.session.get(Progress, pid)
    if not p:
        abort(404)
    classes = [c for c in p.user.classes if c.teacher_id == current_user.id]
    if not classes:
        abort(404)
    p.feedback = request.form.get("feedback", "").strip()[:5000]
    if request.form.get("reopen_debug"):
        p.debug_solved = False
        p.mark("debug", False)
    db.session.commit()
    flash("Feedback saved.", "success")
    return redirect(request.form.get("back") or url_for("teacher.student", cid=classes[0].id, sid=p.user_id))


@bp.post("/classes/<int:cid>/students/<int:sid>/reset")
@teacher_required
def reset_password(cid, sid):
    c = _own_class(cid)
    s = _student_in(c, sid)
    words = ["volt", "amp", "led", "pixel", "servo", "robot", "spark", "pin", "loop", "byte"]
    temp = f"{secrets.choice(words)}{secrets.randbelow(900) + 100}"
    s.set_password(temp)
    db.session.commit()
    flash(f"{s.display_name}'s new password is: {temp}  (they can change it after logging in)", "success")
    return redirect(url_for("teacher.student", cid=cid, sid=sid))


@bp.post("/classes/<int:cid>/students/<int:sid>/remove")
@teacher_required
def remove_student(cid, sid):
    c = _own_class(cid)
    s = _student_in(c, sid)
    c.students.remove(s)
    db.session.commit()
    flash(f"Removed {s.display_name} from {c.name}.", "info")
    return redirect(url_for("teacher.classroom", cid=cid))


@bp.route("/classes/<int:cid>/export.csv")
@teacher_required
def export(cid):
    c = _own_class(cid)
    cols, grid = gradebook(c)
    out = io.StringIO()
    w = csv.writer(out)
    header = ["Student", "Username", "XP", "Level"]
    for a, lesson in cols:
        t = lesson["title"]
        header += [f"{t} - % complete", f"{t} - quiz best", f"{t} - debug solved", f"{t} - challenge", f"{t} - partner"]
    w.writerow(header)
    for s in c.students:
        lv = gamify.level_info(s.xp or 0)
        row = [s.display_name, s.username, s.xp or 0, f"{lv['level']} {lv['title']}"]
        for a, lesson in cols:
            cell = grid[(s.id, a.id)]
            p = cell["p"]
            row += [cell["pct"],
                    f"{p.quiz_best}/{p.quiz_total}" if p and p.quiz_total else "",
                    "yes" if p and p.debug_solved else "no",
                    "submitted" if p and p.challenge_submitted_at else "",
                    cell.get("partner") or ""]
        w.writerow(row)
    fname = f"{c.name.replace(' ', '_')}_progress.csv"
    return Response(out.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@bp.route("/videos", methods=["GET", "POST"])
@teacher_required
def videos():
    if request.method == "POST":
        for lesson in L.all_lessons():
            url = request.form.get(f"video_{lesson['id']}", "").strip()
            row = db.session.get(LessonVideo, lesson["id"])
            if url:
                if not embed_info(url):
                    flash(f"{lesson['title']}: links must start with https://", "error")
                    continue
                if row:
                    row.url = url
                else:
                    db.session.add(LessonVideo(lesson_id=lesson["id"], url=url))
            elif row:
                db.session.delete(row)
        db.session.commit()
        flash("Videos saved.", "success")
        return redirect(url_for("teacher.videos"))
    return render_template("teacher/videos.html", units=L.lessons_by_unit(), urls=all_video_urls())


@bp.route("/standards")
@teacher_required
def standards():
    cov = STD.coverage()
    strands = []
    for code, name in STD.framework()["strands"].items():
        topics = [t for t in cov if t["strand"] == code]
        strands.append({"code": code, "name": name, "covered": sum(t["covered"] for t in topics),
                        "total": sum(len(t["items"]) for t in topics)})
    return render_template("teacher/standards.html", fw=STD.framework(), coverage=cov, strands=strands,
                           lessons=L.all_lessons(),
                           total=sum(len(t["items"]) for t in cov),
                           covered=sum(t["covered"] for t in cov))
