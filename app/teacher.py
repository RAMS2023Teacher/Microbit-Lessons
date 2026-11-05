import csv
import io
import secrets
from datetime import date, datetime

from flask import (Blueprint, Response, abort, flash, redirect, render_template, request,
                   url_for)
from flask_login import current_user

from . import lessons as L
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
    grid = {(s.id, a.id): status_cell(lesson, progress.get((s.id, a.lesson_id)), a.due_date)
            for s in students for a, lesson in cols}
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
    return render_template("teacher/classroom.html", c=c, cols=cols, grid=grid,
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
    items = []
    for lesson in L.all_lessons():
        p = pm.get(lesson["id"])
        assigned = any(a.lesson_id == lesson["id"] for a in c.assignments)
        if p or assigned:
            items.append({"lesson": lesson, "p": p, "assigned": assigned,
                          "pct": p.percent(L.section_keys(lesson)) if p else 0})
    return render_template("teacher/student.html", c=c, s=s, items=items)


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
    header = ["Student", "Username"]
    for a, lesson in cols:
        t = lesson["title"]
        header += [f"{t} - % complete", f"{t} - quiz best", f"{t} - debug solved", f"{t} - challenge"]
    w.writerow(header)
    for s in c.students:
        row = [s.display_name, s.username]
        for a, lesson in cols:
            cell = grid[(s.id, a.id)]
            p = cell["p"]
            row += [cell["pct"],
                    f"{p.quiz_best}/{p.quiz_total}" if p and p.quiz_total else "",
                    "yes" if p and p.debug_solved else "no",
                    "submitted" if p and p.challenge_submitted_at else ""]
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
