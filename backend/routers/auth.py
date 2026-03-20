from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Organisation, OrgMembership, UsageEvent, User
from services.auth import (
    create_access_token,
    get_current_active_user,
    get_current_membership,
    get_current_org,
    hash_password,
    verify_password,
)
from services.usage import (
    DOCUMENT_INGESTED,
    JOB_CREATED,
    JOB_EXPORTED,
    USER_LOGIN,
    USER_LOGIN_FAILED,
    USER_REGISTERED,
    WORDS_TRANSLATED,
    record_event,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# --- Request / response schemas ---


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None


class UserPublic(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class UserMe(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UsageTotals(BaseModel):
    users_registered: int
    logins: int
    documents_ingested: int
    jobs_created: int
    words_translated: int
    jobs_exported: int


class UsageEventOut(BaseModel):
    id: int
    event_type: str
    user_id: Optional[int]
    job_id: Optional[int]
    document_id: Optional[int]
    meta: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


class UsageResponse(BaseModel):
    totals: UsageTotals
    recent: list[UsageEventOut]


class OrgOut(BaseModel):
    id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


class OrgResponse(BaseModel):
    org: OrgOut
    role: str


# --- Endpoints ---


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user. Email must be unique."""
    normalised_email = body.email.strip().lower()
    if db.query(User).filter(User.email == normalised_email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    user = User(
        email=normalised_email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    record_event(db, USER_REGISTERED, user_id=user.id, meta={"email": user.email})
    return user


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Authenticate with email + password. Returns a Bearer token."""
    user = db.query(User).filter(User.email == form_data.username.strip().lower()).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        record_event(
            db,
            USER_LOGIN_FAILED,
            meta={"email": form_data.username.strip().lower()},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive",
        )
    token = create_access_token(user.id, user.email)
    record_event(db, USER_LOGIN, user_id=user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
        },
    }


@router.get("/me", response_model=UserMe)
def me(current_user: User = Depends(get_current_active_user)):
    """Return the profile of the currently authenticated user."""
    return current_user


@router.get("/org", response_model=OrgResponse)
def get_org(
    current_org: Organisation = Depends(get_current_org),
    membership: OrgMembership = Depends(get_current_membership),
):
    """Return the current user's organisation and their role within it."""
    return OrgResponse(org=current_org, role=membership.role)


@router.get("/usage", response_model=UsageResponse)
def usage(
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Return aggregate usage totals and the 10 most recent events. Admin-intended."""

    def _count(event_type: str) -> int:
        return (
            db.query(func.count(UsageEvent.id))
            .filter(UsageEvent.event_type == event_type)
            .scalar()
            or 0
        )

    def _sum_meta_int(event_type: str, key: str) -> int:
        rows = (
            db.query(UsageEvent.meta)
            .filter(UsageEvent.event_type == event_type)
            .all()
        )
        total = 0
        for (meta,) in rows:
            if isinstance(meta, dict):
                total += int(meta.get(key, 0) or 0)
        return total

    totals = UsageTotals(
        users_registered=_count(USER_REGISTERED),
        logins=_count(USER_LOGIN),
        documents_ingested=_count(DOCUMENT_INGESTED),
        jobs_created=_count(JOB_CREATED),
        words_translated=_sum_meta_int(WORDS_TRANSLATED, "word_count"),
        jobs_exported=_count(JOB_EXPORTED),
    )

    recent_rows = (
        db.query(UsageEvent)
        .order_by(UsageEvent.created_at.desc())
        .limit(10)
        .all()
    )

    return UsageResponse(totals=totals, recent=recent_rows)
