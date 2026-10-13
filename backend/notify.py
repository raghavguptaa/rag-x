import logging
import os
import smtplib
import threading
from email.message import EmailMessage

log = logging.getLogger("ragx.notify")


def _settings():
    return {
        "host": os.environ.get("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": os.environ.get("SMTP_USER", "").strip(),
        "password": os.environ.get("SMTP_PASSWORD", "").replace(" ", ""),
        "owner": (os.environ.get("NOTIFY_EMAIL") or os.environ.get("ADMIN_EMAIL", "")).strip(),
    }


def _configured(cfg):
    return bool(cfg["user"] and cfg["password"])


def _send(cfg, to, subject, body, reply_to=None):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = cfg["user"]
    msg["To"] = to
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)
    try:
        with smtplib.SMTP(cfg["host"], cfg["port"], timeout=15) as server:
            server.starttls()
            server.login(cfg["user"], cfg["password"])
            server.send_message(msg)
    except Exception as e:
        log.warning("Email failed: %s", type(e).__name__)


def _send_in_background(cfg, to, subject, body, reply_to=None):
    # sent in the background so visitors never wait for the mail server
    threading.Thread(target=_send, args=(cfg, to, subject, body, reply_to), daemon=True).start()


def notify_new_message(topic, name, email, text):
    """Email the site owner about a new contact message. Does nothing if not configured."""
    cfg = _settings()
    if not (_configured(cfg) and cfg["owner"]):
        return
    subject = "[Rag X] New message: " + topic
    body = (
        "New message on Rag X\n\n"
        "Topic: " + topic + "\n"
        "Name: " + (name or "not given") + "\n"
        "Email: " + (email or "not given") + "\n\n"
        + text + "\n\n"
        "Read and manage it in your inbox page: /admin.html\n"
    )
    _send_in_background(cfg, cfg["owner"], subject, body, email)


def send_user_email(to, subject, body):
    """Email a user. Returns False when email is not configured."""
    cfg = _settings()
    if not _configured(cfg):
        return False
    _send_in_background(cfg, to, subject, body)
    return True