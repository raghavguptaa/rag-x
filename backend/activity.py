from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request

from .auth import body, csrf_protect, current_user, fail, iso
from .extensions import db, limiter
from .models import Activity

bp = Blueprint("activity", __name__, url_prefix="/api")
bp.before_request(csrf_protect)

# only these combinations are accepted; anything else is rejected
ALLOWED = {
    "text": {"encrypt", "decrypt"},
    "file": {"encrypt", "decrypt"},
    "vault": {"encrypt", "decrypt"},
    "pdf": {"lock", "unlock"},
    "password": {"generate"},
    "hash": {"hash"},
}
MAX_PER_USER = 2000


def as_utc(dt):
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@bp.post("/activity")
@limiter.limit("240 per hour")
def log_activity():
    user = current_user()
    if user is None:
        return fail("Not signed in.", 401)

    data = body()
    tool = str(data.get("tool", ""))
    action = str(data.get("action", ""))
    if action not in ALLOWED.get(tool, ()):
        return fail("Invalid activity.")

    try:
        size = int(data.get("size", 0))
    except (TypeError, ValueError):
        size = 0
    size = max(0, min(size, 10 ** 12))

    db.session.add(Activity(user_id=user.id, tool=tool, action=action, size_bytes=size))
    db.session.commit()

    # keep each user's history small: drop the oldest rows beyond the limit
    count = db.session.execute(
        db.select(db.func.count(Activity.id)).where(Activity.user_id == user.id)
    ).scalar()
    if count > MAX_PER_USER:
        old_ids = db.session.execute(
            db.select(Activity.id)
            .where(Activity.user_id == user.id)
            .order_by(Activity.created_at.asc(), Activity.id.asc())
            .limit(count - MAX_PER_USER)
        ).scalars().all()
        db.session.execute(db.delete(Activity).where(Activity.id.in_(old_ids)))
        db.session.commit()

    return jsonify(ok=True), 201


@bp.get("/activity/summary")
def summary():
    user = current_user()
    if user is None:
        return fail("Not signed in.", 401)

    # the browser sends its UTC offset in minutes so days line up with the user's clock
    try:
        tz = int(request.args.get("tz", "0"))
    except ValueError:
        tz = 0
    offset = timedelta(minutes=max(-840, min(840, tz)))

    rows = db.session.execute(
        db.select(Activity)
        .where(Activity.user_id == user.id)
        .order_by(Activity.created_at.desc(), Activity.id.desc())
    ).scalars().all()

    today = (datetime.now(timezone.utc) + offset).date()
    days = [today - timedelta(days=i) for i in range(13, -1, -1)]
    per_day = {d: 0 for d in days}
    by_tool = {}
    total_bytes = 0
    last7 = 0

    for r in rows:
        local = (as_utc(r.created_at) + offset).date()
        if local in per_day:
            per_day[local] += 1
        if 0 <= (today - local).days < 7:
            last7 += 1
        by_tool[r.tool] = by_tool.get(r.tool, 0) + 1
        total_bytes += r.size_bytes or 0

    ranked = sorted(by_tool.items(), key=lambda kv: kv[1], reverse=True)

    return jsonify(
        total=len(rows),
        last7=last7,
        bytes=total_bytes,
        top_tool=ranked[0][0] if ranked else None,
        by_tool=[{"tool": t, "count": c} for t, c in ranked],
        per_day=[{"date": d.isoformat(), "count": per_day[d]} for d in days],
        recent=[
            {"tool": r.tool, "action": r.action, "size": r.size_bytes, "at": iso(r.created_at)}
            for r in rows[:20]
        ],
    )


@bp.delete("/activity")
def clear_activity():
    user = current_user()
    if user is None:
        return fail("Not signed in.", 401)
    db.session.execute(db.delete(Activity).where(Activity.user_id == user.id))
    db.session.commit()
    return jsonify(ok=True)