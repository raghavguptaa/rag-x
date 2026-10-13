import itertools
import os

from backend.app import app

ADMIN = os.environ["ADMIN_EMAIL"]
PW = "correct-horse-battery"
_ip = itertools.count(1)


def new_client():
    c = app.test_client()
    c.environ_base["REMOTE_ADDR"] = "10.60.0.%d" % next(_ip)
    return c


def token(c):
    return c.get("/api/csrf").get_json()["token"]


def call(c, route, payload=None):
    return c.post(route, json=payload or {}, headers={"X-CSRF-Token": token(c)})


def admin_client():
    c = new_client()
    r = call(c, "/api/register", {"email": ADMIN, "password": PW})
    if r.status_code == 409:
        assert call(c, "/api/login", {"email": ADMIN, "password": PW}).status_code == 200
    return c


def test_admin_stats_and_users_are_admin_only():
    assert new_client().get("/api/admin/stats").status_code == 401
    c = new_client()
    call(c, "/api/register", {"email": "adm-plain@example.com", "password": PW})
    assert c.get("/api/admin/stats").status_code == 404
    assert c.get("/api/admin/users").status_code == 404


def test_admin_sees_user_counts():
    for n in (1, 2):
        call(new_client(), "/api/register", {"email": "cnt%d@example.com" % n, "password": PW})
    admin = admin_client()

    s = admin.get("/api/admin/stats").get_json()
    assert s["total_users"] >= 3
    assert len(s["signups"]) == 14
    assert s["new_7d"] >= 3

    users = admin.get("/api/admin/users").get_json()["users"]
    assert "cnt1@example.com" in [u["email"] for u in users]
    assert "password" not in str(users).lower()