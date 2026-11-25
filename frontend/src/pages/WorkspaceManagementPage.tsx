import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderKanban,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Users,
  MailPlus,
  MailOpen,
  UserMinus,
  LogOut,
} from 'lucide-react';
import {
  SOCUserIdentity,
  WorkspaceInfo,
  WorkspaceInvitationInfo,
  WorkspaceMemberInfo,
} from '../types';
import {
  acceptWorkspaceInvitation,
  createWorkspace,
  createWorkspaceInvitation,
  deleteWorkspaceById,
  fetchMyPendingInvitations,
  fetchWorkspaceInvitations,
  fetchWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMember,
} from '../services/api';

interface WorkspaceManagementPageProps {
  workspaces: WorkspaceInfo[];
  activeWorkspace: WorkspaceInfo | null;
  currentUser: SOCUserIdentity;
  onSelectWorkspace: (ws: WorkspaceInfo, goToDashboard?: boolean) => void;
  onWorkspacesChanged: (newActive?: WorkspaceInfo) => void;
  onLogoutEmail?: () => void;
}

export const WorkspaceManagementPage: React.FC<WorkspaceManagementPageProps> = ({
  workspaces,
  activeWorkspace,
  currentUser,
  onSelectWorkspace,
  onWorkspacesChanged,
  onLogoutEmail,
}) => {
  const [newName, setNewName] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ANALYST' | 'VIEWER' | 'OWNER'>('ANALYST');
  const [inviting, setInviting] = useState(false);

  const [members, setMembers] = useState<WorkspaceMemberInfo[]>([]);
  const [myInvites, setMyInvites] = useState<WorkspaceInvitationInfo[]>([]);
  const [roomPendingInvites, setRoomPendingInvites] = useState<WorkspaceInvitationInfo[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const myRooms = workspaces.filter((w) => w.current_user_role !== 'NOT_MEMBER');
  const isOwner = activeWorkspace?.current_user_role === 'OWNER';

  const loadRoomDetails = useCallback(async () => {
    try {
      const myPending = await fetchMyPendingInvitations(currentUser.email);
      setMyInvites(myPending);

      if (activeWorkspace && activeWorkspace.current_user_role !== 'NOT_MEMBER') {
        const memList = await fetchWorkspaceMembers(activeWorkspace.id, currentUser.email);
        setMembers(memList);

        if (activeWorkspace.current_user_role === 'OWNER') {
          const invList = await fetchWorkspaceInvitations(activeWorkspace.id, currentUser.email);
          setRoomPendingInvites(invList.filter((i) => i.status === 'PENDING'));
        } else {
          setRoomPendingInvites([]);
        }
      }
    } catch {
      // ignore
    }
  }, [activeWorkspace, currentUser.email]);

  useEffect(() => {
    loadRoomDetails();
  }, [loadRoomDetails]);

  // 1. กดรับคำเชิญเข้าห้องในคลิกเดียว
  const handleAcceptInvite = async (inv: WorkspaceInvitationInfo) => {
    setFeedback(null);
    try {
      const res = await acceptWorkspaceInvitation({
        token: inv.token,
        email: currentUser.email,
      });
      setFeedback({
        type: 'success',
        text: `เข้าร่วมห้อง "${res.workspace_name}" (${res.workspace_code}) ในสิทธิ์ ${res.role} สำเร็จ!`,
      });
      await loadRoomDetails();
      onWorkspacesChanged();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถเข้าร่วมห้องได้',
      });
    }
  };

  // 3. สร้างห้องใหม่
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setFeedback(null);
    try {
      setCreatingRoom(true);
      const created = await createWorkspace({
        name: newName.trim(),
        owner_email: currentUser.email,
      });
      setNewName('');
      setFeedback({
        type: 'success',
        text: `สร้างห้องใหม่ "${created.name}" (${created.workspace_code}) สำเร็จ คุณเป็นเจ้าของห้อง (OWNER)`,
      });
      onWorkspacesChanged(created);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถสร้างห้องได้',
      });
    } finally {
      setCreatingRoom(false);
    }
  };

  // 4. เชิญเพื่อนเข้าห้องด้วยอีเมล
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !inviteEmail.trim()) return;
    setFeedback(null);
    try {
      setInviting(true);
      const created = await createWorkspaceInvitation(
        activeWorkspace.id,
        {
          invited_email: inviteEmail.trim(),
          role: inviteRole,
          expires_in_hours: 72,
        },
        currentUser.email
      );
      setInviteEmail('');
      setFeedback({
        type: 'success',
        text: `ส่งคำเชิญเข้าห้อง ${activeWorkspace.workspace_code} ไปยัง ${created.invited_email} (${created.role}) แล้ว — เมื่ออีกฝ่ายล็อกอินด้วยอีเมลนั้น จะมีปุ่มกดเข้าห้องทันที`,
      });
      await loadRoomDetails();
      onWorkspacesChanged();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถเชิญสมาชิกได้',
      });
    } finally {
      setInviting(false);
    }
  };

  // 5. เปลี่ยนสิทธิ์สมาชิกในห้อง
  const handleChangeMemberRole = async (
    mem: WorkspaceMemberInfo,
    newRole: 'OWNER' | 'ANALYST' | 'VIEWER'
  ) => {
    if (!activeWorkspace) return;
    setFeedback(null);
    try {
      await updateWorkspaceMember(activeWorkspace.id, mem.id, { role: newRole }, currentUser.email);
      setFeedback({
        type: 'success',
        text: `เปลี่ยนสิทธิ์ของ ${mem.email} เป็น ${newRole} เรียบร้อยแล้ว`,
      });
      await loadRoomDetails();
      onWorkspacesChanged();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถเปลี่ยนสิทธิ์ได้',
      });
    }
  };

  // 6. ลบสมาชิกออกจากห้อง
  const handleRemoveMember = async (mem: WorkspaceMemberInfo) => {
    if (!activeWorkspace) return;
    setFeedback(null);
    try {
      await removeWorkspaceMember(activeWorkspace.id, mem.id, currentUser.email);
      setFeedback({
        type: 'success',
        text: `ลบ ${mem.email} ออกจากห้อง ${activeWorkspace.workspace_code} แล้ว`,
      });
      await loadRoomDetails();
      onWorkspacesChanged();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถลบสมาชิกได้',
      });
    }
  };

  return (
    <div className="space-y-5 pt-1">
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

      {/* หากอีเมลนี้มีคำเชิญเข้าห้องใหม่ จะเด้งขึ้นมาให้กดรับทันที */}
      {myInvites.length > 0 && (
        <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-500/15 border-2 border-sky-400/50 space-y-2.5">
          <div className="text-xs font-extrabold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
            <MailOpen className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            คุณมีคำเชิญให้เข้าร่วมห้องทำงานใหม่ ({myInvites.length} ห้อง):
          </div>
          <div className="space-y-2">
            {myInvites.map((inv) => (
              <div
                key={inv.id}
                className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-500/30 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="text-xs">
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    ห้อง {inv.workspace_name} ({inv.workspace_code})
                  </span>{' '}
                  · เชิญโดย <strong>{inv.invited_by_email}</strong> · สิทธิ์ที่จะได้รับ:{' '}
                  <span className="px-2 py-0.5 rounded-full font-mono font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
                    {inv.role}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAcceptInvite(inv)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  กดเข้าร่วมห้องนี้ทันที
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          ส่วนที่ 1: ห้องทำงานของคุณ (แสดงเฉพาะห้องที่มีสิทธิ์ดู + ปุ่มสร้างห้องใหม่)
         ===================================================================== */}
      <div className="sylva-glass-card rounded-[24px] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center shrink-0">
              1
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                เลือกห้องทำงานของคุณ ({myRooms.length} ห้องที่มีสิทธิ์เข้าดู)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                ล็อกอินในนาม <strong className="font-mono text-emerald-700 dark:text-emerald-400">{currentUser.email}</strong> · คลิกเลือกห้องเพื่อดูข้อมูล หรือสร้างห้องใหม่
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* ฟอร์มสร้างห้องใหม่แบบบรรทัดเดียว เข้าใจง่าย */}
            <form onSubmit={handleCreateRoom} className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ตั้งชื่อห้องใหม่..."
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 w-44"
              />
              <button
                type="submit"
                disabled={creatingRoom || !newName.trim()}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                สร้างห้องใหม่
              </button>
            </form>

            {onLogoutEmail && (
              <button
                type="button"
                onClick={onLogoutEmail}
                className="px-3.5 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-400/40 text-xs font-extrabold cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                เปลี่ยนอีเมล / ออกจากระบบ
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {myRooms.map((ws) => {
            const isActive = activeWorkspace?.id === ws.id;
            const isRoomOwner = ws.current_user_role === 'OWNER';

            return (
              <div
                key={ws.id}
                className={`p-5 rounded-2xl border-2 flex flex-col justify-between space-y-4 transition min-w-0 overflow-hidden ${
                  isActive
                    ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-500 shadow-md shadow-emerald-500/10'
                    : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                }`}
              >
                <div className="space-y-2.5 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg font-mono text-xs font-extrabold bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-slate-300 dark:border-slate-700">
                      {ws.workspace_code}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-400/40">
                      สิทธิ์: {ws.current_user_role}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                      {ws.name}
                    </h3>
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 space-y-0.5">
                      <div>เจ้าของห้อง: <strong>{ws.owner_email}</strong></div>
                      <div>
                        ข้อมูลในห้องนี้: <strong>{ws.alerts_count} Alerts</strong> · สมาชิก{' '}
                        <strong>{ws.members_count} คน</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => onSelectWorkspace(ws, true)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                      isActive
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-slate-900 hover:bg-emerald-600 dark:bg-slate-800 dark:hover:bg-emerald-600 text-white'
                    }`}
                  >
                    <FolderKanban className="w-3.5 h-3.5" />
                    {isActive ? 'กำลังใช้งานห้องนี้ (เปิด Dashboard)' : 'เข้าใช้งานห้องนี้'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {myRooms.length > 1 && isRoomOwner && (
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteWorkspaceById(ws.id, currentUser.email);
                        onWorkspacesChanged();
                      }}
                      title="ลบห้องนี้"
                      className="p-2 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-400/40 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          ส่วนที่ 2: สมาชิกในห้องปัจจุบัน & เชิญคนเข้าห้องด้วยอีเมล
         ===================================================================== */}
      {activeWorkspace && (
        <div className="sylva-glass-card rounded-[24px] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center shrink-0">
                2
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>
                    สมาชิกในห้อง {activeWorkspace.name} ({activeWorkspace.workspace_code})
                  </span>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200">
                    {members.length} คน
                  </span>
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  เฉพาะผู้ที่มีรายชื่ออยู่ในตารางนี้เท่านั้นที่จะมองเห็นข้อมูลของห้อง {activeWorkspace.workspace_code} และมีชื่อใน Dropdown หน้า Analyst Review
                </p>
              </div>
            </div>

            {/* ฟอร์มเชิญคนเข้าห้องด้วยอีเมล (เฉพาะ Owner) */}
            {isOwner ? (
              <form onSubmit={handleInviteMember} className="flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="กรอกอีเมลเพื่อนที่จะเชิญเข้าห้อง..."
                  className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 w-56"
                />
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as 'ANALYST' | 'VIEWER' | 'OWNER')
                  }
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="ANALYST">สิทธิ์: ANALYST (วิเคราะห์ได้)</option>
                  <option value="VIEWER">สิทธิ์: VIEWER (ดูอย่างเดียว)</option>
                  <option value="OWNER">สิทธิ์: OWNER (เจ้าของร่วม)</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <MailPlus className="w-4 h-4" />
                  {inviting ? 'กำลังเชิญ...' : 'เชิญเข้าห้อง'}
                </button>
              </form>
            ) : (
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                * เฉพาะเจ้าของห้อง (OWNER) เท่านั้นที่เชิญหรือลบสมาชิกได้
              </span>
            )}
          </div>

          {/* ตารางรายชื่อสมาชิกในห้องปัจจุบัน */}
          <div className="overflow-x-auto pt-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="uppercase font-extrabold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3">อีเมลสมาชิกในห้องนี้ (Member E-mail)</th>
                  <th className="py-2.5 px-3">สิทธิ์ในห้องนี้ (Role)</th>
                  <th className="py-2.5 px-3">สิ่งที่ทำได้ในห้อง {activeWorkspace.workspace_code}</th>
                  {isOwner && <th className="py-2.5 px-3 text-right">จัดการสมาชิก</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70 font-medium">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      <Users className="w-3.5 h-3.5 inline mr-1.5 text-emerald-600 dark:text-emerald-400" />
                      {m.email}
                      {m.email.toLowerCase() === currentUser.email.toLowerCase() && (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
                          คุณ
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {isOwner ? (
                        <select
                          value={m.role}
                          onChange={(e) =>
                            handleChangeMemberRole(
                              m,
                              e.target.value as 'OWNER' | 'ANALYST' | 'VIEWER'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                        >
                          <option value="OWNER">OWNER (เจ้าของห้อง)</option>
                          <option value="ANALYST">ANALYST (ผู้วิเคราะห์)</option>
                          <option value="VIEWER">VIEWER (ดูอย่างเดียว)</option>
                        </select>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full font-mono font-bold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                          {m.role}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {m.role === 'OWNER'
                        ? 'ดูข้อมูลทั้งหมด · นำเข้าไฟล์ · วิเคราะห์ AI · อนุมัติผล · เชิญ/ลบสมาชิก'
                        : m.role === 'ANALYST'
                        ? 'ดูข้อมูลทั้งหมด · นำเข้าไฟล์ · วิเคราะห์ AI · อนุมัติผลในหน้า Review'
                        : 'ดู Dashboard และตาราง Security Alerts ได้อย่างเดียว (แก้ไขไม่ได้)'}
                    </td>
                    {isOwner && (
                      <td className="py-3 px-3 text-right">
                        {m.email.toLowerCase() !== currentUser.email.toLowerCase() && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m)}
                            className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-500/20 text-rose-800 dark:text-rose-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            ลบออกจากห้อง
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* แสดงรายการอีเมลที่เจ้าของห้องเชิญไว้และรออีกฝ่ายกดรับ */}
          {isOwner && roomPendingInvites.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400">
                คำเชิญที่ส่งไปแล้ว (รอผู้รับล็อกอินเข้ามากดรับ):
              </span>
              {roomPendingInvites.map((inv) => (
                <span
                  key={inv.id}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-400/30 font-mono font-bold text-amber-900 dark:text-amber-200"
                >
                  {inv.invited_email} ({inv.role})
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
