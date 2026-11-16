import re
from functools import wraps
from urllib.parse import urlparse

from flask import (Blueprint, abort, current_app, flash, redirect, render_template,
                   request, url_for)
from flask_login import current_user, login_required, login_user, logout_user

from .models import Classroom, User, db

bp = Blueprint("auth", __name__)

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,40}$")


def teacher_required(view):
    @wraps(view)
    @login_required
    def wrapped(*a, **kw):
        if not current_user.is_teacher:
            abort(403)
        return view(*a, **kw)
    return wrapped


def _validate_new_user(form):
    errors = []
    username = form.get("username", "").strip()
    name = form.get("display_name", "").strip()
    pw = form.get("password", "")
    if not USERNAME_RE.match(username):
        errors.append("Username must be 3-40 letters, numbers, dots, dashes or underscores.")
    elif User.query.filter(db.func.lower(User.username) == username.lower()).first():
        errors.append("That username is taken - try another.")
    if not name:
        errors.append("Please enter your name.")
    if len(pw) < 6:
        errors.append("Password must be at least 6 characters.")
    if pw != form.get("confirm", ""):
        errors.append("Passwords don't match.")
    return username, name, pw, errors


@bp.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("student.dashboard"))
    if request.method == "POST":
        username, name, pw, errors = _validate_new_user(request.form)
        code = request.form.get("class_code", "").strip().upper()
        classroom = Classroom.query.filter_by(join_code=code).first() if code else None
        if not classroom:
            errors.append("Class code not found. Ask your teacher for the 6-letter code.")
        if errors:
            for e in errors:
                flash(e, "error")
            return render_template("auth/register.html", form=request.form), 400
        user = User(username=username, display_name=name, role="student")
        user.set_password(pw)
        user.classes.append(classroom)
        db.session.add(user)
        db.session.commit()
        login_user(user)
        flash(f"Welcome to {classroom.name}, {name}!", "success")
        return redirect(url_for("student.dashboard"))
    return render_template("auth/register.html", form={"class_code": request.args.get("code", "")})


@bp.route("/register/teacher", methods=["GET", "POST"])
def register_teacher():
    if request.method == "POST":
        username, name, pw, errors = _validate_new_user(request.form)
        if request.form.get("teacher_code", "") != current_app.config["TEACHER_SIGNUP_CODE"]:
            errors.append("The teacher sign-up code is not correct.")
        if errors:
            for e in errors:
                flash(e, "error")
            return render_template("auth/register_teacher.html", form=request.form), 400
        user = User(username=username, display_name=name, role="teacher")
        user.set_password(pw)
        db.session.add(user)
        db.session.commit()
        login_user(user)
        flash("Teacher account created. Make your first class!", "success")
        return redirect(url_for("teacher.home"))
    return render_template("auth/register_teacher.html", form={})


def _safe_next(target):
    if not target:
        return None
    p = urlparse(target)
    return target if not p.netloc and not p.scheme and target.startswith("/") else None


@bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("student.dashboard"))
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        user = User.query.filter(db.func.lower(User.username) == username.lower()).first()
        if user and user.check_password(request.form.get("password", "")):
            login_user(user, remember=bool(request.form.get("remember")))
            return redirect(_safe_next(request.args.get("next")) or
                            url_for("teacher.home" if user.is_teacher else "student.dashboard"))
        flash("Wrong username or password.", "error")
        return render_template("auth/login.html", username=username), 401
    return render_template("auth/login.html", username="")


@bp.route("/logout", methods=["POST"])
def logout():
    logout_user()
    return redirect(url_for("student.index"))


@bp.route("/account/password", methods=["GET", "POST"])
@login_required
def change_password():
    if request.method == "POST":
        if not current_user.check_password(request.form.get("current", "")):
            flash("Current password is wrong.", "error")
        elif len(request.form.get("password", "")) < 6:
            flash("New password must be at least 6 characters.", "error")
        elif request.form.get("password") != request.form.get("confirm"):
            flash("Passwords don't match.", "error")
        else:
            current_user.set_password(request.form["password"])
            db.session.commit()
            flash("Password changed.", "success")
            return redirect(url_for("student.dashboard"))
    return render_template("auth/password.html")
