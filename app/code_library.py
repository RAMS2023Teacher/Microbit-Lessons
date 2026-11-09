"""The Code library panel: reference snippets, with this lesson's first."""
import re
from functools import lru_cache
from pathlib import Path

import yaml

PATH = Path(__file__).resolve().parent / "code_library.yaml"


@lru_cache(maxsize=1)
def groups() -> list[dict]:
    with open(PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)["groups"]


def _lesson_text(lesson: dict) -> str:
    cards = [c["text"] if isinstance(c, dict) else c for c in lesson.get("learn") or []]
    code = [lesson["code"]["starter"], lesson["debug"]["solution"]] if lesson.get("code") else []
    return "\n".join([*code, *cards])


def for_lesson(lesson: dict) -> dict:
    """Split the library into entries this lesson uses and everything else."""
    text = _lesson_text(lesson)
    here, rest = [], []
    for group in groups():
        others = []
        for entry in group["entries"]:
            (here if re.search(entry["uses"], text) else others).append(entry)
        if others:
            rest.append({"name": group["name"], "entries": others})
    return {"here": here, "groups": rest}
