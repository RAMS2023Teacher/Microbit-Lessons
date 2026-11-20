"""Load and check the lessons: course/lessons/*.yaml (7th grade) and course/lessons/g6/*.yaml (6th grade).

A lesson has four stages, like the App Inventor curriculum:
  mission  what you'll make, what you need, a partner question
  build    one step per screen, like the slideshows: say / do / code (new lines highlighted) / what it does /
           Test it checkboxes / one question
  quiz     3-6 multiple-choice questions (graded on the server)
  ship     extensions to pick from, reflection questions, and the MakeCode share link
"""
from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

import yaml

from . import rules

HERE = Path(__file__).resolve().parent
LEVELS = ("Easier", "Medium", "Challenge")
STEP_KEYS = {"part", "title", "say", "do", "code", "blocks", "new", "what", "tip", "stuck", "test", "ask", "fields", "picture", "wiring", "breadboard", "fields_prompt"}
# MakeCode Blocks, written as text (6th grade). One block per line, 2 spaces of indent per level; a line ending in ":"
# holds the indented lines under it (on start:, forever:, repeat 4 times:, if ... then:, else:).
# [x] is a value you type or pick, (x) is a block snapped into a slot. {cat} at the start sets the color when
# the first word doesn't make it clear (client/lesson.js guesses the rest).
BLOCK_CATS = {"basic", "input", "music", "led", "radio", "loops", "logic", "variables", "math", "game", "functions", "ml", "text"}


def words(text) -> int:
    return len(re.findall(r"[A-Za-z0-9][\w'’.-]*", re.sub(r"`[^`]*`", " x ", str(text or ""))))


def line_set(spec, n_lines: int) -> list[int] | None:
    """'3-9', '10' or '1-2, 5' -> 1-based line numbers. None if it doesn't parse or is out of range."""
    out = []
    for part in str(spec).split(","):
        m = re.fullmatch(r"\s*(\d+)\s*(?:-\s*(\d+))?\s*", part)
        if not m:
            return None
        a, b = int(m.group(1)), int(m.group(2) or m.group(1))
        if not 1 <= a <= b <= n_lines:
            return None
        out += range(a, b + 1)
    return sorted(set(out))


def standards_table() -> dict:
    data = yaml.safe_load((HERE / "standards.yaml").read_text(encoding="utf-8"))
    return {s["code"]: {**s, "topic": t["topic"], "strand": t["strand"]} for t in data["topics"] for s in t["standards"]}


def check_blocks(text: str) -> list[str]:
    """Problems with a blocks listing (see BLOCK_CATS above)."""
    errs, prev_indent, prev_opens = [], -1, True
    for n, line in enumerate(str(text).rstrip("\n").split("\n"), 1):
        if not line.strip():
            errs.append(f"line {n} is empty")
            continue
        spaces = len(line) - len(line.lstrip(" "))
        if spaces % 2:
            errs.append(f"line {n}: indent with 2 spaces per level")
        level = spaces // 2
        if level > prev_indent + (1 if prev_opens else 0) or (n == 1 and level):
            errs.append(f"line {n}: indented more than the line above allows (does that line end with ':'?)")
        m = re.match(r"\{(\w+)\}", line.strip())
        if m and m.group(1) not in BLOCK_CATS:
            errs.append(f"line {n}: unknown block color {{{m.group(1)}}}")
        if line.count("[") != line.count("]") or line.count("(") != line.count(")"):
            errs.append(f"line {n}: unbalanced [ ] or ( )")
        prev_indent, prev_opens = level, line.rstrip().endswith(":")
    return errs


def _check_code_block(item: dict, where: str) -> list[str]:
    errs = []
    if item.get("code") and item.get("blocks"):
        errs.append(f"{where}: use 'code' (Python) or 'blocks', not both")
    if item.get("blocks"):
        errs += [f"{where}: blocks {e}" for e in check_blocks(item["blocks"])]
    body = item.get("code") or item.get("blocks")
    if item.get("new") is not None:
        if not body:
            errs.append(f"{where}: 'new' needs 'code' or 'blocks'")
        elif line_set(item["new"], len(body.rstrip("\n").split("\n"))) is None:
            errs.append(f"{where}: 'new' must be line numbers like \"3-9\" inside the code")
    return errs


def plan_by_id() -> dict:
    """lesson id -> (course id, plan row) for every course in rules.PLANS."""
    return {c[0]: (cid, c) for cid, (rows, _) in rules.PLANS.items() for c in rows}


def validate(lesson: dict) -> list[str]:
    errs = []
    plan = plan_by_id()
    if lesson.get("id") not in plan:
        return [f"id {lesson.get('id')!r} isn't in a course plan in rules.py (COURSE or COURSE_6)"]
    if lesson.get("course") != plan[lesson["id"]][0]:
        errs.append(f"the file is in the wrong folder for course {plan[lesson['id']][0]}")
    m = lesson.get("mission") or {}
    for key in ("big_question", "goal", "you_need", "talk"):
        if not m.get(key):
            errs.append(f"mission: add '{key}'")
    if words(m.get("big_question")) > 15:
        errs.append("mission: keep the big_question (the class display's question of the day) to 15 words")
    if words(m.get("goal")) > 70:
        errs.append("mission: keep the goal under 70 words")
    steps = lesson.get("build") or []
    if not 3 <= len(steps) <= 16:
        errs.append("build: use 3-16 steps")
    for i, s in enumerate(steps, 1):
        where = f"build step {i} ({s.get('title', '?')})"
        extra = set(s) - STEP_KEYS
        if extra:
            errs.append(f"{where}: unknown keys {sorted(extra)}")
        if not s.get("title"):
            errs.append(f"{where}: add a 'title'")
        if not (s.get("do") or s.get("code") or s.get("say") or s.get("wiring")):
            errs.append(f"{where}: needs something to do (say, do, code or wiring)")
        tests = s.get("test") or []
        if not 1 <= len(tests) <= 4:
            errs.append(f"{where}: give 1-4 'test' checkboxes, so students know it worked")
        if words(s.get("say")) > 80:
            errs.append(f"{where}: 'say' is over 80 words; split the step")
        if s.get("ask") and words(s["ask"]) > 40:
            errs.append(f"{where}: 'ask' is over 40 words")
        if s.get("fields") and (not isinstance(s["fields"], list) or len(s["fields"]) > 4):
            errs.append(f"{where}: 'fields' is a list of up to 4 short labels")
        errs += _check_code_block(s, where)
        if s.get("breadboard"):
            errs += [f"{where}: breadboard: {e}" for e in check_breadboard(s["breadboard"])]
    quiz = lesson.get("quiz") or []
    if not 3 <= len(quiz) <= 6:
        errs.append("quiz: use 3-6 questions")
    for i, q in enumerate(quiz, 1):
        ch = q.get("choices") or []
        if not q.get("question") or not 2 <= len(ch) <= 4:
            errs.append(f"quiz {i}: needs a question and 2-4 choices")
        if not isinstance(q.get("answer"), int) or isinstance(q.get("answer"), bool) or not 0 <= q["answer"] < len(ch):
            errs.append(f"quiz {i}: 'answer' must be a 0-based index into choices")
        if not q.get("why"):
            errs.append(f"quiz {i}: add 'why', shown after they answer")
    ship = lesson.get("ship") or {}
    for i, e in enumerate(ship.get("extensions") or [], 1):
        if not (e.get("title") and e.get("goal")):
            errs.append(f"extension {i}: needs a title and a goal")
        if e.get("level") not in LEVELS:
            errs.append(f"extension {i}: level must be one of {LEVELS}")
        errs += _check_code_block(e, f"extension {i}")
    if not 1 <= len(ship.get("reflect") or []) <= 3:
        errs.append("ship: add 1-3 'reflect' questions")
    table = standards_table()
    if not lesson.get("standards"):
        errs.append("add 'standards' (MA DLCS codes, each with a 'how')")
    for st in lesson.get("standards") or []:
        if st.get("code") not in table:
            errs.append(f"standards: unknown code {st.get('code')!r}")
        elif not st.get("how"):
            errs.append(f"standards: {st['code']} needs a 'how'")
    return errs


@lru_cache(maxsize=1)
def _load() -> tuple:
    plan = plan_by_id()
    out = []
    for cid, meta in rules.COURSES.items():
        for path in sorted((HERE / meta["dir"]).glob("*.yaml")):
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
            data["_file"] = meta["dir"].replace("lessons", "").strip("/") + ("/" if meta["dir"] != "lessons" else "") + path.name
            data["course"] = cid
            row = plan.get(data.get("id"))
            if row:
                _, data["number"], data["title_plan"], data["icon"], data["color"], data["python"], data["hardware"], data["pos"] = row[1]
            out.append(data)
    order = list(rules.COURSES)
    out.sort(key=lambda l: (order.index(l["course"]), l.get("number", 99)))
    return tuple(out)


def all_lessons() -> list[dict]:
    return list(_load())


def get(lesson_id: str) -> dict | None:
    return next((l for l in _load() if l["id"] == lesson_id), None)


BREADBOARD_KEYS = {"add", "before", "check", "caption", "board", "mb_title"}


def breadboard_steps(b: dict) -> list[dict]:
    """The picture's parts as drawing steps: what was built earlier, then what this step adds (drawn glowing)."""
    return ([{"add": b["before"]}] if b.get("before") else []) + [{"add": b.get("add") or []}]


def check_breadboard(b: dict) -> list[str]:
    """A wiring picture must be a real circuit: parts in real holes, nothing shorted, and every `check` group joined."""
    from . import circuits
    if not isinstance(b, dict) or not b.get("add"):
        return ["give an 'add' list of parts and wires"]
    errs = [f"unknown keys {sorted(set(b) - BREADBOARD_KEYS)}"] if set(b) - BREADBOARD_KEYS else []
    if b.get("board") is not False:               # the breakout board is plugged into holes j1-j22, so f-j of rows 1-22 belong to its pins
        for part in (b.get("before") or []) + (b.get("add") or []):
            for key, val in part.items():
                m = re.match(r"^([f-j])(\d+)$", str(val)) if key not in ("type", "id", "color", "label", "ohms") else None
                if m and int(m.group(2)) <= circuits.BREAKOUT_ROWS:
                    errs.append(f"hole {val} is in a row the breakout board's pins use (f-j of rows 1-{circuits.BREAKOUT_ROWS}); use rows {circuits.BREAKOUT_ROWS + 1}-30 or holes a-e")
    return errs + circuits.check_circuit({"steps": breadboard_steps(b), "verify": {"connected": b.get("check") or []}})


def wired(lesson: dict) -> bool:
    """True when a lesson has students build a circuit (any step with wiring)."""
    return any(s.get("wiring") for s in lesson.get("build") or [])
