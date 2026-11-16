"""The lessons in course/lessons/ and the rules in course/rules.py."""
from course import lessons as L
from course import rules


def test_every_lesson_is_valid():
    lessons = L.all_lessons()
    assert lessons
    for lesson in lessons:
        assert L.validate(lesson) == [], lesson["_file"]


def test_course_plan_is_consistent():
    ids = [c[0] for c in rules.COURSE]
    assert len(ids) == len(set(ids))
    assert [c[1] for c in rules.COURSE] == list(range(1, len(ids) + 1))
    for lid, reqs in rules.REQUIRES.items():
        assert lid in ids and all(r in ids for r in reqs), lid
    badge_ids = {b[0] for b in rules.BADGES}
    for b in rules.BADGES:
        if b[4][0] == "lesson":
            assert b[4][1] in ids, b[0]
    for opts in rules.AVATAR_OPTIONS.values():
        for _, _, unlock in opts:
            assert unlock is None or unlock[0] == "level" or unlock[1] in badge_ids, unlock


def test_validator_catches_mistakes():
    good = L.get("dodge-the-drop")
    bad = {**good, "build": [{**good["build"][1], "test": [], "new": "40-50"}] * 3, "quiz": good["quiz"][:2]}
    errs = " ".join(L.validate(bad))
    assert "Test it" in errs or "test" in errs
    assert "'new' must be line numbers" in errs
    assert "3-6 questions" in errs
