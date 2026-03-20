import logging

from database import SessionLocal
from models import Organisation, OrgMembership, User
from services.auth import hash_password

logger = logging.getLogger(__name__)

_ORG_NAME = "Pirmin's Workspace"
_ADMIN_EMAIL = "pirmin@translationapp.com"
_ADMIN_PASSWORD = "Admin1234!"
_ADMIN_FULL_NAME = "Pirmin"


def seed_initial_admin() -> None:
    """Create the default organisation, admin user, and org membership if they do not exist.

    Idempotent — each entity is created only if absent.
    The admin password is intentionally weak and should be changed after first login.
    """
    db = SessionLocal()
    try:
        # 1. Default organisation
        org = db.query(Organisation).filter(Organisation.name == _ORG_NAME).first()
        if not org:
            org = Organisation(name=_ORG_NAME, is_active=True)
            db.add(org)
            db.commit()
            db.refresh(org)
            logger.info("Seeded default organisation: %s", _ORG_NAME)

        # 2. Admin user
        admin = db.query(User).filter(User.email == _ADMIN_EMAIL).first()
        if not admin:
            admin = User(
                email=_ADMIN_EMAIL,
                hashed_password=hash_password(_ADMIN_PASSWORD),
                full_name=_ADMIN_FULL_NAME,
                is_admin=True,
                is_active=True,
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            logger.info("Seeded initial admin user: %s", _ADMIN_EMAIL)

        # 3. Org membership
        membership = (
            db.query(OrgMembership)
            .filter(OrgMembership.org_id == org.id, OrgMembership.user_id == admin.id)
            .first()
        )
        if not membership:
            membership = OrgMembership(org_id=org.id, user_id=admin.id, role="owner")
            db.add(membership)
            db.commit()
            logger.info("Seeded org membership: %s -> %s (owner)", _ADMIN_EMAIL, _ORG_NAME)

    except Exception as exc:
        logger.error("Failed to seed initial data: %s", exc)
        db.rollback()
    finally:
        db.close()
