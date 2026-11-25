from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PasswordlessAccessRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=180)
    display_name: Optional[str] = Field(default="")


class UserSchema(BaseModel):
    id: str
    email: str
    display_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = Field(default="")
    owner_email: Optional[str] = Field(default="owner@sentinelai.soc")
    owner_name: Optional[str] = Field(default="Somchai (Workspace Owner)")


class WorkspaceMemberSchema(BaseModel):
    id: int
    workspace_id: str
    user_id: str
    email: str
    display_name: str
    role: str  # OWNER | ANALYST | VIEWER
    status: str  # ACTIVE | SUSPENDED
    joined_at: datetime


class WorkspaceMemberUpdateRequest(BaseModel):
    role: Optional[str] = Field(default=None, pattern="^(OWNER|ANALYST|VIEWER)$")
    status: Optional[str] = Field(default=None, pattern="^(ACTIVE|SUSPENDED)$")


class WorkspaceInvitationCreateRequest(BaseModel):
    invited_email: str = Field(..., min_length=3, max_length=180)
    role: str = Field(default="ANALYST", pattern="^(OWNER|ANALYST|VIEWER)$")
    expires_in_hours: int = Field(default=72, ge=1, le=720)


class WorkspaceInvitationAcceptRequest(BaseModel):
    token: str = Field(..., min_length=6)
    email: Optional[str] = Field(default=None)
    display_name: Optional[str] = Field(default=None)


class WorkspaceInvitationSchema(BaseModel):
    id: int
    invite_code: str
    workspace_id: str
    workspace_code: str
    workspace_name: str
    invited_email: str
    role: str
    token: str
    invite_link: str
    status: str  # PENDING | ACCEPTED | REVOKED | EXPIRED
    invited_by_email: str
    expires_at: datetime
    created_at: datetime
    accepted_at: Optional[datetime] = None


class WorkspaceSchema(BaseModel):
    id: str
    workspace_code: str
    name: str
    description: Optional[str] = ""
    owner_email: str = "owner@sentinelai.soc"
    owner_name: str = "Somchai (Workspace Owner)"
    current_user_role: str = "OWNER"
    members_count: int = 1
    pending_invites_count: int = 0
    alerts_count: int = 0
    pending_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ImportHistorySchema(BaseModel):
    id: int
    import_code: str
    workspace_id: str
    source_type: str
    filename: str
    total_events: int
    new_events: int
    duplicated_events: int
    failed_events: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MitreTechniqueSchema(BaseModel):
    technique_id: str
    name: str
    tactic: str
    confidence: str = "HIGH"
    evidence: str
    url: str


class IOCIndicatorSchema(BaseModel):
    indicator_type: str
    value: str
    reputation: str
    confidence_score: int
    source: str
    tags: List[str] = []
    details: str


class ScoringFactorSchema(BaseModel):
    factor: str
    points: int
    reason: str


class AlertAnalysisSchema(BaseModel):
    id: int
    workspace_id: Optional[str] = "ws-default-001"
    risk_score: int
    severity: str
    incident_type: str
    scoring_breakdown: List[ScoringFactorSchema]
    ioc_results: List[IOCIndicatorSchema]
    mitre_mapping: List[MitreTechniqueSchema]
    ai_provider: str
    ai_summary: str
    behavior_analysis: str
    risk_justification: str
    evidence_citations: List[str]
    recommendations: List[str]
    is_suspicious: bool
    requires_analyst_review: bool
    analysis_duration_ms: float
    analyzed_at: datetime

    model_config = {"from_attributes": True}


class AuditLogSchema(BaseModel):
    id: int
    workspace_id: Optional[str] = "ws-default-001"
    alert_id: Optional[int] = None
    alert_code: str
    analyst_name: str
    action: str
    previous_status: str
    new_status: str
    comment: str
    ai_recommendation_snapshot: Optional[List[str]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SecurityAlertSchema(BaseModel):
    id: int
    workspace_id: Optional[str] = "ws-default-001"
    alert_code: str
    external_id: Optional[str] = None
    dedup_hash: str
    occurrence_count: int
    source: str
    timestamp: datetime
    rule_id: Optional[str] = None
    rule_level: int
    description: str
    hostname: Optional[str] = None
    src_ip: Optional[str] = None
    dst_ip: Optional[str] = None
    username: Optional[str] = None
    process_name: Optional[str] = None
    command_line: Optional[str] = None
    domain: Optional[str] = None
    file_hash: Optional[str] = None
    protocol: Optional[str] = None
    raw_log: str
    raw_payload: Dict[str, Any]
    status: str
    created_at: datetime
    updated_at: datetime
    analysis: Optional[AlertAnalysisSchema] = None
    audit_logs: List[AuditLogSchema] = []

    model_config = {"from_attributes": True}


class EvidenceImageAttachmentSchema(BaseModel):
    id: str = Field(..., description="Unique attachment ID")
    title: str = Field(..., min_length=1, max_length=200, description="Suspicious point caption")
    image_data: str = Field(..., min_length=10, description="Base64 Data URL of the image")
    uploaded_by: str = Field(default="owner@sentinelai.soc")
    created_at: str = Field(default="")


class EvidenceImageUploadRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="คำอธิบายจุดน่าสงสัยในรูปภาพ")
    image_data: str = Field(..., min_length=10, description="Base64 Data URL (image/png, image/jpeg, image/webp)")


class AnalystDecisionRequest(BaseModel):
    analyst_name: str = Field(
        default="Local Operator",
        min_length=2,
        description="System/Local actor label or verified member email",
    )
    action: str = Field(
        ...,
        pattern="^(APPROVE|REJECT|FALSE_POSITIVE|ESCALATE|NEEDS_REANALYSIS|RE_ANALYSIS|UPDATE_RISK|APPROVE_ALERT|REJECT_ALERT|FALSE_POSITIVE_ALERT|ESCALATE_ALERT)$",
        description="Decision action",
    )
    comment: str = Field(..., min_length=3, description="Mandatory audit justification")
    adjusted_severity: Optional[str] = Field(
        None,
        description="Optional severity override by analyst: CRITICAL, HIGH, MEDIUM, LOW",
    )
    adjusted_risk_score: Optional[int] = Field(
        None,
        ge=0,
        le=100,
        description="Optional risk score override (0-100)",
    )
    evidence_image_data: Optional[str] = Field(
        None,
        description="Optional Base64 image data attached during review confirmation",
    )
    evidence_image_title: Optional[str] = Field(
        None,
        description="Optional caption for the attached suspicious point image",
    )


class IngestResponseSchema(BaseModel):
    ingested_count: int
    deduplicated_count: int
    alerts: List[SecurityAlertSchema]
