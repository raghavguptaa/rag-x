import os

# Tests use a throwaway in-memory database
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.pop("PORT", None)
os.environ["ADMIN_EMAIL"] = "admin@example.com"