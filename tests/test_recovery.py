import itertools
from datetime import datetime, timedelta, timezone

from backend.app import app
from backend.extensions import db
from backend.models import PasswordReset
from backend.recovery import digest

PW = "correct-horse-battery"
NEW = "brand-new-password-42"
_ip = itertools.count(1)


def new_client():
    c = app.test_client()
    c.environ_base["REMOTE_ADDR"] = "10.50.0.%d" % next(_ip)
    return c


def token(c):
    return c.get("/api/csrf").get_json()["token"]


def call(c, route, payload=None):
    return c.post(route, json=payload or {}, headers={"X-CSRF-Token": token(c)})


def make_user(email):
    c = new_client()
    assert call(c, "/api/register", {"email": email, "password": PW}).status_code == 201
    return c


def capture(monkeypatch):
    sent = {}
    monkeypatch.setattr("backend.recovery.send_reset_email",
                        lambda to, tok: sent.update(to=to, token=tok))
    return sent


def test_forgot_gives_the_same_answer_for_unknown_emails(monkeypatch):
    sent = capture(monkeypatch)
    make_user("rec1@example.com")
    known = call(new_client(), "/api/forgot", {"email": "rec1@example.com"})
    unknown = call(new_client(), "/api/forgot", {"email": "nobody-here@example.com"})
    assert known.status_code == unknown.status_code == 200
    assert known.get_json() == unknown.get_json()
    assert sent["to"] == "rec1@example.com"


def test_reset_flow_changes_the_password(monkeypatch):
    sent = capture(monkeypatch)
    make_user("rec2@example.com")
    call(new_client(), "/api/forgot", {"email": "rec2@example.com"})
    assert call(new_client(), "/api/reset", {"token": sent["token"], "password": NEW}).status_code == 200

    c = new_client()
    assert call(c, "/api/login", {"email": "rec2@example.com", "password": PW}).status_code == 401
    assert call(c, "/api/login", {"email": "rec2@example.com", "password": NEW}).status_code == 200


def test_reset_link_works_only_once(monkeypatch):
    sent = capture(monkeypatch)
    make_user("rec3@example.com")
    call(new_client(), "/api/forgot", {"email": "rec3@example.com"})
    assert call(new_client(), "/api/reset", {"token": sent["token"], "password": NEW}).status_code == 200
    assert call(new_client(), "/api/reset", {"token": sent["token"], "password": NEW + "x"}).status_code == 400


def test_bad_token_and_weak_password_are_rejected(monkeypatch):
    sent = capture(monkeypatch)
    make_user("rec4@example.com")
    call(new_client(), "/api/forgot", {"email": "rec4@example.com"})
    c = new_client()
    assert call(c, "/api/reset", {"token": "wrong-token", "password": NEW}).status_code == 400
    assert call(c, "/api/reset", {"token": sent["token"], "password": "short"}).status_code == 400
    # a weak attempt does not use up the link
    assert call(c, "/api/reset", {"token": sent["token"], "password": NEW}).status_code == 200


def test_expired_link_is_rejected(monkeypatch):
    sent = capture(monkeypatch)
    make_user("rec5@example.com")
    call(new_client(), "/api/forgot", {"email": "rec5@example.com"})

    with app.app_context():
        row = db.session.execute(
            db.select(PasswordReset).filter_by(token_hash=digest(sent["token"]))
        ).scalar_one()
        row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.session.commit()

    assert call(new_client(), "/api/reset", {"token": sent["token"], "password": NEW}).status_code == 400


def test_old_sessions_end_after_a_reset(monkeypatch):
    sent = capture(monkeypatch)
    old = make_user("rec6@example.com")
    assert old.get("/api/me").status_code == 200
    call(new_client(), "/api/forgot", {"email": "rec6@example.com"})
    call(new_client(), "/api/reset", {"token": sent["token"], "password": NEW})
    assert old.get("/api/me").status_code == 401


def test_forgot_is_rate_limited_per_account(monkeypatch):
    capture(monkeypatch)
    c = new_client()
    codes = [call(c, "/api/forgot", {"email": "rec7@example.com"}).status_code for _ in range(4)]
    assert codes[:3] == [200, 200, 200]
    assert codes[3] == 429