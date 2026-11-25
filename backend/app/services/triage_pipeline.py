import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple
from sqlalchemy.orm import Session
from app.models.alert import (
    AlertAnalysis,
    AuditLog,
    ImportHistory,
    SecurityAlert,
    User,
    Workspace,
    WorkspaceInvitation,
    WorkspaceMember,
)
from app.services.normalizer import normalize_alert_payload
from app.services.ioc_enrichment import enrich_alert_iocs
from app.mitre_mapping.mapper import map_alert_to_mitre
from app.rule_engine.evaluator import evaluate_alert_risk
from app.ai_engine.analyzer import analyze_alert_with_ai

DEFAULT_WORKSPACE_ID = "ws-default-001"
SECONDARY_WORKSPACE_ID = "ws-testing-002"
DEFAULT_OWNER_EMAIL = "owner@sentinelai.soc"


def ensure_default_workspaces(db: Session) -> Workspace:
    """
    Seeds default Passwordless SOC users (Owner, Analyst, Viewer),
    default Workspaces (SNT-WS-001, SNT-WS-002), Workspace Memberships,
    and a sample pending Invitation link so all 10 pages have realistic initial data.
    """
    # 1. Seed default SOC Users (Passwordless email identities)
    owner_user = db.query(User).filter(User.email == DEFAULT_OWNER_EMAIL).first()
    if not owner_user:
        owner_user = User(
            id="usr-owner-001",
            email=DEFAULT_OWNER_EMAIL,
            display_name="Somchai (Workspace Owner)",
        )
        db.add(owner_user)

    analyst_user = db.query(User).filter(User.email == "analyst@sentinelai.soc").first()
    if not analyst_user:
        analyst_user = User(
            id="usr-analyst-002",
            email="analyst@sentinelai.soc",
            display_name="Nattapong (Tier-2 Analyst)",
        )
        db.add(analyst_user)

    viewer_user = db.query(User).filter(User.email == "viewer@sentinelai.soc").first()
    if not viewer_user:
        viewer_user = User(
            id="usr-viewer-003",
            email="viewer@sentinelai.soc",
            display_name="Kitti (SOC Auditor / Viewer)",
        )
        db.add(viewer_user)

    db.flush()

    # 2. Seed Workspaces
    ws1 = db.query(Workspace).filter(Workspace.id == DEFAULT_WORKSPACE_ID).first()
    if not ws1:
        ws1 = Workspace(
            id=DEFAULT_WORKSPACE_ID,
            workspace_code="SNT-WS-001",
            name="My SOC Workspace",
            description="พื้นที่ทำงานหลักของทีม SOC สำหรับวิเคราะห์ Security Alerts, ตรวจสอบด้วย AI และจัดการสมาชิก",
            owner_user_id=owner_user.id,
        )
        db.add(ws1)

    ws2 = db.query(Workspace).filter(Workspace.id == SECONDARY_WORKSPACE_ID).first()
    if not ws2:
        ws2 = Workspace(
            id=SECONDARY_WORKSPACE_ID,
            workspace_code="SNT-WS-002",
            name="Testing Workspace",
            description="ห้องทดลองแยกอิสระสำหรับทดสอบการนำเข้าไฟล์ JSON / CSV และทดสอบการแยกสิทธิ์ระหว่างห้อง",
            owner_user_id=owner_user.id,
        )
        db.add(ws2)

    db.flush()

    # 3. Seed Workspace Members for SNT-WS-001
    default_members = [
        (ws1.id, owner_user.id, "OWNER"),
        (ws1.id, analyst_user.id, "ANALYST"),
        (ws1.id, viewer_user.id, "VIEWER"),
        (ws2.id, owner_user.id, "OWNER"),
    ]
    for w_id, u_id, role_name in default_members:
        exists_mem = (
            db.query(WorkspaceMember)
            .filter(
                WorkspaceMember.workspace_id == w_id,
                WorkspaceMember.user_id == u_id,
            )
            .first()
        )
        if not exists_mem:
            db.add(
                WorkspaceMember(
                    workspace_id=w_id,
                    user_id=u_id,
                    role=role_name,
                    status="ACTIVE",
                )
            )

    # 4. Seed sample pending invitations for SNT-WS-001 and SNT-WS-002 so inbox & join codes work immediately
    has_inv = (
        db.query(WorkspaceInvitation)
        .filter(WorkspaceInvitation.workspace_id == ws1.id)
        .first()
    )
    if not has_inv:
        db.add(
            WorkspaceInvitation(
                invite_code="INV-0001",
                workspace_id=ws1.id,
                invited_email="ir-specialist@sentinelai.soc",
                role="ANALYST",
                token="snt_inv_demo_token_2026_soc_team",
                status="PENDING",
                invited_by_email=DEFAULT_OWNER_EMAIL,
                expires_at=datetime.now(timezone.utc) + timedelta(hours=72),
            )
        )

    ws2_invs = [
        ("INV-0002", "analyst@sentinelai.soc", "ANALYST", "JOIN-WS2-ANALYST"),
        ("INV-0003", "viewer@sentinelai.soc", "VIEWER", "JOIN-WS2-VIEWER"),
    ]
    for inv_code, inv_email, inv_role, inv_tok in ws2_invs:
        exists_tok = (
            db.query(WorkspaceInvitation)
            .filter(WorkspaceInvitation.token == inv_tok)
            .first()
        )
        if not exists_tok:
            db.add(
                WorkspaceInvitation(
                    invite_code=inv_code,
                    workspace_id=ws2.id,
                    invited_email=inv_email,
                    role=inv_role,
                    token=inv_tok,
                    status="PENDING",
                    invited_by_email=DEFAULT_OWNER_EMAIL,
                    expires_at=datetime.now(timezone.utc) + timedelta(hours=168),
                )
            )

    db.commit()
    db.refresh(ws1)
    return ws1


def _generate_next_alert_code(db: Session) -> str:
    last_alert = db.query(SecurityAlert).order_by(SecurityAlert.id.desc()).first()
    next_num = (last_alert.id + 1) if last_alert else 1
    return f"ALT-{next_num:04d}"


def _generate_next_import_code(db: Session) -> str:
    last_imp = db.query(ImportHistory).order_by(ImportHistory.id.desc()).first()
    next_num = (last_imp.id + 1) if last_imp else 1
    return f"IMP-{next_num:04d}"


def process_and_store_alert(
    db: Session,
    raw_payload: Dict[str, Any],
    workspace_id: str = DEFAULT_WORKSPACE_ID,
) -> Tuple[SecurityAlert, bool]:
    """
    Runs the full SentinelAI Triage Pipeline on a single alert payload scoped to workspace_id.
    """
    start_ts = time.perf_counter()
    normalized = normalize_alert_payload(raw_payload)

    scoped_dedup_hash = f"{workspace_id}:{normalized['dedup_hash']}"

    existing = (
        db.query(SecurityAlert)
        .filter(
            SecurityAlert.workspace_id == workspace_id,
            SecurityAlert.dedup_hash == scoped_dedup_hash,
        )
        .first()
    )
    if not existing and normalized.get("external_id"):
        existing = (
            db.query(SecurityAlert)
            .filter(
                SecurityAlert.workspace_id == workspace_id,
                SecurityAlert.external_id == normalized["external_id"],
            )
            .first()
        )
    if existing:
        existing.occurrence_count += 1
        db.commit()
        db.refresh(existing)
        return existing, True

    alert_code = _generate_next_alert_code(db)
    alert_obj = SecurityAlert(
        workspace_id=workspace_id,
        alert_code=alert_code,
        external_id=normalized["external_id"],
        dedup_hash=scoped_dedup_hash,
        occurrence_count=1,
        source=normalized["source"],
        timestamp=normalized["timestamp"],
        rule_id=normalized["rule_id"],
        rule_level=normalized["rule_level"],
        description=normalized["description"],
        hostname=normalized["hostname"],
        src_ip=normalized["src_ip"],
        dst_ip=normalized["dst_ip"],
        username=normalized["username"],
        process_name=normalized["process_name"],
        command_line=normalized["command_line"],
        domain=normalized["domain"],
        file_hash=normalized["file_hash"],
        protocol=normalized["protocol"],
        raw_log=normalized["raw_log"],
        raw_payload=normalized["raw_payload"],
        status="PENDING_REVIEW",
    )
    db.add(alert_obj)
    db.flush()

    ioc_results = enrich_alert_iocs(normalized)
    mitre_mappings = map_alert_to_mitre(normalized)
    risk_eval = evaluate_alert_risk(normalized, ioc_results, mitre_mappings)
    ai_output = analyze_alert_with_ai(normalized, risk_eval, ioc_results, mitre_mappings)

    elapsed_ms = round((time.perf_counter() - start_ts) * 1000.0, 2)

    analysis_obj = AlertAnalysis(
        workspace_id=workspace_id,
        alert_id=alert_obj.id,
        risk_score=risk_eval["risk_score"],
        severity=risk_eval["severity"],
        incident_type=risk_eval["incident_type"],
        scoring_breakdown=risk_eval["scoring_breakdown"],
        ioc_results=ioc_results,
        mitre_mapping=mitre_mappings,
        ai_provider=ai_output["ai_provider"],
        ai_summary=ai_output["ai_summary"],
        behavior_analysis=ai_output["behavior_analysis"],
        risk_justification=ai_output["risk_justification"],
        evidence_citations=ai_output["evidence_citations"],
        recommendations=ai_output["recommendations"],
        is_suspicious=ai_output["is_suspicious"],
        requires_analyst_review=ai_output["requires_analyst_review"],
        analysis_duration_ms=elapsed_ms,
    )
    db.add(analysis_obj)
    db.commit()
    db.refresh(alert_obj)
    return alert_obj, False


def process_batch_alerts(
    db: Session,
    payloads: List[Dict[str, Any]],
    workspace_id: str = DEFAULT_WORKSPACE_ID,
    source_type: str = "JSON Upload",
    filename: str = "Manual JSON Payload",
) -> Dict[str, Any]:
    ensure_default_workspaces(db)

    ingested = 0
    deduplicated = 0
    results: List[SecurityAlert] = []

    for item in payloads:
        alert_obj, is_dup = process_and_store_alert(db, item, workspace_id=workspace_id)
        if is_dup:
            deduplicated += 1
        else:
            ingested += 1
        results.append(alert_obj)

    imp_record = ImportHistory(
        import_code=_generate_next_import_code(db),
        workspace_id=workspace_id,
        source_type=source_type,
        filename=filename,
        total_events=len(payloads),
        new_events=ingested,
        duplicated_events=deduplicated,
        failed_events=0,
        status="SUCCESS",
    )
    db.add(imp_record)

    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if ws and results:
        ws.updated_at = results[-1].created_at
    db.commit()

    return {
        "ingested_count": ingested,
        "deduplicated_count": deduplicated,
        "alerts": results,
    }
