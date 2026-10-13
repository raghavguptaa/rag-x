import itertools

from backend.app import app

PW = "correct-horse-battery"
_ip = itertools.count(1)


def new_client():
    c = app.test_client()
    c.environ_base["REMOTE_ADDR"] = "10.40.0.%d" % next(_ip)
    return c


def token(c):
    return c.get("/api/csrf").get_json()["token"]


def call(c, route, payload=None):
    return c.post(route, json=payload or {}, headers={"X-CSRF-Token": token(c)})


def signed_in(email):
    c = new_client()
    assert call(c, "/api/register", {"email": email, "password": PW}).status_code == 201
    return c


def log(c, tool, action, size=100):
    return call(c, "/api/activity", {"tool": tool, "action": action, "size": size})


def test_anonymous_cannot_log_or_read():
    c = new_client()
    assert log(c, "text", "encrypt").status_code == 401
    assert c.get("/api/activity/summary").status_code == 401


def test_logged_activity_shows_in_summary():
    c = signed_in("act1@example.com")
    assert log(c, "text", "encrypt", 120).status_code == 201
    assert log(c, "text", "decrypt", 120).status_code == 201
    assert log(c, "pdf", "lock", 5000).status_code == 201

    s = c.get("/api/activity/summary?tz=330").get_json()
    assert s["total"] == 3
    assert s["last7"] == 3
    assert s["bytes"] == 5240
    assert s["top_tool"] == "text"
    assert len(s["per_day"]) == 14
    assert s["per_day"][-1]["count"] == 3
    assert s["recent"][0]["tool"] == "pdf"


def test_invalid_activity_is_rejected():
    c = signed_in("act2@example.com")
    assert log(c, "text", "lock").status_code == 400
    assert log(c, "nope", "encrypt").status_code == 400
    assert log(c, "", "").status_code == 400


def test_bad_sizes_are_cleaned():
    c = signed_in("act3@example.com")
    assert call(c, "/api/activity", {"tool": "hash", "action": "hash", "size": "abc"}).status_code == 201
    assert call(c, "/api/activity", {"tool": "hash", "action": "hash", "size": -5}).status_code == 201
    assert call(c, "/api/activity", {"tool": "hash", "action": "hash", "size": 10 ** 15}).status_code == 201
    s = c.get("/api/activity/summary").get_json()
    assert s["total"] == 3
    assert s["bytes"] == 10 ** 12


def test_users_only_see_their_own_activity():
    a = signed_in("act4@example.com")
    b = signed_in("act5@example.com")
    log(a, "file", "encrypt")
    assert a.get("/api/activity/summary").get_json()["total"] == 1
    assert b.get("/api/activity/summary").get_json()["total"] == 0


def test_user_can_delete_their_history():
    c = signed_in("act6@example.com")
    log(c, "vault", "encrypt")
    log(c, "vault", "decrypt")
    r = c.delete("/api/activity", headers={"X-CSRF-Token": token(c)})
    assert r.status_code == 200
    assert c.get("/api/activity/summary").get_json()["total"] == 0


def test_history_is_capped(monkeypatch):
    monkeypatch.setattr("backend.activity.MAX_PER_USER", 3)
    c = signed_in("act7@example.com")
    for _ in range(5):
        log(c, "text", "encrypt")
    assert c.get("/api/activity/summary").get_json()["total"] == 3