import logging

from database import SessionLocal
from models import User
from services.auth import hash_password

logger = logging.getLogger(__name__)

_ADMIN_EMAIL = "pirmin@translationapp.com"
_ADMIN_PASSWORD = "Admin1234!"
_ADMIN_FULL_NAME = "Pirmin"


def seed_initial_admin() -> None:
    """Create an initial admin user if the users table is empty.

    This is idempotent — it does nothing when at least one user already exists.
    The admin password is intentionally weak and should be changed after first login.
    """
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            return
        admin = User(
            email=_ADMIN_EMAIL,
            hashed_password=hash_password(_ADMIN_PASSWORD),
            full_name=_ADMIN_FULL_NAME,
            is_admin=True,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        logger.info("Seeded initial admin user: %s", _ADMIN_EMAIL)
    except Exception as exc:
        logger.error("Failed to seed admin user: %s", exc)
        db.rollback()
    finally:
        db.close()
