import sqlite3

from app import create_app, gamify
from app import lessons as L
from app.models import User, UserBadge, XPEvent, db

from .conftest import logout, make_class, register_student, register_teacher

LID = "blink-external-led"


def _student(client):
    register_teacher(client)
    c = make_class(client)
    cid, code = c.id, c.join_code
    logout(client)
    register_student(client, code)
    return cid


def test_levels():
    assert gamify.level_info(0)["level"] == 1
    assert gamify.level_info(100)["level"] == 2
    top = gamify.level_info(99999)
    assert top["max"] and top["level"] == len(gamify.LEVELS)


def test_tree_covers_every_lesson_and_references_real_lessons():
    t = gamify.tree()
    ids = {l["id"] for l in L.all_lessons() if l.get("kind") != "check"}
    assert set(t) == ids
    for lid, info in t.items():
        assert set(info["requires"]) <= ids, lid


def test_xp_is_awarded_once_and_badges_follow(client):
    _student(client)
    r = client.post(f"/api/lessons/{LID}/save", json={"warmup_answer": "use a pin"}).json
    assert r["rewards"]["xp_gained"] == gamify.XP["warmup"] + gamify.XP["badge"]  # + First Spark badge
    assert [b["id"] for b in r["rewards"]["badges"]] == ["first-spark"]
    # saving again gives nothing new
    r = client.post(f"/api/lessons/{LID}/save", json={"warmup_answer": "use a pin!"}).json
    assert r["rewards"]["xp_gained"] == 0
    lesson = L.get_lesson(LID)
    r = client.post(f"/api/lessons/{LID}/debug", json={"code": lesson["debug"]["solution"]}).json
    got = {b["id"] for b in r["rewards"]["badges"]}
    assert {"bug-squasher", "clean-fix"} <= got
    r = client.post(f"/api/lessons/{LID}/quiz", json={"answers": [q["answer"] for q in lesson["quiz"]]}).json
    assert "quiz-whiz" in {b["id"] for b in r["rewards"]["badges"]}
    assert r["stars"] == 2
    user = User.query.filter_by(username="sam").one()
    assert user.xp == sum(e.amount for e in XPEvent.query.filter_by(user_id=user.id))


def test_hints_block_clean_fix(client):
    _student(client)
    lesson = L.get_lesson(LID)
    client.post(f"/api/lessons/{LID}/save", json={"debug_hints_used": 1})
    r = client.post(f"/api/lessons/{LID}/debug", json={"code": lesson["debug"]["solution"]}).json
    assert "clean-fix" not in {b["id"] for b in r["rewards"]["badges"]}


def test_map_unlocks(client):
    _student(client)
    user = User.query.filter_by(username="sam").one()
    nodes = {n["id"]: n for n in gamify.map_data(user)["nodes"]}
    assert nodes["hello-microbit"]["state"] == "open"
    assert nodes["circuits-101"]["state"] == "locked"
    assert nodes["circuits-101"]["requires_titles"] == ["Hello, micro:bit!"]
    # assigned lessons are always open
    nodes = {n["id"]: n for n in gamify.map_data(user, {"radio-remote"})["nodes"]}
    assert nodes["radio-remote"]["state"] == "open"
    assert client.get("/map").status_code == 200


def test_avatar_locked_parts_rejected(client):
    _student(client)
    r = client.post("/api/avatar", json={**gamify.DEFAULT_AVATAR, "accessory": "crown"})
    assert r.status_code == 400 and "locked" in r.json["error"]
    r = client.post("/api/avatar", json={**gamify.DEFAULT_AVATAR, "color": "purple", "name": "Sparky"})
    assert r.json["ok"] and "robot-stylist" in {b["id"] for b in r.json["rewards"]["badges"]}
    assert client.post("/api/avatar", json={**gamify.DEFAULT_AVATAR, "name": "<script>"}).status_code == 400
    assert client.get("/me").status_code == 200


def test_teacher_bonus(client):
    cid = _student(client)
    sid = User.query.filter_by(username="sam").one().id
    logout(client)
    client.post("/login", data={"username": "teach", "password": "pass1234"})
    client.post(f"/teacher/classes/{cid}/students/{sid}/bonus", data={"amount": "30", "reason": "Teamwork", "badge": "1"})
    assert db.session.get(User, sid).xp == 30 + gamify.XP["badge"]
    assert UserBadge.query.filter_by(user_id=sid, badge_id="teachers-pick").count() == 1
    r = client.get(f"/teacher/classes/{cid}")
    assert b"Lv " in r.data


def test_old_database_gets_new_columns(tmp_path):
    path = tmp_path / "old.db"
    con = sqlite3.connect(path)
    con.execute('CREATE TABLE "user" (id INTEGER PRIMARY KEY, username VARCHAR(40) NOT NULL, display_name VARCHAR(80) NOT NULL, '
                'password_hash VARCHAR(255) NOT NULL, role VARCHAR(10) NOT NULL, created_at DATETIME)')
    con.execute('INSERT INTO "user" (username, display_name, password_hash, role) VALUES ("old", "Old", "x", "student")')
    con.commit()
    con.close()
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": f"sqlite:///{path}"})
    with app.app_context():
        assert User.query.filter_by(username="old").one().xp == 0


def test_standards_pages(client):
    from app import standards as STD
    assert len(STD.by_code()) == 67
    for lesson in L.all_lessons():
        if lesson.get("kind") == "check":       # a unit check repeats what its lessons covered
            continue
        assert STD.for_lesson(lesson), lesson["id"]
    register_teacher(client)
    r = client.get("/teacher/standards")
    assert r.status_code == 200 and b"6-8.CT.b.1" in r.data and b"Not addressed" in r.data
    assert b"Massachusetts DLCS standards" in client.get(f"/lessons/{LID}").data


def test_sprint_branches_unlock(client):
    from app import lessons as L
    from app.models import Progress, db
    _student(client)
    user = User.query.filter_by(username="sam").one()
    branches = [b["lesson"] for b in L.get_lesson("sprint-sense-decide-act")["branches"]]
    assert len(branches) == 3 and all(L.get_lesson(b) for b in branches)
    nodes = {n["id"]: n for n in gamify.map_data(user)["nodes"]}
    assert all(nodes[b]["state"] == "locked" for b in branches)
    assert nodes["ai-rules-or-learning"]["or_titles"]

    def finish(lesson_id):
        lesson = L.get_lesson(lesson_id)
        db.session.add(Progress(user_id=user.id, lesson_id=lesson_id, circuit_steps=[],
                                sections={k: True for k in L.section_keys(lesson)}))
        db.session.commit()

    finish("sprint-sense-decide-act")
    nodes = {n["id"]: n for n in gamify.map_data(user)["nodes"]}
    assert all(nodes[b]["state"] == "open" for b in branches)
    assert nodes["ai-teach-your-microbit"]["state"] == "locked"

