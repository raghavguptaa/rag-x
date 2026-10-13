import io

from pypdf import PdfReader, PdfWriter

from backend.app import app


def make_pdf():
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def post(client, route, data, name, password):
    return client.post(
        route,
        data={"file": (io.BytesIO(data), name), "password": password},
        content_type="multipart/form-data",
    )


def test_home_page_loads_with_security_headers():
    client = app.test_client()
    r = client.get("/")
    assert r.status_code == 200
    assert "Content-Security-Policy" in r.headers
    assert r.headers["X-Content-Type-Options"] == "nosniff"


def test_lock_then_unlock_roundtrip():
    client = app.test_client()

    locked = post(client, "/lock-file", make_pdf(), "doc.pdf", "S3cret!pass")
    assert locked.status_code == 200
    assert PdfReader(io.BytesIO(locked.data)).is_encrypted

    unlocked = post(client, "/unlock-file", locked.data, "doc_locked.pdf", "S3cret!pass")
    assert unlocked.status_code == 200
    assert not PdfReader(io.BytesIO(unlocked.data)).is_encrypted


def test_wrong_password_is_rejected():
    client = app.test_client()
    locked = post(client, "/lock-file", make_pdf(), "doc.pdf", "S3cret!pass")
    r = post(client, "/unlock-file", locked.data, "doc_locked.pdf", "wrong-password")
    assert r.status_code == 400


def test_non_pdf_is_rejected():
    client = app.test_client()
    r = post(client, "/lock-file", b"just some text", "notes.pdf", "S3cret!pass")
    assert r.status_code == 400


def test_missing_file_is_rejected():
    client = app.test_client()
    r = client.post("/lock-file", data={"password": "abc"})
    assert r.status_code == 400


def test_path_traversal_is_blocked():
    client = app.test_client()
    r = client.get("/%2e%2e/backend/app.py")
    assert r.status_code != 200