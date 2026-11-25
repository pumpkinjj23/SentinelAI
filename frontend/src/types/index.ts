export type WorkspaceRole = 'OWNER' | 'ANALYST' | 'VIEWER' | 'NOT_MEMBER';

export interface SOCUserIdentity {
  id: string;
  email: string;
  display_name: string;
  created_at?: string;
}

export interface WorkspaceInfo {
  id: string;
  workspace_code: string;
  name: string;
  description: string;
  owner_email: string;
  owner_name: string;
  current_user_role: WorkspaceRole;
  members_count: number;
  pending_invites_count: number;
  alerts_count: number;
  pending_count: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMemberInfo {
  id: number;
  workspace_id: string;
  user_id: string;
  email: string;
  display_name: string;
  role: 'OWNER' | 'ANALYST' | 'VIEWER';
  status: 'ACTIVE' | 'SUSPENDED';
  joined_at: string;
}

export interface WorkspaceInvitationInfo {
  id: number;
  invite_code: string;
  workspace_id: string;
  workspace_code: string;
  workspace_name: string;
  invited_email: string;
  role: 'OWNER' | 'ANALYST' | 'VIEWER';
  token: string;
  invite_link: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  invited_by_email: string;
  expires_at: string;
  created_at: string;
  accepted_at?: string | null;
}

export interface ImportHistoryRecord {
  id: number;
  import_code: string;
  workspace_id: string;
  source_type: string;
  filename: string;
  total_events: number;
  new_events: number;
  duplicated_events: number;
  failed_events: number;
  status: string;
  created_at: string;
}

export interface MitreTechnique {
  technique_id: string;
  name: string;
  tactic: string;
  confidence: string;
  evidence: string;
  url: string;
}

export interface IOCIndicator {
  indicator_type: string;
  value: string;
  reputation: 'MALICIOUS' | 'SUSPICIOUS' | 'CLEAN' | 'INTERNAL';
  confidence_score: number;
  source: string;
  tags: string[];
  details: string;
}

export interface ScoringFactor {
  factor: string;
  points: number;
  reason: string;
}

export interface AlertAnalysis {
  id: number;
  risk_score: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  incident_type: string;
  scoring_breakdown: ScoringFactor[];
  ioc_results: IOCIndicator[];
  mitre_mapping: MitreTechnique[];
  ai_provider: string;
  ai_summary: string;
  behavior_analysis: string;
  risk_justification: string;
  evidence_citations: string[];
  recommendations: string[];
  is_suspicious: boolean;
  requires_analyst_review: boolean;
  analysis_duration_ms: number;
  analyzed_at: string;
}

export interface SavedReportItem {
  id: string;
  saved_at: string;
  title: string;
  alert_code: string;
  incident_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  risk_score: number;
  ai_summary: string;
  analyst_note: string;
  alert_snapshot: SecurityAlert;
}

export interface EvidenceImageAttachment {
  id: string;
  title: string;
  image_data: string;
  uploaded_by: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  alert_id: number;
  alert_code: string;
  analyst_name: string;
  action: string;
  previous_status: string;
  new_status: string;
  comment: string;
  ai_recommendation_snapshot?: string[];
  created_at: string;
}

export interface SecurityAlert {
  id: number;
  alert_code: string;
  external_id?: string;
  dedup_hash: string;
  occurrence_count: number;
  source: string;
  timestamp: string;
  rule_id?: string;
  rule_level: number;
  description: string;
  hostname?: string;
  src_ip?: string;
  dst_ip?: string;
  username?: string;
  process_name?: string;
  command_line?: string;
  domain?: string;
  file_hash?: string;
  protocol?: string;
  raw_log: string;
  raw_payload: Record<string, unknown>;
  status:
    | 'PENDING_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'NEEDS_REANALYSIS'
    | 'FALSE_POSITIVE'
    | 'ESCALATED';
  created_at: string;
  updated_at: string;
  analysis?: AlertAnalysis;
  audit_logs: AuditLog[];
}

export interface DashboardSummary {
  total_alerts: number;
  pending_review_count: number;
  reviewed_count: number;
  avg_analysis_duration_ms: number;
  evidence_backed_rate: number;
  severity_distribution: { name: string; value: number; color: string }[];
  status_distribution: Record<string, number>;
  mitre_tactic_distribution: { tactic: string; count: number }[];
  incident_timeline: {
    id: number;
    alert_code: string;
    timestamp: string;
    full_timestamp: string;
    hostname: string;
    incident_type: string;
    risk_score: number;
    severity: string;
    status: string;
  }[];
  evaluation_metrics: {
    available: boolean;
    matched_samples?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    severity_accuracy?: number;
    mitre_mapping_accuracy?: number;
    confusion_matrix?: { tp: number; fp: number; tn: number; fn: number };
  };
}

export interface IncidentReportResponse {
  alert_code: string;
  external_id?: string;
  status: string;
  severity: string;
  risk_score: number;
  incident_type: string;
  five_questions: {
    q1_what_happened: string;
    q2_risk_level: string;
    q3_why_this_risk: string;
    q4_mitre_techniques: MitreTechnique[];
    q5_next_investigation_steps: string[];
  };
  raw_evidence: {
    raw_log: string;
    evidence_citations: string[];
  };
  audit_trail: {
    analyst_name: string;
    action: string;
    new_status: string;
    comment: string;
    created_at: string;
  }[];
  markdown: string;
}
