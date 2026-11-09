from flask import Blueprint, abort, jsonify, request
from flask_login import current_user, login_required

from . import gamify
from . import lessons as L
from . import partners
from .models import Progress, db, utcnow

bp = Blueprint("api", __name__, url_prefix="/api")

MAX_TEXT = 20_000


def _lesson_and_progress(lesson_id):
    lesson = L.get_lesson(lesson_id)
    if not lesson:
        abort(404)
    p = Progress.query.filter_by(user_id=current_user.id, lesson_id=lesson_id).first()
    if not p:
        p = Progress(user_id=current_user.id, lesson_id=lesson_id, sections={}, circuit_steps=[])
        db.session.add(p)
    return lesson, p


def _text(v):
    if not isinstance(v, str):
        abort(400)
    return v[:MAX_TEXT]


def _finish(lesson, p, **extra):
    keys = L.section_keys(lesson)
    pct = p.percent(keys)
    if pct == 100 and not p.completed_at:
        p.completed_at = utcnow()
    db.session.commit()
    rewards = gamify.sync_rewards(current_user)
    return jsonify({"ok": True, "sections": p.sections, "percent": pct, "rewards": rewards,
                    "lesson_xp": gamify.lesson_xp(current_user, lesson["id"]),
                    "stars": gamify.lesson_stars(lesson, p), **extra})


@bp.post("/lessons/<lesson_id>/save")
@login_required
def save(lesson_id):
    lesson, p = _lesson_and_progress(lesson_id)
    data = request.get_json(silent=True) or {}
    for field in ("code", "debug_code", "challenge_code", "challenge_response", "debug_reflection"):
        if field in data:
            setattr(p, field, _text(data[field]))
    if "warmup_answer" in data:
        p.warmup_answer = _text(data["warmup_answer"])
        p.mark("warmup", len(p.warmup_answer.strip()) >= 3)
    if "debug_hints_used" in data and isinstance(data["debug_hints_used"], int):
        p.debug_hints_used = max(p.debug_hints_used or 0, min(data["debug_hints_used"], 10))
    stepped = lesson.get("circuit") or lesson.get("lab")     # lab steps are tracked the same way
    if "circuit_steps" in data and stepped:
        n = len(stepped["steps"])
        steps = sorted({int(i) for i in data["circuit_steps"] if isinstance(i, int) and 0 <= i < n})
        p.circuit_steps = steps
        p.mark("circuit" if lesson.get("circuit") else "lab", len(steps) == n)
    for key in ("learn", "code"):
        if key in (data.get("mark") or {}):
            p.mark(key, bool(data["mark"][key]))
    return _finish(lesson, p)


@bp.post("/lessons/<lesson_id>/sent")
@login_required
def sent(lesson_id):
    lesson, p = _lesson_and_progress(lesson_id)
    p.sends = (p.sends or 0) + 1
    data = request.get_json(silent=True) or {}
    if data.get("section") == "code":
        p.mark("code")
    return _finish(lesson, p)


@bp.post("/lessons/<lesson_id>/debug")
@login_required
def debug(lesson_id):
    lesson, p = _lesson_and_progress(lesson_id)
    if not lesson.get("debug"):
        abort(404)
    code = _text((request.get_json(silent=True) or {}).get("code", ""))
    p.debug_code = code
    p.debug_attempts = (p.debug_attempts or 0) + 1
    if code.strip() == lesson["debug"]["buggy_code"].strip():
        results = [{"ok": False, "message": "This is still the original broken code. Change something first!"}]
    else:
        results = L.run_checks(code, lesson["debug"]["checks"])
    solved = all(r["ok"] for r in results)
    if solved:
        p.debug_solved = True
        p.mark("debug")
    failing = [r["message"] for r in results if not r["ok"] and r["message"]]
    return _finish(lesson, p, solved=solved, messages=failing[:1] if failing else [],
                   passed=sum(r["ok"] for r in results), total=len(results))


@bp.post("/lessons/<lesson_id>/quiz")
@login_required
def quiz(lesson_id):
    lesson, p = _lesson_and_progress(lesson_id)
    answers = (request.get_json(silent=True) or {}).get("answers")
    if not isinstance(answers, list) or len(answers) != len(lesson["quiz"]):
        abort(400)
    answers = [a if isinstance(a, int) else None for a in answers]
    graded = L.grade_quiz(lesson, answers)
    p.quiz_answers = answers
    p.quiz_score = graded["score"]
    p.quiz_total = graded["total"]
    p.quiz_best = max(p.quiz_best or 0, graded["score"])
    p.quiz_attempts = (p.quiz_attempts or 0) + 1
    p.mark("quiz")
    return _finish(lesson, p, quiz=graded, best=p.quiz_best)


@bp.post("/lessons/<lesson_id>/challenge")
@login_required
def challenge(lesson_id):
    lesson, p = _lesson_and_progress(lesson_id)
    data = request.get_json(silent=True) or {}
    response = _text(data.get("response", "")).strip()
    if len(response) < 10:
        return jsonify({"ok": False, "error": "Tell us a bit more about what you built (at least a sentence)."}), 400
    p.challenge_code = _text(data.get("code", ""))
    p.challenge_response = response
    p.challenge_submitted_at = utcnow()
    p.mark("challenge")
    return _finish(lesson, p, partner=partners.share_challenge(current_user.id, lesson, p))


@bp.route("/lessons/<lesson_id>/partner", methods=["GET", "POST"])
@login_required
def partner(lesson_id):
    if not L.get_lesson(lesson_id) or current_user.is_teacher:
        abort(404)
    if request.method == "GET":
        return jsonify(partners.state(current_user, lesson_id))
    data = request.get_json(silent=True) or {}
    action = data.get("action")
    row = partners.current(current_user.id, lesson_id)
    error = None
    if action == "invite":
        if not isinstance(data.get("partner_id"), int):
            abort(400)
        error = partners.invite(current_user, lesson_id, data["partner_id"])
    elif action == "accept":
        if not row or row.partner_id != current_user.id:
            abort(400)
        row.accepted = True
    elif action == "leave":                 # also declines or cancels an invite
        if row:
            db.session.delete(row)
    else:
        abort(400)
    if error:
        db.session.rollback()
        return jsonify({"error": error, **partners.state(current_user, lesson_id)}), 400
    db.session.commit()
    return jsonify(partners.state(current_user, lesson_id))


@bp.post("/avatar")
@login_required
def save_avatar():
    avatar, err = gamify.clean_avatar(current_user, request.get_json(silent=True) or {})
    if err:
        return jsonify({"ok": False, "error": err}), 400
    current_user.avatar = avatar
    db.session.commit()
    return jsonify({"ok": True, "avatar": avatar, "rewards": gamify.sync_rewards(current_user)})
