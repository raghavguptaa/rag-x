<h1 align="center">Rag X</h1>

<p align="center">
  A browser-based encryption toolkit for text, files and PDFs, with optional accounts,
  a contact inbox and a metadata-only activity dashboard.
</p>

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white">
  <img alt="Flask" src="https://img.shields.io/badge/Flask-3.x-000000?logo=flask&logoColor=white">
  <img alt="Encryption" src="https://img.shields.io/badge/AES--256--GCM-PBKDF2-8b5cf6">
  <img alt="Tests" src="https://img.shields.io/badge/tests-36%20passing-brightgreen">
</p>


---

## Overview

Rag X lets you protect sensitive data with standard, well-reviewed cryptography. Text, file and
vault encryption run **entirely in your browser** using the Web Crypto API, so your data and keys
never leave your device. Only PDF protection and the optional account features use the server.

<!--
Add screenshots once you have them: create a docs/screenshots folder, save your images there,
remove this comment markers and adjust the file names.

![Home page](docs/screenshots/home.png)
![Toolkit](docs/screenshots/toolkit.png)
![Dashboard](docs/screenshots/dashboard.png)
-->

## Features

| Area | What it does |
|---|---|
| **Text Cipher** | AES-256-GCM encryption in the browser, with a fresh key and IV for every message |
| **File Cipher** | Encrypt any file locally and download a key package for later decryption |
| **Password Vault** | Password-based encryption using PBKDF2-HMAC-SHA256 (600,000 iterations); original file names are encrypted too |
| **PDF Protection** | Lock and unlock PDFs with AES-256 password protection |
| **Security Tools** | Secure password generator with an entropy meter, and a SHA-256/384/512 hash checker |
| **Accounts** | Register, sign in, sign out, forgot-password reset by email |
| **Dashboard** | Personal usage statistics: totals, a 14-day chart and a recent timeline (metadata only, pausable and deletable) |
| **Contact inbox** | Visitors send messages that are stored privately; the site owner reads, replies to and deletes them in an admin panel |
| **Admin panel** | Registered-user counts, new sign-ups, weekly active users and the message inbox |

## Security design

| Concern | Approach |
|---|---|
| Encryption | AES-256-GCM with a random IV per operation; authenticated file headers detect tampering |
| Key derivation | PBKDF2-HMAC-SHA256, 600,000 iterations, random salt |
| Password storage | Hashed with scrypt; login timing is equalized and error messages are generic |
| Sessions | Signed, HttpOnly, SameSite=Lax cookies; sessions end when a password changes |
| CSRF | Token required on every state-changing request |
| Brute force | Rate limits per IP and per account on login, registration, contact and reset |
| Password reset | Random tokens stored only as SHA-256 hashes; single-use; 30-minute expiry; link built from a configured site URL |
| Headers | Strict Content Security Policy, X-Frame-Options, X-Content-Type-Options and more |
| Uploads | 20 MB limit; PDFs verified by content, not by file name |
| Privacy | The server never stores messages, files, keys or vault passwords. The activity log keeps only tool, action, size and time |

## Tech stack

- **Backend:** Python, Flask, Flask-SQLAlchemy, Flask-Limiter, pypdf, gunicorn
- **Frontend:** HTML, CSS and vanilla JavaScript (Web Crypto API), no frameworks
- **Database:** SQLite locally; PostgreSQL planned for hosting
- **Testing:** pytest

## Project structure

```
rag-x/
├── backend/
│   ├── app.py            Flask app, security headers, PDF routes
│   ├── auth.py           Registration, sign-in, sessions, CSRF
│   ├── recovery.py       Forgot / reset password
│   ├── contact.py        Contact form and admin inbox API
│   ├── admin.py          Admin statistics and user list
│   ├── activity.py       Metadata-only activity log
│   ├── notify.py         Email sending (SMTP)
│   ├── models.py         Database models
│   └── extensions.py     Database and rate limiter setup
├── frontend/             Pages, styles and scripts
├── tests/                Automated tests
├── requirements.txt
└── Procfile
```

## Run locally

**1. Clone and install**

```bash
git clone https://github.com/raghavguptaa/rag-x.git
cd rag-x
python -m venv venv
```

Activate the environment: `venv\Scripts\activate` on Windows, or `source venv/bin/activate` on macOS and Linux. Then:

```bash
pip install -r requirements.txt
```

**2. Start the app**

```bash
python -m backend.app
```

Open <http://127.0.0.1:5000>.

**3. Optional: admin panel and email**

Set these in the same terminal **before** starting the app (PowerShell shown):

```powershell
$env:ADMIN_EMAIL = "you@example.com"        # this account can open the admin panel
$env:SITE_URL = "http://127.0.0.1:5000"     # used in password reset links
$env:SMTP_USER = "you@gmail.com"            # optional: sends reset links and message alerts
$env:SMTP_PASSWORD = "your-app-password"    # a Google app password, never your real password
python -m backend.app
```

Without SMTP settings, password reset links are printed in the terminal (development only).

## Environment variables

| Name | Purpose |
|---|---|
| `SECRET_KEY` | Signs session cookies. **Required in production**; generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ADMIN_EMAIL` | The account allowed to open the admin panel |
| `SITE_URL` | Public address used in password reset links |
| `DATABASE_URL` | Database connection string (SQLite is used when unset) |
| `SMTP_USER`, `SMTP_PASSWORD` | Gmail address and app password for outgoing email |
| `SMTP_HOST`, `SMTP_PORT` | Optional; default to `smtp.gmail.com` and `587` |
| `NOTIFY_EMAIL` | Optional; where new-message alerts go (defaults to `ADMIN_EMAIL`) |

Never commit secrets. `.env`, database files and local start scripts are listed in `.gitignore`.

## Tests

```bash
python -m pytest -q
```

The suite covers authentication, CSRF protection, rate limiting, PDF locking, the contact inbox, admin access control, the activity log and the password reset flow.

## Deployment

Rag X is **not deployed yet**. The plan is Render for the web service and a managed PostgreSQL
database, with `SECRET_KEY`, `ADMIN_EMAIL`, `SITE_URL` and `DATABASE_URL` set as environment variables.
The start command is:

```bash
gunicorn backend.app:app --workers 1 --threads 4 --timeout 60
```

## Roadmap

- [x] Redesigned interface, landing page and animated background
- [x] Password vault, password generator and hash checker
- [x] Hardened backend: rate limiting, CSP, upload limits, AES-256 PDFs
- [x] Accounts, activity dashboard, contact inbox and admin panel
- [x] Forgot-password flow
- [ ] Two-factor authentication
- [ ] Email verification on sign-up
- [ ] Public deployment with a managed database
- [ ] Screenshots and a short demo video

## Limitations

Rag X is a learning and portfolio project built on standard cryptography. It has **not** been
independently audited. For critical secrets, use professionally audited tools.


## Author

**Raghav Gupta**, computer science student (B.Tech, cybersecurity focus), Ghaziabad, India.
GitHub: [@raghavguptaa](https://github.com/raghavguptaa) · Email: okraghavgupta@gmail.com
