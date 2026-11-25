import asyncio
import io
from typing import Any, Dict, Optional
import pytest
from app.core.database import Base
from fastapi import HTTPException, UploadFile
from fastapi.encoders import jsonable_encoder
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.api.routes import (
    accept_workspace_invitation,
    create_workspace,
    create_workspace_invitation,
    generate_incident_report,
    get_alert_detail,
    get_dashboard_summary,
    ingest_csv_alerts,
    ingest_json_alerts,
    list_alerts,
    list_audit_logs,
    list_workspace_members,
    list_workspaces,
    seed_demo_datasets,
    submit_analyst_decision,
    verify_passwordless_email,
)
from app.models.schemas import (
    AnalystDecisionRequest,
    AuditLogSchema,
    IngestResponseSchema,
    PasswordlessAccessRequest,
    SecurityAlertSchema,
    UserSchema,
    WorkspaceCreateRequest,
    WorkspaceInvitationAcceptRequest,
    WorkspaceInvitationCreateRequest,
    WorkspaceInvitationSchema,
    WorkspaceMemberSchema,
    WorkspaceSchema,
)

# In-memory SQLite database for isolated deterministic testing
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


class _Response:
    def __init__(self, status_code: int, data: Any):
        self.status_code = status_code
        self._data = jsonable_encoder(data)

    def json(self) -> Any:
        return self._data


class InProcessFastAPIClient:
    """
    Executes FastAPI route handlers and Pydantic response validation in-process
    without requiring Windows loopback socketpair threads.
    """
    def post(
        self,
        path: str,
        json: Any = None,
        files: Optional[Dict[str, Any]] = None,
        workspace_id: str = "SNT-WS-001",
        user_email: Optional[str] = None,
    ) -> _Response:
        db = TestingSessionLocal()
        try:
            if path == "/api/access/verify-email":
                req = PasswordlessAccessRequest(**json)
                res = verify_passwordless_email(payload=req, db=db)
                return _Response(200, res)

            if path == "/api/workspaces":
                req = WorkspaceCreateRequest(**json)
                res = create_workspace(payload=req, db=db)
                validated = WorkspaceSchema.model_validate(res)
                return _Response(200, validated)

            if path.startswith("/api/workspaces/") and path.endswith("/invitations"):
                ws_id = path.split("/")[3]
                req = WorkspaceInvitationCreateRequest(**json)
                res = create_workspace_invitation(workspace_id=ws_id, payload=req, user_email=user_email, db=db)
                validated = WorkspaceInvitationSchema.model_validate(res)
                return _Response(200, validated)

            if path == "/api/invitations/accept":
                req = WorkspaceInvitationAcceptRequest(**json)
                res = accept_workspace_invitation(payload=req, db=db)
                return _Response(200, res)

            if path == "/api/alerts/ingest/json":
                res = ingest_json_alerts(payload=json, workspace_id=workspace_id, filename="Manual JSON Payload", user_email=user_email, db=db)
                validated = IngestResponseSchema.model_validate(res)
                return _Response(200, validated)

            if path == "/api/alerts/ingest/csv":
                file_tuple = files["file"]
                upload = UploadFile(filename=file_tuple[0], file=file_tuple[1])
                res = ingest_csv_alerts(file=upload, workspace_id=workspace_id, user_email=user_email, db=db)
                validated = IngestResponseSchema.model_validate(res)
                return _Response(200, validated)

            if path == "/api/alerts/seed-demo":
                res = seed_demo_datasets(workspace_id=workspace_id, user_email=user_email, db=db)
                validated = IngestResponseSchema.model_validate(res)
                return _Response(200, validated)

            if path.startswith("/api/alerts/") and path.endswith("/decision"):
                alert_id = int(path.split("/")[3])
                req = AnalystDecisionRequest(**json)
                res = submit_analyst_decision(alert_id=alert_id, decision_req=req, user_email=user_email, db=db)
                validated = SecurityAlertSchema.model_validate(res)
                return _Response(200, validated)

            return _Response(404, {"detail": "Not Found"})
        except HTTPException as exc:
            return _Response(exc.status_code, {"detail": exc.detail})
        finally:
            db.close()

    def get(
        self,
        path: str,
        workspace_id: str = "SNT-WS-001",
        user_email: Optional[str] = None,
    ) -> _Response:
        db = TestingSessionLocal()
        try:
            if path == "/api/workspaces":
                res = list_workspaces(user_email=user_email, db=db)
                validated = [WorkspaceSchema.model_validate(w) for w in res]
                return _Response(200, validated)

            if path.startswith("/api/workspaces/") and path.endswith("/members"):
                ws_id = path.split("/")[3]
                res = list_workspace_members(workspace_id=ws_id, user_email=user_email, db=db)
                validated = [WorkspaceMemberSchema.model_validate(m) for m in res]
                return _Response(200, validated)

            if path == "/api/alerts":
                res = list_alerts(workspace_id=workspace_id, user_email=user_email, severity=None, status=None, search=None, db=db)
                validated = [SecurityAlertSchema.model_validate(a) for a in res]
                return _Response(200, validated)

            if path == "/api/dashboard/summary":
                res = get_dashboard_summary(workspace_id=workspace_id, user_email=user_email, db=db)
                return _Response(200, res)

            if path == "/api/audit-logs":
                res = list_audit_logs(workspace_id=workspace_id, user_email=user_email, db=db)
                validated = [AuditLogSchema.model_validate(l) for l in res]
                return _Response(200, validated)

            if path.startswith("/api/alerts/") and path.endswith("/report"):
                alert_id = int(path.split("/")[3])
                res = generate_incident_report(alert_id=alert_id, db=db)
                return _Response(200, res)

            if path.startswith("/api/alerts/"):
                alert_id = int(path.split("/")[3])
                res = get_alert_detail(alert_id=alert_id, db=db)
                validated = SecurityAlertSchema.model_validate(res)
                return _Response(200, validated)

            return _Response(404, {"detail": "Not Found"})
        except HTTPException as exc:
            return _Response(exc.status_code, {"detail": exc.detail})
        finally:
            db.close()


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield


client = InProcessFastAPIClient()


def test_tc01_ingest_json_alert():
    """TC01: รับ JSON Alert ได้ (Wazuh JSON format)"""
    payload = {
        "id": "wazuh-test-01",
        "timestamp": "2026-11-18T01:12:04Z",
        "agent": {"id": "001", "name": "prod-auth-srv-01", "ip": "10.20.1.15"},
        "rule": {
            "id": "5712",
            "level": 12,
            "description": "SSHD brute force trying to get access to the system.",
            "mitre": {"id": ["T1110"]},
        },
        "data": {"srcip": "185.220.101.45", "dstip": "10.20.1.15", "srcuser": "root"},
        "full_log": "Failed password for root from 185.220.101.45 port 49812 ssh2",
    }
    resp = client.post("/api/alerts/ingest/json", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["ingested_count"] == 1
    assert data["deduplicated_count"] == 0
    alert = data["alerts"][0]
    assert alert["alert_code"] == "ALT-0001"
    assert alert["hostname"] == "prod-auth-srv-01"
    assert alert["src_ip"] == "185.220.101.45"


def test_tc02_ingest_csv_log():
    """TC02: รับ CSV Log ได้"""
    csv_content = (
        "timestamp,alert_id,source,rule_id,rule_level,description,src_ip,dst_ip,username,hostname,domain,file_hash,protocol,raw_log\n"
        "2026-11-18T03:05:12Z,CSV-9001,CICIDS2017,100201,10,Network Port Scan detected,103.145.12.88,10.20.2.50,unknown,fw-edge-01,,,TCP,SYN_SCAN 120 ports\n"
    ).encode("utf-8")

    resp = client.post(
        "/api/alerts/ingest/csv",
        files={"file": ("test_logs.csv", io.BytesIO(csv_content), "text/csv")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ingested_count"] == 1
    assert data["alerts"][0]["source"] == "CICIDS2017"


def test_tc03_reject_incomplete_alert():
    """TC03: ตรวจสอบข้อมูลที่ไม่สมบูรณ์ (Missing description)"""
    incomplete_payload = {"source": "Wazuh", "src_ip": "192.168.1.10"}
    resp = client.post("/api/alerts/ingest/json", json=incomplete_payload)
    assert resp.status_code == 422
    assert "description" in resp.json()["detail"].lower()


def test_tc04_deduplicate_alert():
    """TC04: ตรวจจับ Alert ซ้ำ และเพิ่ม occurrence_count แทนการสร้างซ้ำ"""
    payload = {
        "id": "dup-01",
        "rule": {"id": "5712", "level": 12, "description": "Repeated SSH brute force attack"},
        "agent": {"name": "srv-01"},
        "data": {"srcip": "185.220.101.45", "dstip": "10.20.1.15", "srcuser": "root"},
    }
    r1 = client.post("/api/alerts/ingest/json", json=payload)
    assert r1.json()["ingested_count"] == 1

    r2 = client.post("/api/alerts/ingest/json", json=payload)
    assert r2.json()["ingested_count"] == 0
    assert r2.json()["deduplicated_count"] == 1
    assert r2.json()["alerts"][0]["occurrence_count"] == 2


def test_tc05_calculate_risk_score():
    """TC05: คำนวณ Risk Score ด้วย Rule Engine แยกจาก LLM พร้อม scoring_breakdown"""
    payload = {
        "id": "risk-01",
        "rule": {
            "id": "87901",
            "level": 15,
            "description": "Ransomware shadow copy deletion detected (vssadmin.exe delete shadows /all /quiet)",
            "mitre": {"id": ["T1486", "T1490"]},
        },
        "agent": {"name": "fileshare-srv-02"},
        "data": {
            "srcip": "10.20.4.109",
            "srcuser": "CORP\\j.somsak",
            "command_line": "vssadmin.exe delete shadows /all /quiet",
            "file_hash": "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f",
        },
    }
    resp = client.post("/api/alerts/ingest/json", json=payload)
    analysis = resp.json()["alerts"][0]["analysis"]
    assert analysis["risk_score"] >= 85
    assert analysis["severity"] == "CRITICAL"
    assert len(analysis["scoring_breakdown"]) >= 3


def test_tc06_ai_alert_analysis_with_evidence():
    """TC06: วิเคราะห์ Alert ด้วย AI ครบ 5 คำถาม พร้อมอ้างอิงหลักฐานต้นทาง (evidence_citations)"""
    payload = {
        "id": "ai-01",
        "rule": {
            "id": "91802",
            "level": 14,
            "description": "Suspicious PowerShell execution with Base64 EncodedCommand",
        },
        "agent": {"name": "win-fin-wks-09"},
        "data": {
            "srcip": "10.20.4.109",
            "dstip": "91.215.85.142",
            "domain": "update-telemetry-cdn.ru",
            "command_line": "powershell.exe -Enc SQBFAFgA",
        },
    }
    resp = client.post("/api/alerts/ingest/json", json=payload)
    analysis = resp.json()["alerts"][0]["analysis"]
    assert analysis["ai_summary"] != ""
    assert analysis["behavior_analysis"] != ""
    assert analysis["risk_justification"] != ""
    assert len(analysis["recommendations"]) >= 3
    assert len(analysis["evidence_citations"]) >= 2
    assert analysis["requires_analyst_review"] is True


def test_tc07_mitre_attack_mapping():
    """TC07: Mapping MITRE ATT&CK STIX Technique & Tactic พร้อม Evidence"""
    payload = {
        "id": "mitre-01",
        "rule": {
            "id": "92055",
            "level": 15,
            "description": "LSASS memory access detected indicating possible credential dumping (Mimikatz).",
        },
        "agent": {"name": "win-wks-01"},
        "full_log": "Process accessed lsass.exe with GrantedAccess 0x1010",
    }
    resp = client.post("/api/alerts/ingest/json", json=payload)
    mitre = resp.json()["alerts"][0]["analysis"]["mitre_mapping"]
    tech_ids = [m["technique_id"] for m in mitre]
    assert "T1003.001" in tech_ids


def test_tc08_ioc_enrichment():
    """TC08: ตรวจสอบ IOC (IP, Domain, File Hash)"""
    payload = {
        "id": "ioc-01",
        "rule": {"id": "5712", "level": 12, "description": "Malicious C2 connection"},
        "data": {
            "srcip": "185.220.101.45",
            "domain": "update-telemetry-cdn.ru",
            "file_hash": "44d88612fea8a8f36de82e1278abb02f",
        },
    }
    resp = client.post("/api/alerts/ingest/json", json=payload)
    iocs = resp.json()["alerts"][0]["analysis"]["ioc_results"]
    assert len(iocs) == 3
    assert all(i["reputation"] == "MALICIOUS" for i in iocs)


def test_tc09_dashboard_summary_and_metrics():
    """TC09: แสดง Incident Dashboard และคำนวณ Evaluation Metrics (Precision/Recall/F1)"""
    seed_resp = client.post("/api/alerts/seed-demo")
    assert seed_resp.status_code == 200
    assert seed_resp.json()["ingested_count"] == 12

    dash_resp = client.get("/api/dashboard/summary")
    assert dash_resp.status_code == 200
    summary = dash_resp.json()
    assert summary["total_alerts"] == 12
    assert summary["evaluation_metrics"]["available"] is True
    assert summary["evaluation_metrics"]["f1_score"] >= 90.0
    assert summary["evaluation_metrics"]["severity_accuracy"] >= 90.0
    assert summary["evaluation_metrics"]["mitre_mapping_accuracy"] >= 90.0


def test_tc10_analyst_approve_and_reject_workflow():
    """TC10: Analyst Approve / Reject AI Recommendation"""
    client.post("/api/alerts/seed-demo")
    alerts = client.get("/api/alerts").json()
    first_id = alerts[0]["id"]

    approve_resp = client.post(
        f"/api/alerts/{first_id}/decision",
        json={
            "analyst_name": "Somchai (Tier-2 SOC)",
            "action": "APPROVE",
            "comment": "Confirmed malicious activity via EDR telemetry; proceeding with host isolation.",
        },
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "APPROVED"


def test_tc11_immutable_audit_trail():
    """TC11: บันทึก Audit Trail (ผู้ดำเนินการ เวลา การตัดสินใจ และสถานะก่อน-หลัง)"""
    client.post("/api/alerts/seed-demo")
    alerts = client.get("/api/alerts").json()
    target_id = alerts[0]["id"]

    client.post(
        f"/api/alerts/{target_id}/decision",
        json={
            "analyst_name": "Nattapong (SOC Lead)",
            "action": "ESCALATE",
            "comment": "Escalating to Incident Response team immediately.",
        },
    )
    logs_resp = client.get("/api/audit-logs")
    assert logs_resp.status_code == 200
    logs = logs_resp.json()
    assert len(logs) == 1
    assert logs[0]["analyst_name"] == "Nattapong (SOC Lead)"
    assert logs[0]["previous_status"] == "PENDING_REVIEW"
    assert logs[0]["new_status"] == "ESCALATED"


def test_tc12_generate_incident_report():
    """TC12: สร้าง Incident Report พร้อมหลักฐานต้นทางและคำตอบครบ 5 ข้อ"""
    client.post("/api/alerts/seed-demo")
    alerts = client.get("/api/alerts").json()
    target_id = alerts[0]["id"]

    rep_resp = client.get(f"/api/alerts/{target_id}/report")
    assert rep_resp.status_code == 200
    report = rep_resp.json()
    assert "five_questions" in report
    assert "markdown" in report
    assert "SentinelAI Security Incident Triage Report" in report["markdown"]


def test_tc13_workspace_isolation_and_owner_member_invitation_rbac():
    """TC13: ทดสอบการแยกข้อมูลตาม Workspace ID, การเชิญสมาชิกด้วย Single-Use Token และการจำกัดสิทธิ์ OWNER / ANALYST / VIEWER"""
    # 1. สร้าง Workspace ใหม่ โดยมี owner_b@sentinelai.soc เป็นเจ้าของห้อง
    ws_b_resp = client.post(
        "/api/workspaces",
        json={
            "name": "Red Team Isolation Workspace",
            "description": "Isolated workspace for TC13",
            "owner_email": "owner_b@sentinelai.soc",
            "owner_name": "Owner B",
        },
    )
    assert ws_b_resp.status_code == 200
    ws_b_code = ws_b_resp.json()["workspace_code"]
    assert ws_b_resp.json()["current_user_role"] == "OWNER"

    # 2. นำเข้า Alert ลงใน SNT-WS-001 และตรวจสอบว่าห้องใหม่มองไม่เห็นข้อมูลของ SNT-WS-001
    payload_a = {
        "id": "ws-iso-01",
        "rule": {"id": "5712", "level": 12, "description": "Workspace A Exclusive Alert"},
        "agent": {"name": "srv-ws-a"},
        "data": {"srcip": "185.220.101.45"},
    }
    client.post("/api/alerts/ingest/json", json=payload_a, workspace_id="SNT-WS-001")

    alerts_ws_a = client.get("/api/alerts", workspace_id="SNT-WS-001").json()
    alerts_ws_b = client.get(
        "/api/alerts", workspace_id=ws_b_code, user_email="owner_b@sentinelai.soc"
    ).json()
    assert len(alerts_ws_a) == 1
    assert len(alerts_ws_b) == 0

    # 3. ผู้ใช้ที่ไม่ได้เป็นสมาชิกของห้องใหม่ ต้องถูกปฏิเสธการเข้าถึง (403 Forbidden)
    unauth_resp = client.get(
        "/api/alerts", workspace_id=ws_b_code, user_email="outsider@sentinelai.soc"
    )
    assert unauth_resp.status_code == 403

    # 4. Owner สร้างคำเชิญ (Single-Use Invitation Token) ให้ viewer_b@sentinelai.soc ในบทบาท VIEWER
    inv_resp = client.post(
        f"/api/workspaces/{ws_b_code}/invitations",
        json={
            "invited_email": "viewer_b@sentinelai.soc",
            "role": "VIEWER",
            "expires_in_hours": 48,
        },
        user_email="owner_b@sentinelai.soc",
    )
    assert inv_resp.status_code == 200
    token = inv_resp.json()["token"]

    # 5. สมาชิกกดรับคำเชิญด้วย Token
    accept_resp = client.post(
        "/api/invitations/accept",
        json={
            "token": token,
            "email": "viewer_b@sentinelai.soc",
            "display_name": "Viewer B",
        },
    )
    assert accept_resp.status_code == 200
    assert accept_resp.json()["role"] == "VIEWER"

    # Token แบบใช้ครั้งเดียว (Single-Use) เมื่อนำมาใช้ซ้ำต้องถูกปฏิเสธ (400 Bad Request)
    reuse_resp = client.post(
        "/api/invitations/accept",
        json={"token": token, "email": "viewer_b@sentinelai.soc"},
    )
    assert reuse_resp.status_code == 400

    # 6. VIEWER สามารถดู Alerts ในห้องได้ แต่ไม่สามารถ Import Alerts หรือดู Audit Logs ได้ (403 Forbidden)
    viewer_list = client.get(
        "/api/alerts", workspace_id=ws_b_code, user_email="viewer_b@sentinelai.soc"
    )
    assert viewer_list.status_code == 200

    viewer_ingest = client.post(
        "/api/alerts/ingest/json",
        json=payload_a,
        workspace_id=ws_b_code,
        user_email="viewer_b@sentinelai.soc",
    )
    assert viewer_ingest.status_code == 403

    viewer_audit = client.get(
        "/api/audit-logs", workspace_id=ws_b_code, user_email="viewer_b@sentinelai.soc"
    )
    assert viewer_audit.status_code == 403

