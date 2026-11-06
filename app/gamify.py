"""XP, levels, badges, the lesson skill-tree map and avatar parts.

Everything a teacher might want to tune lives at the top of this file.

Rewards are *idempotent*: every XP award has a unique key (e.g. "debug:traffic-light"),
so calling ``sync_rewards`` again never double-counts, and students who did work
before gamification existed get their XP the next time they save anything.
"""
from __future__ import annotations

import re

from . import lessons as L
from .models import Assignment, Progress, UserBadge, XPEvent, db, utcnow

# ---------------------------------------------------------------- XP values
XP = {
    "warmup": 10,
    "learn": 10,
    "circuit": 30,
    "code": 20,
    "debug": 30,
    "quiz": 15,
    "challenge": 40,
    "complete": 50,       # whole lesson finished
    "clean_fix": 10,      # debug fixed without hints
    "quiz_perfect": 15,   # best quiz score is 100%
    "quiz_first_try": 10,  # 100% on the first attempt
    "badge": 25,          # every badge is also worth XP
}
SECTION_LABELS = {"warmup": "Warm-up", "learn": "Learn", "circuit": "Circuit built", "code": "Code ran",
                  "debug": "Bug fixed", "quiz": "Quiz done", "challenge": "Challenge submitted",
                  "complete": "Lesson complete!", "clean_fix": "Fixed with no hints",
                  "quiz_perfect": "Perfect quiz", "quiz_first_try": "Perfect on the first try"}

# ---------------------------------------------------------------- levels
LEVELS = [  # (XP needed, title)
    (0, "Spark"), (100, "Blinker"), (250, "Wire Wrangler"), (450, "Code Cadet"),
    (700, "Circuit Scout"), (1000, "Bug Hunter"), (1350, "Sensor Sleuth"),
    (1750, "Motor Mechanic"), (2200, "Maker"), (2700, "Engineer"),
    (3250, "Inventor"), (3850, "Robotics Ace"),
]


def level_info(xp: int) -> dict:
    lvl = 1
    for i, (need, _) in enumerate(LEVELS):
        if xp >= need:
            lvl = i + 1
    floor = LEVELS[lvl - 1][0]
    nxt = LEVELS[lvl][0] if lvl < len(LEVELS) else None
    pct = 100 if nxt is None else round(100 * (xp - floor) / (nxt - floor))
    return {"level": lvl, "title": LEVELS[lvl - 1][1], "xp": xp, "floor": floor,
            "next": nxt, "pct": pct, "max": nxt is None}


# ---------------------------------------------------------------- skill tree
# requires: lessons that must be COMPLETE before this one unlocks on the map.
# pos: (column 0-4, row) on the map. Lessons missing here are appended automatically.
TREE = {
    "hello-microbit":      {"requires": [], "pos": (2, 0)},
    "circuits-101":        {"requires": ["hello-microbit"], "pos": (2, 1)},
    "blink-external-led":  {"requires": ["circuits-101"], "pos": (2, 2)},
    "traffic-light":       {"requires": ["blink-external-led"], "pos": (0.4, 3)},
    "dimmer-pwm":          {"requires": ["blink-external-led"], "pos": (1.9, 3.2)},
    "buttons-and-inputs":  {"requires": ["blink-external-led"], "pos": (3.5, 3)},
    "potentiometer":       {"requires": ["dimmer-pwm"], "pos": (0.5, 4.4)},
    "servo-motor":         {"requires": ["dimmer-pwm"], "pos": (1.7, 4.6)},
    "temperature-data":    {"requires": ["buttons-and-inputs"], "pos": (2.9, 4.4)},
    "light-sensor":        {"requires": ["buttons-and-inputs"], "pos": (4.1, 4.3)},
    "dc-motor-transistor": {"requires": ["servo-motor"], "pos": (1.4, 5.8)},
    "motion-and-sound":    {"requires": ["buttons-and-inputs"], "pos": (3.4, 5.7)},
    "motor-driver":        {"requires": ["dc-motor-transistor"], "pos": (1.8, 6.9)},
    "robot-drive":         {"requires": ["motor-driver"], "pos": (2.3, 8)},
    "line-follower":       {"requires": ["robot-drive", "light-sensor"], "pos": (1.2, 9.1)},
    "radio-remote":        {"requires": ["robot-drive", "motion-and-sound"], "pos": (3.2, 9.1)},
    # Robot Sprint: its own trail on the right, open from the start
    "sprint-servo-skills":  {"requires": [], "pos": (5.6, 0)},
    "sprint-sensor-lab":    {"requires": ["sprint-servo-skills"], "pos": (5.6, 1.3)},
    "sprint-sense-decide-act": {"requires": ["sprint-sensor-lab"], "pos": (5.6, 2.6)},
    "sprint-build-the-bot": {"requires": ["sprint-sense-decide-act"], "pos": (5.6, 3.9)},
    "sprint-mission-day":   {"requires": ["sprint-build-the-bot"], "pos": (5.6, 5.2)},
    "sprint-showcase":      {"requires": ["sprint-mission-day"], "pos": (5.6, 6.5)},
}


def tree() -> dict:
    """TREE plus any lessons added later (chained after the previous lesson)."""
    t = {k: dict(v) for k, v in TREE.items() if L.get_lesson(k)}
    prev, row = None, max((v["pos"][1] for v in TREE.values()), default=-1)
    for lesson in L.all_lessons():
        lid = lesson["id"]
        if lid not in t:
            row += 1.1
            t[lid] = {"requires": [prev] if prev else [], "pos": (2, row)}
        prev = lid
    return t


def lesson_stars(lesson: dict, p: Progress | None) -> int:
    """0-3 stars: bug fixed, perfect quiz, challenge submitted."""
    if not p:
        return 0
    return (int(bool(p.debug_solved)) + int(bool(p.quiz_total and p.quiz_best == p.quiz_total))
            + int(bool(p.challenge_submitted_at)))


def map_data(user, assigned_ids=()) -> dict:
    pm = {p.lesson_id: p for p in user.progress} if user else {}
    t = tree()
    nodes = []
    complete = set()
    for lesson in L.all_lessons():
        p = pm.get(lesson["id"])
        if p and p.percent(L.section_keys(lesson)) == 100:
            complete.add(lesson["id"])
    current = None
    recent = sorted((p for p in pm.values() if p.lesson_id not in complete and L.get_lesson(p.lesson_id)),
                    key=lambda p: p.updated_at or p.started_at, reverse=True)
    if recent:
        current = recent[0].lesson_id
    for lesson in L.all_lessons():
        lid = lesson["id"]
        info = t[lid]
        p = pm.get(lid)
        pct = p.percent(L.section_keys(lesson)) if p else 0
        reqs = [r for r in info["requires"] if L.get_lesson(r)]
        unlocked = all(r in complete for r in reqs) or lid in assigned_ids or pct > 0
        state = "complete" if lid in complete else "progress" if pct > 0 else "open" if unlocked else "locked"
        nodes.append({
            "id": lid, "number": lesson["number"], "title": lesson["title"], "unit": lesson["unit"],
            "x": info["pos"][0], "y": info["pos"][1], "requires": reqs,
            "requires_titles": [L.get_lesson(r)["title"] for r in reqs if r not in complete],
            "state": state, "pct": pct, "stars": lesson_stars(lesson, p),
            "assigned": lid in assigned_ids, "xp_possible": possible_xp(lesson),
        })
    if not current:
        current = next((n["id"] for n in nodes if n["state"] == "open"), nodes[-1]["id"] if nodes else None)
    return {"nodes": nodes, "current": current, "units": L.UNITS}


def possible_xp(lesson: dict) -> int:
    keys = L.section_keys(lesson)
    return sum(XP[k] for k in keys) + XP["complete"] + XP["clean_fix"] + XP["quiz_perfect"] + XP["quiz_first_try"]


# ---------------------------------------------------------------- badges
BADGES = [
    # id, icon, name, description
    ("first-spark", "⚡", "First Spark", "Finish your first lesson section."),
    ("let-there-be-light", "💡", "Let There Be Light", "Build your first circuit."),
    ("hardware-hacker", "🔌", "Hardware Hacker", "Send code to your micro:bit 10 times."),
    ("bug-squasher", "🐞", "Bug Squasher", "Fix your first debug challenge."),
    ("exterminator", "🪲", "Exterminator", "Fix 5 debug challenges."),
    ("clean-fix", "🧼", "Clean Fix", "Fix a bug without using any hints."),
    ("quiz-whiz", "🧠", "Quiz Whiz", "Get a perfect quiz score."),
    ("sharpshooter", "🎯", "Sharpshooter", "Get 3 quizzes perfect on the first try."),
    ("inventor", "🛠️", "Inventor", "Submit 3 open-ended challenges."),
    ("finisher", "🏁", "Finisher", "Complete a whole lesson."),
    ("star-collector", "⭐", "Star Collector", "Earn all 3 stars on 5 lessons."),
    ("early-bird", "🐦", "Early Bird", "Finish an assignment before it's due."),
    ("explorer", "🧭", "Explorer", "Start lessons in 3 different units."),
    ("robot-stylist", "🎨", "Robot Stylist", "Customize your avatar."),
    ("unit-1", "🔆", "Bright Spark", "Complete every lesson in Unit 1: Light It Up."),
    ("unit-2", "📡", "Sense-ational", "Complete every lesson in Unit 2: Sensing the World."),
    ("unit-3", "⚙️", "Mover & Shaker", "Complete every lesson in Unit 3: Making Things Move."),
    ("unit-4", "🤖", "Robot Wrangler", "Complete every lesson in Unit 4: Robots."),
    ("unit-5", "🏎️", "Sprint Champion", "Complete every lesson in the Robot Sprint."),
    ("graduate", "🎓", "Graduate", "Complete all 16 core lessons."),
    ("teachers-pick", "🍎", "Teacher's Pick", "Given by your teacher for great work."),
]
BADGE_BY_ID = {b[0]: {"id": b[0], "icon": b[1], "name": b[2], "desc": b[3]} for b in BADGES}


def _badge_checks(user, progress: list[Progress], xp_keys: set[str]) -> set[str]:
    earned = set()
    lessons = {l["id"]: l for l in L.all_lessons()}
    prog = [p for p in progress if p.lesson_id in lessons]
    done = {p.lesson_id for p in prog if p.percent(L.section_keys(lessons[p.lesson_id])) == 100}
    if any(any((p.sections or {}).values()) for p in prog):
        earned.add("first-spark")
    if any((p.sections or {}).get("circuit") for p in prog):
        earned.add("let-there-be-light")
    if sum(p.sends or 0 for p in prog) >= 10:
        earned.add("hardware-hacker")
    fixed = sum(1 for p in prog if p.debug_solved)
    if fixed >= 1:
        earned.add("bug-squasher")
    if fixed >= 5:
        earned.add("exterminator")
    if any(k.startswith("clean_fix:") for k in xp_keys):
        earned.add("clean-fix")
    if any(k.startswith("quiz_perfect:") for k in xp_keys):
        earned.add("quiz-whiz")
    if sum(1 for k in xp_keys if k.startswith("quiz_first_try:")) >= 3:
        earned.add("sharpshooter")
    if sum(1 for p in prog if p.challenge_submitted_at) >= 3:
        earned.add("inventor")
    if done:
        earned.add("finisher")
    if sum(1 for p in prog if lesson_stars(lessons[p.lesson_id], p) == 3) >= 5:
        earned.add("star-collector")
    if len({lessons[p.lesson_id]["unit"] for p in prog}) >= 3:
        earned.add("explorer")
    if user.avatar:
        earned.add("robot-stylist")
    for unit in L.UNITS:
        ids = [l["id"] for l in lessons.values() if l["unit"] == unit]
        if ids and all(i in done for i in ids):
            earned.add(f"unit-{unit}")
    core = [i for i, l in lessons.items() if l["unit"] <= 4]
    if core and all(i in done for i in core):
        earned.add("graduate")
    class_ids = [c.id for c in user.classes]
    if class_ids and done:
        for a in Assignment.query.filter(Assignment.classroom_id.in_(class_ids),
                                         Assignment.due_date.isnot(None)):
            p = next((p for p in prog if p.lesson_id == a.lesson_id), None)
            if p and p.completed_at and p.completed_at.date() <= a.due_date:
                earned.add("early-bird")
                break
    return earned


# ---------------------------------------------------------------- awarding
def _award(user, key: str, amount: int, reason: str, existing: set[str], gained: list):
    if key in existing:
        return
    db.session.add(XPEvent(user_id=user.id, key=key, amount=amount, reason=reason))
    existing.add(key)
    user.xp = (user.xp or 0) + amount
    gained.append({"amount": amount, "reason": reason})


def sync_rewards(user) -> dict:
    """Award any XP and badges the user has earned but not yet received.

    Returns what changed, for the pop-up celebration in the browser."""
    if user.is_teacher:
        return {}
    before = level_info(user.xp or 0)
    existing = {k for (k,) in db.session.query(XPEvent.key).filter_by(user_id=user.id)}
    gained: list = []
    progress = Progress.query.filter_by(user_id=user.id).all()
    for p in progress:
        lesson = L.get_lesson(p.lesson_id)
        if not lesson:
            continue
        lid, title = lesson["id"], lesson["title"]
        s = p.sections or {}
        for key in L.section_keys(lesson):
            if s.get(key):
                _award(user, f"{key}:{lid}", XP[key], f"{SECTION_LABELS[key]} · {title}", existing, gained)
        if p.debug_solved and not (p.debug_hints_used or 0):
            _award(user, f"clean_fix:{lid}", XP["clean_fix"], f"{SECTION_LABELS['clean_fix']} · {title}", existing, gained)
        if p.quiz_total and p.quiz_best == p.quiz_total:
            _award(user, f"quiz_perfect:{lid}", XP["quiz_perfect"], f"{SECTION_LABELS['quiz_perfect']} · {title}", existing, gained)
            if p.quiz_attempts == 1:
                _award(user, f"quiz_first_try:{lid}", XP["quiz_first_try"],
                       f"{SECTION_LABELS['quiz_first_try']} · {title}", existing, gained)
        if p.percent(L.section_keys(lesson)) == 100:
            _award(user, f"complete:{lid}", XP["complete"], f"{SECTION_LABELS['complete']} · {title}", existing, gained)

    have = {b.badge_id for b in UserBadge.query.filter_by(user_id=user.id)}
    new_badges = []
    for bid in sorted(_badge_checks(user, progress, existing) - have):
        db.session.add(UserBadge(user_id=user.id, badge_id=bid))
        _award(user, f"badge:{bid}", XP["badge"], f"Badge: {BADGE_BY_ID[bid]['name']}", existing, gained)
        new_badges.append(BADGE_BY_ID[bid])
    db.session.commit()
    after = level_info(user.xp or 0)
    return {"xp_gained": sum(g["amount"] for g in gained), "items": gained[:6],
            "badges": new_badges, "level": after, "level_up": after["level"] > before["level"]}


def give_bonus(student, teacher, amount: int, reason: str, badge: bool) -> dict:
    amount = max(0, min(int(amount or 0), 200))
    existing: set = set()
    gained: list = []
    if amount:
        _award(student, f"bonus:{utcnow().isoformat()}:{teacher.id}", amount,
               f"Bonus from {teacher.display_name}: {reason}"[:200], existing, gained)
    if badge and not db.session.get(UserBadge, (student.id, "teachers-pick")):
        db.session.add(UserBadge(user_id=student.id, badge_id="teachers-pick"))
        _award(student, "badge:teachers-pick", XP["badge"], "Badge: Teacher's Pick", existing, gained)
    db.session.commit()
    return {"xp": sum(g["amount"] for g in gained)}


def lesson_xp(user, lesson_id: str) -> int:
    rows = XPEvent.query.filter(XPEvent.user_id == user.id, XPEvent.key.like(f"%:{lesson_id}")).all()
    return sum(r.amount for r in rows if r.key.split(":", 1)[1] == lesson_id)


def badge_list(user) -> list[dict]:
    got = {b.badge_id: b.earned_at for b in UserBadge.query.filter_by(user_id=user.id)}
    return [{**BADGE_BY_ID[bid], "earned": bid in got, "earned_at": got.get(bid)} for bid, *_ in BADGES]


# ---------------------------------------------------------------- avatar
# Each option: (id, label, unlock) where unlock is None, ("level", n) or ("badge", id).
AVATAR_OPTIONS = {
    "body": [("box", "Boxy", None), ("round", "Dome", None), ("tall", "Tall", ("level", 3)),
             ("tank", "Tank treads", ("level", 6)), ("hover", "Hover jets", ("badge", "unit-4"))],
    "color": [("teal", "Teal", None), ("red", "Red", None), ("orange", "Orange", None),
              ("yellow", "Yellow", None), ("green", "Green", None), ("blue", "Blue", None),
              ("purple", "Purple", None), ("pink", "Pink", None), ("white", "White", None),
              ("chrome", "Chrome", ("level", 8)), ("gold", "Gold", ("badge", "star-collector"))],
    "eyes": [("dots", "Dots", None), ("round", "Round", None), ("visor", "Visor", ("level", 2)),
             ("cyclops", "Cyclops", ("level", 4)), ("hearts", "Hearts", ("badge", "quiz-whiz")),
             ("leds", "LED grid", ("level", 5)), ("happy", "Happy", ("badge", "finisher"))],
    "mouth": [("smile", "Smile", None), ("flat", "Flat", None), ("open", "Open", None),
              ("grille", "Grille", ("level", 3)), ("zigzag", "Zigzag", ("badge", "bug-squasher"))],
    "antenna": [("none", "None", None), ("ball", "Ball", None), ("double", "Double", ("level", 2)),
                ("bolt", "Lightning", ("level", 4)), ("dish", "Radar dish", ("badge", "hardware-hacker")),
                ("propeller", "Propeller", ("level", 7))],
    "accessory": [("none", "None", None), ("bowtie", "Bow tie", None), ("cap", "Cap", ("level", 3)),
                  ("headphones", "Headphones", ("badge", "let-there-be-light")),
                  ("goggles", "Safety goggles", ("badge", "explorer")),
                  ("cape", "Cape", ("level", 9)), ("crown", "Crown", ("badge", "graduate"))],
    "bg": [("sky", "Sky", None), ("mint", "Mint", None), ("sun", "Sunny", None), ("lilac", "Lilac", None),
           ("night", "Night", None), ("circuit", "Circuit board", ("level", 5)),
           ("stars", "Starfield", ("level", 10))],
}
AVATAR_PARTS = {"body": "Body", "color": "Color", "eyes": "Eyes", "mouth": "Mouth",
                "antenna": "Antenna", "accessory": "Accessory", "bg": "Background"}
DEFAULT_AVATAR = {"body": "box", "color": "teal", "eyes": "round", "mouth": "smile",
                  "antenna": "ball", "accessory": "none", "bg": "sky", "name": ""}


def avatar_of(user) -> dict:
    a = dict(DEFAULT_AVATAR)
    if user and user.avatar:
        a.update({k: v for k, v in user.avatar.items() if k in a})
    return a


def unlock_text(unlock) -> str:
    if unlock is None:
        return ""
    kind, val = unlock
    return f"Reach level {val}" if kind == "level" else f"Earn the {BADGE_BY_ID[val]['name']} badge"


def is_unlocked(unlock, level: int, badges: set) -> bool:
    if unlock is None:
        return True
    kind, val = unlock
    return level >= val if kind == "level" else val in badges


def avatar_catalog(user) -> dict:
    level = level_info(user.xp or 0)["level"]
    badges = {b.badge_id for b in UserBadge.query.filter_by(user_id=user.id)}
    return {part: [{"id": oid, "label": label, "unlocked": user.is_teacher or is_unlocked(u, level, badges),
                    "how": unlock_text(u)} for oid, label, u in opts]
            for part, opts in AVATAR_OPTIONS.items()}


NAME_RE = re.compile(r"^[A-Za-z0-9 .\-_!']{0,20}$")


def clean_avatar(user, data: dict) -> tuple[dict | None, str | None]:
    level = level_info(user.xp or 0)["level"]
    badges = {b.badge_id for b in UserBadge.query.filter_by(user_id=user.id)}
    out = {}
    for part, opts in AVATAR_OPTIONS.items():
        choice = data.get(part, DEFAULT_AVATAR[part])
        match = next((o for o in opts if o[0] == choice), None)
        if not match:
            return None, f"Unknown {part}"
        if not user.is_teacher and not is_unlocked(match[2], level, badges):
            return None, f"{match[1]} is still locked: {unlock_text(match[2])}."
        out[part] = choice
    name = str(data.get("name", "")).strip()
    if not NAME_RE.match(name):
        return None, "Robot names can be up to 20 letters, numbers and spaces."
    out["name"] = name
    return out, None
