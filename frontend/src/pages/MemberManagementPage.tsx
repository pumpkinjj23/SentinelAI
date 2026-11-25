import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Crown,
  ShieldCheck,
  Eye,
  Trash2,
  MailPlus,
  CheckCircle2,
  AlertTriangle,
  Ban,
} from 'lucide-react';
import { SOCUserIdentity, WorkspaceInfo, WorkspaceMemberInfo } from '../types';
import {
  fetchWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMember,
} from '../services/api';
import { formatThaiDateTime } from '../utils/formatDateTime';

interface MemberManagementPageProps {
  activeWorkspace: WorkspaceInfo | null;
  currentUser: SOCUserIdentity;
  onGoToInvitations: () => void;
  onMembersUpdated: () => void;
}

export const MemberManagementPage: React.FC<MemberManagementPageProps> = ({
  activeWorkspace,
  currentUser,
  onGoToInvitations,
  onMembersUpdated,
}) => {
  const [members, setMembers] = useState<WorkspaceMemberInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const isOwner = activeWorkspace?.current_user_role === 'OWNER';

  const loadMembers = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      setLoading(true);
      const data = await fetchWorkspaceMembers(activeWorkspace.id, currentUser.email);
      setMembers(data);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถโหลดรายชื่อสมาชิกได้',
      });
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, currentUser.email]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  if (!activeWorkspace) return null;

  const handleRoleChange = async (
    member: WorkspaceMemberInfo,
    newRole: 'OWNER' | 'ANALYST' | 'VIEWER'
  ) => {
    setFeedback(null);
    try {
      await updateWorkspaceMember(
        activeWorkspace.id,
        member.id,
        { role: newRole },
        currentUser.email
      );
      setFeedback({
        type: 'success',
        text: `เปลี่ยนบทบาทของ ${member.display_name} (${member.email}) เป็น ${newRole} เรียบร้อยแล้ว`,
      });
      await loadMembers();
      onMembersUpdated();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถเปลี่ยนสิทธิ์ได้',
      });
    }
  };

  const handleToggleSuspend = async (member: WorkspaceMemberInfo) => {
    setFeedback(null);
    const nextStatus = member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await updateWorkspaceMember(
        activeWorkspace.id,
        member.id,
        { status: nextStatus },
        currentUser.email
      );
      setFeedback({
        type: 'success',
        text: `ปรับสถานะของ ${member.email} เป็น ${nextStatus} เรียบร้อยแล้ว`,
      });
      await loadMembers();
      onMembersUpdated();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถเปลี่ยนสถานะสมาชิกได้',
      });
    }
  };

  const handleRemove = async (member: WorkspaceMemberInfo) => {
    setFeedback(null);
    try {
      await removeWorkspaceMember(activeWorkspace.id, member.id, currentUser.email);
      setFeedback({
        type: 'success',
        text: `นำสมาชิก ${member.display_name} (${member.email}) ออกจากห้อง ${activeWorkspace.name} เรียบร้อยแล้ว`,
      });
      await loadMembers();
      onMembersUpdated();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถนำสมาชิกออกจากห้องได้',
      });
    }
  };

  return (
    <div className="space-y-5 pt-1">
      {/* Header */}
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
              Page 8 — Member Management ({activeWorkspace.name} · {activeWorkspace.workspace_code})
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5 leading-snug">
              <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>จัดการสมาชิกและกำหนดสิทธิ์ในห้อง (Owner / Analyst / Viewer)</span>
            </h2>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
              ดูรายชื่อสมาชิกทั้งหมดในห้อง เปลี่ยนบทบาท (`Owner`, `Analyst`, `Viewer`), ระงับสิทธิ์ชั่วคราว หรือนำสมาชิกออกจาก Workspace (เฉพาะเจ้าของห้อง Owner เท่านั้นที่แก้ไขได้)
            </p>
          </div>

          <button
            type="button"
            onClick={onGoToInvitations}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 cursor-pointer inline-flex items-center gap-1.5 shrink-0"
          >
            <MailPlus className="w-4 h-4" />
            เชิญสมาชิกใหม่ (Invitation Management)
          </button>
        </div>

        {/* Role Summary Cards — min-w-0 & overflow-hidden */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700/80">
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-400/30 flex items-center gap-3 min-w-0 overflow-hidden">
            <Crown className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200 truncate">
                Owner (เจ้าของห้อง)
              </div>
              <div className="text-[11px] text-emerald-800 dark:text-emerald-300 break-words leading-snug">
                สิทธิ์สูงสุด: เชิญสมาชิก จัดการสิทธิ์ ลบห้อง และจัดการ Alert ทั้งหมด
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-500/15 border border-sky-300 dark:border-sky-400/30 flex items-center gap-3 min-w-0 overflow-hidden">
            <ShieldCheck className="w-6 h-6 text-sky-600 dark:text-sky-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-extrabold text-sky-900 dark:text-sky-200 truncate">
                Analyst (นักวิเคราะห์ SOC)
              </div>
              <div className="text-[11px] text-sky-800 dark:text-sky-300 break-words leading-snug">
                นำเข้า Alert, ใช้ AI Analysis, อนุมัติ/ปฏิเสธ Alert และดู Audit Logs
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-400/30 flex items-center gap-3 min-w-0 overflow-hidden">
            <Eye className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-extrabold text-amber-900 dark:text-amber-200 truncate">
                Viewer (ผู้ดูข้อมูลอย่างเดียว)
              </div>
              <div className="text-[11px] text-amber-800 dark:text-amber-300 break-words leading-snug">
                ดู Dashboard และรายการ Security Alerts ได้อย่างเดียว (แก้ไขหรือลบไม่ได้)
              </div>
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-500/20 dark:border-emerald-400/40 dark:text-emerald-200'
              : 'bg-rose-100 border-rose-300 text-rose-900 dark:bg-rose-500/20 dark:border-rose-400/40 dark:text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Members Table */}
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            รายชื่อสมาชิกในห้อง {activeWorkspace.name} ({members.length} คน)
          </h3>
          <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
            สิทธิ์ของคุณในห้องนี้:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {activeWorkspace.current_user_role}
            </strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-3">สมาชิก (Member)</th>
                <th className="py-3 px-3">อีเมล (Email)</th>
                <th className="py-3 px-3">บทบาท (Role)</th>
                <th className="py-3 px-3">สถานะ</th>
                <th className="py-3 px-3">วันที่เข้าร่วม</th>
                <th className="py-3 px-3 text-right">การจัดการสิทธิ์ (เฉพาะ Owner)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    กำลังโหลดรายชื่อสมาชิก...
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white">
                      {m.display_name}
                      {m.email.toLowerCase() === currentUser.email.toLowerCase() && (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
                          คุณ (You)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {m.email}
                    </td>
                    <td className="py-3.5 px-3">
                      {isOwner ? (
                        <select
                          value={m.role}
                          onChange={(e) =>
                            handleRoleChange(
                              m,
                              e.target.value as 'OWNER' | 'ANALYST' | 'VIEWER'
                            )
                          }
                          className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                        >
                          <option value="OWNER">OWNER (เจ้าของห้อง)</option>
                          <option value="ANALYST">ANALYST (ผู้วิเคราะห์)</option>
                          <option value="VIEWER">VIEWER (ผู้ดูข้อมูล)</option>
                        </select>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                          {m.role}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          m.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40'
                            : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/40'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {formatThaiDateTime(m.joined_at)}
                    </td>
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      {isOwner ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleSuspend(m)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 cursor-pointer inline-flex items-center gap-1"
                          >
                            <Ban className="w-3.5 h-3.5 text-amber-500" />
                            {m.status === 'ACTIVE' ? 'ระงับสิทธิ์' : 'เปิดสิทธิ์'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(m)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 text-xs font-bold text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-400/40 cursor-pointer inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            นำออกจากห้อง
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">เฉพาะ Owner</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
