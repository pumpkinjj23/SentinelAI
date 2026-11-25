import React from 'react';
import {
  LayoutDashboard,
  BrainCircuit,
  UserCheck,
  FileBarChart2,
  PanelLeftClose,
} from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'workspace'
  | 'review'
  | 'reports';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  pendingCount: number;
  totalAlerts: number;
  savedReportsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  setIsCollapsed,
  activePage,
  setActivePage,
  pendingCount,
  totalAlerts,
  savedReportsCount = 0,
}) => {
  const menuItems: {
    id: PageId;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    badge?: string | number;
    badgeStyle?: string;
  }[] = [
    {
      id: 'dashboard',
      title: 'Dashboard & Upload',
      subtitle: 'ภาพรวมและนำเข้าข้อมูล (JSON/CSV)',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'workspace',
      title: 'Analysis Workspace',
      subtitle: 'เลือก Alert และดูผลวิเคราะห์ AI',
      icon: <BrainCircuit className="w-5 h-5" />,
      badge: totalAlerts,
      badgeStyle:
        'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40',
    },
    {
      id: 'review',
      title: 'Analyst Review & Audit',
      subtitle: 'ตรวจสอบผลและดูประวัติกิจกรรม',
      icon: <UserCheck className="w-5 h-5" />,
      badge: pendingCount > 0 ? pendingCount : undefined,
      badgeStyle:
        'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/40',
    },
    {
      id: 'reports',
      title: 'Report',
      subtitle: 'สร้างและดาวน์โหลดรายงาน PDF/CSV',
      icon: <FileBarChart2 className="w-5 h-5" />,
      badge: savedReportsCount > 0 ? savedReportsCount : undefined,
      badgeStyle:
        'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-400/40',
    },
  ];

  return (
    <aside
      className={`sylva-transition shrink-0 flex flex-col justify-between overflow-hidden ${
        isCollapsed ? 'w-[76px] mr-3' : 'w-72 mr-4'
      }`}
    >
      <div
        className={`sylva-glass-card h-full rounded-[24px] ${
          isCollapsed ? 'px-2.5 py-4 items-center' : 'p-3.5'
        } flex flex-col justify-between overflow-y-auto no-scrollbar`}
      >
        <div className="w-full">
          {/* Top Brand: SentinelAI / SOC Intelligence Platform */}
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-3 pb-4 mb-3 border-b border-slate-200 dark:border-slate-700/80">
              <button
                onClick={() => setActivePage('dashboard')}
                title="SentinelAI — SOC Intelligence Platform"
                className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20 cursor-pointer shrink-0"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L4 5.5V11.5C4 16.8 7.4 21.6 12 23C16.6 21.6 20 16.8 20 11.5V5.5L12 2Z"
                    stroke="#ffffff"
                    strokeWidth="2"
                    fill="rgba(255,255,255,0.18)"
                  />
                  <circle cx="12" cy="11.5" r="2.5" fill="#ffffff" />
                </svg>
              </button>

              <button
                onClick={() => setIsCollapsed(false)}
                title="ขยายแถบเมนู"
                className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <PanelLeftClose className="w-5 h-5 rotate-180" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-200 dark:border-slate-700/80">
              <button
                onClick={() => setActivePage('dashboard')}
                className="flex items-center gap-3 text-left cursor-pointer min-w-0"
              >
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2L4 5.5V11.5C4 16.8 7.4 21.6 12 23C16.6 21.6 20 16.8 20 11.5V5.5L12 2Z"
                      stroke="#ffffff"
                      strokeWidth="2"
                      fill="rgba(255,255,255,0.18)"
                    />
                    <circle cx="12" cy="11.5" r="2.5" fill="#ffffff" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                      Sentinel<span className="text-emerald-600 dark:text-emerald-400">AI</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/40 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Online
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block truncate">
                    SOC Intelligence Platform
                  </span>
                </div>
              </button>

              <button
                onClick={() => setIsCollapsed(true)}
                title="ย่อแถบเมนู"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer shrink-0"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* MAIN MENU */}
          <div className={isCollapsed ? 'flex flex-col items-center space-y-2' : 'space-y-1.5'}>
            {!isCollapsed && (
              <div className="px-2.5 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                MAIN MENU
              </div>
            )}
            {menuItems.map((item) => {
              const active = activePage === item.id;

              if (isCollapsed) {
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    title={item.title}
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center transition cursor-pointer border shrink-0 ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                        : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200/80 dark:border-slate-700/80'
                    }`}
                  >
                    {item.icon}
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-2xl flex items-center justify-between gap-2 transition cursor-pointer border ${
                    active
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/25'
                      : 'bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-xs font-bold truncate ${
                          active ? 'text-white' : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {item.title}
                      </div>
                      <div
                        className={`text-[10px] truncate ${
                          active ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        active
                          ? 'bg-white text-emerald-900 border-white'
                          : item.badgeStyle ||
                            'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Status Info */}
        {!isCollapsed && (
          <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 text-[11px] space-y-1">
            <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
              <span>Wazuh SIEM & AI Engine</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Connected
              </span>
            </div>
            <div className="text-slate-500 dark:text-slate-400">
              Human-in-the-Loop Decision Support
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
