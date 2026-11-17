import pytest

from app import create_app
from app.models import db


@pytest.fixture
def app(tmp_path):
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 't.db'}",
                      "TEACHER_SIGNUP_CODE": "secret"})
    with app.app_context():
        db.create_all()
        yield app


@pytest.fixture
def client(app):
    return app.test_client()


def register_teacher(client, username="teach"):
    return client.post("/register/teacher", data={"teacher_code": "secret", "display_name": "Ms. T",
                                                  "username": username, "password": "pass1234", "confirm": "pass1234"})


def make_class(client, name="Period 1"):
    r = client.post("/teacher/classes", data={"name": name}, follow_redirects=True)
    from app.models import Classroom
    return Classroom.query.filter_by(name=name).first()


def register_student(client, code, username="sam"):
    return client.post("/register", data={"class_code": code, "display_name": "Sam K.", "username": username,
                                          "password": "pass1234", "confirm": "pass1234"})


def logout(client):
    client.post("/logout")
