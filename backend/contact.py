import os
import re
from .notify import notify_new_message
from functools import wraps

from flask import Blueprint, jsonify, request

from .auth import body, csrf_protect, current_user, fail, iso
from .extensions import db, limiter
from .models import Message

bp = Blueprint("contact", __name__, url_prefix="/api")
bp.before_request(csrf_protect)

TOPICS = {"Feedback", "Bug report", "Security report", "Collaboration", "Other"}
# strict on purpose: the address is later used in a mailto link in the admin page
CONTACT_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$")
MAX_MESSAGES = 5000


def is_admin(user):
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    return bool(admin_email) and user.email == admin_email


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if user is None:
            return fail("Not signed in.", 401)
        if not is_admin(user):
            return fail("Not found.", 404)
        return view(*args, **kwargs)
    return wrapped


@bp.post("/contact")
@limiter.limit("5 per hour")
def send_message():
    if request.content_length and request.content_length > 20000:
        return fail("Message too large.", 413)

    data = body()

    # honeypot: real visitors never see this field, bots fill it in
    if str(data.get("hp", "")).strip():
        return jsonify(ok=True)

    name = str(data.get("name", "")).strip()[:80]
    email = str(data.get("email", "")).strip().lower()
    topic = str(data.get("topic", "Other"))
    text = str(data.get("message", "")).strip()

    if topic not in TOPICS:
        topic = "Other"
    if email and (len(email) > 254 or not CONTACT_EMAIL_RE.match(email)):
        return fail("Enter a valid email address, or leave it empty.")
    if len(text) < 10:
        return fail("Please write at least 10 characters.")
    if len(text) > 2000:
        return fail("Message is too long (max 2000 characters).")

    total = db.session.execute(db.select(db.func.count(Message.id))).scalar()
    if total >= MAX_MESSAGES:
        return fail("The inbox is full right now. Please try again later.", 503)

    db.session.add(Message(name=name, email=email, topic=topic, body=text))
    db.session.commit()
    notify_new_message(topic, name, email, text)
    return jsonify(ok=True), 201


@bp.get("/admin/messages")
@admin_required
def list_messages():
    rows = db.session.execute(
        db.select(Message).order_by(Message.created_at.desc()).limit(300)
    ).scalars().all()
    return jsonify(messages=[
        {
            "id": m.id, "name": m.name, "email": m.email, "topic": m.topic,
            "body": m.body, "read": m.is_read, "created_at": iso(m.created_at),
        }
        for m in rows
    ])
@bp.get("/admin/unread")
@admin_required
def unread_count():
    n = db.session.execute(
        db.select(db.func.count(Message.id)).where(Message.is_read.is_(False))
    ).scalar()
    return jsonify(unread=n)

@bp.post("/admin/messages/<int:mid>/read")
@admin_required
def mark_read(mid):
    m = db.session.get(Message, mid)
    if m is None:
        return fail("Not found.", 404)
    m.is_read = bool(body().get("read", True))
    db.session.commit()
    return jsonify(ok=True)


@bp.delete("/admin/messages/<int:mid>")
@admin_required
def delete_message(mid):
    m = db.session.get(Message, mid)
    if m is None:
        return fail("Not found.", 404)
    db.session.delete(m)
    db.session.commit()
    return jsonify(ok=True)