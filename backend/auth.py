import hmac
import hashlib
import os
import re
import secrets
from datetime import timezone

from flask import Blueprint, jsonify, request, session
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db, limiter
from .models import User

bp = Blueprint("auth", __name__, url_prefix="/api")

EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")
MIN_PASSWORD = 10
MAX_PASSWORD = 128
COMMON_PASSWORDS = {
    "password123", "1234567890", "qwertyuiop", "password1234",
    "iloveyou123", "admin12345", "welcome123", "letmein1234",
}

# Used so login takes the same time whether or not the email exists
DUMMY_HASH = generate_password_hash("timing-protection-dummy")


# ---------- helpers ----------
def body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def fail(message, status=400):
    return jsonify(error=message), status


def csrf_token():
    if "csrf" not in session:
        session["csrf"] = secrets.token_urlsafe(32)
    return session["csrf"]


def iso(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def pw_stamp(user):
    return hashlib.sha256(user.password_hash.encode()).hexdigest()[:20]


def current_user():
    uid = session.get("uid")
    if not uid:
        return None
    user = db.session.get(User, uid)
    if user is None or session.get("pwv") != pw_stamp(user):
        return None
    return user


def email_key():
    # rate limit login attempts per account, not only per IP
    return str(body().get("email", "")).strip().lower()[:254] or "anonymous"


def password_problem(password, email):
    if len(password) < MIN_PASSWORD:
        return "Password must be at least %d characters." % MIN_PASSWORD
    if len(password) > MAX_PASSWORD:
        return "Password must be at most %d characters." % MAX_PASSWORD
    if password.lower() == email or password.lower() in COMMON_PASSWORDS:
        return "Choose a less predictable password."
    if len(set(password)) < 5:
        return "Choose a less predictable password."
    return None


def start_session(user):
    session.clear()
    session["uid"] = user.id
    session["pwv"] = pw_stamp(user)
    session.permanent = True


# ---------- CSRF protection for every state-changing request ----------
@bp.before_request
def csrf_protect():
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        sent = request.headers.get("X-CSRF-Token", "")
        expected = session.get("csrf", "")
        if not expected or not hmac.compare_digest(sent.encode(), expected.encode()):
            return fail("Security check failed. Refresh the page and try again.", 403)


# ---------- routes ----------
@bp.get("/csrf")
def get_csrf():
    return jsonify(token=csrf_token())


@bp.post("/register")
@limiter.limit("10 per hour")
def register():
    data = body()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if len(email) > 254 or not EMAIL_RE.match(email):
        return fail("Enter a valid email address.")

    problem = password_problem(password, email)
    if problem:
        return fail(problem)

    user = User(email=email, password_hash=generate_password_hash(password))
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return fail("An account with this email already exists.", 409)

    start_session(user)
    return jsonify(ok=True, csrf=csrf_token()), 201


@bp.post("/login")
@limiter.limit("20 per 15 minutes")
@limiter.limit("8 per 15 minutes", key_func=email_key)
def login():
    data = body()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if len(password) > MAX_PASSWORD or len(email) > 254:
        return fail("Incorrect email or password.", 401)

    user = db.session.execute(db.select(User).filter_by(email=email)).scalar_one_or_none()
    valid = check_password_hash(user.password_hash if user else DUMMY_HASH, password)

    if user is None or not valid:
        return fail("Incorrect email or password.", 401)

    start_session(user)
    return jsonify(ok=True, csrf=csrf_token())


@bp.post("/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@bp.get("/me")
def me():
    user = current_user()
    if user is None:
        return fail("Not signed in.", 401)
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    return jsonify(
        email=user.email,
        created_at=iso(user.created_at),
        is_admin=bool(admin_email) and user.email == admin_email,
    )