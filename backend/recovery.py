import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, session
from werkzeug.security import generate_password_hash

from .auth import body, csrf_protect, email_key, fail, password_problem
from .extensions import db, limiter
from .models import PasswordReset, User, utcnow
from .notify import send_user_email

bp = Blueprint("recovery", __name__, url_prefix="/api")
bp.before_request(csrf_protect)

RESET_MINUTES = 30
GENERIC = "If an account exists for that email, a reset link has been sent. It is valid for 30 minutes."
INVALID = "This reset link is invalid or has expired. Please request a new one."


def as_utc(dt):
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def send_reset_email(to, token):
    # the link is built from a fixed setting, never from the request, so a forged
    # Host header cannot point a reset link at an attacker's site
    site = os.environ.get("SITE_URL", "").rstrip("/")
    if not site:
        if os.environ.get("PORT"):
            return
        site = "http://127.0.0.1:5000"

    link = site + "/reset.html#token=" + token
    text = (
        "Someone asked to reset the password for your Rag X account.\n\n"
        "Open this link within %d minutes to choose a new password:\n%s\n\n"
        "If this was not you, ignore this email. Your password stays the same.\n"
    ) % (RESET_MINUTES, link)

    sent = send_user_email(to, "Reset your Rag X password", text)
    if not sent and not os.environ.get("PORT"):
        print("DEV ONLY - password reset link for", to, ":", link)


@bp.post("/forgot")
@limiter.limit("5 per hour")
@limiter.limit("3 per hour", key_func=email_key)
def forgot():
    email = str(body().get("email", "")).strip().lower()

    # tidy up expired links
    db.session.execute(db.delete(PasswordReset).where(PasswordReset.expires_at < utcnow()))

    if email and len(email) <= 254:
        user = db.session.execute(db.select(User).filter_by(email=email)).scalar_one_or_none()
        if user is not None:
            # one active link per account
            db.session.execute(db.delete(PasswordReset).where(PasswordReset.user_id == user.id))
            token = secrets.token_urlsafe(32)
            db.session.add(PasswordReset(
                user_id=user.id,
                token_hash=digest(token),
                expires_at=utcnow() + timedelta(minutes=RESET_MINUTES),
            ))
            db.session.commit()
            send_reset_email(user.email, token)
        else:
            db.session.commit()

    # same answer whether or not the account exists
    return jsonify(ok=True, message=GENERIC)


@bp.post("/reset")
@limiter.limit("10 per hour")
def reset():
    data = body()
    token = str(data.get("token", ""))
    password = str(data.get("password", ""))

    if not token or len(token) > 200:
        return fail(INVALID)

    row = db.session.execute(
        db.select(PasswordReset).filter_by(token_hash=digest(token))
    ).scalar_one_or_none()
    if row is None or as_utc(row.expires_at) < datetime.now(timezone.utc):
        return fail(INVALID)

    user = db.session.get(User, row.user_id)
    if user is None:
        return fail(INVALID)

    # a weak password is rejected without using up the link
    problem = password_problem(password, user.email)
    if problem:
        return fail(problem)

    user.password_hash = generate_password_hash(password)
    db.session.execute(db.delete(PasswordReset).where(PasswordReset.user_id == user.id))
    db.session.commit()
    session.clear()
    return jsonify(ok=True)