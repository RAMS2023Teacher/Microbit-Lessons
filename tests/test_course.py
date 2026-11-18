"""The lessons in course/lessons/ and the rules in course/rules.py."""
from course import lessons as L
from course import rules


def test_every_lesson_is_valid():
    lessons = L.all_lessons()
    assert lessons
    for lesson in lessons:
        assert L.validate(lesson) == [], lesson["_file"]


def test_course_plan_is_consistent():
    all_ids = []
    for cid, (rows, requires) in rules.PLANS.items():
        assert cid in rules.COURSES
        ids = [c[0] for c in rows]
        all_ids += ids
        assert [c[1] for c in rows] == list(range(1, len(ids) + 1)), cid
        for lid, reqs in requires.items():
            assert lid in ids and all(r in ids for r in reqs), lid
    assert len(all_ids) == len(set(all_ids)), "a lesson id is in two courses"
    badge_ids = {b[0] for b in rules.BADGES}
    for b in rules.BADGES:
        if b[4][0] == "lesson":
            assert b[4][1] in all_ids, b[0]
    for opts in rules.AVATAR_OPTIONS.values():
        for _, _, unlock in opts:
            assert unlock is None or unlock[0] in ("level", "cost") or unlock[1] in badge_ids, unlock


def test_every_course_has_its_lessons():
    by_course = {}
    for lesson in L.all_lessons():
        by_course.setdefault(lesson["course"], []).append(lesson["id"])
    for cid, (rows, _) in rules.PLANS.items():
        assert by_course.get(cid) == [c[0] for c in rows], cid


def test_blocks_checker():
    assert L.check_blocks("on start:\n  show icon [heart]\nforever:\n  if (button [A] is pressed) then:\n    show number (score)\n  else:\n    clear screen") == []
    assert L.check_blocks("show icon [heart]\n  pause (ms) [100]")                   # indented under a line without ':'
    assert L.check_blocks("on start:\n   show icon [heart")                          # 3 spaces, unbalanced [


def test_validator_catches_mistakes():
    good = L.get("dodge-the-drop")
    bad = {**good, "build": [{**good["build"][1], "test": [], "new": "40-50"}] * 3, "quiz": good["quiz"][:2]}
    errs = " ".join(L.validate(bad))
    assert "Test it" in errs or "test" in errs
    assert "'new' must be line numbers" in errs
    assert "3-6 questions" in errs
