"""Load, validate and grade lessons stored as YAML files in ``lessons/``."""
from __future__ import annotations

import ast
import re
from functools import lru_cache
from pathlib import Path

import yaml

from .circuits import check_circuit
from .visuals import check_visual

LESSON_DIR = Path(__file__).resolve().parent.parent / "lessons"

UNITS = {
    1: {"title": "Light It Up", "blurb": "Python basics, your first circuits and LEDs."},
    2: {"title": "Sensing the World", "blurb": "Buttons, light, temperature, knobs and motion."},
    3: {"title": "Making Things Move", "blurb": "Sound, servos, DC motors and motor drivers."},
    4: {"title": "Robots", "blurb": "Build, program and remote-control a two-wheel robot."},
    5: {"title": "Robot Sprint", "blurb": "For classes that already know micro:bit basics. Learn servos and sensors, then pick a branch: Robots, AI or Embedded."},
    6: {"title": "AI Lab", "blurb": "Teach a micro:bit with machine learning, test it for fairness, and build with it."},
    7: {"title": "Embedded Computing", "blurb": "Build sensor stations that monitor the real world and answer research questions."},
}

SPRINT_TRUNK = ["sprint-servo-skills", "sprint-sensor-lab", "sprint-sense-decide-act"]
SPRINT_BRANCHES = {
    "robots": ["sprint-build-the-bot", "sprint-mission-day", "sprint-showcase"],
    "ai": ["ai-rules-or-learning", "ai-teach-your-microbit", "ai-test-and-fix", "ai-build-with-your-model"],
    "embedded": ["embedded-field-station", "embedded-sensor-study", "embedded-monitor-and-report"],
}

REQUIRED = ["id", "unit", "order", "title", "duration_minutes", "big_idea",
            "objectives", "materials", "agenda", "warmup", "learn", "code", "debug",
            "quiz", "challenge"]


def _strip_comments(code: str) -> str:
    """Remove # comments (outside strings, roughly) so checks see real code."""
    out = []
    for line in code.splitlines():
        in_str = None
        result = ""
        for ch in line:
            if in_str:
                if ch == in_str:
                    in_str = None
            elif ch in "\"'":
                in_str = ch
            elif ch == "#":
                break
            result += ch
        out.append(result.rstrip())
    return "\n".join(out)


def run_checks(code: str, checks: list[dict]) -> list[dict]:
    """Run debug-challenge checks against student code. Never executes code."""
    results = []
    stripped = _strip_comments(code)
    for check in checks:
        ctype = check.get("type")
        ok = True
        if ctype == "syntax":
            try:
                ast.parse(code)
            except SyntaxError as e:
                ok = False
                results.append({"ok": False, "message": check.get("message") or
                                f"Python can't read line {e.lineno}: {e.msg}"})
                continue
        elif ctype == "contains":
            ok = re.search(check["pattern"], stripped, re.MULTILINE) is not None
        elif ctype == "not_contains":
            ok = re.search(check["pattern"], stripped, re.MULTILINE) is None
        else:
            raise ValueError(f"unknown check type {ctype}")
        results.append({"ok": ok, "message": check.get("message", "")})
    return results


def _check_practice(practice: dict) -> list[str]:
    errs = []
    for key in ("level", "prompt", "starter", "solution", "checks", "hints"):
        if key not in practice:
            errs.append(f"practice: missing '{key}'")
    if errs:
        return errs
    if practice["level"] not in ("fill", "write"):
        errs.append("practice: level must be fill or write")
    if not all(r["ok"] for r in run_checks(practice["solution"], practice["checks"])):
        errs.append("practice: the solution fails its own checks")
    if all(r["ok"] for r in run_checks(practice["starter"], practice["checks"])):
        errs.append("practice: the starter already passes every check")
    return errs


def _check_lab(lab: dict) -> list[str]:
    errs = []
    if not str(lab.get("url", "")).startswith("https://"):
        errs.append("lab: 'url' must start with https://")
    if not lab.get("tool"):
        errs.append("lab: add 'tool', the name shown on the open button")
    steps = lab.get("steps") or []
    if len(steps) < 3:
        errs.append("lab: add at least 3 steps")
    for i, step in enumerate(steps, 1):
        for key in ("title", "instruction", "check"):
            if not step.get(key):
                errs.append(f"lab step {i}: missing '{key}'")
        if len(str(step.get("instruction", "")).split()) > 45:
            errs.append(f"lab step {i}: instruction is over 45 words")
    return errs


LEARN_MAX_CARDS = 4
LEARN_MAX_WORDS = 60        # per card, not counting the 'more' details
REMEMBER_IN = ("circuit", "code", "practice", "debug", "lab")


def words(md: str) -> int:
    """Words a student reads in a bit of Markdown (code and symbols don't count as extra)."""
    return len(re.findall(r"[A-Za-z0-9][\w'’.-]*", re.sub(r"[#*`>|]", " ", str(md or ""))))


def _check_learn(cards) -> list[str]:
    errs = []
    if len(cards) > LEARN_MAX_CARDS:
        errs.append(f"learn: keep it to {LEARN_MAX_CARDS} cards or fewer (move details into 'remember' boxes where they're used)")
    for i, card in enumerate(cards, 1):
        if not isinstance(card, dict):
            errs.append(f"learn {i}: must be Markdown text or {{text, visual, check}}")
            continue
        if not card.get("text"):
            errs.append(f"learn {i}: a card written as a mapping needs 'text'")
        elif words(card["text"]) > LEARN_MAX_WORDS:
            errs.append(f"learn {i}: {words(card['text'])} words; keep cards to {LEARN_MAX_WORDS} (put extra detail in 'more')")
        if card.get("visual"):
            errs += check_visual(card["visual"], f"learn {i} visual")
        ck = card.get("check")
        if not ck:
            errs.append(f"learn {i}: add a 'check' (a one-tap question about this card)")
            continue
        choices = ck.get("choices") or []
        if not ck.get("question") or not 2 <= len(choices) <= 4:
            errs.append(f"learn {i} check: needs a 'question' and 2-4 'choices'")
        if not isinstance(ck.get("answer"), int) or isinstance(ck.get("answer"), bool) or not 0 <= ck["answer"] < len(choices):
            errs.append(f"learn {i} check: 'answer' must be a 0-based index into choices")
        if not ck.get("why"):
            errs.append(f"learn {i} check: add 'why', shown when they get it right")
        if not ck.get("hint"):
            errs.append(f"learn {i} check: add 'hint', shown when they pick a wrong answer")
        for key in ("question", "why", "hint"):
            if words(ck.get(key)) > 30:
                errs.append(f"learn {i} check: '{key}' is over 30 words")
    return errs


def _check_remember(boxes, where) -> list[str]:
    errs = []
    if boxes is None:
        return errs
    if not isinstance(boxes, list) or not boxes:
        return [f"{where}.remember: must be a list of {{text, visual}}"]
    for i, box in enumerate(boxes, 1):
        if not isinstance(box, dict) or not box.get("text"):
            errs.append(f"{where}.remember {i}: needs 'text'")
            continue
        if words(box["text"]) > 50:
            errs.append(f"{where}.remember {i}: over 50 words")
        if box.get("visual"):
            errs += check_visual(box["visual"], f"{where}.remember {i} visual")
    return errs


def grade_learn_check(lesson: dict, card: int, choice) -> dict | None:
    """None if that card has no check."""
    cards = lesson.get("learn") or []
    if not isinstance(card, int) or not 0 <= card < len(cards) or not cards[card].get("check"):
        return None
    ck = cards[card]["check"]
    correct = choice == ck["answer"]
    return {"correct": correct, "why": ck["why"] if correct else "", "hint": "" if correct else ck["hint"]}


def card_title(card: dict) -> str:
    m = re.search(r"^#+\s*(.+)$", card.get("text") or "", re.MULTILINE)
    return m.group(1).strip() if m else (card.get("text") or "").strip().split("\n")[0][:40]


def learn_check_summary(lesson: dict, checks: dict | None) -> dict | None:
    """For the teacher: which Learn quick checks a student got right first try, needed more tries, or hasn't answered."""
    cards = [(i, c) for i, c in enumerate(lesson.get("learn") or []) if c.get("check")]
    if not cards:
        return None
    rows = []
    for i, c in cards:
        r = (checks or {}).get(str(i)) or {}
        status = "first" if r.get("ok") and r.get("tries") == 1 else "retry" if r.get("ok") else "missed" if r.get("tries") else "none"
        rows.append({"title": card_title(c), "status": status, "tries": r.get("tries", 0)})
    return {"first": sum(r["status"] == "first" for r in rows), "total": len(rows), "rows": rows}


def learn_check_count(lesson: dict) -> int:
    return sum(1 for c in lesson.get("learn") or [] if c.get("check"))


def validate_lesson(data: dict) -> list[str]:
    errs = []
    is_lab = bool(data.get("lab"))     # lab lessons happen in an outside tool, so they have no Python sections
    is_check = data.get("kind") == "check"     # a unit check is only a quiz
    if is_check:
        for key in ("id", "unit", "order", "title", "duration_minutes", "agenda", "quiz"):
            if key not in data:
                errs.append(f"missing '{key}'")
        if errs:
            return errs
        if not 4 <= len(data["quiz"]) <= 10:
            errs.append("a unit check should have 4-10 questions")
        for q_i, q in enumerate(data["quiz"], 1):
            if not isinstance(q.get("answer"), int) or not (0 <= q["answer"] < len(q.get("choices", []))) or not q.get("explain"):
                errs.append(f"quiz {q_i}: needs a valid answer and an explain")
        return errs
    for key in REQUIRED:
        if is_lab and key in ("code", "debug"):
            continue
        if key not in data:
            errs.append(f"missing '{key}'")
    if errs:
        return errs
    eq = str(data.get("essential_question") or "")
    if not eq.endswith("?") or len(eq.split()) > 25:
        errs.append("add 'essential_question': one open question (25 words max, ending in ?) that the big idea answers")
    total = sum(int(s.get("minutes", 0)) for s in data["agenda"])
    if total != data["duration_minutes"]:
        errs.append(f"agenda minutes add to {total}, duration_minutes is {data['duration_minutes']}")
    if data["duration_minutes"] != 35:
        errs.append("lessons should be designed for 35 minutes")
    for q_i, q in enumerate(data["quiz"], 1):
        if not isinstance(q.get("answer"), int) or not (0 <= q["answer"] < len(q.get("choices", []))):
            errs.append(f"quiz {q_i}: 'answer' must be a 0-based index into choices")
        if not q.get("explain"):
            errs.append(f"quiz {q_i}: add an 'explain'")
    if not 3 <= len(data["quiz"]) <= 8:
        errs.append("quiz should have 3-8 questions")
    sources = () if is_lab else (("code.starter", data["code"].get("starter", "")),
                                 ("debug.solution", data["debug"].get("solution", "")))
    for label, src in sources:
        try:
            ast.parse(src)
        except SyntaxError as e:
            errs.append(f"{label} has a syntax error on line {e.lineno}: {e.msg}")
    if is_lab:
        errs += _check_lab(data["lab"])
    elif not data.get("practice"):
        errs.append("add 'practice', the Your turn task")
    else:
        errs += _check_practice(data["practice"])
    if not is_lab and not data["code"].get("predict"):
        errs.append("code: add 'predict', a question to answer before running it")
    dbg = data.get("debug") or {}
    for key in ("story", "buggy_code", "solution", "checks", "hints", "reflection_prompt"):
        if key not in dbg and not is_lab:
            errs.append(f"debug: missing '{key}'")
    if "checks" in dbg and "buggy_code" in dbg and "solution" in dbg:
        sol = run_checks(dbg["solution"], dbg["checks"])
        if not all(r["ok"] for r in sol):
            errs.append("debug: the solution fails its own checks: " +
                        "; ".join(r["message"] for r in sol if not r["ok"]))
        bug = run_checks(dbg["buggy_code"], dbg["checks"])
        if all(r["ok"] for r in bug):
            errs.append("debug: the buggy code passes every check (checks are too weak)")
    errs += _check_learn(data["learn"])
    for where in REMEMBER_IN:
        errs += _check_remember((data.get(where) or {}).get("remember"), where)
    for i, q in enumerate(data["quiz"], 1):
        if q.get("visual"):
            errs += check_visual(q["visual"], f"quiz {i} visual")
    if data["challenge"].get("visual"):
        errs += check_visual(data["challenge"]["visual"], "challenge visual")
    for i, step in enumerate((data.get("circuit") or {}).get("steps") or [], 1):
        if step.get("visual"):
            errs += check_visual(step["visual"], f"circuit step {i} visual")
    if "circuit" in data and data["circuit"]:
        errs += [f"circuit: {e}" for e in check_circuit(data["circuit"])]
    from .standards import by_code
    table = by_code()
    if not data.get("standards"):
        errs.append("add 'standards' (MA DLCS codes this lesson addresses, each with a 'how')")
    for st in data.get("standards") or []:
        if st.get("code") not in table:
            errs.append(f"standards: unknown code {st.get('code')!r} (see app/standards.yaml)")
        elif not st.get("how"):
            errs.append(f"standards: {st['code']} needs a 'how' explaining what in the lesson meets it")
    for branch in data.get("branches") or []:
        if not (branch.get("lesson") and branch.get("label") and branch.get("blurb")):
            errs.append("branches: each one needs lesson, label and blurb")
    if not data["challenge"].get("levels"):
        errs.append("challenge: add 'levels' (bronze / silver / gold ideas)")
    hints = data["challenge"].get("hints") or {}
    for level in data["challenge"].get("levels") or []:
        name = level.split(":", 1)[0]
        if not 1 <= len(hints.get(name) or []) <= 3:
            errs.append(f"challenge: give the {name} level 1-3 hints")
        for hint in hints.get(name) or []:
            if len(hint.split()) > 20:
                errs.append(f"challenge: {name} hint is over 20 words: {hint}")
    return errs


@lru_cache(maxsize=1)
def _load_all() -> tuple[dict, ...]:
    lessons = []
    for path in sorted(LESSON_DIR.glob("*.yaml")):
        with open(path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        data["_file"] = path.name
        data["learn"] = [c if isinstance(c, dict) else {"text": c} for c in data.get("learn", [])]
        lessons.append(data)
    lessons.sort(key=lambda l: (l["unit"], l["order"]))
    count = 0
    for lesson in lessons:
        if lesson.get("label"):                     # e.g. "S1" for sprint lessons
            lesson["number"] = lesson["label"]
        else:
            count += 1
            lesson["number"] = count
    return tuple(lessons)


def all_lessons() -> list[dict]:
    return list(_load_all())


def get_lesson(lesson_id: str) -> dict | None:
    for lesson in _load_all():
        if lesson["id"] == lesson_id:
            return lesson
    return None


def owes_assignment(assignment, started_ids) -> bool:
    """Choice-branch work only counts once the student has started that branch."""
    return not assignment.branch or any(l in started_ids for l in SPRINT_BRANCHES.get(assignment.branch, []))


def lessons_by_unit() -> list[dict]:
    units = []
    for num, meta in UNITS.items():
        items = [l for l in _load_all() if l["unit"] == num]
        if items:
            units.append({"number": num, **meta, "lessons": items})
    return units


def neighbors(lesson_id: str):
    ls = _load_all()
    ids = [l["id"] for l in ls]
    i = ids.index(lesson_id)
    return (ls[i - 1] if i > 0 else None, ls[i + 1] if i + 1 < len(ls) else None)


def public_view(lesson: dict) -> dict:
    """Lesson data safe to send to the browser (no answers or solutions)."""
    view = {k: v for k, v in lesson.items() if k not in ("quiz", "debug", "practice")}
    if lesson.get("practice"):
        view["practice"] = {k: v for k, v in lesson["practice"].items() if k not in ("solution", "checks")}
    view["quiz"] = [{"question": q["question"], "choices": q["choices"], "visual": q.get("visual")}
                    for q in lesson["quiz"]]
    if lesson.get("debug"):
        view["debug"] = {k: v for k, v in lesson["debug"].items() if k not in ("solution", "checks")}
    view["learn"] = [{**c, "check": {"question": c["check"]["question"], "choices": c["check"]["choices"]}} if c.get("check") else c
                     for c in lesson.get("learn") or []]
    return view


def grade_quiz(lesson: dict, answers: list) -> dict:
    results = []
    for q, a in zip(lesson["quiz"], answers + [None] * len(lesson["quiz"])):
        correct = a == q["answer"]
        results.append({"correct": correct, "explain": q["explain"],
                        "answer": q["answer"]})
    score = sum(r["correct"] for r in results)
    return {"score": score, "total": len(lesson["quiz"]), "results": results}


def section_keys(lesson: dict) -> list[str]:
    """Trackable sections, in lesson order."""
    if lesson.get("kind") == "check":
        return ["quiz"]
    if lesson.get("lab"):
        return ["warmup", "learn", "lab", "quiz", "challenge"]
    keys = ["warmup", "learn"]
    if lesson.get("circuit"):
        keys.append("circuit")
    keys += ["code", "practice", "debug", "quiz", "challenge"]
    return keys
