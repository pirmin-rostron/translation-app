from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from limiter import limiter
from models import OrgMembership, WaitlistEntry
from services.auth import require_org_role

router = APIRouter(prefix="/api/waitlist", tags=["waitlist"])


# --- Schemas ---


class WaitlistJoinRequest(BaseModel):
    name: str
    email: str


class WaitlistJoinResponse(BaseModel):
    message: str


class WaitlistEntryPublic(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Endpoints ---


@router.post("", response_model=WaitlistJoinResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
async def join_waitlist(
    request: Request,
    body: WaitlistJoinRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> WaitlistJoinResponse:
    """Join the Helvara waitlist.

    Returns 201 on success, 200 if the email is already registered (no enumeration
    risk since the caller already provided the email).
    """
    if not body.name.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name is required.")
    if not body.email.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email is required.")

    normalised_email = body.email.strip().lower()

    existing = db.query(WaitlistEntry).filter(WaitlistEntry.email == normalised_email).first()
    if existing:
        response.status_code = status.HTTP_200_OK
        return WaitlistJoinResponse(message="You're already on the list!")

    entry = WaitlistEntry(
        name=body.name.strip(),
        email=normalised_email,
        created_at=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    return WaitlistJoinResponse(message="You're on the list! We'll be in touch.")


@router.get("", response_model=List[WaitlistEntryPublic])
async def list_waitlist(
    db: Session = Depends(get_db),
    _membership: OrgMembership = Depends(require_org_role(["owner", "admin"])),
) -> List[WaitlistEntryPublic]:
    """List all waitlist entries ordered by sign-up date. Requires owner or admin role."""
    entries = db.query(WaitlistEntry).order_by(WaitlistEntry.created_at.desc()).all()
    return entries
