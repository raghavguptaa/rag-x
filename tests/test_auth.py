import itertools

from backend.app import app
from backend.extensions import db
from backend.models import User

_ip = itertools.count(1)
PW = "correct-horse-battery"


def new_client():
    c = app.test_client()
    c.environ_base["REMOTE_ADDR"] = "10.20.0.%d" % next(_ip)
    return c


def token(c):
    return c.get("/api/csrf").get_json()["token"]


def call(c, route, payload=None):
    return c.post(route, json=payload or {}, headers={"X-CSRF-Token": token(c)})


def register(c, email, password=PW):
    return call(c, "/api/register", {"email": email, "password": password})


def test_register_signs_you_in():
    c = new_client()
    assert register(c, "a1@example.com").status_code == 201
    me = c.get("/api/me")
    assert me.status_code == 200
    assert me.get_json()["email"] == "a1@example.com"
    assert "password" not in str(me.get_json()).lower()


def test_password_is_stored_hashed():
    register(new_client(), "a2@example.com")
    with app.app_context():
        user = db.session.execute(db.select(User).filter_by(email="a2@example.com")).scalar_one()
        assert user.password_hash != PW
        assert PW not in user.password_hash
        assert user.password_hash.startswith(("scrypt:", "pbkdf2:"))


def test_duplicate_email_is_rejected():
    register(new_client(), "a3@example.com")
    assert register(new_client(), "a3@example.com").status_code == 409


def test_weak_password_and_bad_email_are_rejected():
    c = new_client()
    assert register(c, "a4@example.com", "short").status_code == 400
    assert register(c, "not-an-email").status_code == 400


def test_login_and_logout_flow():
    email = "a5@example.com"
    register(new_client(), email)

    c = new_client()
    bad = call(c, "/api/login", {"email": email, "password": "wrong-password-here"})
    unknown = call(c, "/api/login", {"email": "nobody@example.com", "password": "wrong-password-here"})
    assert bad.status_code == 401
    assert unknown.status_code == 401
    assert bad.get_json() == unknown.get_json()      # no hint whether the email exists

    assert call(c, "/api/login", {"email": email, "password": PW}).status_code == 200
    assert c.get("/api/me").status_code == 200
    assert call(c, "/api/logout").status_code == 200
    assert c.get("/api/me").status_code == 401


def test_missing_csrf_token_is_blocked():
    c = new_client()
    r = c.post("/api/login", json={"email": "x@example.com", "password": "whatever-long"})
    assert r.status_code == 403


def test_login_is_rate_limited_per_account():
    c = new_client()
    codes = [
        call(c, "/api/login", {"email": "limit@example.com", "password": "wrong-password-here"}).status_code
        for _ in range(9)
    ]
    assert codes[:8] == [401] * 8
    assert codes[8] == 429