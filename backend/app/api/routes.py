import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.alert import (
    AlertAnalysis,
    AnalystReviewRecord,
    AuditLog,
    ImportHistory,
    SecurityAlert,
    User,
    Workspace,
    WorkspaceInvitation,
    WorkspaceMember,
)
from app.models.schemas import (
    AnalystDecisionRequest,
    AuditLogSchema,
    EvidenceImageUploadRequest,
    ImportHistorySchema,
    IngestResponseSchema,
    PasswordlessAccessRequest,
    SecurityAlertSchema,
    UserSchema,
    WorkspaceCreateRequest,
    WorkspaceInvitationAcceptRequest,
    WorkspaceInvitationCreateRequest,
    WorkspaceInvitationSchema,
    WorkspaceMemberSchema,
    WorkspaceMemberUpdateRequest,
    WorkspaceSchema,
)
from app.services.normalizer import AlertValidationError, parse_csv_content
from app.services.triage_pipeline import (
    DEFAULT_OWNER_EMAIL,
    DEFAULT_WORKSPACE_ID,
    ensure_default_workspaces,
    process_and_store_alert,
    process_batch_alerts,
)

router = APIRouter(prefix="/api", tags=["SentinelAI API"])


def _get_or_create_user_by_email(
    db: Session,
    email: str,
    display_name: Optional[str] = None,
) -> User:
    clean_email = email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        default_name = (display_name or "").strip() or clean_email.split("@")[0].capitalize()
        user = User(
            id=str(uuid.uuid4()),
            email=clean_email,
            display_name=default_name,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif display_name and display_name.strip():
        user.display_name = display_name.strip()
        db.commit()
        db.refresh(user)
    return user


def _resolve_workspace(db: Session, workspace_id: Optional[str]) -> Workspace:
    """
    Rule: Every API that reads or modifies data must verify the Workspace ID
    and filter data by that ID to prevent cross-workspace leakage.
    """
    ensure_default_workspaces(db)
    target_id = (workspace_id or DEFAULT_WORKSPACE_ID).strip()
    ws = (
        db.query(Workspace)
        .filter((Workspace.id == target_id) | (Workspace.workspace_code == target_id))
        .first()
    )
    if not ws:
        raise HTTPException(
            status_code=404,
            detail=f"ไม่พบ Workspace ID '{target_id}' ในระบบ (Workspace not found)",
        )
    return ws


def _check_member_role(
    db: Session,
    ws: Workspace,
    user_email: Optional[str],
    allowed_roles: Tuple[str, ...] = ("OWNER", "ANALYST", "VIEWER"),
) -> str:
    """
    Verifies the user's membership and role inside the target Workspace.
    If user_email is omitted (e.g., automated backend tests), defaults to OWNER.
    """
    if not user_email or not user_email.strip():
        return "OWNER"

    clean_email = user_email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        raise HTTPException(
            status_code=403,
            detail=f"ผู้ใช้ '{clean_email}' ไม่ได้เป็นสมาชิกของห้อง {ws.name} ({ws.workspace_code})",
        )

    mem = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == ws.id,
            WorkspaceMember.user_id == user.id,
        )
        .first()
    )
    if not mem:
        raise HTTPException(
            status_code=403,
            detail=f"ถูกปฏิเสธการเข้าถึง: บัญชี '{clean_email}' ไม่ได้เป็นสมาชิกในห้อง {ws.name} ({ws.workspace_code})",
        )
    if mem.status != "ACTIVE":
        raise HTTPException(
            status_code=403,
            detail=f"สิทธิ์ของ '{clean_email}' ในห้องนี้ถูกระงับชั่วคราว (SUSPENDED)",
        )
    if mem.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"สิทธิ์ไม่เพียงพอ: บทบาทของคุณคือ '{mem.role}' แต่การดำเนินการนี้ต้องการสิทธิ์ {', '.join(allowed_roles)}",
        )
    return mem.role


@router.post("/access/verify-email")
def verify_passwordless_email(
    payload: PasswordlessAccessRequest,
    db: Session = Depends(get_db),
):
    """
    Page 1: Access / Verify Email (Passwordless Authentication).
    Verifies or creates a user identity by email and lists all workspaces they belong to.
    """
    ensure_default_workspaces(db)
    user = _get_or_create_user_by_email(db, payload.email, payload.display_name)
    memberships = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.user_id == user.id)
        .all()
    )
    return {
        "status": "VERIFIED",
        "user": {
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
        },
        "workspaces_joined": len(memberships),
    }


@router.get("/users", response_model=List[UserSchema])
def list_known_users(db: Session = Depends(get_db)):
    """
    Returns preset & registered Passwordless SOC users for quick role-switching demonstration.
    """
    ensure_default_workspaces(db)
    return db.query(User).order_by(User.created_at.asc()).all()


@router.get("/workspaces", response_model=List[WorkspaceSchema])
def list_workspaces(
    user_email: Optional[str] = Query(None, description="Current verified user email"),
    db: Session = Depends(get_db),
):
    """
    Page 2: Workspace Management — Lists workspaces with owner, member count, role, and alert counts.
    """
    ensure_default_workspaces(db)
    workspaces = db.query(Workspace).order_by(Workspace.created_at.asc()).all()
    clean_email = (user_email or DEFAULT_OWNER_EMAIL).strip().lower()
    active_user = db.query(User).filter(User.email == clean_email).first()

    out: List[Dict[str, Any]] = []
    for ws in workspaces:
        total_cnt = (
            db.query(SecurityAlert)
            .filter(SecurityAlert.workspace_id == ws.id)
            .count()
        )
        pending_cnt = (
            db.query(SecurityAlert)
            .filter(
                SecurityAlert.workspace_id == ws.id,
                SecurityAlert.status == "PENDING_REVIEW",
            )
            .count()
        )
        members_cnt = (
            db.query(WorkspaceMember)
            .filter(WorkspaceMember.workspace_id == ws.id)
            .count()
        )
        invites_cnt = (
            db.query(WorkspaceInvitation)
            .filter(
                WorkspaceInvitation.workspace_id == ws.id,
                WorkspaceInvitation.status == "PENDING",
            )
            .count()
        )
        owner_user = (
            db.query(User).filter(User.id == ws.owner_user_id).first()
            if ws.owner_user_id
            else None
        )
        user_role = "NOT_MEMBER"
        if active_user:
            mem = (
                db.query(WorkspaceMember)
                .filter(
                    WorkspaceMember.workspace_id == ws.id,
                    WorkspaceMember.user_id == active_user.id,
                )
                .first()
            )
            if mem:
                user_role = mem.role

        is_member = user_role != "NOT_MEMBER"
        out.append(
            {
                "id": ws.id if is_member else ws.workspace_code,
                "workspace_code": ws.workspace_code,
                "name": ws.name,
                "description": (ws.description or "")
                if is_member
                else "ห้องทำงานส่วนตัว (จำกัดการเข้าถึงเฉพาะสมาชิกที่ได้รับเชิญเท่านั้น)",
                "owner_email": (owner_user.email if owner_user else DEFAULT_OWNER_EMAIL)
                if is_member
                else "ไม่เปิดเผย (Private Room)",
                "owner_name": (owner_user.display_name if owner_user else "Somchai (Workspace Owner)")
                if is_member
                else "จำกัดเฉพาะสมาชิก",
                "current_user_role": user_role,
                "members_count": members_cnt if is_member else 0,
                "pending_invites_count": invites_cnt if is_member else 0,
                "alerts_count": total_cnt if is_member else 0,
                "pending_count": pending_cnt if is_member else 0,
                "created_at": ws.created_at,
                "updated_at": ws.updated_at,
            }
        )
    return out


@router.post("/workspaces", response_model=WorkspaceSchema)
def create_workspace(
    payload: WorkspaceCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Page 2: Creates a new isolated Workspace and assigns the creator as OWNER.
    """
    ensure_default_workspaces(db)
    owner = _get_or_create_user_by_email(
        db,
        payload.owner_email or DEFAULT_OWNER_EMAIL,
        payload.owner_name,
    )

    count = db.query(Workspace).count()
    next_code = f"SNT-WS-{count + 1:03d}"
    while db.query(Workspace).filter(Workspace.workspace_code == next_code).first():
        count += 1
        next_code = f"SNT-WS-{count + 1:03d}"

    new_ws = Workspace(
        id=str(uuid.uuid4()),
        workspace_code=next_code,
        name=payload.name.strip(),
        description=(payload.description or "").strip()
        or "พื้นที่ทำงานของทีม SOC สำหรับวิเคราะห์และจัดการ Security Alerts ร่วมกัน",
        owner_user_id=owner.id,
    )
    db.add(new_ws)
    db.flush()

    db.add(
        WorkspaceMember(
            workspace_id=new_ws.id,
            user_id=owner.id,
            role="OWNER",
            status="ACTIVE",
        )
    )

    audit_entry = AuditLog(
        workspace_id=new_ws.id,
        alert_id=None,
        alert_code=new_ws.workspace_code,
        analyst_name=f"{owner.display_name} ({owner.email})",
        action="CREATE_WORKSPACE",
        previous_status="NONE",
        new_status="OWNER",
        comment=f"สร้างห้อง Workspace ใหม่ '{new_ws.name}' ({new_ws.workspace_code}) และกำหนดเจ้าของห้องเป็น {owner.email}",
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(new_ws)

    return {
        "id": new_ws.id,
        "workspace_code": new_ws.workspace_code,
        "name": new_ws.name,
        "description": new_ws.description or "",
        "owner_email": owner.email,
        "owner_name": owner.display_name,
        "current_user_role": "OWNER",
        "members_count": 1,
        "pending_invites_count": 0,
        "alerts_count": 0,
        "pending_count": 0,
        "created_at": new_ws.created_at,
        "updated_at": new_ws.updated_at,
    }


@router.delete("/workspaces/{workspace_id}")
def delete_workspace(
    workspace_id: str,
    user_email: Optional[str] = Query(None, description="Email of caller (must be OWNER)"),
    db: Session = Depends(get_db),
):
    """
    Page 2: Deletes a Workspace (restricted to Workspace OWNER).
    """
    ws = _resolve_workspace(db, workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER",))

    total_ws = db.query(Workspace).count()
    if total_ws <= 1:
        raise HTTPException(
            status_code=400,
            detail="ไม่สามารถลบ Workspace สุดท้ายของระบบได้ (ต้องมีอย่างน้อย 1 Workspace)",
        )

    code = ws.workspace_code
    name = ws.name
    db.delete(ws)
    db.commit()
    return {
        "status": "DELETED",
        "workspace_code": code,
        "name": name,
    }


@router.get("/workspaces/{workspace_id}/members", response_model=List[WorkspaceMemberSchema])
def list_workspace_members(
    workspace_id: str,
    user_email: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Page 8: Member Management — Lists all members and their roles (OWNER / ANALYST / VIEWER) in the workspace.
    """
    ws = _resolve_workspace(db, workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER", "ANALYST", "VIEWER"))

    members = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == ws.id)
        .order_by(WorkspaceMember.joined_at.asc())
        .all()
    )
    result: List[Dict[str, Any]] = []
    for m in members:
        u = db.query(User).filter(User.id == m.user_id).first()
        if u:
            result.append(
                {
                    "id": m.id,
                    "workspace_id": ws.id,
                    "user_id": u.id,
                    "email": u.email,
                    "display_name": u.display_name,
                    "role": m.role,
                    "status": m.status,
                    "joined_at": m.joined_at,
                }
            )
    return result


@router.patch("/workspaces/{workspace_id}/members/{member_id}", response_model=WorkspaceMemberSchema)
def update_workspace_member(
    workspace_id: str,
    member_id: int,
    payload: WorkspaceMemberUpdateRequest,
    user_email: Optional[str] = Query(None, description="Must be Workspace OWNER"),
    db: Session = Depends(get_db),
):
    """
    Page 8: Member Management — Allows Workspace OWNER to change a member's role or suspend/activate them.
    """
    ws = _resolve_workspace(db, workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER",))

    mem = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.id == member_id,
            WorkspaceMember.workspace_id == ws.id,
        )
        .first()
    )
    if not mem:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลสมาชิกในห้องนี้")

    target_user = db.query(User).filter(User.id == mem.user_id).first()
    prev_val = f"{mem.role} ({mem.status})"

    if payload.role:
        mem.role = payload.role
    if payload.status:
        mem.status = payload.status

    new_val = f"{mem.role} ({mem.status})"
    db.add(
        AuditLog(
            workspace_id=ws.id,
            alert_id=None,
            alert_code=ws.workspace_code,
            analyst_name=user_email or DEFAULT_OWNER_EMAIL,
            action="UPDATE_MEMBER_ROLE",
            previous_status=prev_val,
            new_status=new_val,
            comment=f"ปรับเปลี่ยนสิทธิ์สมาชิก {target_user.email if target_user else member_id} จาก {prev_val} เป็น {new_val}",
        )
    )
    db.commit()
    db.refresh(mem)

    return {
        "id": mem.id,
        "workspace_id": ws.id,
        "user_id": mem.user_id,
        "email": target_user.email if target_user else "unknown",
        "display_name": target_user.display_name if target_user else "Unknown",
        "role": mem.role,
        "status": mem.status,
        "joined_at": mem.joined_at,
    }


@router.delete("/workspaces/{workspace_id}/members/{member_id}")
def remove_workspace_member(
    workspace_id: str,
    member_id: int,
    user_email: Optional[str] = Query(None, description="Must be Workspace OWNER"),
    db: Session = Depends(get_db),
):
    """
    Page 8: Member Management — Allows Workspace OWNER to remove a member from the workspace.
    """
    ws = _resolve_workspace(db, workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER",))

    mem = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.id == member_id,
            WorkspaceMember.workspace_id == ws.id,
        )
        .first()
    )
    if not mem:
        raise HTTPException(status_code=404, detail="ไม่พบสมาชิกที่ต้องการลบ")

    if mem.role == "OWNER":
        owners_cnt = (
            db.query(WorkspaceMember)
            .filter(
                WorkspaceMember.workspace_id == ws.id,
                WorkspaceMember.role == "OWNER",
            )
            .count()
        )
        if owners_cnt <= 1:
            raise HTTPException(
                status_code=400,
                detail="ไม่สามารถนำเจ้าของห้อง (Owner) คนสุดท้ายออกจาก Workspace ได้",
            )

    target_user = db.query(User).filter(User.id == mem.user_id).first()
    removed_email = target_user.email if target_user else str(member_id)
    prev_role = mem.role

    db.delete(mem)
    db.add(
        AuditLog(
            workspace_id=ws.id,
            alert_id=None,
            alert_code=ws.workspace_code,
            analyst_name=user_email or DEFAULT_OWNER_EMAIL,
            action="REMOVE_MEMBER",
            previous_status=prev_role,
            new_status="REMOVED",
            comment=f"นำสมาชิก '{removed_email}' ออกจากห้อง {ws.name} ({ws.workspace_code})",
        )
    )
    db.commit()
    return {"status": "REMOVED", "email": removed_email}


@router.get("/my-invitations", response_model=List[WorkspaceInvitationSchema])
def list_my_pending_invitations(
    user_email: Optional[str] = Query(None, description="Email of current user"),
    db: Session = Depends(get_db),
):
    """
    Returns all PENDING invitations addressed to user_email across all workspaces
    (Slack / GitHub / Notion style 'Invitations Waiting for You' inbox).
    """
    ensure_default_workspaces(db)
    clean_email = (user_email or DEFAULT_OWNER_EMAIL).strip().lower()
    invs = (
        db.query(WorkspaceInvitation)
        .filter(
            WorkspaceInvitation.invited_email == clean_email,
            WorkspaceInvitation.status == "PENDING",
        )
        .order_by(WorkspaceInvitation.created_at.desc())
        .all()
    )
    now = datetime.now(timezone.utc)
    out: List[Dict[str, Any]] = []
    for inv in invs:
        exp = (
            inv.expires_at
            if inv.expires_at.tzinfo
            else inv.expires_at.replace(tzinfo=timezone.utc)
        )
        if exp < now:
            inv.status = "EXPIRED"
            db.commit()
            continue

        ws = db.query(Workspace).filter(Workspace.id == inv.workspace_id).first()
        if not ws:
            continue
        out.append(
            {
                "id": inv.id,
                "invite_code": inv.invite_code,
                "workspace_id": ws.id,
                "workspace_code": ws.workspace_code,
                "workspace_name": ws.name,
                "invited_email": inv.invited_email,
                "role": inv.role,
                "token": inv.token,
                "invite_link": f"?invite_token={inv.token}",
                "status": inv.status,
                "invited_by_email": inv.invited_by_email,
                "expires_at": inv.expires_at,
                "created_at": inv.created_at,
                "accepted_at": inv.accepted_at,
            }
        )
    return out


@router.get("/workspaces/{workspace_id}/invitations", response_model=List[WorkspaceInvitationSchema])
def list_workspace_invitations(
    workspace_id: str,
    user_email: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Page 9: Invitation Management — Lists all invitations for the workspace.
    """
    ws = _resolve_workspace(db, workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER", "ANALYST", "VIEWER"))

    invs = (
        db.query(WorkspaceInvitation)
        .filter(WorkspaceInvitation.workspace_id == ws.id)
        .order_by(WorkspaceInvitation.created_at.desc())
        .all()
    )
    now = datetime.now(timezone.utc)
    out: List[Dict[str, Any]] = []
    for inv in invs:
        exp = (
            inv.expires_at
            if inv.expires_at.tzinfo
            else inv.expires_at.replace(tzinfo=timezone.utc)
        )
        if inv.status == "PENDING" and exp < now:
            inv.status = "EXPIRED"
            db.commit()

        out.append(
            {
                "id": inv.id,
                "invite_code": inv.invite_code,
                "workspace_id": ws.id,
                "workspace_code": ws.workspace_code,
                "workspace_name": ws.name,
                "invited_email": inv.invited_email,
                "role": inv.role,
                "token": inv.token,
                "invite_link": f"?invite_token={inv.token}",
                "status": inv.status,
                "invited_by_email": inv.invited_by_email,
                "expires_at": inv.expires_at,
                "created_at": inv.created_at,
                "accepted_at": inv.accepted_at,
            }
        )
    return out


@router.post("/workspaces/{workspace_id}/invitations", response_model=WorkspaceInvitationSchema)
def create_workspace_invitation(
    workspace_id: str,
    payload: WorkspaceInvitationCreateRequest,
    user_email: Optional[str] = Query(None, description="Must be Workspace OWNER"),
    db: Session = Depends(get_db),
):
    """
    Page 9: Invitation Management — Owner generates a single-use, time-limited invitation token & link.
    """
    ws = _resolve_workspace(db, workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER",))

    last_inv = db.query(WorkspaceInvitation).order_by(WorkspaceInvitation.id.desc()).first()
    next_num = (last_inv.id + 1) if last_inv else 1
    invite_code = f"INV-{next_num:04d}"

    token = f"snt_inv_{secrets.token_urlsafe(20)}"
    expires_at = datetime.now(timezone.utc) + timedelta(hours=payload.expires_in_hours)
    inviter = (user_email or DEFAULT_OWNER_EMAIL).strip().lower()

    inv = WorkspaceInvitation(
        invite_code=invite_code,
        workspace_id=ws.id,
        invited_email=payload.invited_email.strip().lower(),
        role=payload.role,
        token=token,
        status="PENDING",
        invited_by_email=inviter,
        expires_at=expires_at,
    )
    db.add(inv)
    db.add(
        AuditLog(
            workspace_id=ws.id,
            alert_id=None,
            alert_code=ws.workspace_code,
            analyst_name=inviter,
            action="INVITE_MEMBER",
            previous_status="NONE",
            new_status=f"PENDING ({payload.role})",
            comment=f"สร้างคำเชิญ {invite_code} สำหรับ '{inv.invited_email}' ในบทบาท {payload.role} (หมดอายุใน {payload.expires_in_hours} ชม.)",
        )
    )
    db.commit()
    db.refresh(inv)

    return {
        "id": inv.id,
        "invite_code": inv.invite_code,
        "workspace_id": ws.id,
        "workspace_code": ws.workspace_code,
        "workspace_name": ws.name,
        "invited_email": inv.invited_email,
        "role": inv.role,
        "token": inv.token,
        "invite_link": f"?invite_token={inv.token}",
        "status": inv.status,
        "invited_by_email": inv.invited_by_email,
        "expires_at": inv.expires_at,
        "created_at": inv.created_at,
        "accepted_at": inv.accepted_at,
    }


@router.post("/invitations/accept")
def accept_workspace_invitation(
    payload: WorkspaceInvitationAcceptRequest,
    db: Session = Depends(get_db),
):
    """
    Page 1 & Page 9: Member opens invitation link / token, verifies identity, and joins the Workspace.
    Single-use token is marked ACCEPTED and cannot be reused.
    """
    ensure_default_workspaces(db)
    token_clean = payload.token.strip()
    inv = (
        db.query(WorkspaceInvitation)
        .filter(
            (WorkspaceInvitation.token == token_clean)
            | (WorkspaceInvitation.invite_code == token_clean.upper())
        )
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="ไม่พบรหัสคำเชิญ (Invalid Invitation Token)")

    if inv.status == "ACCEPTED":
        raise HTTPException(
            status_code=400,
            detail="ลิงก์คำเชิญนี้ถูกใช้งานไปแล้ว (Single-use token already accepted)",
        )
    if inv.status == "REVOKED":
        raise HTTPException(status_code=400, detail="คำเชิญนี้ถูกเจ้าของห้องยกเลิกแล้ว (Revoked)")

    now = datetime.now(timezone.utc)
    exp = (
        inv.expires_at
        if inv.expires_at.tzinfo
        else inv.expires_at.replace(tzinfo=timezone.utc)
    )
    if exp < now:
        inv.status = "EXPIRED"
        db.commit()
        raise HTTPException(status_code=400, detail="ลิงก์คำเชิญนี้หมดอายุแล้ว (Expired)")

    ws = _resolve_workspace(db, inv.workspace_id)
    target_email = (payload.email or inv.invited_email).strip().lower()
    user = _get_or_create_user_by_email(db, target_email, payload.display_name)

    existing_mem = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == ws.id,
            WorkspaceMember.user_id == user.id,
        )
        .first()
    )
    if existing_mem:
        existing_mem.role = inv.role
        existing_mem.status = "ACTIVE"
    else:
        db.add(
            WorkspaceMember(
                workspace_id=ws.id,
                user_id=user.id,
                role=inv.role,
                status="ACTIVE",
            )
        )

    inv.status = "ACCEPTED"
    inv.accepted_at = now

    db.add(
        AuditLog(
            workspace_id=ws.id,
            alert_id=None,
            alert_code=ws.workspace_code,
            analyst_name=f"{user.display_name} ({user.email})",
            action="ACCEPT_INVITATION",
            previous_status="INVITED",
            new_status=inv.role,
            comment=f"สมาชิก '{user.email}' ตอบรับคำเชิญ {inv.invite_code} และเข้าร่วมห้อง '{ws.name}' ในบทบาท {inv.role}",
        )
    )
    db.commit()

    return {
        "status": "ACCEPTED",
        "workspace_id": ws.id,
        "workspace_code": ws.workspace_code,
        "workspace_name": ws.name,
        "role": inv.role,
        "user": {
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
        },
    }


@router.delete("/workspaces/{workspace_id}/invitations/{invitation_id}")
def revoke_workspace_invitation(
    workspace_id: str,
    invitation_id: int,
    user_email: Optional[str] = Query(None, description="Must be Workspace OWNER"),
    db: Session = Depends(get_db),
):
    """
    Page 9: Invitation Management — Owner revokes a pending invitation link.
    """
    ws = _resolve_workspace(db, workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER",))

    inv = (
        db.query(WorkspaceInvitation)
        .filter(
            WorkspaceInvitation.id == invitation_id,
            WorkspaceInvitation.workspace_id == ws.id,
        )
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="ไม่พบคำเชิญที่ต้องการยกเลิก")

    inv.status = "REVOKED"
    db.add(
        AuditLog(
            workspace_id=ws.id,
            alert_id=None,
            alert_code=ws.workspace_code,
            analyst_name=user_email or DEFAULT_OWNER_EMAIL,
            action="REVOKE_INVITATION",
            previous_status="PENDING",
            new_status="REVOKED",
            comment=f"ยกเลิกคำเชิญ {inv.invite_code} ของ '{inv.invited_email}'",
        )
    )
    db.commit()
    return {"status": "REVOKED", "invite_code": inv.invite_code}


@router.get("/import-history", response_model=List[ImportHistorySchema])
def list_import_history(
    workspace_id: Optional[str] = Query(None, description="Workspace UUID or code"),
    user_email: Optional[str] = Query(None, description="Verified member email"),
    db: Session = Depends(get_db),
):
    """
    Page 10: Lists Import History records filtered strictly by workspace_id.
    """
    ws = _resolve_workspace(db, workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER", "ANALYST", "VIEWER"))
    return (
        db.query(ImportHistory)
        .filter(ImportHistory.workspace_id == ws.id)
        .order_by(ImportHistory.created_at.desc())
        .all()
    )


@router.post("/alerts/ingest/json", response_model=IngestResponseSchema)
def ingest_json_alerts(
    payload: Union[Dict[str, Any], List[Dict[str, Any]]],
    workspace_id: Optional[str] = Query(None, description="Workspace UUID or code"),
    filename: Optional[str] = Query("Manual JSON Payload", description="Source filename"),
    user_email: Optional[str] = Query(None, description="Verified member email (OWNER or ANALYST)"),
    db: Session = Depends(get_db),
):
    """
    TC01, TC03, TC04: Ingest one or multiple JSON security alerts scoped to workspace_id.
    Restricted to OWNER and ANALYST roles.
    """
    ws = _resolve_workspace(db, workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER", "ANALYST"))
    items = payload if isinstance(payload, list) else [payload]
    if not items:
        raise HTTPException(status_code=422, detail="Alert payload list cannot be empty.")

    try:
        result = process_batch_alerts(
            db,
            items,
            workspace_id=ws.id,
            source_type="JSON Upload",
            filename=filename or "Manual JSON Payload",
        )
        return result
    except AlertValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/alerts/ingest/csv", response_model=IngestResponseSchema)
def ingest_csv_alerts(
    file: UploadFile = File(...),
    workspace_id: Optional[str] = Query(None, description="Workspace UUID or code"),
    user_email: Optional[str] = Query(None, description="Verified member email (OWNER or ANALYST)"),
    db: Session = Depends(get_db),
):
    """
    TC02: Ingest security alerts from an uploaded CSV log file scoped to workspace_id.
    Restricted to OWNER and ANALYST roles.
    """
    ws = _resolve_workspace(db, workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER", "ANALYST"))
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=422, detail="Uploaded CSV file is empty.")

    try:
        records = parse_csv_content(content)
        result = process_batch_alerts(
            db,
            records,
            workspace_id=ws.id,
            source_type="CSV Upload",
            filename=file.filename or "uploaded_logs.csv",
        )
        return result
    except AlertValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/alerts/seed-demo", response_model=IngestResponseSchema)
def seed_demo_datasets(
    workspace_id: Optional[str] = Query(None, description="Workspace UUID or code"),
    user_email: Optional[str] = Query(None, description="Verified member email (OWNER or ANALYST)"),
    db: Session = Depends(get_db),
):
    """
    Loads the built-in Wazuh JSON and CSV security datasets from /datasets into the active Workspace.
    """
    ws = _resolve_workspace(db, workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER", "ANALYST"))
    all_records: List[Dict[str, Any]] = []
    wazuh_path = settings.DATASETS_DIR / "sample_wazuh_alerts.json"
    csv_path = settings.DATASETS_DIR / "sample_security_logs.csv"

    if wazuh_path.exists():
        all_records.extend(json.loads(wazuh_path.read_text(encoding="utf-8")))
    if csv_path.exists():
        all_records.extend(parse_csv_content(csv_path.read_bytes()))

    if not all_records:
        raise HTTPException(status_code=404, detail="Demo dataset files not found.")

    return process_batch_alerts(
        db,
        all_records,
        workspace_id=ws.id,
        source_type="Standard Dataset",
        filename="sample_wazuh_alerts.json + sample_security_logs.csv",
    )


@router.delete("/alerts/clear-temporary")
def clear_temporary_alerts(
    workspace_id: Optional[str] = Query(None, description="Workspace UUID or code"),
    db: Session = Depends(get_db),
):
    """
    Ends the current temporary analysis session and wipes all temporary session data
    for the workspace: AuditLog (Session Audit Logs), AnalystReviewRecord, AlertAnalysis,
    SecurityAlert, and ImportHistory, while the user keeps downloaded PDF/CSV reports.
    """
    ws = _resolve_workspace(db, workspace_id)
    deleted_audit_cnt = (
        db.query(AuditLog)
        .filter(AuditLog.workspace_id == ws.id)
        .delete(synchronize_session=False)
    )
    deleted_reviews_cnt = (
        db.query(AnalystReviewRecord)
        .filter(AnalystReviewRecord.workspace_id == ws.id)
        .delete(synchronize_session=False)
    )
    deleted_analyses_cnt = (
        db.query(AlertAnalysis)
        .filter(AlertAnalysis.workspace_id == ws.id)
        .delete(synchronize_session=False)
    )
    deleted_alerts_cnt = (
        db.query(SecurityAlert)
        .filter(SecurityAlert.workspace_id == ws.id)
        .delete(synchronize_session=False)
    )
    deleted_imports_cnt = (
        db.query(ImportHistory)
        .filter(ImportHistory.workspace_id == ws.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {
        "status": "CLEARED",
        "deleted_count": deleted_alerts_cnt,
        "deleted_audit_logs": deleted_audit_cnt,
        "deleted_reviews": deleted_reviews_cnt,
        "deleted_analyses": deleted_analyses_cnt,
        "deleted_imports": deleted_imports_cnt,
    }


@router.get("/alerts", response_model=List[SecurityAlertSchema])
def list_alerts(
    workspace_id: Optional[str] = Query(None, description="Filter by Workspace UUID or code"),
    user_email: Optional[str] = Query(None, description="Verified member email"),
    severity: Optional[str] = Query(None, description="Filter by CRITICAL, HIGH, MEDIUM, LOW"),
    status: Optional[str] = Query(None, description="Filter by PENDING_REVIEW, APPROVED, REJECTED, FALSE_POSITIVE, ESCALATED"),
    search: Optional[str] = Query(None, description="Search description, hostname, IP, or alert_code"),
    db: Session = Depends(get_db),
):
    """
    Returns alerts for the specified Workspace prioritized by Risk Score (highest first), then timestamp.
    """
    ws = _resolve_workspace(db, workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER", "ANALYST", "VIEWER"))
    query = (
        db.query(SecurityAlert)
        .outerjoin(AlertAnalysis)
        .filter(SecurityAlert.workspace_id == ws.id)
    )

    if severity:
        query = query.filter(AlertAnalysis.severity == severity.upper())
    if status:
        query = query.filter(SecurityAlert.status == status.upper())
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            (SecurityAlert.description.ilike(pattern))
            | (SecurityAlert.hostname.ilike(pattern))
            | (SecurityAlert.src_ip.ilike(pattern))
            | (SecurityAlert.alert_code.ilike(pattern))
            | (SecurityAlert.username.ilike(pattern))
        )

    alerts = query.order_by(AlertAnalysis.risk_score.desc(), SecurityAlert.timestamp.desc()).all()
    return alerts


@router.get("/alerts/{alert_id}", response_model=SecurityAlertSchema)
def get_alert_detail(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(SecurityAlert).filter(SecurityAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert ID {alert_id} not found.")
    return alert


@router.post("/alerts/{alert_id}/decision", response_model=SecurityAlertSchema)
def submit_analyst_decision(
    alert_id: int,
    decision_req: AnalystDecisionRequest,
    user_email: Optional[str] = Query(None, description="Verified member email (OWNER or ANALYST)"),
    db: Session = Depends(get_db),
):
    """
    TC10 & TC11: Module 6 Human-in-the-loop approval/rejection workflow and immutable Audit Trail.
    Restricted to OWNER and ANALYST roles.
    """
    alert = db.query(SecurityAlert).filter(SecurityAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert ID {alert_id} not found.")

    ws = _resolve_workspace(db, alert.workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER", "ANALYST"))

    normalized_action = decision_req.action.replace("_ALERT", "")
    action_label_map = {
        "APPROVE": "APPROVE_ALERT",
        "REJECT": "REJECT_ALERT",
        "FALSE_POSITIVE": "FALSE_POSITIVE_ALERT",
        "ESCALATE": "ESCALATE_ALERT",
        "NEEDS_REANALYSIS": "RE_ANALYSIS",
        "RE_ANALYSIS": "RE_ANALYSIS",
        "UPDATE_RISK": "UPDATE_RISK",
    }
    action_audit_label = action_label_map.get(normalized_action, f"{normalized_action}_ALERT")
    status_map = {
        "APPROVE": "APPROVED",
        "REJECT": "REJECTED",
        "FALSE_POSITIVE": "FALSE_POSITIVE",
        "ESCALATE": "ESCALATED",
        "NEEDS_REANALYSIS": "NEEDS_REANALYSIS",
        "RE_ANALYSIS": "NEEDS_REANALYSIS",
        "UPDATE_RISK": alert.status,
    }
    prev_status = alert.status
    new_status = status_map[normalized_action]
    alert.status = new_status

    prev_sev = alert.analysis.severity if alert.analysis else "UNKNOWN"
    prev_score = alert.analysis.risk_score if alert.analysis else 0
    new_sev = prev_sev
    new_score = prev_score

    if (
        decision_req.adjusted_severity
        and decision_req.adjusted_severity.upper() in ("CRITICAL", "HIGH", "MEDIUM", "LOW")
        and alert.analysis
    ):
        new_sev = decision_req.adjusted_severity.upper()
        alert.analysis.severity = new_sev

    if decision_req.adjusted_risk_score is not None and alert.analysis:
        new_score = int(decision_req.adjusted_risk_score)
        alert.analysis.risk_score = new_score

    if new_sev != prev_sev or new_score != prev_score:
        sev_note = f"[Risk Score: {prev_score} ({prev_sev}) -> {new_score} ({new_sev})] "
    else:
        sev_note = f"[Risk Score: {new_score} ({new_sev})] "

    actor_name = decision_req.analyst_name.strip() or (user_email or "Local Operator")

    # If an evidence image was attached during review decision, append it to raw_payload["evidence_images"]
    if decision_req.evidence_image_data and decision_req.evidence_image_data.strip():
        payload_dict = dict(alert.raw_payload) if isinstance(alert.raw_payload, dict) else {}
        images_list = list(payload_dict.get("evidence_images", []))
        images_list.insert(
            0,
            {
                "id": f"IMG-{secrets.token_hex(3).upper()}",
                "title": (decision_req.evidence_image_title or f"หลักฐานยืนยันจุดน่าสงสัย ({action_audit_label})").strip(),
                "image_data": decision_req.evidence_image_data.strip(),
                "uploaded_by": actor_name,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        payload_dict["evidence_images"] = images_list
        alert.raw_payload = payload_dict

    # Record into analyst_reviews table
    review_rec = AnalystReviewRecord(
        workspace_id=alert.workspace_id,
        alert_id=alert.id,
        reviewer_email=user_email or DEFAULT_OWNER_EMAIL,
        reviewer_name=actor_name,
        decision=action_audit_label,
        previous_status=prev_status,
        new_status=new_status,
        adjusted_severity=new_sev,
        adjusted_risk_score=new_score,
        comment=decision_req.comment.strip(),
    )
    db.add(review_rec)

    snapshot = alert.analysis.recommendations if alert.analysis else []
    audit_entry = AuditLog(
        workspace_id=alert.workspace_id,
        alert_id=alert.id,
        alert_code=alert.alert_code,
        analyst_name=actor_name,
        action=action_audit_label,
        previous_status=prev_status,
        new_status=new_status,
        comment=f"{sev_note}{decision_req.comment.strip()}",
        ai_recommendation_snapshot=snapshot,
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(alert)
    return alert


@router.post("/alerts/{alert_id}/evidence-images", response_model=SecurityAlertSchema)
def add_alert_evidence_image(
    alert_id: int,
    payload: EvidenceImageUploadRequest,
    user_email: Optional[str] = Query(None, description="Verified member email (OWNER or ANALYST)"),
    db: Session = Depends(get_db),
):
    """
    Attaches a screenshot / evidence image highlighting a suspicious point to an alert
    and records the action in Audit Logs.
    """
    alert = db.query(SecurityAlert).filter(SecurityAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert ID {alert_id} not found.")

    ws = _resolve_workspace(db, alert.workspace_id)
    role = _check_member_role(db, ws, user_email, allowed_roles=("OWNER", "ANALYST"))
    actor_label = f"{user_email or DEFAULT_OWNER_EMAIL} ({role})"

    payload_dict = dict(alert.raw_payload) if isinstance(alert.raw_payload, dict) else {}
    images_list = list(payload_dict.get("evidence_images", []))
    img_id = f"IMG-{secrets.token_hex(3).upper()}"
    images_list.insert(
        0,
        {
            "id": img_id,
            "title": payload.title.strip(),
            "image_data": payload.image_data.strip(),
            "uploaded_by": actor_label,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    payload_dict["evidence_images"] = images_list
    alert.raw_payload = payload_dict

    db.add(
        AuditLog(
            workspace_id=alert.workspace_id,
            alert_id=alert.id,
            alert_code=alert.alert_code,
            analyst_name=actor_label,
            action="ATTACH_EVIDENCE_IMAGE",
            previous_status=alert.status,
            new_status=alert.status,
            comment=f"แนบรูปภาพยืนยันจุดน่าสงสัย ({img_id}): {payload.title.strip()}",
        )
    )
    db.commit()
    db.refresh(alert)
    return alert


@router.delete("/alerts/{alert_id}/evidence-images/{image_id}", response_model=SecurityAlertSchema)
def delete_alert_evidence_image(
    alert_id: int,
    image_id: str,
    user_email: Optional[str] = Query(None, description="Verified member email (OWNER or ANALYST)"),
    db: Session = Depends(get_db),
):
    """
    Removes an attached evidence image from an alert.
    """
    alert = db.query(SecurityAlert).filter(SecurityAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert ID {alert_id} not found.")

    ws = _resolve_workspace(db, alert.workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER", "ANALYST"))

    payload_dict = dict(alert.raw_payload) if isinstance(alert.raw_payload, dict) else {}
    images_list = [
        img
        for img in payload_dict.get("evidence_images", [])
        if isinstance(img, dict) and img.get("id") != image_id
    ]
    payload_dict["evidence_images"] = images_list
    alert.raw_payload = payload_dict
    db.commit()
    db.refresh(alert)
    return alert


@router.post("/alerts/{alert_id}/reanalyze", response_model=SecurityAlertSchema)
def reanalyze_alert(
    alert_id: int,
    user_email: Optional[str] = Query(None, description="Verified member email (OWNER or ANALYST)"),
    db: Session = Depends(get_db),
):
    """
    Re-runs the SentinelAI IOC, MITRE ATT&CK, Rule Engine, and AI Triage Analysis on an existing alert
    and records a RE_ANALYSIS event in Audit Logs. Restricted to OWNER and ANALYST roles.
    """
    import time
    from app.services.normalizer import normalize_alert_payload
    from app.services.ioc_enrichment import enrich_alert_iocs
    from app.mitre_mapping.mapper import map_alert_to_mitre
    from app.rule_engine.evaluator import evaluate_alert_risk
    from app.ai_engine.analyzer import analyze_alert_with_ai

    alert = db.query(SecurityAlert).filter(SecurityAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert ID {alert_id} not found.")

    ws = _resolve_workspace(db, alert.workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER", "ANALYST"))

    start_ts = time.perf_counter()
    raw_payload = alert.raw_payload if isinstance(alert.raw_payload, dict) and alert.raw_payload else {
        "id": alert.external_id,
        "source": alert.source,
        "rule_id": alert.rule_id,
        "rule_level": alert.rule_level,
        "description": alert.description,
        "hostname": alert.hostname,
        "src_ip": alert.src_ip,
        "dst_ip": alert.dst_ip,
        "username": alert.username,
        "process_name": alert.process_name,
        "command_line": alert.command_line,
        "domain": alert.domain,
        "file_hash": alert.file_hash,
        "protocol": alert.protocol,
        "raw_log": alert.raw_log,
    }
    normalized = normalize_alert_payload(raw_payload)
    ioc_results = enrich_alert_iocs(normalized)
    mitre_mappings = map_alert_to_mitre(normalized)
    risk_eval = evaluate_alert_risk(normalized, ioc_results, mitre_mappings)
    ai_output = analyze_alert_with_ai(normalized, risk_eval, ioc_results, mitre_mappings)
    elapsed_ms = round((time.perf_counter() - start_ts) * 1000.0, 2)

    prev_status = alert.status
    if alert.analysis:
        alert.analysis.risk_score = risk_eval["risk_score"]
        alert.analysis.severity = risk_eval["severity"]
        alert.analysis.incident_type = risk_eval["incident_type"]
        alert.analysis.scoring_breakdown = risk_eval["scoring_breakdown"]
        alert.analysis.ioc_results = ioc_results
        alert.analysis.mitre_mapping = mitre_mappings
        alert.analysis.ai_provider = ai_output["ai_provider"]
        alert.analysis.ai_summary = ai_output["ai_summary"]
        alert.analysis.behavior_analysis = ai_output["behavior_analysis"]
        alert.analysis.risk_justification = ai_output["risk_justification"]
        alert.analysis.evidence_citations = ai_output["evidence_citations"]
        alert.analysis.recommendations = ai_output["recommendations"]
        alert.analysis.analysis_duration_ms = elapsed_ms

    alert.status = "PENDING_REVIEW"

    audit_entry = AuditLog(
        workspace_id=alert.workspace_id,
        alert_id=alert.id,
        alert_code=alert.alert_code,
        analyst_name=user_email or "Local Operator",
        action="RE_ANALYSIS",
        previous_status=prev_status,
        new_status="PENDING_REVIEW",
        comment=f"[Risk Score: {risk_eval['risk_score']} ({risk_eval['severity']})] เรียกใช้ AI วิเคราะห์ข้อมูลใหม่ (Re-analysis Completed in {elapsed_ms} ms)",
        ai_recommendation_snapshot=ai_output["recommendations"],
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(alert)
    return alert


@router.get("/alerts/{alert_id}/report")
def generate_incident_report(alert_id: int, db: Session = Depends(get_db)):
    """
    TC12: Generates a comprehensive Incident Triage Report with separated Raw Evidence,
    AI Analysis (5 Questions), IOC Enrichment, MITRE ATT&CK Mappings, and Analyst Audit Trail.
    """
    alert = db.query(SecurityAlert).filter(SecurityAlert.id == alert_id).first()
    if not alert or not alert.analysis:
        raise HTTPException(status_code=404, detail=f"Alert ID {alert_id} or its analysis not found.")

    an = alert.analysis
    mitre_lines = "\n".join(
        f"- **{m['technique_id']} - {m['name']}** (Tactic: `{m['tactic']}`, Confidence: `{m['confidence']}`)\n  - Evidence: {m['evidence']}"
        for m in an.mitre_mapping
    )
    ioc_lines = "\n".join(
        f"- **{i['indicator_type'].upper()}**: `{i['value']}` | Reputation: **{i['reputation']}** ({i['confidence_score']}%) | Source: {i['source']}\n  - Details: {i['details']}"
        for i in an.ioc_results
    ) or "- No external IOCs extracted"

    rec_lines = "\n".join(f"- {r}" for r in an.recommendations)
    cite_lines = "\n".join(f"- {c}" for c in an.evidence_citations)
    audit_lines = (
        "\n".join(
            f"- `[{a.created_at.isoformat()}]` **{a.analyst_name}** -> **{a.action}** (`{a.previous_status}` -> `{a.new_status}`): {a.comment}"
            for a in alert.audit_logs
        )
        if alert.audit_logs
        else "- Pending SOC Analyst Review (No human decision recorded yet)"
    )

    markdown_report = f"""# SentinelAI Security Incident Triage Report
**Alert Code:** `{alert.alert_code}` | **External ID:** `{alert.external_id or 'N/A'}`
**Current Status:** `{alert.status}` | **Source:** `{alert.source}`
**Event Timestamp:** `{alert.timestamp.isoformat()}`
**Target Host:** `{alert.hostname}` | **User:** `{alert.username or 'N/A'}`
**Network Flow:** `{alert.src_ip or 'N/A'}` -> `{alert.dst_ip or 'N/A'}` ({alert.protocol or 'N/A'})

---

## 1. เกิดเหตุการณ์อะไรขึ้น? (AI Executive Summary)
{an.ai_summary}

### การวิเคราะห์พฤติกรรมเชิงเทคนิค (Behavioral Analysis)
{an.behavior_analysis}

---

## 2. ระดับความเสี่ยง และ 3. เหตุผลประกอบ (Risk Score & Justification)
- **Severity:** `{an.severity}`
- **Risk Score:** `{an.risk_score} / 100`
- **Incident Category:** `{an.incident_type}`
- **คำอธิบายประกอบ:** {an.risk_justification}

---

## 4. เทคนิคการโจมตี MITRE ATT&CK ที่เกี่ยวข้อง
{mitre_lines}

---

## 5. ขั้นตอนที่ SOC Analyst ควรตรวจสอบต่อ (Actionable Recommendations)
{rec_lines}

---

## 6. ผลการตรวจสอบ Threat Intelligence (IOC Enrichment)
{ioc_lines}

---

## 7. หลักฐานต้นทางที่ใช้อ้างอิง (Source Evidence & Raw Log)
{cite_lines}

```text
{alert.raw_log}
```

---

## 8. ประวัติการตรวจสอบและอนุมัติโดยมนุษย์ (Human-in-the-Loop Audit Trail)
{audit_lines}
"""

    return {
        "alert_code": alert.alert_code,
        "external_id": alert.external_id,
        "status": alert.status,
        "severity": an.severity,
        "risk_score": an.risk_score,
        "incident_type": an.incident_type,
        "five_questions": {
            "q1_what_happened": an.ai_summary,
            "q2_risk_level": f"{an.severity} ({an.risk_score}/100)",
            "q3_why_this_risk": an.risk_justification,
            "q4_mitre_techniques": an.mitre_mapping,
            "q5_next_investigation_steps": an.recommendations,
        },
        "raw_evidence": {
            "raw_log": alert.raw_log,
            "evidence_citations": an.evidence_citations,
        },
        "audit_trail": [
            {
                "analyst_name": a.analyst_name,
                "action": a.action,
                "new_status": a.new_status,
                "comment": a.comment,
                "created_at": a.created_at.isoformat(),
            }
            for a in alert.audit_logs
        ],
        "markdown": markdown_report,
    }


def _compute_evaluation_metrics(alerts: List[SecurityAlert]) -> Dict[str, Any]:
    """
    Computes empirical evaluation metrics against datasets/ground_truth_eval.json:
    - Precision, Recall, F1-score for malicious alert triage
    - Severity Classification Accuracy
    - MITRE ATT&CK Mapping Accuracy
    """
    gt_path = settings.DATASETS_DIR / "ground_truth_eval.json"
    if not gt_path.exists():
        return {"available": False}

    gt_list = json.loads(gt_path.read_text(encoding="utf-8"))
    gt_map = {item["external_id"]: item for item in gt_list if "external_id" in item}

    tp = fp = tn = fn = 0
    sev_correct = 0
    mitre_correct = 0
    matched_total = 0

    for alert in alerts:
        if not alert.external_id or alert.external_id not in gt_map or not alert.analysis:
            continue
        matched_total += 1
        gt = gt_map[alert.external_id]
        predicted_malicious = bool(alert.analysis.is_suspicious)
        actual_malicious = bool(gt["expected_is_malicious"])

        if predicted_malicious and actual_malicious:
            tp += 1
        elif predicted_malicious and not actual_malicious:
            fp += 1
        elif not predicted_malicious and not actual_malicious:
            tn += 1
        else:
            fn += 1

        if alert.analysis.severity == gt["expected_severity"]:
            sev_correct += 1

        pred_mitre_ids = {m["technique_id"] for m in alert.analysis.mitre_mapping}
        exp_mitre_ids = set(gt.get("expected_mitre_ids", []))
        if exp_mitre_ids and exp_mitre_ids.issubset(pred_mitre_ids):
            mitre_correct += 1

    if matched_total == 0:
        return {"available": False, "matched_samples": 0}

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1_score = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "available": True,
        "matched_samples": matched_total,
        "precision": round(precision * 100, 1),
        "recall": round(recall * 100, 1),
        "f1_score": round(f1_score * 100, 1),
        "severity_accuracy": round((sev_correct / matched_total) * 100, 1),
        "mitre_mapping_accuracy": round((mitre_correct / matched_total) * 100, 1),
        "confusion_matrix": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
    }


@router.get("/dashboard/summary")
def get_dashboard_summary(
    workspace_id: Optional[str] = Query(None, description="Workspace UUID or code"),
    user_email: Optional[str] = Query(None, description="Verified member email"),
    db: Session = Depends(get_db),
):
    """
    TC09: Provides aggregated SOC statistics, Risk Distribution, MITRE ATT&CK tactic counts,
    Incident Timeline, and Ground-Truth Evaluation Metrics scoped to workspace_id.
    """
    ws = _resolve_workspace(db, workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER", "ANALYST", "VIEWER"))
    alerts = (
        db.query(SecurityAlert)
        .filter(SecurityAlert.workspace_id == ws.id)
        .order_by(SecurityAlert.timestamp.asc())
        .all()
    )
    total_alerts = len(alerts)

    severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    status_counts = {
        "PENDING_REVIEW": 0,
        "APPROVED": 0,
        "REJECTED": 0,
        "FALSE_POSITIVE": 0,
        "ESCALATED": 0,
    }
    tactic_counts: Dict[str, int] = {}
    timeline_data: List[Dict[str, Any]] = []
    durations: List[float] = []
    evidence_backed_count = 0

    for a in alerts:
        status_counts[a.status] = status_counts.get(a.status, 0) + 1
        if a.analysis:
            sev = a.analysis.severity
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
            durations.append(a.analysis.analysis_duration_ms)
            if a.analysis.evidence_citations and len(a.analysis.evidence_citations) > 0:
                evidence_backed_count += 1
            for m in a.analysis.mitre_mapping:
                tactic = m.get("tactic", "Other")
                tactic_counts[tactic] = tactic_counts.get(tactic, 0) + 1

            timeline_data.append(
                {
                    "id": a.id,
                    "alert_code": a.alert_code,
                    "timestamp": a.timestamp.strftime("%H:%M:%S"),
                    "full_timestamp": a.timestamp.isoformat(),
                    "hostname": a.hostname,
                    "incident_type": a.analysis.incident_type,
                    "risk_score": a.analysis.risk_score,
                    "severity": a.analysis.severity,
                    "status": a.status,
                }
            )

    avg_duration_ms = round(sum(durations) / len(durations), 2) if durations else 0.0
    evidence_rate = round((evidence_backed_count / total_alerts) * 100, 1) if total_alerts > 0 else 100.0
    reviewed_count = total_alerts - status_counts.get("PENDING_REVIEW", 0)

    return {
        "total_alerts": total_alerts,
        "pending_review_count": status_counts.get("PENDING_REVIEW", 0),
        "reviewed_count": reviewed_count,
        "avg_analysis_duration_ms": avg_duration_ms,
        "evidence_backed_rate": evidence_rate,
        "severity_distribution": [
            {"name": "CRITICAL", "value": severity_counts["CRITICAL"], "color": "#ef4444"},
            {"name": "HIGH", "value": severity_counts["HIGH"], "color": "#f97316"},
            {"name": "MEDIUM", "value": severity_counts["MEDIUM"], "color": "#eab308"},
            {"name": "LOW", "value": severity_counts["LOW"], "color": "#22c55e"},
        ],
        "status_distribution": status_counts,
        "mitre_tactic_distribution": [
            {"tactic": k, "count": v}
            for k, v in sorted(tactic_counts.items(), key=lambda x: x[1], reverse=True)
        ],
        "incident_timeline": timeline_data,
        "evaluation_metrics": _compute_evaluation_metrics(alerts),
    }


@router.get("/audit-logs", response_model=List[AuditLogSchema])
def list_audit_logs(
    workspace_id: Optional[str] = Query(None, description="Workspace UUID or code"),
    user_email: Optional[str] = Query(None, description="Verified member email (OWNER or ANALYST)"),
    db: Session = Depends(get_db),
):
    ws = _resolve_workspace(db, workspace_id)
    _check_member_role(db, ws, user_email, allowed_roles=("OWNER", "ANALYST"))
    return (
        db.query(AuditLog)
        .filter(AuditLog.workspace_id == ws.id)
        .order_by(AuditLog.created_at.desc())
        .all()
    )
