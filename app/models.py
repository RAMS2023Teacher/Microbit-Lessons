from datetime import datetime, timezone
import secrets

from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


enrollments = db.Table(
    "enrollments",
    db.Column("user_id", db.Integer, db.ForeignKey("user.id"), primary_key=True),
    db.Column("classroom_id", db.Integer, db.ForeignKey("classroom.id"), primary_key=True),
)


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(40), unique=True, nullable=False, index=True)
    display_name = db.Column(db.String(80), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(10), nullable=False, default="student")
    created_at = db.Column(db.DateTime, default=utcnow)
    xp = db.Column(db.Integer, default=0, nullable=False, server_default="0")
    avatar = db.Column(db.JSON)

    classes = db.relationship("Classroom", secondary=enrollments, back_populates="students")
    progress = db.relationship("Progress", back_populates="user", cascade="all, delete-orphan")

    def set_password(self, pw):
        self.password_hash = generate_password_hash(pw)

    def check_password(self, pw):
        return check_password_hash(self.password_hash, pw)

    @property
    def is_teacher(self):
        return self.role == "teacher"


def new_join_code():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I confusion
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(6))
        if not Classroom.query.filter_by(join_code=code).first():
            return code


class Classroom(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    join_code = db.Column(db.String(10), unique=True, nullable=False, index=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow)
    screen = db.Column(db.JSON)     # Classroom Screen settings

    teacher = db.relationship("User", foreign_keys=[teacher_id])
    students = db.relationship("User", secondary=enrollments, back_populates="classes",
                               order_by="User.display_name")
    assignments = db.relationship("Assignment", back_populates="classroom",
                                  cascade="all, delete-orphan", order_by="Assignment.created_at")


class Assignment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    classroom_id = db.Column(db.Integer, db.ForeignKey("classroom.id"), nullable=False)
    lesson_id = db.Column(db.String(80), nullable=False)
    due_date = db.Column(db.Date)
    note = db.Column(db.String(500), default="")
    created_at = db.Column(db.DateTime, default=utcnow)
    branch = db.Column(db.String(20))   # set when students choose a Sprint branch; they only owe the one they pick

    classroom = db.relationship("Classroom", back_populates="assignments")


class Progress(db.Model):
    __table_args__ = (db.UniqueConstraint("user_id", "lesson_id"),)
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    lesson_id = db.Column(db.String(80), nullable=False)

    sections = db.Column(db.JSON, default=dict)        # {"warmup": true, ...}
    circuit_steps = db.Column(db.JSON, default=list)   # step indexes checked off
    warmup_answer = db.Column(db.Text, default="")
    code = db.Column(db.Text)                          # code section editor
    sends = db.Column(db.Integer, default=0)           # times sent to micro:bit / downloaded
    debug_code = db.Column(db.Text)
    debug_solved = db.Column(db.Boolean, default=False)
    debug_attempts = db.Column(db.Integer, default=0)
    debug_hints_used = db.Column(db.Integer, default=0)
    debug_reflection = db.Column(db.Text, default="")
    quiz_answers = db.Column(db.JSON)
    quiz_score = db.Column(db.Integer)
    quiz_best = db.Column(db.Integer)
    quiz_total = db.Column(db.Integer)
    quiz_attempts = db.Column(db.Integer, default=0)
    challenge_code = db.Column(db.Text)
    challenge_response = db.Column(db.Text, default="")
    challenge_submitted_at = db.Column(db.DateTime)
    feedback = db.Column(db.Text, default="")
    started_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)
    completed_at = db.Column(db.DateTime)

    user = db.relationship("User", back_populates="progress")

    def mark(self, key, done=True):
        s = dict(self.sections or {})
        s[key] = done
        self.sections = s

    def percent(self, keys):
        s = self.sections or {}
        return round(100 * sum(1 for k in keys if s.get(k)) / len(keys)) if keys else 0


class Partnership(db.Model):
    """Two students working together on one lesson. Inactive until the partner accepts."""
    id = db.Column(db.Integer, primary_key=True)
    lesson_id = db.Column(db.String(80), nullable=False, index=True)
    inviter_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    partner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    accepted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow)


class LessonVideo(db.Model):
    lesson_id = db.Column(db.String(80), primary_key=True)
    url = db.Column(db.String(500), nullable=False)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)


class XPEvent(db.Model):
    """One XP award. ``key`` is unique per user so awards are never doubled."""
    __table_args__ = (db.UniqueConstraint("user_id", "key"),)
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    key = db.Column(db.String(120), nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(200), default="")
    created_at = db.Column(db.DateTime, default=utcnow)


class UserBadge(db.Model):
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), primary_key=True)
    badge_id = db.Column(db.String(40), primary_key=True)
    earned_at = db.Column(db.DateTime, default=utcnow)
