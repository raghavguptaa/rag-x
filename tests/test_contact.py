import itertools
import os

from backend.app import app

ADMIN = os.environ["ADMIN_EMAIL"]
PW = "correct-horse-battery"
_ip = itertools.count(1)


def new_client():
    c = app.test_client()
    c.environ_base["REMOTE_ADDR"] = "10.30.0.%d" % next(_ip)
    return c


def token(c):
    return c.get("/api/csrf").get_json()["token"]


def call(c, route, payload=None):
    return c.post(route, json=payload or {}, headers={"X-CSRF-Token": token(c)})


def send(c, message="This is a test message for the inbox.", **extra):
    payload = {"name": "Tester", "email": "tester@example.com", "topic": "Feedback", "message": message}
    payload.update(extra)
    return call(c, "/api/contact", payload)


def admin_client():
    c = new_client()
    r = call(c, "/api/register", {"email": ADMIN, "password": PW})
    if r.status_code == 409:
        assert call(c, "/api/login", {"email": ADMIN, "password": PW}).status_code == 200
    return c


def test_visitor_can_send_a_message():
    r = send(new_client(), message="Please add a dark mode toggle to the vault page.")
    assert r.status_code == 201


def test_short_message_and_bad_email_are_rejected():
    c = new_client()
    assert send(c, message="short").status_code == 400
    assert send(c, email="not-an-email").status_code == 400
    assert send(c, message="x" * 2001).status_code == 400


def test_honeypot_messages_are_not_stored():
    r = send(new_client(), message="HONEYPOT-SPAM-TEXT-123456", hp="http://spam.example")
    assert r.status_code == 200
    admin = admin_client()
    bodies = [m["body"] for m in admin.get("/api/admin/messages").get_json()["messages"]]
    assert "HONEYPOT-SPAM-TEXT-123456" not in bodies


def test_inbox_is_admin_only():
    assert new_client().get("/api/admin/messages").status_code == 401
    c = new_client()
    call(c, "/api/register", {"email": "reader@example.com", "password": PW})
    assert c.get("/api/admin/messages").status_code == 404


def test_admin_can_read_mark_and_delete_messages():
    send(new_client(), message="Message for the admin inbox test, please ignore.")
    admin = admin_client()

    messages = admin.get("/api/admin/messages").get_json()["messages"]
    target = next(m for m in messages if "admin inbox test" in m["body"])
    assert target["read"] is False

    assert call(admin, "/api/admin/messages/%d/read" % target["id"], {"read": True}).status_code == 200
    messages = admin.get("/api/admin/messages").get_json()["messages"]
    assert next(m for m in messages if m["id"] == target["id"])["read"] is True

    r = admin.delete("/api/admin/messages/%d" % target["id"], headers={"X-CSRF-Token": token(admin)})
    assert r.status_code == 200
    messages = admin.get("/api/admin/messages").get_json()["messages"]
    assert all(m["id"] != target["id"] for m in messages)


def test_contact_is_rate_limited():
    c = new_client()
    codes = [send(c).status_code for _ in range(6)]
    assert codes[:5] == [201] * 5
    assert codes[5] == 429

def test_me_reports_admin_and_unread_count():
    admin = admin_client()
    assert admin.get("/api/me").get_json()["is_admin"] is True
    assert admin.get("/api/admin/unread").get_json()["unread"] >= 0

    c = new_client()
    call(c, "/api/register", {"email": "plain@example.com", "password": PW})
    assert c.get("/api/me").get_json()["is_admin"] is False
    assert c.get("/api/admin/unread").status_code == 404