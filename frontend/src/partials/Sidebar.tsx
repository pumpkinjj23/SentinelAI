import React from 'react';
import {
  LayoutDashboard,
  BrainCircuit,
  UserCheck,
  FileBarChart2,
  PanelLeft,
  PanelLeftOpen,
  X,
} from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'workspace'
  | 'review'
  | 'reports';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  pendingCount: number;
  totalAlerts: number;
  savedReportsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  setIsCollapsed,
  mobileOpen = false,
  setMobileOpen,
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
        'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-800/30 dark:text-blue-200 dark:border-blue-500/40',
    },
  ];

  const handleNavigate = (id: PageId) => {
    setActivePage(id);
    if (setMobileOpen) setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile / Tablet Slide-Over Drawer Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen && setMobileOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        />
      )}

      {/* Desktop Sidebar & Mobile/Tablet Slide-Over Drawer */}
      <aside
        className={`sylva-transition shrink-0 flex flex-col justify-between ${
          mobileOpen
            ? 'fixed inset-y-3 left-3 z-50 w-72 flex overflow-hidden'
            : 'hidden lg:flex overflow-visible relative z-40'
        } ${!mobileOpen && (isCollapsed ? 'lg:w-[76px] lg:mr-3' : 'lg:w-72 lg:mr-4')}`}
      >
        <div
          className={`sylva-glass-card h-full rounded-[24px] ${
            !mobileOpen && isCollapsed ? 'px-2.5 py-4 items-center overflow-visible' : 'p-3.5 overflow-y-auto no-scrollbar'
          } flex flex-col justify-between`}
        >
          <div className="w-full">
            {/* Top Brand: SentinelAI / SOC Intelligence Platform */}
            {!mobileOpen && isCollapsed ? (
              <div className="flex flex-col items-center pb-4 mb-3 border-b border-slate-200 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setIsCollapsed(false)}
                  aria-label="เปิดแถบด้านข้าง"
                  className="group relative w-11 h-11 rounded-full bg-gradient-to-br from-blue-950 to-blue-800 hover:from-slate-200 hover:to-slate-200 dark:hover:from-slate-800 dark:hover:to-slate-800 flex items-center justify-center shadow-md shadow-blue-900/30 hover:shadow-none border border-transparent hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer shrink-0 transition-all duration-200"
                >
                  {/* โลโก้ปกติ (ซ่อนเมื่อ Hover) */}
                  <svg
                    className="w-5 h-5 transition-opacity duration-150 group-hover:opacity-0"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M12 2L4 5.5V11.5C4 16.8 7.4 21.6 12 23C16.6 21.6 20 16.8 20 11.5V5.5L12 2Z"
                      stroke="#ffffff"
                      strokeWidth="2"
                      fill="rgba(255,255,255,0.18)"
                    />
                    <circle cx="12" cy="11.5" r="2.5" fill="#ffffff" />
                  </svg>

                  {/* ไอคอนเปิดแถบด้านข้าง (โผล่มาแทนโลโก้เมื่อ Hover) */}
                  <PanelLeftOpen className="w-5 h-5 text-slate-800 dark:text-slate-100 absolute opacity-0 group-hover:opacity-100 transition-opacity duration-150" />

                  {/* Tooltip แคปซูล "เปิดแถบด้านข้าง" */}
                  <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-14 top-1/2 -translate-y-1/2 z-50 px-3.5 py-1.5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold whitespace-nowrap shadow-xl">
                    เปิดแถบด้านข้าง
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-200 dark:border-slate-700/80">
                <button
                  onClick={() => handleNavigate('dashboard')}
                  className="flex items-center gap-3 text-left cursor-pointer min-w-0"
                >
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-950 to-blue-800 flex items-center justify-center shadow-md shadow-blue-900/30 shrink-0">
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

                {mobileOpen ? (
                  <button
                    onClick={() => setMobileOpen && setMobileOpen(false)}
                    title="ปิดแถบเมนู"
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer shrink-0 lg:hidden"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCollapsed(true)}
                    title="Toggle sidebar"
                    aria-label="Toggle sidebar"
                    className="hidden lg:inline-flex p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer shrink-0"
                  >
                    <PanelLeft className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* MAIN MENU */}
            <div className={!mobileOpen && isCollapsed ? 'flex flex-col items-center space-y-2' : 'space-y-1.5'}>
              {(mobileOpen || !isCollapsed) && (
                <div className="px-2.5 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  MAIN MENU
                </div>
              )}
              {menuItems.map((item) => {
                const active = activePage === item.id;

                if (!mobileOpen && isCollapsed) {
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
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
                    onClick={() => handleNavigate(item.id)}
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
          {(mobileOpen || !isCollapsed) && (
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

      {/* Mobile & Tablet Bottom Navigation Bar (< lg) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-700 px-2 py-1.5 flex items-center justify-around shadow-lg">
        {menuItems.map((item) => {
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-xl min-w-0 flex-1 transition cursor-pointer ${
                active
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 text-[9px] font-mono font-extrabold px-1 rounded-full bg-rose-500 text-white">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold truncate max-w-full">
                {item.id === 'dashboard'
                  ? 'Dashboard'
                  : item.id === 'workspace'
                  ? 'Analyze'
                  : item.id === 'review'
                  ? 'Review'
                  : 'Report'}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
