"""Load, validate and grade lessons stored as YAML files in ``lessons/``."""
from __future__ import annotations

import ast
import re
from functools import lru_cache
from pathlib import Path

import yaml

from .circuits import check_circuit

LESSON_DIR = Path(__file__).resolve().parent.parent / "lessons"

UNITS = {
    1: {"title": "Light It Up", "blurb": "Python basics, your first circuits and LEDs."},
    2: {"title": "Sensing the World", "blurb": "Buttons, light, temperature, knobs and motion."},
    3: {"title": "Making Things Move", "blurb": "Sound, servos, DC motors and motor drivers."},
    4: {"title": "Robots", "blurb": "Build, program and remote-control a two-wheel robot."},
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


def validate_lesson(data: dict) -> list[str]:
    errs = []
    for key in REQUIRED:
        if key not in data:
            errs.append(f"missing '{key}'")
    if errs:
        return errs
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
    if not 3 <= len(data["quiz"]) <= 6:
        errs.append("quiz should have 3-6 questions")
    for label, src in (("code.starter", data["code"].get("starter", "")),
                       ("debug.solution", data["debug"].get("solution", ""))):
        try:
            ast.parse(src)
        except SyntaxError as e:
            errs.append(f"{label} has a syntax error on line {e.lineno}: {e.msg}")
    dbg = data["debug"]
    for key in ("story", "buggy_code", "solution", "checks", "hints", "reflection_prompt"):
        if key not in dbg:
            errs.append(f"debug: missing '{key}'")
    if "checks" in dbg and "buggy_code" in dbg and "solution" in dbg:
        sol = run_checks(dbg["solution"], dbg["checks"])
        if not all(r["ok"] for r in sol):
            errs.append("debug: the solution fails its own checks: " +
                        "; ".join(r["message"] for r in sol if not r["ok"]))
        bug = run_checks(dbg["buggy_code"], dbg["checks"])
        if all(r["ok"] for r in bug):
            errs.append("debug: the buggy code passes every check (checks are too weak)")
    if "circuit" in data and data["circuit"]:
        errs += [f"circuit: {e}" for e in check_circuit(data["circuit"])]
    if not data["challenge"].get("levels"):
        errs.append("challenge: add 'levels' (mild / medium / spicy ideas)")
    return errs


@lru_cache(maxsize=1)
def _load_all() -> tuple[dict, ...]:
    lessons = []
    for path in sorted(LESSON_DIR.glob("*.yaml")):
        with open(path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        data["_file"] = path.name
        lessons.append(data)
    lessons.sort(key=lambda l: (l["unit"], l["order"]))
    for i, lesson in enumerate(lessons, 1):
        lesson["number"] = i
    return tuple(lessons)


def all_lessons() -> list[dict]:
    return list(_load_all())


def get_lesson(lesson_id: str) -> dict | None:
    for lesson in _load_all():
        if lesson["id"] == lesson_id:
            return lesson
    return None


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
    view = {k: v for k, v in lesson.items() if k not in ("quiz", "debug")}
    view["quiz"] = [{"question": q["question"], "choices": q["choices"]} for q in lesson["quiz"]]
    view["debug"] = {k: v for k, v in lesson["debug"].items() if k not in ("solution", "checks")}
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
    keys = ["warmup", "learn"]
    if lesson.get("circuit"):
        keys.append("circuit")
    keys += ["code", "debug", "quiz", "challenge"]
    return keys
