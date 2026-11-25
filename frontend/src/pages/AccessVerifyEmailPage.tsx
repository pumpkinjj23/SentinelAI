import React, { useState, useEffect, useCallback } from 'react';
import {
  MailCheck,
  KeyRound,
  ShieldCheck,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Link2,
  MailOpen,
} from 'lucide-react';
import { SOCUserIdentity, WorkspaceInfo, WorkspaceInvitationInfo } from '../types';
import {
  acceptWorkspaceInvitation,
  fetchMyPendingInvitations,
  verifyPasswordlessEmail,
} from '../services/api';

interface AccessVerifyEmailPageProps {
  currentUser: SOCUserIdentity;
  knownUsers: SOCUserIdentity[];
  activeWorkspace: WorkspaceInfo | null;
  isEmailLoggedIn?: boolean;
  onUserVerified: (user: SOCUserIdentity) => void;
  onInvitationAccepted: (workspaceId: string, user: SOCUserIdentity) => void;
  onGoToWorkspaces: () => void;
  onLogoutEmail?: () => void;
}

export const AccessVerifyEmailPage: React.FC<AccessVerifyEmailPageProps> = ({
  currentUser,
  activeWorkspace,
  isEmailLoggedIn = true,
  onUserVerified,
  onInvitationAccepted,
  onGoToWorkspaces,
  onLogoutEmail,
}) => {
  const [emailInput, setEmailInput] = useState(currentUser.email);
  const [inviteToken, setInviteToken] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [myInvites, setMyInvites] = useState<WorkspaceInvitationInfo[]>([]);

  const loadMyInvites = useCallback(async () => {
    try {
      const list = await fetchMyPendingInvitations(currentUser.email);
      setMyInvites(list);
    } catch {
      setMyInvites([]);
    }
  }, [currentUser.email]);

  useEffect(() => {
    loadMyInvites();
  }, [loadMyInvites]);

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      setLoading(true);
      const res = await verifyPasswordlessEmail({
        email: emailInput.trim(),
      });
      onUserVerified(res.user);
      setFeedback({
        type: 'success',
        text: `เข้าสู่ระบบด้วยอีเมล ${res.user.email} สำเร็จ — เข้าร่วมแล้ว ${res.workspaces_joined} Workspace`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบด้วยอีเมลได้',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      setLoading(true);
      let cleanToken = inviteToken.trim();
      if (cleanToken.includes('invite_token=')) {
        cleanToken = cleanToken.split('invite_token=')[1].split('&')[0];
      }
      const res = await acceptWorkspaceInvitation({
        token: cleanToken,
        email: joinEmail.trim() || undefined,
      });
      setInviteToken('');
      setFeedback({
        type: 'success',
        text: `ตอบรับคำเชิญสำเร็จ! เพิ่ม ${res.user.email} เข้าสู่ห้อง '${res.workspace_name}' (${res.workspace_code}) ในบทบาท ${res.role} เรียบร้อยแล้ว`,
      });
      onInvitationAccepted(res.workspace_id, res.user);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ลิงก์คำเชิญไม่ถูกต้องหรือหมดอายุ',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 pt-1">
      {/* Page Header */}
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4">
        <div className="min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
            Page 1 — E-mail Only Login (เข้าสู่ระบบด้วยอีเมลเท่านั้น)
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5 leading-snug">
            <MailCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>เข้าสู่ระบบด้วยอีเมลเท่านั้น (E-mail Login) และเข้าร่วมห้องผ่านลิงก์คำเชิญ</span>
          </h2>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
            ระบบใช้การล็อกอินด้วย <strong>E-mail เท่านั้น</strong> (ไม่ต้องใช้รหัสผ่านหรือกรอกข้อมูลอื่น) — เมื่อกรอกอีเมลเข้าสู่ระบบแล้ว ระบบจะแสดงเฉพาะห้องทำงานที่คุณได้รับอนุญาต
          </p>
        </div>

        {/* Active Identity Banner */}
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-400/30 flex flex-wrap items-center justify-between gap-3 min-w-0 overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center shrink-0">
              {currentUser.email.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 truncate">
                {isEmailLoggedIn
                  ? 'อีเมลที่ล็อกอินอยู่ในระบบ (Logged-in E-mail):'
                  : 'กรุณากรอกอีเมลด้านล่างเพื่อเข้าสู่ระบบ:'}
              </div>
              <div className="text-sm font-extrabold font-mono text-emerald-700 dark:text-emerald-400 truncate">
                {isEmailLoggedIn ? currentUser.email : 'ยังไม่ได้ล็อกอินด้วยอีเมล'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {isEmailLoggedIn && activeWorkspace && (
              <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-400/50 text-xs font-bold truncate max-w-full">
                ห้องปัจจุบัน: <strong>{activeWorkspace.name}</strong> ({activeWorkspace.workspace_code}) · สิทธิ์:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {activeWorkspace.current_user_role}
                </strong>
              </span>
            )}
            {isEmailLoggedIn && (
              <>
                <button
                  type="button"
                  onClick={onGoToWorkspaces}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                >
                  ไปที่หน้า Workspace Management <ArrowRight className="w-3.5 h-3.5" />
                </button>
                {onLogoutEmail && (
                  <button
                    type="button"
                    onClick={onLogoutEmail}
                    className="px-3.5 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-400/40 text-xs font-extrabold cursor-pointer shrink-0"
                  >
                    ออกจากระบบ / เปลี่ยนอีเมล
                  </button>
                )}
              </>
            )}
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

      {/* Quick Role Switcher + Email Verification + Invitation Acceptance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 6 Cols: Passwordless Email Verification & Role Simulation */}
        <div className="lg:col-span-6 sylva-glass-card rounded-[26px] p-6 space-y-5">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            1. ยืนยันตัวตนด้วยอีเมล (Passwordless Email Access)
          </h3>

          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
              สลับตัวตนด่วนเพื่อทดสอบสิทธิ์ 3 ระดับในห้อง `SNT-WS-001` (1-Click Role Demo):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  email: 'owner@sentinelai.soc',
                  name: 'Somchai (Workspace Owner)',
                  roleBadge: 'OWNER (เจ้าของห้อง)',
                  color: 'border-emerald-500/50 bg-emerald-500/10',
                },
                {
                  email: 'analyst@sentinelai.soc',
                  name: 'Nattapong (Tier-2 Analyst)',
                  roleBadge: 'ANALYST (ผู้วิเคราะห์)',
                  color: 'border-sky-500/50 bg-sky-500/10',
                },
                {
                  email: 'viewer@sentinelai.soc',
                  name: 'Kitti (SOC Auditor / Viewer)',
                  roleBadge: 'VIEWER (ดูอย่างเดียว)',
                  color: 'border-amber-500/50 bg-amber-500/10',
                },
              ].map((preset) => {
                const isCurrent = currentUser.email.toLowerCase() === preset.email.toLowerCase();
                return (
                  <button
                    key={preset.email}
                    type="button"
                    onClick={async () => {
                      setEmailInput(preset.email);
                      const res = await verifyPasswordlessEmail({
                        email: preset.email,
                      });
                      onUserVerified(res.user);
                      setFeedback({
                        type: 'success',
                        text: `เข้าสู่ระบบด้วยอีเมล ${preset.email} (${preset.roleBadge}) สำเร็จ`,
                      });
                    }}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      isCurrent
                        ? 'ring-2 ring-emerald-500 ' + preset.color
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/90 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">
                      {preset.roleBadge}
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                      {preset.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      {preset.email}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleVerifyEmail} className="space-y-3.5 pt-2 border-t border-slate-200 dark:border-slate-700/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                เข้าสู่ระบบด้วยอีเมลเท่านั้น (E-mail Only Login)
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="กรอกอีเมลของคุณ เช่น owner@sentinelai.soc"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              {loading ? 'กำลังเข้าสู่ระบบด้วยอีเมล...' : 'เข้าสู่ระบบด้วยอีเมล (Login with E-mail)'}
            </button>
          </form>
        </div>

        {/* Right 6 Cols: Accept Workspace Invitation Token / Link */}
        <div className="lg:col-span-6 sylva-glass-card rounded-[26px] p-6 space-y-5">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
            <Link2 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            2. เข้าร่วมห้องทำงาน (กดรับคำเชิญที่ส่งถึงคุณ หรือกรอกรหัสเข้าห้อง)
          </h3>

          {/* กล่องคำเชิญที่ส่งถึงอีเมลนี้โดยตรง (1-Click Join) */}
          {myInvites.length > 0 && (
            <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-500/15 border border-sky-300 dark:border-sky-400/40 space-y-2.5">
              <div className="text-xs font-extrabold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                <MailOpen className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                คำเชิญเข้าห้องที่ส่งถึง {currentUser.email} ({myInvites.length} รายการ):
              </div>
              {myInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-500/30 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="text-xs">
                    <div className="font-extrabold text-slate-900 dark:text-white">
                      {inv.workspace_code} — {inv.workspace_name}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      สิทธิ์: <strong className="text-emerald-600 dark:text-emerald-400">{inv.role}</strong> · รหัสเข้าห้อง:{' '}
                      <code className="font-mono font-bold">{inv.invite_code}</code>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      try {
                        setLoading(true);
                        const res = await acceptWorkspaceInvitation({
                          token: inv.token,
                          email: currentUser.email,
                          display_name: currentUser.display_name,
                        });
                        await loadMyInvites();
                        onInvitationAccepted(res.workspace_id, res.user);
                      } catch (err: unknown) {
                        setFeedback({
                          type: 'error',
                          text: err instanceof Error ? err.message : 'ไม่สามารถเข้าร่วมห้องได้',
                        });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer"
                  >
                    กดรับคำเชิญเข้าห้องนี้
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
            เมื่อเจ้าของห้อง (Owner) สร้างคำเชิญในหน้า <strong>Invitation Management</strong> สมาชิกสามารถนำลิงก์หรือรหัส Token มาวางที่นี่เพื่อยืนยันอีเมลและเข้าร่วมห้องตามสิทธิ์ที่กำหนด (`Owner` / `Analyst` / `Viewer`) โดยลิงก์คำเชิญใช้ได้ครั้งเดียวและมีวันหมดอายุ
          </p>

          <form onSubmit={handleAcceptInvite} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                ลิงก์คำเชิญ หรือ รหัสเชิญเข้าห้อง (Join Code)
              </label>
              <input
                type="text"
                required
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="วางลิงก์คำเชิญ หรือกรอกรหัสเชิญที่ได้รับจากเจ้าของห้อง..."
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                อีเมลผู้รับคำเชิญ (เว้นว่างเพื่อใช้อีเมลที่ล็อกอินอยู่: {currentUser.email})
              </label>
              <input
                type="email"
                value={joinEmail}
                onChange={(e) => setJoinEmail(e.target.value)}
                placeholder="กรอกเฉพาะอีเมล เช่น analyst@sentinelai.soc"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="submit"
                disabled={loading || !inviteToken.trim()}
                className="flex-1 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-extrabold shadow-md shadow-sky-600/20 transition cursor-pointer"
              >
                <KeyRound className="w-4 h-4 inline mr-1.5" />
                ตรวจสอบรหัสเชิญและเข้าร่วม Workspace
              </button>
            </div>
          </form>

          {/* Role Permission Matrix Table per Section 3 */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700/80 space-y-2">
            <div className="text-xs font-extrabold uppercase text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ตารางเปรียบเทียบสิทธิ์สมาชิกทั้ง 3 ระดับ (RBAC Permission Matrix)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-bold">
                    <th className="py-2 px-2.5">ความสามารถ</th>
                    <th className="py-2 px-2.5 text-center text-emerald-700 dark:text-emerald-400">
                      Owner
                    </th>
                    <th className="py-2 px-2.5 text-center text-sky-700 dark:text-sky-400">
                      Analyst
                    </th>
                    <th className="py-2 px-2.5 text-center text-amber-700 dark:text-amber-400">
                      Viewer
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60 font-medium">
                  {[
                    ['ดู Dashboard & Security Alerts', '✓', '✓', '✓'],
                    ['นำเข้า Alert (JSON / CSV) & ใช้ AI Analysis', '✓', '✓', '–'],
                    ['อนุมัติ / ปฏิเสธ Alert & ดู Audit Logs', '✓', '✓', '–'],
                    ['เชิญสมาชิก / จัดการสมาชิก / ลบ Workspace', '✓', '–', '–'],
                  ].map(([cap, o, a, v]) => (
                    <tr key={cap}>
                      <td className="py-2 px-2.5 text-slate-800 dark:text-slate-200">{cap}</td>
                      <td className="py-2 px-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {o}
                      </td>
                      <td className="py-2 px-2.5 text-center font-bold text-sky-600 dark:text-sky-400">
                        {a}
                      </td>
                      <td className="py-2 px-2.5 text-center font-bold text-amber-600 dark:text-amber-400">
                        {v}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
