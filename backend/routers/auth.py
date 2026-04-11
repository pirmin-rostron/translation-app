import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Organisation, OrgMembership, OrgWebhook, PasswordResetToken, UsageEvent, User
from services.auth import (
    VALID_ORG_ROLES,
    create_access_token,
    get_current_active_user,
    get_current_membership,
    get_current_org,
    hash_password,
    require_org_role,
    verify_password,
)
from services.usage import (
    DOCUMENT_INGESTED,
    JOB_CREATED,
    JOB_EXPORTED,
    ORG_CREATED,
    USER_DELETED,
    USER_LOGIN,
    USER_LOGIN_FAILED,
    USER_REGISTERED,
    WORDS_TRANSLATED,
    record_event,
)

from limiter import limiter

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
    tier: str = "free"
    jobs_this_month: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class OrgResponse(BaseModel):
    org: OrgOut
    role: str


class TierResponse(BaseModel):
    tier: str
    jobs_this_month: int
    limits: dict


class OrgCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class UpdateMeRequest(BaseModel):
    full_name: Optional[str] = None


class InviteRequest(BaseModel):
    email: str
    role: str
    full_name: Optional[str] = None


class UserInviteOut(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class InviteResponse(BaseModel):
    user: UserInviteOut
    role: str
    is_new_user: bool
    temporary_password: Optional[str] = None


class MemberOut(BaseModel):
    user_id: int
    email: str
    full_name: Optional[str]
    role: str
    joined_at: datetime


class UpdateRoleRequest(BaseModel):
    role: str


class MembershipOut(BaseModel):
    user_id: int
    role: str
    joined_at: datetime

    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class AuditEventOut(BaseModel):
    id: int
    event_type: str
    user_id: Optional[int]
    job_id: Optional[int]
    document_id: Optional[int]
    org_id: Optional[int]
    meta: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    total: int
    offset: int
    limit: int
    events: list[AuditEventOut]


class WebhookCreateRequest(BaseModel):
    url: str


class WebhookOut(BaseModel):
    id: int
    org_id: int
    url: str
    is_active: bool
    created_at: datetime
    created_by_user_id: Optional[int]

    class Config:
        from_attributes = True


class WebhookCreateResponse(WebhookOut):
    secret: str


class PasswordResetRequestBody(BaseModel):
    email: str


class PasswordResetConfirmBody(BaseModel):
    token: str
    new_password: str


class PasswordResetRequestResponse(BaseModel):
    message: str
    # Temporary: reset_token is returned directly until email delivery is implemented.
    # When email infrastructure is added, remove this field and send the token by email instead.
    reset_token: Optional[str] = None


# --- Endpoints ---


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
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
@limiter.limit("10/minute")
def login(
    request: Request,
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


@router.patch("/me", response_model=UserMe)
def update_me(
    data: UpdateMeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update mutable profile fields for the currently authenticated user.

    Currently supports: full_name. Fields omitted from the request body are
    left unchanged. Returns the updated user object.
    """
    if data.full_name is not None:
        current_user.full_name = data.full_name
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/refresh")
def refresh_token(current_user: User = Depends(get_current_active_user)):
    """Issue a fresh token for the current authenticated user. Call this before the existing
    token expires to maintain the session."""
    token = create_access_token(current_user.id, current_user.email)
    return {"access_token": token, "token_type": "bearer"}


@router.delete("/me")
def delete_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Anonymise the current user's account in compliance with GDPR right-to-erasure.

    This is a soft anonymisation rather than a hard delete, to preserve referential
    integrity with UsageEvent, TranslationJob, and other org-owned records. The user
    row is retained but all personally-identifiable fields are overwritten:

    - email → "deleted_{id}@deleted.invalid" (unique, clearly synthetic)
    - full_name → None
    - hashed_password → a random hex string (not a valid hash — login always fails)
    - is_active → False

    OrgMembership rows are deleted so the user no longer appears in any org.
    The audit event is recorded with user_id=None (already anonymised at commit time).
    Existing JWT tokens remain valid until their 7-day expiry — acceptable given the
    account is immediately deactivated and the password invalidated.
    """
    unusable_hash = secrets.token_hex(32)

    # Capture org_id before removing memberships, for the audit event.
    membership = db.query(OrgMembership).filter(OrgMembership.user_id == current_user.id).first()
    org_id = membership.org_id if membership else None

    current_user.email = f"deleted_{current_user.id}@deleted.invalid"
    current_user.full_name = None
    current_user.hashed_password = unusable_hash
    current_user.is_active = False

    db.query(OrgMembership).filter(OrgMembership.user_id == current_user.id).delete(
        synchronize_session=False
    )

    db.commit()

    record_event(db, USER_DELETED, user_id=None, org_id=org_id)

    return {"message": "Your account has been deleted. You will be logged out shortly."}


@router.post("/change-password")
@limiter.limit("5/minute")
def change_password(
    request: Request,
    body: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Change the authenticated user's password.

    Verifies the current password before applying the change. The new password
    must be at least 8 characters. The password hash is never returned.
    """
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    if len(body.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password must be at least 8 characters",
        )
    current_user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


@router.post("/org", response_model=OrgResponse, status_code=status.HTTP_201_CREATED)
def create_org(
    body: OrgCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new organisation and make the current user its owner.

    Fails with 409 if the user already belongs to an organisation.
    """
    existing = db.query(OrgMembership).filter(OrgMembership.user_id == current_user.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already belong to an organisation. Leave your current organisation before creating a new one.",
        )
    org = Organisation(name=body.name.strip(), is_active=True)
    db.add(org)
    db.flush()  # populate org.id before creating membership
    membership = OrgMembership(org_id=org.id, user_id=current_user.id, role="owner")
    db.add(membership)
    db.commit()
    db.refresh(org)
    record_event(db, ORG_CREATED, user_id=current_user.id, org_id=org.id)
    return OrgResponse(org=org, role="owner")


@router.get("/org", response_model=OrgResponse)
def get_org(
    current_org: Organisation = Depends(get_current_org),
    membership: OrgMembership = Depends(get_current_membership),
):
    """Return the current user's organisation and their role within it."""
    return OrgResponse(org=current_org, role=membership.role)


@router.get("/tier", response_model=TierResponse)
def get_tier(
    current_org: Organisation = Depends(get_current_org),
):
    """Return the org's current tier, usage, and feature limits."""
    from services.tier import get_tier_limits
    return TierResponse(
        tier=current_org.tier,
        jobs_this_month=current_org.jobs_this_month or 0,
        limits=get_tier_limits(current_org.tier),
    )


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


@router.post("/invite", response_model=InviteResponse)
@limiter.limit("20/minute")
def invite_user(
    request: Request,
    body: InviteRequest,
    response: Response,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
    acting_membership: OrgMembership = Depends(require_org_role(["owner", "admin"])),
):
    """Invite a user to the current organisation.

    If the user does not exist, a new account is created with a random temporary
    password returned in the response — this is the only time it is visible.
    If the user already exists but is not a member, they are added to the org.
    Returns 201 for new users and 200 for existing users added to the org.
    """
    if body.role not in VALID_ORG_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role. Must be one of: {', '.join(sorted(VALID_ORG_ROLES))}",
        )

    normalised_email = body.email.strip().lower()
    existing_user = db.query(User).filter(User.email == normalised_email).first()

    if existing_user:
        existing_membership = (
            db.query(OrgMembership)
            .filter(
                OrgMembership.org_id == current_org.id,
                OrgMembership.user_id == existing_user.id,
            )
            .first()
        )
        if existing_membership:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a member of this organisation",
            )
        db.add(OrgMembership(org_id=current_org.id, user_id=existing_user.id, role=body.role))
        db.commit()
        response.status_code = status.HTTP_200_OK
        return InviteResponse(
            user=UserInviteOut(
                id=existing_user.id,
                email=existing_user.email,
                full_name=existing_user.full_name,
                is_active=existing_user.is_active,
            ),
            role=body.role,
            is_new_user=False,
        )

    temporary_password = secrets.token_hex(16)
    new_user = User(
        email=normalised_email,
        hashed_password=hash_password(temporary_password),
        full_name=body.full_name,
        is_active=True,
    )
    db.add(new_user)
    db.flush()
    db.add(OrgMembership(org_id=current_org.id, user_id=new_user.id, role=body.role))
    db.commit()
    db.refresh(new_user)
    record_event(db, USER_REGISTERED, user_id=new_user.id, org_id=current_org.id, meta={"email": new_user.email, "invited": True})
    response.status_code = status.HTTP_201_CREATED
    return InviteResponse(
        user=UserInviteOut(
            id=new_user.id,
            email=new_user.email,
            full_name=new_user.full_name,
            is_active=new_user.is_active,
        ),
        role=body.role,
        is_new_user=True,
        temporary_password=temporary_password,
    )


@router.get("/org/members", response_model=list[MemberOut])
def list_org_members(
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Return all members of the current user's organisation with their roles."""
    rows = (
        db.query(OrgMembership, User)
        .join(User, OrgMembership.user_id == User.id)
        .filter(OrgMembership.org_id == current_org.id)
        .all()
    )
    return [
        MemberOut(
            user_id=m.user_id,
            email=u.email,
            full_name=u.full_name,
            role=m.role,
            joined_at=m.joined_at,
        )
        for m, u in rows
    ]


@router.patch("/org/members/{user_id}", response_model=MembershipOut)
def update_member_role(
    user_id: int,
    body: UpdateRoleRequest,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
    acting_membership: OrgMembership = Depends(require_org_role(["owner", "admin"])),
):
    """Update the role of a member within the current organisation.

    Requires owner or admin role. Admins cannot change the org owner's role —
    that operation is reserved for the owner. Users cannot change their own role.
    """
    if body.role not in VALID_ORG_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role. Must be one of: {', '.join(sorted(VALID_ORG_ROLES))}",
        )
    if user_id == acting_membership.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own role",
        )
    target = (
        db.query(OrgMembership)
        .filter(OrgMembership.org_id == current_org.id, OrgMembership.user_id == user_id)
        .first()
    )
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this organisation",
        )
    if target.role == "owner" and acting_membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can change the owner's role",
        )
    target.role = body.role
    db.commit()
    db.refresh(target)
    return target


@router.delete("/org/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_org_member(
    user_id: int,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
    acting_membership: OrgMembership = Depends(require_org_role(["owner", "admin"])),
):
    """Remove a member from the organisation. Does not delete the User record.

    Cannot remove yourself or the org owner.
    """
    if user_id == acting_membership.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove yourself from the organisation",
        )
    target = (
        db.query(OrgMembership)
        .filter(OrgMembership.org_id == current_org.id, OrgMembership.user_id == user_id)
        .first()
    )
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this organisation",
        )
    if target.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the organisation owner",
        )
    db.delete(target)
    db.commit()


@router.get("/org/audit", response_model=AuditLogResponse)
def get_org_audit_log(
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    event_type: Optional[str] = Query(default=None),
):
    """Return a paginated audit log of usage events scoped to the current organisation."""
    q = db.query(UsageEvent).filter(UsageEvent.org_id == current_org.id)
    if event_type is not None:
        q = q.filter(UsageEvent.event_type == event_type)
    total = q.count()
    events = q.order_by(UsageEvent.created_at.desc()).offset(offset).limit(limit).all()
    return AuditLogResponse(total=total, offset=offset, limit=limit, events=events)


@router.post("/org/webhooks", response_model=WebhookCreateResponse, status_code=status.HTTP_201_CREATED)
def create_webhook(
    body: WebhookCreateRequest,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
    current_user: User = Depends(get_current_active_user),
    acting_membership: OrgMembership = Depends(require_org_role(["owner", "admin"])),
):
    """Register a webhook URL for the organisation. Requires owner or admin role.

    The signing secret is auto-generated and returned only in this response — store it securely.
    """
    hook = OrgWebhook(
        org_id=current_org.id,
        url=body.url,
        secret=secrets.token_hex(32),
        created_by_user_id=current_user.id,
    )
    db.add(hook)
    db.commit()
    db.refresh(hook)
    return hook


@router.get("/org/webhooks", response_model=list[WebhookOut])
def list_webhooks(
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
    acting_membership: OrgMembership = Depends(require_org_role(["owner", "admin"])),
):
    """List all webhooks registered for the organisation."""
    return db.query(OrgWebhook).filter(OrgWebhook.org_id == current_org.id).all()


@router.delete("/org/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(
    webhook_id: int,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
    acting_membership: OrgMembership = Depends(require_org_role(["owner", "admin"])),
):
    """Delete (deregister) a webhook by ID. Must belong to the current organisation."""
    hook = (
        db.query(OrgWebhook)
        .filter(OrgWebhook.id == webhook_id, OrgWebhook.org_id == current_org.id)
        .first()
    )
    if not hook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    db.delete(hook)
    db.commit()


@router.post("/reset-password/request", response_model=PasswordResetRequestResponse)
@limiter.limit("5/hour")
def reset_password_request(
    request: Request,
    body: PasswordResetRequestBody,
    db: Session = Depends(get_db),
) -> PasswordResetRequestResponse:
    """Request a password reset token for the given email address.

    Always returns the same message regardless of whether the email exists, to prevent
    account enumeration. The reset_token field is temporary — it will be removed once
    email delivery is implemented and tokens are sent by email instead.
    """
    _RESET_MESSAGE = "If that email exists, a reset token has been issued."

    normalised_email = body.email.strip().lower()
    user = db.query(User).filter(User.email == normalised_email).first()

    if not user or not user.is_active:
        # Do not reveal whether the email exists or account is inactive.
        return PasswordResetRequestResponse(message=_RESET_MESSAGE)

    # Invalidate any existing unused tokens for this user.
    now = datetime.utcnow()
    (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
        .update({"used_at": now}, synchronize_session=False)
    )

    reset_token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token=reset_token,
            expires_at=now + timedelta(hours=1),
        )
    )
    db.commit()

    return PasswordResetRequestResponse(message=_RESET_MESSAGE, reset_token=reset_token)


@router.post("/reset-password/confirm")
@limiter.limit("10/hour")
def reset_password_confirm(
    request: Request,
    body: PasswordResetConfirmBody,
    db: Session = Depends(get_db),
) -> dict:
    """Consume a password reset token and set a new password.

    Returns 400 for invalid, already-used, or expired tokens. The token is
    single-use: used_at is set on successful reset.
    """
    record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token == body.token)
        .first()
    )

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )
    if record.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset token has already been used",
        )
    if record.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset token has expired",
        )
    if len(body.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password must be at least 8 characters",
        )

    user = db.query(User).filter(User.id == record.user_id).first()
    user.hashed_password = hash_password(body.new_password)
    record.used_at = datetime.utcnow()
    db.commit()

    return {"message": "Password reset successfully. You can now log in."}
