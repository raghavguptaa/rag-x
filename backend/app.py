import io
import os
from datetime import timedelta

from flask import Flask, request, send_file, send_from_directory, jsonify, abort, make_response
from pypdf import PdfReader, PdfWriter
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import secure_filename

from .extensions import db, limiter
from .auth import bp as auth_bp
from .contact import bp as contact_bp
from .activity import bp as activity_bp
from .admin import bp as admin_bp
from .recovery import bp as recovery_bp
from . import models  # noqa: F401  (registers the database tables)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_FOLDER = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))

# Hosting platforms set PORT; locally it is not set
IS_PROD = bool(os.environ.get("PORT"))

secret_key = os.environ.get("SECRET_KEY")
if not secret_key:
    if IS_PROD:
        raise RuntimeError("SECRET_KEY environment variable is required in production")
    secret_key = "dev-only-secret-change-me"

db_url = os.environ.get("DATABASE_URL")
if db_url:
    if db_url.startswith("postgres://"):
        db_url = "postgresql://" + db_url[len("postgres://"):]
else:
    db_url = "sqlite:///" + os.path.join(BASE_DIR, "ragx.db").replace("\\", "/")

app = Flask(__name__, static_folder=None)

app.config.update(
    SECRET_KEY=secret_key,
    SQLALCHEMY_DATABASE_URI=db_url,
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    MAX_CONTENT_LENGTH=20 * 1024 * 1024,        # 20 MB uploads
    SESSION_COOKIE_HTTPONLY=True,                # JavaScript cannot read the cookie
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=IS_PROD,               # HTTPS only when deployed
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),
)

# Trust the hosting proxy (Render) so rate limiting sees the real visitor IP
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

db.init_app(app)
limiter.init_app(app)
app.register_blueprint(auth_bp)
app.register_blueprint(contact_bp)
app.register_blueprint(activity_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(recovery_bp)

with app.app_context():
    db.create_all()

CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src https://fonts.gstatic.com; "
    "img-src 'self' data:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)


# ================= SECURITY HEADERS =================
@app.after_request
def add_security_headers(resp):
    resp.headers["Content-Security-Policy"] = CSP
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    resp.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.is_secure:
        resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if request.path in ("/lock-file", "/unlock-file") or request.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


# ================= ERROR HANDLERS =================
@app.errorhandler(413)
def too_large(e):
    return jsonify(error="File too large (max 20 MB)"), 413


@app.errorhandler(429)
def rate_limited(e):
    return jsonify(error="Too many requests. Try again in a few minutes."), 429


@app.errorhandler(404)
def not_found(e):
    return jsonify(error="Not found"), 404


# ================= SERVE FRONTEND =================
@app.route("/")
def home():
    return send_from_directory(FRONTEND_FOLDER, "index.html")


@app.route("/health")
@limiter.exempt
def health():
    return "ok"


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(FRONTEND_FOLDER, path)


# ================= HELPERS =================
def bad_request(message):
    abort(make_response(jsonify(error=message), 400))


def read_pdf_upload():
    file = request.files.get("file")
    password = request.form.get("password", "")

    if file is None or not file.filename:
        bad_request("No file uploaded")
    if not password or len(password) > 128:
        bad_request("Password must be between 1 and 128 characters")

    data = file.read()
    if not data.startswith(b"%PDF-"):
        bad_request("Only PDF files are allowed")

    base = secure_filename(os.path.splitext(file.filename)[0]) or "document"
    return base, data, password


# ================= LOCK PDF =================
@app.route("/lock-file", methods=["POST"])
@limiter.limit("10 per minute")
def lock_file():
    base, data, password = read_pdf_upload()

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            return jsonify(error="This PDF is already locked"), 400

        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)

        writer.encrypt(password, algorithm="AES-256")

        output = io.BytesIO()
        writer.write(output)
        output.seek(0)
    except Exception as e:
        app.logger.warning("PDF lock failed: %s", type(e).__name__)
        return jsonify(error="Could not process this PDF"), 400

    return send_file(
        output,
        as_attachment=True,
        download_name=base + "_locked.pdf",
        mimetype="application/pdf",
    )


# ================= UNLOCK PDF =================
@app.route("/unlock-file", methods=["POST"])
@limiter.limit("10 per minute")
def unlock_file():
    base, data, password = read_pdf_upload()

    try:
        reader = PdfReader(io.BytesIO(data))
        if not reader.is_encrypted:
            return jsonify(error="This PDF is not locked"), 400

        if reader.decrypt(password) == 0:
            return jsonify(error="Wrong password"), 400

        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)

        output = io.BytesIO()
        writer.write(output)
        output.seek(0)
    except Exception as e:
        app.logger.warning("PDF unlock failed: %s", type(e).__name__)
        return jsonify(error="Wrong password or damaged file"), 400

    return send_file(
        output,
        as_attachment=True,
        download_name=base + "_unlocked.pdf",
        mimetype="application/pdf",
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    # Only expose to the network when deployed (hosting sets PORT)
    host = "0.0.0.0" if os.environ.get("PORT") else "127.0.0.1"
    app.run(host=host, port=port)