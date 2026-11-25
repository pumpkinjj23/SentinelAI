import React, { useState, useEffect, useCallback } from 'react';
import {
  MailPlus,
  Copy,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  UserCheck,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { SOCUserIdentity, WorkspaceInfo, WorkspaceInvitationInfo } from '../types';
import {
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  fetchWorkspaceInvitations,
  revokeWorkspaceInvitation,
} from '../services/api';
import { formatThaiDateTime } from '../utils/formatDateTime';

interface InvitationManagementPageProps {
  activeWorkspace: WorkspaceInfo | null;
  currentUser: SOCUserIdentity;
  onInvitationAccepted: (workspaceId: string, user: SOCUserIdentity) => void;
  onInvitationsChanged: () => void;
}

export const InvitationManagementPage: React.FC<InvitationManagementPageProps> = ({
  activeWorkspace,
  currentUser,
  onInvitationAccepted,
  onInvitationsChanged,
}) => {
  const [invitations, setInvitations] = useState<WorkspaceInvitationInfo[]>([]);
  const [invitedEmail, setInvitedEmail] = useState('');
  const [role, setRole] = useState<'ANALYST' | 'VIEWER' | 'OWNER'>('ANALYST');
  const [expiresHours, setExpiresHours] = useState(72);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const isOwner = activeWorkspace?.current_user_role === 'OWNER';

  const loadInvitations = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const data = await fetchWorkspaceInvitations(activeWorkspace.id, currentUser.email);
      setInvitations(data);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถโหลดรายการคำเชิญได้',
      });
    }
  }, [activeWorkspace, currentUser.email]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  if (!activeWorkspace) return null;

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!invitedEmail.trim()) return;
    try {
      setCreating(true);
      const created = await createWorkspaceInvitation(
        activeWorkspace.id,
        {
          invited_email: invitedEmail.trim(),
          role,
          expires_in_hours: expiresHours,
        },
        currentUser.email
      );
      setInvitedEmail('');
      setFeedback({
        type: 'success',
        text: `สร้างลิงก์คำเชิญ (${created.invite_code}) สำหรับ ${created.invited_email} ในบทบาท ${created.role} สำเร็จ! คัดลอกลิงก์ส่งให้สมาชิกได้ทันที`,
      });
      await loadInvitations();
      onInvitationsChanged();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถสร้างคำเชิญได้',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (inv: WorkspaceInvitationInfo) => {
    setFeedback(null);
    try {
      await revokeWorkspaceInvitation(activeWorkspace.id, inv.id, currentUser.email);
      setFeedback({
        type: 'success',
        text: `ยกเลิกคำเชิญ ${inv.invite_code} (${inv.invited_email}) เรียบร้อยแล้ว`,
      });
      await loadInvitations();
      onInvitationsChanged();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถยกเลิกคำเชิญได้',
      });
    }
  };

  const handleQuickAcceptSimulate = async (inv: WorkspaceInvitationInfo) => {
    setFeedback(null);
    try {
      const res = await acceptWorkspaceInvitation({
        token: inv.token,
        email: inv.invited_email,
        display_name: inv.invited_email.split('@')[0] || inv.invited_email,
      });
      setFeedback({
        type: 'success',
        text: `สมาชิก ${res.user.email} ตอบรับคำเชิญ ${inv.invite_code} และเข้าร่วมห้องในบทบาท ${res.role} สำเร็จ!`,
      });
      await loadInvitations();
      onInvitationAccepted(res.workspace_id, res.user);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถตอบรับคำเชิญได้',
      });
    }
  };

  return (
    <div className="space-y-5 pt-1">
      {/* Header */}
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4">
        <div className="min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
            Page 9 — Invitation Management ({activeWorkspace.name} · {activeWorkspace.workspace_code})
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5 leading-snug">
            <MailPlus className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>เชิญสมาชิกด้วยอีเมล สร้างลิงก์คำเชิญแบบใช้ครั้งเดียว และตรวจสอบสถานะการตอบรับ</span>
          </h2>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
            ลิงก์คำเชิญเป็น <strong>Single-Use Token</strong> แบบสุ่ม มีวันหมดอายุ และใช้ได้เพียงครั้งเดียว เมื่อสมาชิกกดตอบรับ ระบบจะเพิ่มเข้าในตาราง `workspace_members` และบันทึก Audit Logs ทันที
          </p>
        </div>

        {/* Create Invitation Form */}
        {isOwner ? (
          <form
            onSubmit={handleCreateInvite}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                อีเมลของสมาชิกที่ต้องการเชิญ (Invited Email)
              </label>
              <input
                type="email"
                required
                value={invitedEmail}
                onChange={(e) => setInvitedEmail(e.target.value)}
                placeholder="เช่น tier1-soc@sentinelai.soc"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                เลือกบทบาท (Role)
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'ANALYST' | 'VIEWER' | 'OWNER')}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-extrabold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="ANALYST">ANALYST (ผู้วิเคราะห์และตรวจ Alert)</option>
                <option value="VIEWER">VIEWER (ผู้ดูข้อมูลอย่างเดียว)</option>
                <option value="OWNER">OWNER (เจ้าของห้องร่วม)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                อายุลิงก์คำเชิญ
              </label>
              <select
                value={expiresHours}
                onChange={(e) => setExpiresHours(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value={24}>24 ชั่วโมง</option>
                <option value={72}>3 วัน (72 ชม.)</option>
                <option value={168}>7 วัน</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <MailPlus className="w-4 h-4" />
                {creating ? 'กำลังสร้าง...' : 'สร้างลิงก์คำเชิญ'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-400/30 text-xs font-bold text-amber-900 dark:text-amber-200">
            เฉพาะเจ้าของห้อง (Workspace Owner) เท่านั้นที่สามารถสร้างหรือยกเลิกคำเชิญได้ (สิทธิ์ปัจจุบันของคุณคือ {activeWorkspace.current_user_role})
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-2.5 ${feedback.type === 'success'
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

      {/* Invitations List Table — แสดงเฉพาะเจ้าของห้อง (Owner) เพื่อไม่ให้ลิงก์คำเชิญที่เป็นความลับรั่วไหล */}
      {isOwner && (
        <div className="sylva-glass-card rounded-[26px] p-6 space-y-4 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>รายการคำเชิญทั้งหมดในห้อง {activeWorkspace.name} ({invitations.length} รายการ)</span>
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              * สามารถกดปุ่ม &ldquo;คัดลอกรหัสเชิญ&rdquo; เพื่อส่งให้สมาชิกกรอกเข้าห้องได้ทันที
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 px-3">รหัสเข้าห้อง (Join Code)</th>
                  <th className="py-3 px-3">อีเมลผู้ได้รับเชิญ</th>
                  <th className="py-3 px-3">บทบาท</th>
                  <th className="py-3 px-3">ลิงก์คำเชิญ (ซ่อนรหัสลับ)</th>
                  <th className="py-3 px-3">สถานะ</th>
                  <th className="py-3 px-3">วันหมดอายุ</th>
                  <th className="py-3 px-3 text-right">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70 text-xs font-medium">
                {invitations.map((inv) => {
                  const fullInviteUrl = `${window.location.origin}/${inv.invite_link}`;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <td className="py-3.5 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        {inv.invite_code}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {inv.invited_email}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-0.5 rounded-full font-bold bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200 border border-sky-300 dark:border-sky-400/40">
                          {inv.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <code className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            รหัสเชิญ: {inv.invite_code} (Token ถูกซ่อน)
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(fullInviteUrl);
                              setCopiedId(inv.id);
                              setTimeout(() => setCopiedId(null), 1800);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedId === inv.id ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${inv.status === 'ACCEPTED'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40'
                              : inv.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/40'
                                : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/40'
                            }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5 inline mr-1" />
                        {formatThaiDateTime(inv.expires_at)}
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {inv.status === 'PENDING' ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleQuickAcceptSimulate(inv)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              ตอบรับคำเชิญนี้
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevoke(inv)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 text-rose-800 dark:text-rose-200 font-bold text-xs border border-rose-300 dark:border-rose-400/40 cursor-pointer inline-flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            {inv.status === 'ACCEPTED' ? 'เข้าร่วมห้องแล้ว' : 'สิ้นสุดแล้ว'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
