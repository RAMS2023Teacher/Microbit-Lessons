"""How much reading is on each screen of each lesson, and how hard is it?

    python tools/readability_report.py            # summary table
    python tools/readability_report.py --detail   # every flagged screen

For each "screen" a student sees (one Learn card, one circuit step, the code
part, ...) it reports the word count, a reading grade level (Flesch-Kincaid)
and whether there is a picture. Code blocks are not counted as reading.
"""
import re
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.lessons import LESSON_DIR  # noqa: E402

MAX_WORDS = 80        # words on one screen before it starts to feel like a wall
HARD_WORDS = 130      # definitely too much
MAX_GRADE = 6.5       # reading level target for grades 6-8 (leaves room for IEP/ELL readers)


def prose(text) -> str:
    """Markdown -> plain sentences: drop code, tables, markup."""
    if isinstance(text, list):
        text = ". ".join(str(x).rstrip(".") for x in text) + "."
    t = str(text or "")
    t = re.sub(r"\n\s*(?:[*-]|\d+\.)\s+", ". ", t)                 # list items are separate sentences
    t = re.sub(r"\n\s*#+\s*([^\n]*)", r". \1.", t)                 # headings too
    t = re.sub(r"```.*?```", " ", t, flags=re.S)                # code blocks
    t = re.sub(r"^\s*\|.*\|\s*$", " ", t, flags=re.M)          # table rows
    t = re.sub(r"`[^`]*`", "code", t)                           # inline code = one word
    t = re.sub(r"[#*_>\[\]()]", " ", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def words(t: str) -> int:
    return len(re.findall(r"[A-Za-z0-9']+", t))


def syllables(word: str) -> int:
    w = word.lower().strip("'")
    if len(w) <= 3:
        return 1
    w = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", w)
    w = re.sub(r"^y", "", w)
    return max(1, len(re.findall(r"[aeiouy]{1,2}", w)))


def grade(t: str) -> float:
    """Flesch-Kincaid grade level: 0.39*(words/sentences) + 11.8*(syllables/word) - 15.59."""
    ws = re.findall(r"[A-Za-z']+", t)
    if len(ws) < 15:
        return 0.0
    sentences = max(1, len(re.findall(r"[.!?]+(?:\s|$)", t)) or 1)
    syl = sum(syllables(w) for w in ws)
    return round(0.39 * len(ws) / sentences + 11.8 * syl / len(ws) - 15.59, 1)


def screens(lesson: dict):
    """Yield (name, text, has_visual) for each screen, as the lesson page shows them."""
    if lesson.get("kind") == "check":
        for i, q in enumerate(lesson["quiz"], 1):
            yield (f"check {i}", prose(q["question"] + ". " + ". ".join(map(str, q["choices"]))), False)
        return
    # overview: objectives + material chips + key-word chips (meanings appear only when tapped)
    yield ("overview", prose(lesson.get("objectives", [])) + " " + prose(lesson.get("materials", [])) + " " +
           prose([v["term"] for v in lesson.get("vocabulary", [])]), True)
    yield ("warm-up", prose(lesson["warmup"]["prompt"]), False)
    for i, card in enumerate(lesson["learn"], 1):
        body = card["text"] if isinstance(card, dict) else card
        visual = isinstance(card, dict) and bool(card.get("visual"))
        yield (f"learn {i}", prose(body), visual)
    c = lesson.get("circuit")
    if c:
        yield ("get ready", prose(c.get("intro", "")) + " " + prose(c.get("safety", [])), True)
        for i, step in enumerate(c["steps"], 1):
            yield (f"circuit {i}", prose(step.get("instruction", "")) + " " +
                   prose(step.get("tip", "")) + " " + prose(step.get("check", "")), True)
    lab = lesson.get("lab")
    if lab:
        yield ("lab intro", prose(lab.get("intro", "")), True)
        for i, step in enumerate(lab["steps"], 1):
            yield (f"lab {i}", prose(step["instruction"]) + " " + prose(step.get("tip", "")) + " " + prose(step["check"]), False)
    code = lesson.get("code") or {}
    if code:
        yield ("code", prose(code.get("intro", "")), True)   # the editor is the picture
    for i, w in enumerate(code.get("walkthrough", []), 1):
        yield (f"how-it-works {i}", prose(w["explain"]), True)
    for i, idea in enumerate(code.get("try_it", []), 1):
        yield (f"try-it {i}", prose(idea), True)
    if lesson.get("practice"):
        yield ("your turn", prose(lesson["practice"]["prompt"]), True)
    if lesson.get("debug"):
        yield ("debug", prose(lesson["debug"]["story"]), True)
    for i, q in enumerate(lesson["quiz"], 1):
        yield (f"quiz {i}", prose(q["question"] + ". " + ". ".join(map(str, q["choices"]))), bool(q.get("visual")))
    ch = lesson["challenge"]
    for i, level in enumerate(ch.get("levels", []), 1):
        yield (f"challenge {i}", prose(ch.get("prompt", "")) + " " + prose(level), bool(ch.get("visual")))
    for name, hints in (ch.get("hints") or {}).items():
        for i, hint in enumerate(hints, 1):
            yield (f"{name} hint {i}", prose(hint), False)


def flag(n, g):
    out = []
    if n > HARD_WORDS:
        out.append("TOO MUCH TEXT")
    elif n > MAX_WORDS:
        out.append("long")
    if g > MAX_GRADE:
        out.append(f"grade {g}")
    return out


def main(detail=False):
    files = sorted(LESSON_DIR.glob("*.yaml"))
    tot_screens = tot_flag = tot_vis = 0
    print(f"{'lesson':28} {'screens':>7} {'avg words':>9} {'max words':>9} {'avg grade':>9} {'flagged':>7} {'visual':>13}")
    rows = []
    for f in files:
        lesson = yaml.safe_load(f.read_text(encoding="utf-8"))
        data = [(name, words(t), grade(t), vis) for name, t, vis in screens(lesson)]
        flagged = [(n, w, g) for n, w, g, v in data if flag(w, g)]
        graded = [g for _, w, g, _ in data if g]
        vis = sum(1 for d in data if d[3])
        tot_screens += len(data)
        tot_flag += len(flagged)
        tot_vis += vis
        print(f"{f.stem:28} {len(data):7} {sum(d[1] for d in data) / len(data):9.0f} {max(d[1] for d in data):9} "
              f"{sum(graded) / max(len(graded), 1):9.1f} {len(flagged):7} {vis:6} / {len(data)}")
        rows.append((f.stem, flagged))
    print(f"\nTOTAL: {tot_screens} screens, {tot_flag} flagged, {tot_vis} with a picture or editor "
          f"(targets: <= {MAX_WORDS} words, reading grade <= {MAX_GRADE})")
    if detail:
        for stem, flagged in rows:
            if flagged:
                print(f"\n{stem}")
                for n, w, g in flagged:
                    print(f"   {n:12} {w:4} words  grade {g:4}  {', '.join(flag(w, g))}")


if __name__ == "__main__":
    main("--detail" in sys.argv)
