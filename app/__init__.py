import os
import re
from pathlib import Path

import click
import markdown as md_lib
from flask import Flask
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from markupsafe import Markup

from .models import db, User

csrf = CSRFProtect()
login_manager = LoginManager()
login_manager.login_view = "auth.login"
login_manager.login_message = "Please log in to continue."


@login_manager.user_loader
def load_user(uid):
    return db.session.get(User, int(uid))


def _add_missing_columns():
    """Tiny migration: add columns introduced after a database was created."""
    from sqlalchemy import inspect, text
    insp = inspect(db.engine)
    cols = {c["name"] for c in insp.get_columns("user")}
    with db.engine.begin() as conn:
        if "xp" not in cols:
            conn.execute(text('ALTER TABLE "user" ADD COLUMN xp INTEGER NOT NULL DEFAULT 0'))
        if "avatar" not in cols:
            conn.execute(text('ALTER TABLE "user" ADD COLUMN avatar JSON'))
        if "branch" not in {c["name"] for c in insp.get_columns("assignment")}:
            conn.execute(text("ALTER TABLE assignment ADD COLUMN branch VARCHAR(20)"))
        progress_cols = {c["name"] for c in insp.get_columns("progress")}
        if "practice_code" not in progress_cols:
            conn.execute(text("ALTER TABLE progress ADD COLUMN practice_code TEXT"))
        if "practice_solved" not in progress_cols:
            conn.execute(text("ALTER TABLE progress ADD COLUMN practice_solved BOOLEAN DEFAULT 0"))
        if "screen" not in {c["name"] for c in insp.get_columns("classroom")}:
            conn.execute(text("ALTER TABLE classroom ADD COLUMN screen JSON"))


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    db_url = os.environ.get("DATABASE_URL", f"sqlite:///{Path(app.instance_path) / 'makerlab.db'}")
    if db_url.startswith("postgres://"):  # Heroku/Render style URLs
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    app.config.update(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev-only-change-me"),
        SQLALCHEMY_DATABASE_URI=db_url,
        TEACHER_SIGNUP_CODE=os.environ.get("TEACHER_SIGNUP_CODE", "teach-makers"),
        SITE_NAME=os.environ.get("SITE_NAME", "micro:bit Maker Lab"),
        SESSION_COOKIE_SAMESITE="Lax",
        WTF_CSRF_TIME_LIMIT=None,
    )
    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    csrf.init_app(app)
    login_manager.init_app(app)

    from . import auth, student, teacher, api
    app.register_blueprint(auth.bp)
    app.register_blueprint(student.bp)
    app.register_blueprint(teacher.bp)
    app.register_blueprint(api.bp)

    from flask import render_template

    @app.errorhandler(403)
    def forbidden(e):
        return render_template("error.html", code=403, message="That page is for teachers only."), 403

    @app.errorhandler(404)
    def not_found(e):
        return render_template("error.html", code=404, message="We couldn't find that page."), 404

    @app.template_filter("material_icon")
    def material_icon(text):
        t = (text or "").lower()
        for keys, icon in (
            (("micro:bit",), "🟦"), (("battery",), "🔋"), (("servo",), "🦾"), (("motor driver", "driver"), "🎛️"),
            (("motor", "wheel", "chassis"), "⚙️"), (("transistor",), "🔺"), (("diode",), "➡️"),
            (("buzzer", "speaker", "headphone"), "🔊"), (("potentiometer", "knob"), "🎚️"),
            (("photoresistor", "ldr", "light sensor"), "☀️"), (("sensor",), "👁️"),
            (("button",), "🔘"), (("led",), "💡"), (("resistor",), "〰️"), (("breakout",), "🔌"),
            (("breadboard",), "🧩"), (("wire", "jumper", "cable"), "🧵"), (("tape", "paper", "marker", "track"), "📏"),
        ):
            if any(k in t for k in keys):
                return icon
        return "🧰"

    @app.template_filter("md")
    def md_filter(text):
        parts = re.split(r"(```.*?```)", str(text or ""), flags=re.S)
        item = re.compile(r"^[ \t]*(?:[*-]|\d+\.) ")
        for i in range(0, len(parts), 2):   # only outside code fences
            out = []
            for line in parts[i].split("\n"):
                # a list that starts right under a paragraph line needs a blank line first
                if item.match(line) and out and out[-1].strip() and not item.match(out[-1]):
                    out.append("")
                out.append(line)
            parts[i] = "\n".join(out)
        return Markup(md_lib.markdown("".join(parts), extensions=["fenced_code", "tables", "sane_lists"]))

    @app.context_processor
    def inject():
        from flask_login import current_user
        from .gamify import avatar_of, level_info
        ctx = {"site_name": app.config["SITE_NAME"], "avatar_of": avatar_of, "level_info": level_info}
        if current_user.is_authenticated and not current_user.is_teacher:
            ctx["me_level"] = level_info(current_user.xp or 0)
        return ctx

    with app.app_context():
        db.create_all()
        _add_missing_columns()

    @app.cli.command("seed-demo")
    def seed_demo():
        """Create a demo teacher, class and student."""
        from .models import Classroom, new_join_code
        if User.query.filter_by(username="demo_teacher").first():
            click.echo("demo data already exists")
            return
        t = User(username="demo_teacher", display_name="Demo Teacher", role="teacher")
        t.set_password("demo1234")
        s = User(username="demo_student", display_name="Demo Student", role="student")
        s.set_password("demo1234")
        c = Classroom(name="Period 1 Makers", join_code=new_join_code(), teacher=t)
        c.students.append(s)
        db.session.add_all([t, s, c])
        db.session.commit()
        click.echo(f"teacher demo_teacher / demo1234, student demo_student / demo1234, class code {c.join_code}")

    return app
