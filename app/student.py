from datetime import date

from flask import Blueprint, abort, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from . import lessons as L
from .models import Assignment, Classroom, Progress, db
from .videos import video_for

bp = Blueprint("student", __name__)


def progress_map(user):
    return {p.lesson_id: p for p in user.progress}


@bp.route("/")
def index():
    if current_user.is_authenticated:
        return redirect(url_for("teacher.home" if current_user.is_teacher else "student.dashboard"))
    return render_template("index.html", units=L.lessons_by_unit())


@bp.route("/dashboard")
@login_required
def dashboard():
    if current_user.is_teacher:
        return redirect(url_for("teacher.home"))
    pm = progress_map(current_user)
    class_ids = [c.id for c in current_user.classes]
    rows = []
    if class_ids:
        q = (Assignment.query.filter(Assignment.classroom_id.in_(class_ids))
             .order_by(Assignment.due_date.is_(None), Assignment.due_date, Assignment.created_at))
        for a in q:
            lesson = L.get_lesson(a.lesson_id)
            if not lesson:
                continue
            p = pm.get(a.lesson_id)
            pct = p.percent(L.section_keys(lesson)) if p else 0
            rows.append({"a": a, "lesson": lesson, "pct": pct,
                         "overdue": a.due_date and a.due_date < date.today() and pct < 100,
                         "feedback": p.feedback if p else ""})
    recent = sorted(current_user.progress, key=lambda p: p.updated_at or p.started_at, reverse=True)
    recent = [(p, L.get_lesson(p.lesson_id)) for p in recent if L.get_lesson(p.lesson_id)][:3]
    recent = [(p, l, p.percent(L.section_keys(l))) for p, l in recent]
    return render_template("student/dashboard.html", rows=rows, recent=recent)


@bp.route("/join", methods=["POST"])
@login_required
def join_class():
    code = request.form.get("class_code", "").strip().upper()
    c = Classroom.query.filter_by(join_code=code).first()
    if not c:
        flash("Class code not found.", "error")
    elif c in current_user.classes:
        flash(f"You're already in {c.name}.", "info")
    else:
        current_user.classes.append(c)
        db.session.commit()
        flash(f"Joined {c.name}!", "success")
    return redirect(url_for("student.dashboard"))


@bp.route("/lessons")
def catalog():
    pm = progress_map(current_user) if current_user.is_authenticated else {}
    pct = {lid: p.percent(L.section_keys(L.get_lesson(lid))) for lid, p in pm.items() if L.get_lesson(lid)}
    return render_template("student/catalog.html", units=L.lessons_by_unit(), pct=pct)


@bp.route("/lessons/<lesson_id>")
@login_required
def lesson(lesson_id):
    lesson = L.get_lesson(lesson_id)
    if not lesson:
        abort(404)
    p = Progress.query.filter_by(user_id=current_user.id, lesson_id=lesson_id).first()
    prev, nxt = L.neighbors(lesson_id)
    state = {
        "sections": (p.sections if p else {}) or {},
        "circuit_steps": (p.circuit_steps if p else []) or [],
        "warmup_answer": p.warmup_answer if p else "",
        "code": p.code if p and p.code else lesson["code"]["starter"],
        "debug_code": p.debug_code if p and p.debug_code else lesson["debug"]["buggy_code"],
        "debug_solved": bool(p and p.debug_solved),
        "debug_hints_used": p.debug_hints_used if p else 0,
        "debug_reflection": p.debug_reflection if p else "",
        "quiz_answers": p.quiz_answers if p else None,
        "quiz_score": p.quiz_score if p else None,
        "quiz_best": p.quiz_best if p else None,
        "challenge_code": p.challenge_code if p and p.challenge_code else "from microbit import *\n\n",
        "challenge_response": p.challenge_response if p else "",
        "challenge_submitted": bool(p and p.challenge_submitted_at),
        "feedback": p.feedback if p else "",
    }
    if p and p.quiz_answers is not None:
        state["quiz_results"] = L.grade_quiz(lesson, p.quiz_answers)
    return render_template("student/lesson.html", lesson=lesson, view=L.public_view(lesson),
                           state=state, video=video_for(lesson_id), prev=prev, nxt=nxt,
                           keys=L.section_keys(lesson),
                           is_teacher=current_user.is_teacher)


@bp.route("/editor")
@login_required
def playground():
    return render_template("student/playground.html")
