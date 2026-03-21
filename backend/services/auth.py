import os
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db
from models import Organisation, OrgMembership, User

# Fail hard at startup if SECRET_KEY is not configured.
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY environment variable is not set. "
        "Set it before starting the application."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    """Hash a plaintext password using argon2."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against an argon2 hash."""
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int, email: str) -> str:
    """Create a signed JWT with a 7-day expiry."""
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and verify a JWT. Raises 401 on any failure."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: resolve the Bearer token to a User record."""
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """FastAPI dependency: like get_current_user but also checks is_active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account",
        )
    return current_user


def get_current_membership(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> OrgMembership:
    """FastAPI dependency: return the OrgMembership for the current user. Raises 403 if none."""
    membership = (
        db.query(OrgMembership)
        .filter(OrgMembership.user_id == current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not belong to any organisation. Create one at POST /auth/org or ask to be invited.",
        )
    return membership


def get_current_org(
    membership: OrgMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> Organisation:
    """FastAPI dependency: return the Organisation the current user belongs to. Raises 403 if none."""
    org = db.query(Organisation).filter(Organisation.id == membership.org_id).first()
    if not org or not org.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organisation not found or inactive",
        )
    return org


VALID_ORG_ROLES: frozenset[str] = frozenset({"owner", "admin", "translator", "reviewer"})


def require_org_role(required_roles: list[str]):
    """Return a FastAPI dependency that raises 403 if the current user's role is not in required_roles.

    Usage::

        membership: OrgMembership = Depends(require_org_role(["owner", "admin"]))
    """
    def _check(membership: OrgMembership = Depends(get_current_membership)) -> OrgMembership:
        if membership.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This operation requires one of these roles: {', '.join(required_roles)}",
            )
        return membership
    return _check
