from app import lessons as L
from app.circuits import check_circuit
from app.models import Progress, User

from .conftest import logout, make_class, register_student, register_teacher

LID = "blink-external-led"


def test_all_lessons_valid():
    lessons = L.all_lessons()
    assert len(lessons) == 16
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

    # progress
    assert client.post(f"/api/lessons/{LID}/save", json={"warmup_answer": "use a pin"}).json["sections"]["warmup"]
    client.post(f"/api/lessons/{LID}/save", json={"mark": {"learn": True}})
    n = len(L.get_lesson(LID)["circuit"]["steps"])
    assert client.post(f"/api/lessons/{LID}/save", json={"circuit_steps": list(range(n))}).json["sections"]["circuit"]
    client.post(f"/api/lessons/{LID}/sent", json={"section": "code"})

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
