import re

import re

from app import lessons as L
from app.circuits import check_circuit
from app.models import Assignment, Progress, User, db

from .conftest import logout, make_class, register_student, register_teacher

LID = "blink-external-led"


def test_all_lessons_valid():
    lessons = L.all_lessons()
    assert sum(1 for l in lessons if l["unit"] <= 4 and l.get("kind") != "check") == 16   # core course; unit 5 is the Robot Sprint
    for lesson in lessons:
        assert L.validate_lesson(lesson) == [], lesson["id"]


def test_circuit_validator_catches_mistakes():
    shorted = {"steps": [{"add": [{"type": "led", "id": "l", "anode": "a5", "cathode": "b5"}]}]}
    assert any("shorted" in e for e in check_circuit(shorted))
    short = {"steps": [{"add": [{"type": "wire", "from": "mb.3V", "to": "T+1"},
                                {"type": "wire", "from": "mb.GND", "to": "T+2"}]}]}
    assert any("SHORT" in e for e in check_circuit(short))
    double = {"steps": [{"add": [{"type": "wire", "from": "mb.P0", "to": "a1"},
                                 {"type": "wire", "from": "mb.P1", "to": "a1"}]}]}
    assert any("already used" in e for e in check_circuit(double))


def test_public_view_hides_answers():
    view = L.public_view(L.get_lesson(LID))
    assert "answer" not in view["quiz"][0]
    assert "solution" not in view["debug"] and "checks" not in view["debug"]


def test_student_registration_needs_valid_code(client):
    r = register_student(client, "NOPE00")
    assert r.status_code == 400
    assert User.query.count() == 0


def test_teacher_signup_needs_code(client):
    r = client.post("/register/teacher", data={"teacher_code": "wrong", "display_name": "X", "username": "xx1",
                                               "password": "pass1234", "confirm": "pass1234"})
    assert r.status_code == 400


def test_full_flow(client, app):
    register_teacher(client)
    c = make_class(client)
    client.post(f"/teacher/classes/{c.id}/assign", data={"lesson_id": [LID], "due_date": "2030-01-01"})
    cid, code = c.id, c.join_code
    logout(client)

    register_student(client, code)
    r = client.get("/dashboard")
    assert b"Blink an External LED" in r.data
    r = client.get(f"/lessons/{LID}")
    assert r.status_code == 200 and b"Teacher answer key" not in r.data
    # every Learn card reaches the page; lesson.js shows them one at a time
    assert len(re.findall(rb'class="learn-card[ "]', r.data)) == len(L.get_lesson(LID)["learn"])
    # lesson.js pages through the overview plus every tracked section
    assert r.data.count(b"data-step") == len(L.section_keys(L.get_lesson(LID))) + 1

    # progress
    assert client.post(f"/api/lessons/{LID}/save", json={"warmup_answer": "use a pin"}).json["sections"]["warmup"]
    client.post(f"/api/lessons/{LID}/save", json={"mark": {"learn": True}})
    n = len(L.get_lesson(LID)["circuit"]["steps"])
    assert client.post(f"/api/lessons/{LID}/save", json={"circuit_steps": list(range(n))}).json["sections"]["circuit"]
    client.post(f"/api/lessons/{LID}/sent", json={"section": "code"})
    client.post(f"/api/lessons/{LID}/practice", json={"code": L.get_lesson(LID)["practice"]["solution"]})

    # debug: buggy code fails, solution passes
    lesson = L.get_lesson(LID)
    r = client.post(f"/api/lessons/{LID}/debug", json={"code": lesson["debug"]["buggy_code"]}).json
    assert not r["solved"]
    r = client.post(f"/api/lessons/{LID}/debug", json={"code": lesson["debug"]["buggy_code"].replace("Sleep", "sleep")}).json
    assert not r["solved"] and r["messages"]
    r = client.post(f"/api/lessons/{LID}/debug", json={"code": lesson["debug"]["solution"]}).json
    assert r["solved"]

    # quiz
    answers = [q["answer"] for q in lesson["quiz"]]
    r = client.post(f"/api/lessons/{LID}/quiz", json={"answers": answers}).json
    assert r["quiz"]["score"] == len(answers)

    # challenge needs a description
    assert client.post(f"/api/lessons/{LID}/challenge", json={"code": "x", "response": "hi"}).status_code == 400
    r = client.post(f"/api/lessons/{LID}/challenge", json={"code": "x", "response": "My LED blinks SOS in Morse code."}).json
    assert r["percent"] == 100
    p = Progress.query.one()
    assert p.completed_at is not None

    # student can't see teacher pages
    assert client.get(f"/teacher/classes/{cid}").status_code == 403
    logout(client)

    client.post("/login", data={"username": "teach", "password": "pass1234"})
    r = client.get(f"/teacher/classes/{cid}")
    assert b"Sam K." in r.data and b"100%" in r.data
    r = client.get(f"/teacher/classes/{cid}/export.csv")
    assert b"Sam K." in r.data and b"submitted" in r.data
    r = client.get(f"/lessons/{LID}")
    assert b"Teacher answer key" in r.data
    r = client.post(f"/teacher/progress/{p.id}/feedback", data={"feedback": "Great Morse code!"}, follow_redirects=True)
    assert b"Feedback saved" in r.data


def test_teacher_cannot_see_other_class(client):
    register_teacher(client, "teach1")
    c = make_class(client, "Mine")
    logout(client)
    register_teacher(client, "teach2")
    assert client.get(f"/teacher/classes/{c.id}").status_code == 404


def test_videos(client):
    register_teacher(client)
    client.post("/teacher/videos", data={f"video_{LID}": "https://youtu.be/dQw4w9WgXcQ"})
    r = client.get(f"/lessons/{LID}")
    assert b"youtube-nocookie.com/embed/dQw4w9WgXcQ" in r.data


def test_login_redirect_is_safe(client):
    register_teacher(client)
    logout(client)
    r = client.post("/login?next=https://evil.example", data={"username": "teach", "password": "pass1234"})
    assert "evil" not in r.headers["Location"]


def test_no_lesson_screen_is_a_wall_of_text():
    """Every screen stays within the readability limits in docs/LESSON_FORMAT.md."""
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
    import readability_report as R
    problems = []
    for lesson in L.all_lessons():
        for name, text, _ in R.screens(lesson):
            if R.flag(R.words(text), R.grade(text)):
                problems.append(f"{lesson['id']} {name}: {R.words(text)} words, grade {R.grade(text)}")
    assert not problems, "\n".join(problems)


def test_code_library_snippets_are_valid():
    import ast
    import re
    from app import code_library as C
    for group in C.groups():
        for entry in group["entries"]:
            re.compile(entry["uses"])
            if not entry.get("not_python"):
                ast.parse(entry["code"])
    for lesson in L.all_lessons():
        lib = C.for_lesson(lesson)
        assert lib["here"] or lesson.get("lab") or lesson.get("kind") == "check", lesson["id"]
        # nothing is lost or listed twice
        names = [e["title"] for e in lib["here"]] + [e["title"] for g in lib["groups"] for e in g["entries"]]
        assert sorted(names) == sorted(e["title"] for g in C.groups() for e in g["entries"])


def test_challenge_levels_and_hints(client):
    for lesson in L.all_lessons():
        if lesson.get("kind") == "check":
            continue
        names = [lv.split(":", 1)[0] for lv in lesson["challenge"]["levels"]]
        assert names == ["Bronze", "Silver", "Gold"], lesson["id"]
    register_teacher(client)
    r = client.get(f"/lessons/{LID}")
    assert b"Code library" in r.data and b"hint-set" in r.data
    assert b"Spicy" not in r.data
    assert b"My idea" in r.data
    assert b'data-act="sim"' in r.data
    # challenges start from working code, not a blank editor
    import json
    state = json.loads(re.search(rb"window\.STATE = (.*?);\n", r.data).group(1))
    assert state["challenge_code"] == L.get_lesson(LID)["code"]["starter"]


def test_lab_lesson_flow(client):
    lesson = L.get_lesson("ai-teach-your-microbit")
    keys = L.section_keys(lesson)
    assert keys == ["warmup", "learn", "lab", "quiz", "challenge"]
    register_teacher(client)
    r = client.get("/lessons/ai-teach-your-microbit")
    assert r.status_code == 200 and b"createai.microbit.org" in r.data
    assert b'id="ed-code"' not in r.data and b'id="ed-debug"' not in r.data
    n = len(lesson["lab"]["steps"])
    assert client.post("/api/lessons/ai-teach-your-microbit/save", json={"circuit_steps": list(range(n))}).json["sections"]["lab"]
    assert client.post("/api/lessons/ai-teach-your-microbit/debug", json={"code": "x"}).status_code == 404
    done = client.post("/api/lessons/ai-teach-your-microbit/challenge", json={"response": "My model mixed up two moves."}).json
    assert done["sections"]["challenge"] and done["stars"] == 2
    assert client.get("/map").status_code == 200 and client.get("/lessons").status_code == 200


def test_teacher_sees_lab_work(client, app):
    register_teacher(client)
    c = make_class(client)
    cid, code = c.id, c.join_code
    logout(client)
    register_student(client, code)
    client.post("/api/lessons/ai-test-and-fix/save", json={"circuit_steps": [0, 1]})
    sid = User.query.filter_by(role="student").first().id
    logout(client)
    client.post("/login", data={"username": "teach", "password": "pass1234"})
    r = client.get(f"/teacher/classes/{cid}/students/{sid}")
    assert r.status_code == 200 and b"AI lab steps" in r.data
    assert client.get("/teacher/standards").status_code == 200
    assert client.get(f"/teacher/classes/{cid}/export.csv").status_code == 200
    assert client.get("/lessons/ai-test-and-fix").status_code == 200


def _sprint_class(client, branch):
    register_teacher(client)
    c = make_class(client)
    cid, code = c.id, c.join_code
    r = client.post(f"/teacher/classes/{cid}/assign-sprint", data={"branch": branch, "due_date": "2030-01-01"})
    assert r.status_code == 302
    logout(client)
    register_student(client, code)
    return cid


def _teach_login(client):
    logout(client)
    client.post("/login", data={"username": "teach", "password": "pass1234"})


def test_assign_sprint_fixed_branch(client):
    cid = _sprint_class(client, "embedded")
    expected = L.SPRINT_TRUNK + L.SPRINT_BRANCHES["embedded"]
    assigned = {a.lesson_id: a for a in Assignment.query.filter_by(classroom_id=cid)}
    assert set(assigned) == set(expected) and all(a.due_date.year == 2030 and not a.branch for a in assigned.values())
    assert b"Embedded 1" in client.get("/dashboard").data


def test_assign_sprint_student_choice(client):
    cid = _sprint_class(client, "choice")
    page = client.get("/dashboard").data
    assert b"Sprint 3" in page and b"Build the Bot" not in page     # no branch owed yet
    client.post("/api/lessons/ai-rules-or-learning/save", json={"warmup_answer": "pattern"})
    page = client.get("/dashboard").data
    assert b"AI 1" in page and b"Build the Bot" not in page and b"Embedded 1" not in page
    _teach_login(client)
    assert b"didn't pick this branch" in client.get(f"/teacher/classes/{cid}").data


def test_classroom_screen(client):
    cid = _sprint_class(client, "robots")
    client.post("/api/lessons/sprint-sensor-lab/save", json={"warmup_answer": "a robot"})
    assert client.get(f"/teacher/classes/{cid}/screen").status_code in (302, 403)      # students can't open it
    _teach_login(client)
    assert client.get(f"/teacher/classes/{cid}/screen").status_code == 200
    d = client.get(f"/teacher/classes/{cid}/screen/data").json
    assert d["students"][0]["name"] == "Sam" and "Sensor Lab" in d["students"][0]["where"]
    assert d["lesson"]["id"] == "sprint-sensor-lab" and d["auto_lesson"]       # the lesson students are on
    assert d["question"] == L.get_lesson("sprint-sensor-lab")["essential_question"]
    assert d["students"][0]["done"] == 1 and d["standards"][0]["students"] == 1
    assert "username" not in d["students"][0] and d["question"] and "xp" in d["students"][0]
    d = client.post(f"/teacher/classes/{cid}/screen/settings",
                    json={"lesson_id": "traffic-light", "question": "Why is yellow short?", "xp": "hide"}).json
    assert d["lesson"]["id"] == "traffic-light" and d["question"] == "Why is yellow short?"
    assert d["track"][0]["key"] == "warmup" and d["standards"] and d["big_idea"]
    assert d["total_xp"] == 0 and "xp" not in d["students"][0]
    assert d["wins"] and d["wins"][0]["text"].startswith("Sam earned the ")          # first section = First Spark badge
    d = client.post(f"/teacher/classes/{cid}/screen/settings", json={"bell": "10:42"}).json
    assert d["settings"]["bell"] == "10:42"
    assert client.post(f"/teacher/classes/{cid}/screen/settings", json={"bell": "soon"}).json["settings"]["bell"] == ""


def test_lesson_timer_is_only_for_the_teacher(client):
    register_teacher(client)
    assert b'id="timer">' in client.get(f"/lessons/{LID}").data
    code = make_class(client).join_code
    logout(client)
    register_student(client, code)
    assert b'id="timer" hidden>' in client.get(f"/lessons/{LID}").data


def _login(client, name):
    logout(client)
    client.post("/login", data={"username": name, "password": "pass1234"})


def test_partners_on_one_chromebook(client):
    """Sam picks Ana as a partner: their work is combined, then every save goes to both of them."""
    register_teacher(client)
    c = make_class(client)
    cid, code = c.id, c.join_code
    logout(client)
    register_student(client, code, "sam")
    logout(client)
    register_student(client, code, "ana")
    client.post(f"/api/lessons/{LID}/save", json={"warmup_answer": "Ana's own idea"})     # Ana started on her own
    ana_id = User.query.filter_by(username="ana").one().id
    sam_id = User.query.filter_by(username="sam").one().id
    url = f"/api/lessons/{LID}/partner"

    _login(client, "sam")
    client.post(f"/api/lessons/{LID}/save", json={"mark": {"learn": True}})
    assert [m["id"] for m in client.get(url).json["classmates"]] == [ana_id]
    assert client.post(url, json={"action": "pair", "partner_id": ana_id}).json["status"] == "paired"   # no accept step
    for uid in (sam_id, ana_id):                                     # combined: both have both sections
        p = Progress.query.filter_by(user_id=uid, lesson_id=LID).one()
        assert p.sections.get("warmup") and p.sections.get("learn") and p.warmup_answer == "Ana's own idea"

    done = client.post(f"/api/lessons/{LID}/challenge", json={"code": "print(1)", "response": "Our secret signal blinks SOS."}).json
    assert done["partner"] == "Sam K."
    theirs = Progress.query.filter_by(user_id=ana_id, lesson_id=LID).one()
    assert theirs.challenge_submitted_at and theirs.challenge_code == "print(1)" and theirs.sections["challenge"]
    assert db.session.get(User, ana_id).xp > 0                             # Ana gets the XP too

    _login(client, "ana")
    assert client.get(url).json == {"status": "paired", "name": "Sam K."}
    assert client.post(url, json={"action": "leave"}).json["status"] == "none"
    client.post(f"/api/lessons/{LID}/save", json={"code": "after"})   # no longer copied
    assert Progress.query.filter_by(user_id=sam_id, lesson_id=LID).one().code != "after"
    assert client.post(url, json={"action": "pair", "partner_id": sam_id}).json["status"] == "paired"

    _login(client, "teach")
    client.post(f"/teacher/classes/{cid}/assign", data={"lesson_id": [LID]})
    assert "👥 Sam K.".encode() in client.get(f"/teacher/classes/{cid}").data
    assert "Worked with Sam K.".encode() in client.get(f"/teacher/classes/{cid}/students/{ana_id}").data


def test_partners_must_share_a_class(client):
    register_teacher(client)
    one = make_class(client, "One")
    two = make_class(client, "Two")
    code_one, code_two = one.join_code, two.join_code
    logout(client)
    register_student(client, code_one, "sam")
    logout(client)
    register_student(client, code_two, "ana")
    ana_id = User.query.filter_by(username="ana").one().id
    _login(client, "sam")
    r = client.post(f"/api/lessons/{LID}/partner", json={"action": "pair", "partner_id": ana_id})
    assert r.status_code == 400 and client.get(f"/api/lessons/{LID}/partner").json["classmates"] == []


def test_google_classroom_package(client):
    cid = _sprint_class(client, "choice")
    client.post("/api/lessons/sprint-sensor-lab/save", json={"warmup_answer": "a robot"})
    assert client.post(f"/teacher/classes/{cid}/google-classroom/package",
                       json={"score": "complete", "lessons": ["sprint-sensor-lab"]}).status_code != 200
    _login(client, "teach")
    assert client.get(f"/teacher/classes/{cid}/google-classroom").status_code == 200
    lessons = ["sprint-sensor-lab", "sprint-servo-skills", "sprint-build-the-bot"]
    url = f"/teacher/classes/{cid}/google-classroom/package"
    d = client.post(url, json={"score": "complete", "lessons": lessons}).json
    assert d["source"] == "microbit-maker-lab" and d["version"] == 1 and len(d["assignments"]) == 3
    assert d["assignments"][0]["due"] == "2030-01-01"
    grades = d["students"][0]["grades"]
    assert grades["sprint-sensor-lab"] > 0
    assert "sprint-servo-skills" not in grades and "sprint-build-the-bot" not in grades   # unstarted stays blank
    assert client.post(url, json={"score": "quiz", "lessons": lessons}).json["students"][0]["grades"] == {}
    assert client.post(url, json={"score": "nope", "lessons": lessons}).status_code == 400


def test_map_requires_what_each_lesson_uses():
    """A student can't reach a lesson without the lessons that teach the code it uses."""
    import re
    from app import gamify
    tree = gamify.TREE

    def ancestors(lid, seen=None):
        seen = set() if seen is None else seen
        for r in tree[lid]["requires"]:
            if r not in seen:
                seen.add(r)
                ancestors(r, seen)
        return seen
    ideas = {"traffic-light": r"\bdef \w+\(", "buttons-and-inputs": r"(?m)^\s*if\b", "dimmer-pwm": r"(?m)^\s*for \w+ in",
             "light-sensor": r"(?m)^\s*elif\b", "potentiometer": r"//", "temperature-data": r"\b(max|min)\(",
             "servo-motor": r"\breturn\b", "motion-and-sound": r"accelerometer"}
    problems = []
    for lesson in L.all_lessons():
        if lesson["unit"] > 4 or not lesson.get("code"):
            continue
        code = lesson["code"]["starter"] + lesson["debug"]["solution"]
        for teacher, pattern in ideas.items():
            if teacher != lesson["id"] and re.search(pattern, code) and teacher not in ancestors(lesson["id"]):
                problems.append(f"{lesson['id']} needs {teacher}")
    assert not problems, problems


def test_practice_and_predict_flow(client):
    register_teacher(client)
    r = client.get(f"/lessons/{LID}")
    assert b'id="practice"' in r.data and b"predict-choice" in r.data
    code = make_class(client).join_code
    logout(client)
    register_student(client, code)
    page = client.get(f"/lessons/{LID}").data
    solution = L.get_lesson(LID)["practice"]["solution"]
    assert solution.encode() not in page             # students don't get the answer
    url = f"/api/lessons/{LID}/practice"
    no = client.post(url, json={"code": L.get_lesson(LID)["practice"]["starter"]}).json
    assert no["solved"] is False and no["messages"]
    yes = client.post(url, json={"code": solution}).json
    assert yes["solved"] and yes["sections"]["practice"]


def test_unit_check_page(client):
    register_teacher(client)
    assert client.get("/lessons/unit-1-check").status_code == 200
    c_code = make_class(client).join_code
    logout(client)
    register_student(client, c_code)
    page = client.get("/lessons/unit-1-check")
    assert page.status_code == 200 and b'id="warmup"' not in page.data
    n = len(L.get_lesson("unit-1-check")["quiz"])
    done = client.post("/api/lessons/unit-1-check/quiz", json={"answers": [0] * n}).json
    assert done["percent"] == 100
    assert "unit-1-check" not in {x["id"] for x in __import__("app.gamify", fromlist=["x"]).map_data(User.query.filter_by(role="student").first())["nodes"]}
    assert L.get_lesson("buttons-and-inputs")["number"] == 6      # checks don't shift lesson numbers



def test_learn_quick_checks(client):
    """Each Learn card's quick check is graded on the server and gives XP only when right on the first try."""
    lid = "circuits-101"
    lesson = L.get_lesson(lid)
    view = L.public_view(lesson)
    assert all("answer" not in c["check"] and "why" not in c["check"] for c in view["learn"])
    register_teacher(client)
    c = make_class(client)
    logout(client)
    register_student(client, c.join_code)
    page = client.get(f"/lessons/{lid}").data.decode()
    assert "lc-choice" in page and "Read to me" in page and "remember-box" in page
    assert lesson["learn"][0]["check"]["why"] not in page          # feedback only comes from the server
    url = f"/api/lessons/{lid}/learn-check"
    right0, right1 = lesson["learn"][0]["check"]["answer"], lesson["learn"][1]["check"]["answer"]
    wrong = client.post(url, json={"card": 0, "choice": (right0 + 1) % 3}).json
    assert wrong["check"]["correct"] is False and wrong["check"]["hint"] and wrong["rewards"]["xp_gained"] == 0
    again = client.post(url, json={"card": 0, "choice": right0}).json
    assert again["check"]["correct"] and again["check"]["why"]
    assert again["rewards"]["xp_gained"] == 0                     # right, but not on the first try
    first = client.post(url, json={"card": 1, "choice": right1}).json
    assert first["rewards"]["xp_gained"] >= 5
    assert client.post(url, json={"card": 1, "choice": right1}).json["rewards"]["xp_gained"] == 0   # never twice
    assert client.post(url, json={"card": 99, "choice": 0}).status_code == 400
    p = Progress.query.filter_by(lesson_id=lid).first()
    assert p.learn_checks["0"] == {"tries": 2, "ok": True, "pick": right0}


def test_skip_learn_for_a_class(client):
    register_teacher(client)
    c = make_class(client)
    client.post(f"/teacher/classes/{c.id}/skip-learn", data={"skip": "1"})
    logout(client)
    register_student(client, c.join_code)
    page = client.get(f"/lessons/{LID}").data.decode()
    assert '"skip_learn": true' in page
    p = Progress.query.filter_by(lesson_id=LID).first()
    assert p.sections.get("learn")                                  # taught live, so it counts as done


def test_learn_rules_catch_long_cards():
    card = {"text": "word " * 70, "check": {"question": "Q?", "choices": ["a", "b"], "answer": 0, "why": "w", "hint": "h"}}
    assert any("60" in e for e in L._check_learn([card]))
    assert any("check" in e for e in L._check_learn([{"text": "short"}]))
    assert any("4 cards" in e for e in L._check_learn([card] * 5))
    assert any("answer" in e for e in L._check_learn([{"text": "hi", "check": {**card["check"], "answer": 5}}]))
