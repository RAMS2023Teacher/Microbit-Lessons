"""Student partners: two classmates doing a lesson together, usually on one Chromebook.

One student picks the other; there's no accept step, because the partner is sitting right there.
From then on every save is copied to both students, so both get the work, the XP and the grade.
One pair per student per lesson, inside a class they share."""
from .models import Partnership, Progress, User, db

# Everything about a lesson's work that both partners share (not the teacher's per-student feedback).
SHARED = ("sections", "circuit_steps", "warmup_answer", "code", "sends", "practice_code", "practice_solved",
          "debug_code", "debug_solved", "debug_attempts", "debug_hints_used", "debug_reflection",
          "quiz_answers", "quiz_score", "quiz_best", "quiz_total", "quiz_attempts",
          "challenge_code", "challenge_response", "challenge_submitted_at", "completed_at", "learn_checks")


def _rows(user_id, lesson_id):
    return Partnership.query.filter(Partnership.lesson_id == lesson_id,
                                    (Partnership.inviter_id == user_id) | (Partnership.partner_id == user_id))


def current(user_id, lesson_id):
    return _rows(user_id, lesson_id).first()


def mate_id(row, user_id):
    return row.partner_id if row.inviter_id == user_id else row.inviter_id


def classmates(user):
    """Students who share a class with this user, by display name."""
    seen = {s.id: s for c in user.classes for s in c.students if s.id != user.id and not s.is_teacher}
    return sorted(seen.values(), key=lambda s: s.display_name.lower())


def state(user, lesson_id):
    row = current(user.id, lesson_id)
    if row:
        if not row.accepted:            # an invite from the older two-step version: treat it as paired
            row.accepted = True
            db.session.commit()
        return {"status": "paired", "name": db.session.get(User, mate_id(row, user.id)).display_name}
    busy = set()
    for r in Partnership.query.filter_by(lesson_id=lesson_id):
        busy |= {r.inviter_id, r.partner_id}
    return {"status": "none", "classmates": [{"id": s.id, "name": s.display_name}
                                             for s in classmates(user) if s.id not in busy]}


def _progress(user_id, lesson_id):
    p = Progress.query.filter_by(user_id=user_id, lesson_id=lesson_id).first()
    if not p:
        p = Progress(user_id=user_id, lesson_id=lesson_id, sections={}, circuit_steps=[])
        db.session.add(p)
    return p


def merge(a: Progress, b: Progress):
    """Combine two students' work on the same lesson into a (whatever either of them finished counts)."""
    a.sections = {k: bool((a.sections or {}).get(k) or (b.sections or {}).get(k))
                  for k in set(a.sections or {}) | set(b.sections or {})}
    a.circuit_steps = sorted(set(a.circuit_steps or []) | set(b.circuit_steps or []))
    for f in ("warmup_answer", "code", "practice_code", "debug_code", "debug_reflection", "challenge_code", "challenge_response"):
        if not getattr(a, f) and getattr(b, f):
            setattr(a, f, getattr(b, f))
    for f in ("practice_solved", "debug_solved"):
        setattr(a, f, bool(getattr(a, f) or getattr(b, f)))
    for f in ("sends", "debug_attempts", "debug_hints_used", "quiz_attempts"):
        setattr(a, f, max(getattr(a, f) or 0, getattr(b, f) or 0))
    if (b.quiz_best or 0) > (a.quiz_best or 0):
        a.quiz_best, a.quiz_total, a.quiz_answers, a.quiz_score = b.quiz_best, b.quiz_total, b.quiz_answers, b.quiz_score
    for f in ("challenge_submitted_at", "completed_at"):
        dates = [d for d in (getattr(a, f), getattr(b, f)) if d]
        setattr(a, f, min(dates) if dates else None)
    checks = dict(b.learn_checks or {})
    for k, row in (a.learn_checks or {}).items():
        other = checks.get(k)
        if not other or (row.get("ok") and (not other.get("ok") or row.get("tries", 9) <= other.get("tries", 9))):
            checks[k] = row
    a.learn_checks = checks


def copy_work(src: Progress, dst: Progress):
    for f in SHARED:
        v = getattr(src, f)
        setattr(dst, f, dict(v) if isinstance(v, dict) else list(v) if isinstance(v, list) else v)


def pair(user, lesson_id, target_id):
    """Returns an error message, or None when the two are now partners (their work is combined)."""
    if current(user.id, lesson_id):
        return "You already have a partner for this lesson."
    if not any(s.id == target_id for s in classmates(user)):
        return "You can only partner with someone in your class."
    if current(target_id, lesson_id):
        return "That classmate already has a partner for this lesson."
    db.session.add(Partnership(lesson_id=lesson_id, inviter_id=user.id, partner_id=target_id, accepted=True))
    mine, theirs = _progress(user.id, lesson_id), _progress(target_id, lesson_id)
    merge(mine, theirs)
    copy_work(mine, theirs)
    return None


def mirror(user_id, lesson_id, p: Progress):
    """After any save: copy this lesson's work to the partner. Returns the partner User, or None."""
    row = current(user_id, lesson_id)
    if not row or not row.accepted:
        return None
    other = db.session.get(User, mate_id(row, user_id))
    copy_work(p, _progress(other.id, lesson_id))
    return other


def names_for(user_ids, lesson_ids):
    """{(user_id, lesson_id): partner's display name} for pairs."""
    if not user_ids or not lesson_ids:
        return {}
    rows = Partnership.query.filter(Partnership.accepted.is_(True), Partnership.lesson_id.in_(lesson_ids)).all()
    ids = {r.inviter_id for r in rows} | {r.partner_id for r in rows}
    people = {u.id: u.display_name for u in User.query.filter(User.id.in_(ids))} if ids else {}
    found = {}
    for r in rows:
        if r.inviter_id in user_ids:
            found[(r.inviter_id, r.lesson_id)] = people[r.partner_id]
        if r.partner_id in user_ids:
            found[(r.partner_id, r.lesson_id)] = people[r.inviter_id]
    return found
