from datetime import datetime, timezone

from .extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(254), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

class Message(db.Model):
        __tablename__ = "Messages"

        id = db.Column(db.Integer, primary_key=True)
        name = db.Column(db.String(80), nullable=False, default="")
        email = db.Column(db.String(254), nullable=False, default="")
        topic = db.Column(db.String(30), nullable=False, default="Other")
        body = db.Column(db.Text, nullable=False)
        is_read = db.Column(db.Boolean, nullable=False, default=False)
        created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False, index=True)

class Activity(db.Model):
    __tablename__ = "activity"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    tool = db.Column(db.String(20), nullable=False)
    action = db.Column(db.String(20), nullable=False)
    size_bytes = db.Column(db.BigInteger, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False, index=True)

class PasswordReset(db.Model):
    __tablename__ = "password_resets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    token_hash = db.Column(db.String(64), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)