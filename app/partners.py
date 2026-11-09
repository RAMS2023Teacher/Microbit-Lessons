"""Student partners: one pair per student per lesson, inside a class they share."""
from .models import Partnership, Progress, User, db, utcnow


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
        other = db.session.get(User, mate_id(row, user.id))
        status = "paired" if row.accepted else "sent" if row.inviter_id == user.id else "incoming"
        return {"status": status, "name": other.display_name}
    busy = {mate_id(r, r.inviter_id) for r in Partnership.query.filter_by(lesson_id=lesson_id)}
    busy |= {r.inviter_id for r in Partnership.query.filter_by(lesson_id=lesson_id)}
    return {"status": "none", "classmates": [{"id": s.id, "name": s.display_name}
                                             for s in classmates(user) if s.id not in busy]}


def invite(user, lesson_id, target_id):
    """Returns an error message, or None when the invite was sent."""
    if current(user.id, lesson_id):
        return "You already have a partner or an invite for this lesson."
    if not any(s.id == target_id for s in classmates(user)):
        return "You can only partner with someone in your class."
    if current(target_id, lesson_id):
        return "That classmate already has a partner for this lesson."
    db.session.add(Partnership(lesson_id=lesson_id, inviter_id=user.id, partner_id=target_id))
    return None


def share_challenge(user_id, lesson, submitted):
    """Copy a submission to the accepted partner. Returns the partner's name, or None."""
    row = current(user_id, lesson["id"])
    if not row or not row.accepted:
        return None
    other = mate_id(row, user_id)
    p = Progress.query.filter_by(user_id=other, lesson_id=lesson["id"]).first()
    if not p:
        p = Progress(user_id=other, lesson_id=lesson["id"], sections={}, circuit_steps=[])
        db.session.add(p)
    p.challenge_code = submitted.challenge_code
    p.challenge_response = submitted.challenge_response
    p.challenge_submitted_at = utcnow()
    p.mark("challenge")
    return db.session.get(User, other).display_name


def names_for(user_ids, lesson_ids):
    """{(user_id, lesson_id): partner's display name} for accepted pairs."""
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
