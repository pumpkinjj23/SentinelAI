import {
  AuditLog,
  DashboardSummary,
  ImportHistoryRecord,
  IncidentReportResponse,
  SecurityAlert,
  SOCUserIdentity,
  WorkspaceInfo,
  WorkspaceInvitationInfo,
  WorkspaceMemberInfo,
} from '../types';

const API_BASE = '/api';

export async function verifyPasswordlessEmail(payload: {
  email: string;
  display_name?: string;
}): Promise<{
  status: string;
  user: SOCUserIdentity;
  workspaces_joined: number;
}> {
  const res = await fetch(`${API_BASE}/access/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'ไม่สามารถยืนยันตัวตนด้วยอีเมลได้');
  }
  return res.json();
}

export async function fetchKnownUsers(): Promise<SOCUserIdentity[]> {
  const res = await fetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error('Failed to load users');
  return res.json();
}

export async function fetchWorkspaces(userEmail?: string): Promise<WorkspaceInfo[]> {
  const qs = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : '';
  const res = await fetch(`${API_BASE}/workspaces${qs}`);
  if (!res.ok) throw new Error('Failed to load workspaces');
  return res.json();
}

export async function createWorkspace(payload: {
  name: string;
  description?: string;
  owner_email?: string;
  owner_name?: string;
}): Promise<WorkspaceInfo> {
  const res = await fetch(`${API_BASE}/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'ไม่สามารถสร้าง Workspace ได้');
  }
  return res.json();
}

export async function deleteWorkspaceById(
  workspaceId: string,
  userEmail?: string
): Promise<{ status: string; workspace_code: string; name: string }> {
  const qs = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : '';
  const res = await fetch(`${API_BASE}/workspaces/${encodeURIComponent(workspaceId)}${qs}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'ไม่สามารถลบ Workspace ได้');
  }
  return res.json();
}

export async function fetchWorkspaceMembers(
  workspaceId: string,
  userEmail?: string
): Promise<WorkspaceMemberInfo[]> {
  const qs = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : '';
  const res = await fetch(
    `${API_BASE}/workspaces/${encodeURIComponent(workspaceId)}/members${qs}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'ไม่สามารถดึงรายชื่อสมาชิกได้');
  }
  return res.json();
}

export async function updateWorkspaceMember(
  workspaceId: string,
  memberId: number,
  payload: { role?: 'OWNER' | 'ANALYST' | 'VIEWER'; status?: 'ACTIVE' | 'SUSPENDED' },
  userEmail?: string
): Promise<WorkspaceMemberInfo> {
  const qs = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : '';
  const res = await fetch(
    `${API_BASE}/workspaces/${encodeURIComponent(workspaceId)}/members/${memberId}${qs}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'ไม่สามารถแก้ไขสิทธิ์สมาชิกได้');
  }
  return res.json();
}

export async function removeWorkspaceMember(
  workspaceId: string,
  memberId: number,
  userEmail?: string
): Promise<{ status: string; email: string }> {
  const qs = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : '';
  const res = await fetch(
    `${API_BASE}/workspaces/${encodeURIComponent(workspaceId)}/members/${memberId}${qs}`,
    { method: 'DELETE' }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'ไม่สามารถลบสมาชิกออกจากห้องได้');
  }
  return res.json();
}

export async function fetchMyPendingInvitations(
  userEmail: string
): Promise<WorkspaceInvitationInfo[]> {
  const qs = `?user_email=${encodeURIComponent(userEmail)}`;
  const res = await fetch(`${API_BASE}/my-invitations${qs}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchWorkspaceInvitations(
  workspaceId: string,
  userEmail?: string
): Promise<WorkspaceInvitationInfo[]> {
  const qs = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : '';
  const res = await fetch(
    `${API_BASE}/workspaces/${encodeURIComponent(workspaceId)}/invitations${qs}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'ไม่สามารถดึงรายการคำเชิญได้');
  }
  return res.json();
}

export async function createWorkspaceInvitation(
  workspaceId: string,
  payload: {
    invited_email: string;
    role: 'OWNER' | 'ANALYST' | 'VIEWER';
    expires_in_hours?: number;
  },
  userEmail?: string
): Promise<WorkspaceInvitationInfo> {
  const qs = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : '';
  const res = await fetch(
    `${API_BASE}/workspaces/${encodeURIComponent(workspaceId)}/invitations${qs}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'ไม่สามารถสร้างลิงก์คำเชิญได้');
  }
  return res.json();
}

export async function acceptWorkspaceInvitation(payload: {
  token: string;
  email?: string;
  display_name?: string;

}): Promise<{
  status: string;
  workspace_id: string;
  workspace_code: string;
  workspace_name: string;
  role: 'OWNER' | 'ANALYST' | 'VIEWER';
  user: SOCUserIdentity;
}> {
  const res = await fetch(`${API_BASE}/invitations/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'ไม่สามารถตอบรับคำเชิญได้');
  }
  return res.json();
}

export async function revokeWorkspaceInvitation(
  workspaceId: string,
  invitationId: number,
  userEmail?: string
): Promise<{ status: string; invite_code: string }> {
  const qs = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : '';
  const res = await fetch(
    `${API_BASE}/workspaces/${encodeURIComponent(workspaceId)}/invitations/${invitationId}${qs}`,
    { method: 'DELETE' }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'ไม่สามารถยกเลิกคำเชิญได้');
  }
  return res.json();
}

export async function fetchImportHistory(
  workspaceId: string,
  userEmail?: string
): Promise<ImportHistoryRecord[]> {
  const qs = new URLSearchParams({ workspace_id: workspaceId });
  if (userEmail) qs.set('user_email', userEmail);
  const res = await fetch(`${API_BASE}/import-history?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to load import history');
  return res.json();
}

export async function fetchDashboardSummary(
  workspaceId?: string,
  userEmail?: string
): Promise<DashboardSummary> {
  const qs = new URLSearchParams();
  if (workspaceId) qs.set('workspace_id', workspaceId);
  if (userEmail) qs.set('user_email', userEmail);
  const res = await fetch(
    `${API_BASE}/dashboard/summary${qs.toString() ? `?${qs.toString()}` : ''}`
  );
  if (!res.ok) throw new Error('Failed to load dashboard summary');
  return res.json();
}

export async function clearTemporaryAlerts(
  workspaceId?: string
): Promise<{
  status: string;
  deleted_count: number;
  deleted_audit_logs?: number;
  deleted_reviews?: number;
  deleted_analyses?: number;
  deleted_imports?: number;
}> {
  const qs = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : '';
  const res = await fetch(`${API_BASE}/alerts/clear-temporary${qs}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('ไม่สามารถล้างข้อมูลชั่วคราวได้');
  return res.json();
}

export async function fetchAlerts(params?: {
  workspace_id?: string;
  user_email?: string;
  severity?: string;
  status?: string;
  search?: string;
}): Promise<SecurityAlert[]> {
  const qs = new URLSearchParams();
  if (params?.workspace_id) qs.set('workspace_id', params.workspace_id);
  if (params?.user_email) qs.set('user_email', params.user_email);
  if (params?.severity && params.severity !== 'ALL') qs.set('severity', params.severity);
  if (params?.status && params.status !== 'ALL') qs.set('status', params.status);
  if (params?.search) qs.set('search', params.search);

  const url = `${API_BASE}/alerts${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function submitAnalystDecision(
  alertId: number,
  payload: {
    analyst_name: string;
    action: string;
    comment: string;
    adjusted_severity?: string;
    adjusted_risk_score?: number;
    evidence_image_data?: string;
    evidence_image_title?: string;
  },
  userEmail?: string
): Promise<SecurityAlert> {
  const qs = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : '';
  const res = await fetch(`${API_BASE}/alerts/${alertId}/decision${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit analyst decision');
  }
  return res.json();
}

export async function uploadAlertEvidenceImage(
  alertId: number,
  payload: { title: string; image_data: string },
  userEmail?: string
): Promise<SecurityAlert> {
  const qs = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : '';
  const res = await fetch(`${API_BASE}/alerts/${alertId}/evidence-images${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'ไม่สามารถอัปโหลดรูปภาพหลักฐานได้');
  }
  return res.json();
}

export async function deleteAlertEvidenceImage(
  alertId: number,
  imageId: string,
  userEmail?: string
): Promise<SecurityAlert> {
  const qs = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : '';
  const res = await fetch(
    `${API_BASE}/alerts/${alertId}/evidence-images/${encodeURIComponent(imageId)}${qs}`,
    { method: 'DELETE' }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'ไม่สามารถลบรูปภาพหลักฐานได้');
  }
  return res.json();
}

export async function reanalyzeAlert(
  alertId: number,
  userEmail?: string
): Promise<SecurityAlert> {
  const qs = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : '';
  const res = await fetch(`${API_BASE}/alerts/${alertId}/reanalyze${qs}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to re-analyze alert');
  }
  return res.json();
}

export async function fetchIncidentReport(alertId: number): Promise<IncidentReportResponse> {
  const res = await fetch(`${API_BASE}/alerts/${alertId}/report`);
  if (!res.ok) throw new Error('Failed to generate incident report');
  return res.json();
}

export async function ingestJsonAlerts(
  payload: unknown,
  workspaceId?: string,
  filename?: string,
  userEmail?: string
): Promise<{
  ingested_count: number;
  deduplicated_count: number;
  alerts: SecurityAlert[];
}> {
  const qs = new URLSearchParams();
  if (workspaceId) qs.set('workspace_id', workspaceId);
  if (filename) qs.set('filename', filename);
  if (userEmail) qs.set('user_email', userEmail);

  const res = await fetch(
    `${API_BASE}/alerts/ingest/json${qs.toString() ? `?${qs.toString()}` : ''}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to ingest JSON alert');
  }
  return res.json();
}

export async function ingestCsvAlerts(
  file: File,
  workspaceId?: string,
  userEmail?: string
): Promise<{
  ingested_count: number;
  deduplicated_count: number;
  alerts: SecurityAlert[];
}> {
  const qs = new URLSearchParams();
  if (workspaceId) qs.set('workspace_id', workspaceId);
  if (userEmail) qs.set('user_email', userEmail);

  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(
    `${API_BASE}/alerts/ingest/csv${qs.toString() ? `?${qs.toString()}` : ''}`,
    {
      method: 'POST',
      body: formData,
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to ingest CSV file');
  }
  return res.json();
}

export async function seedDemoDatasets(
  workspaceId?: string,
  userEmail?: string
): Promise<{
  ingested_count: number;
  deduplicated_count: number;
  alerts: SecurityAlert[];
}> {
  const qs = new URLSearchParams();
  if (workspaceId) qs.set('workspace_id', workspaceId);
  if (userEmail) qs.set('user_email', userEmail);

  const res = await fetch(
    `${API_BASE}/alerts/seed-demo${qs.toString() ? `?${qs.toString()}` : ''}`,
    { method: 'POST' }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to seed demo datasets');
  }
  return res.json();
}

export async function fetchAuditLogs(
  workspaceId?: string,
  userEmail?: string
): Promise<AuditLog[]> {
  const qs = new URLSearchParams();
  if (workspaceId) qs.set('workspace_id', workspaceId);
  if (userEmail) qs.set('user_email', userEmail);

  const res = await fetch(
    `${API_BASE}/audit-logs${qs.toString() ? `?${qs.toString()}` : ''}`
  );
  if (!res.ok) return [];
  return res.json();
}
