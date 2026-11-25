import React from 'react';
import { FolderKanban, ArrowLeftRight, Users } from 'lucide-react';
import { SOCUserIdentity, WorkspaceInfo } from '../types';

interface WorkspaceScopeBannerProps {
  activeWorkspace: WorkspaceInfo | null;
  currentUser: SOCUserIdentity;
  accessibleWorkspaces: WorkspaceInfo[];
  onSwitchWorkspace: (ws: WorkspaceInfo) => void;
  onOpenWorkspacesPage: () => void;
  onOpenAccessPage: () => void;
}

export const WorkspaceScopeBanner: React.FC<WorkspaceScopeBannerProps> = ({
  activeWorkspace,
  currentUser,
  accessibleWorkspaces,
  onSwitchWorkspace,
  onOpenWorkspacesPage,
}) => {
  if (!activeWorkspace) return null;

  const role = activeWorkspace.current_user_role || 'OWNER';
  const roleBadge =
    role === 'OWNER'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40'
      : role === 'ANALYST'
      ? 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-400/40'
      : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/40';

  return (
    <div className="sylva-glass-card rounded-[20px] px-4 py-2.5 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-extrabold whitespace-nowrap">
          <FolderKanban className="w-3.5 h-3.5 shrink-0" />
          ห้องปัจจุบัน: {activeWorkspace.name} ({activeWorkspace.workspace_code})
        </span>
        <span className={`px-2.5 py-0.5 rounded-full font-mono font-extrabold border whitespace-nowrap ${roleBadge}`}>
          {currentUser.email} · {role}
        </span>
        <span className="text-slate-500 dark:text-slate-400 font-semibold hidden md:inline">
          (แสดงข้อมูลของห้อง {activeWorkspace.workspace_code} จำนวน {activeWorkspace.alerts_count} รายการ)
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {accessibleWorkspaces.length > 1 && (
          <div className="inline-flex items-center gap-1">
            <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <select
              value={activeWorkspace.id}
              onChange={(e) => {
                const target = accessibleWorkspaces.find((w) => w.id === e.target.value);
                if (target) onSwitchWorkspace(target);
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              {accessibleWorkspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  สลับห้อง: {w.name} ({w.workspace_code})
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={onOpenWorkspacesPage}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold cursor-pointer whitespace-nowrap"
        >
          <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          จัดการห้อง & เชิญสมาชิก
        </button>
      </div>
    </div>
  );
};
