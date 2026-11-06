"""Massachusetts DLCS (2016) grade 6-8 standards and how lessons align to them."""
from functools import lru_cache
from pathlib import Path

import yaml

from . import lessons as L

PATH = Path(__file__).resolve().parent / "standards.yaml"


@lru_cache(maxsize=1)
def framework() -> dict:
    with open(PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


@lru_cache(maxsize=1)
def by_code() -> dict:
    out = {}
    fw = framework()
    for topic in fw["topics"]:
        for s in topic["standards"]:
            out[s["code"]] = {**s, "topic": topic["topic"], "topic_code": topic["code"],
                              "strand": topic["strand"], "strand_name": fw["strands"][topic["strand"]]}
    return out


def for_lesson(lesson: dict) -> list[dict]:
    """The lesson's standards, with the official wording attached."""
    table = by_code()
    return [{**table[s["code"]], "how": s.get("how", "")} for s in lesson.get("standards") or []
            if s.get("code") in table]


def coverage() -> list[dict]:
    """Every topic, each standard with the lessons that address it."""
    hits: dict[str, list] = {}
    for lesson in L.all_lessons():
        for s in lesson.get("standards") or []:
            hits.setdefault(s["code"], []).append({"lesson": lesson, "how": s.get("how", "")})
    fw = framework()
    out = []
    for topic in fw["topics"]:
        items = [{**s, "lessons": hits.get(s["code"], [])} for s in topic["standards"]]
        out.append({**topic, "strand_name": fw["strands"][topic["strand"]], "items": items,
                    "covered": sum(1 for i in items if i["lessons"])})
    return out
