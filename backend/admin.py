from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify

from .auth import iso
from .contact import admin_required
from .extensions import db
from .models import Activity, Message, User

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def as_utc(dt):
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@bp.get("/stats")
@admin_required
def stats():
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    total_users = db.session.execute(db.select(db.func.count(User.id))).scalar()
    new_7d = db.session.execute(
        db.select(db.func.count(User.id)).where(User.created_at >= week_ago)
    ).scalar()
    active_7d = db.session.execute(
        db.select(db.func.count(Activity.user_id.distinct())).where(Activity.created_at >= week_ago)
    ).scalar()
    messages = db.session.execute(db.select(db.func.count(Message.id))).scalar()
    unread = db.session.execute(
        db.select(db.func.count(Message.id)).where(Message.is_read.is_(False))
    ).scalar()

    # sign-ups per day for the last 14 days (UTC days)
    today = now.date()
    days = [today - timedelta(days=i) for i in range(13, -1, -1)]
    per_day = {d: 0 for d in days}
    since = now - timedelta(days=14)
    for (created,) in db.session.execute(
        db.select(User.created_at).where(User.created_at >= since)
    ).all():
        d = as_utc(created).date()
        if d in per_day:
            per_day[d] += 1

    return jsonify(
        total_users=total_users,
        new_7d=new_7d,
        active_7d=active_7d,
        messages=messages,
        unread=unread,
        signups=[{"date": d.isoformat(), "count": per_day[d]} for d in days],
    )


@bp.get("/users")
@admin_required
def users():
    rows = db.session.execute(
        db.select(User).order_by(User.created_at.desc()).limit(200)
    ).scalars().all()
    ops = dict(db.session.execute(
        db.select(Activity.user_id, db.func.count(Activity.id)).group_by(Activity.user_id)
    ).all())
    return jsonify(users=[
        {"email": u.email, "created_at": iso(u.created_at), "ops": ops.get(u.id, 0)}
        for u in rows
    ])