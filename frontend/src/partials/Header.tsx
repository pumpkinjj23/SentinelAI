import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  HelpCircle,
  Sparkles,
  Sun,
  Moon,
  Clock,
  CheckCircle2,
  FolderKanban,
  MailCheck,
  Trash2,
  X,
  Menu,
} from 'lucide-react';
import { SecurityAlert, SOCUserIdentity, WorkspaceInfo } from '../types';
import { SeverityBadge } from '../components/SeverityBadge';

interface HeaderProps {
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  alerts: SecurityAlert[];
  onSelectAlert: (alert: SecurityAlert) => void;
  onQuickSearch: (q: string) => void;
  latestNotification?: string | null;
  activeWorkspace?: WorkspaceInfo | null;
  currentUser?: SOCUserIdentity | null;
  onOpenWorkspaces?: () => void;
  onOpenAccess?: () => void;
  onEndSession?: () => void;
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  setDarkMode,
  alerts,
  onSelectAlert,
  onQuickSearch,
  latestNotification,
  activeWorkspace,
  currentUser,
  onOpenWorkspaces,
  onOpenAccess,
  onEndSession,
  onOpenMobileMenu,
}) => {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [modalQuery, setModalQuery] = useState('');
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);
      setCurrentTime(`${formatted.replace(',', '')} น.`);
    };
    updateClock();
    const timer = setInterval(updateClock, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!searchModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchModalOpen]);

  const criticalAlerts = alerts.filter(
    (a) => a.analysis?.severity === 'CRITICAL' || a.analysis?.severity === 'HIGH'
  );

  const filteredModalAlerts = modalQuery.trim()
    ? alerts.filter((a) => {
        const q = modalQuery.toLowerCase();
        return (
          a.alert_code.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          (a.hostname || '').toLowerCase().includes(q) ||
          (a.src_ip || '').toLowerCase().includes(q)
        );
      })
    : alerts.slice(0, 6);

  return (
    <header className="sylva-glass-card rounded-[18px] sm:rounded-[22px] px-3 sm:px-5 py-2.5 sm:py-3 mb-3 sm:mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3 z-20 shrink-0">
      {/* Left: ปุ่มเมนูมือถือ, ชื่อระบบ, สถานะระบบ และ Notification ล่าสุด */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            title="เปิดเมนูนำทาง"
            className="lg:hidden p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 cursor-pointer shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-950 to-blue-800 flex items-center justify-center shadow-sm shadow-blue-900/30 shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L4 5.5V11.5C4 16.8 7.4 21.6 12 23C16.6 21.6 20 16.8 20 11.5V5.5L12 2Z"
                stroke="#ffffff"
                strokeWidth="2"
                fill="rgba(255,255,255,0.18)"
              />
              <circle cx="12" cy="11.5" r="2.5" fill="#ffffff" />
            </svg>
          </div>
          <span className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
            Sentinel<span className="text-emerald-600 dark:text-emerald-400">AI</span>
            <span className="hidden xl:inline font-medium text-xs text-slate-500 dark:text-slate-400 ml-1.5">
              · AI-Assisted Security Alert Analysis
            </span>
          </span>
        </div>

        <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
          <span>สถานะระบบ: Online</span>
        </div>

        {activeWorkspace && (
          <button
            type="button"
            onClick={onOpenWorkspaces}
            title="คลิกเพื่อสลับหรือสร้างห้อง Workspace"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
          >
            <FolderKanban className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{activeWorkspace.name}</span>
            <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
              ({activeWorkspace.workspace_code})
            </span>
          </button>
        )}

        {currentUser && (
          <button
            type="button"
            onClick={onOpenAccess}
            title="คลิกเพื่อเปลี่ยนอีเมล / ออกจากระบบไปหน้า Login"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 hover:bg-rose-100 dark:bg-emerald-500/15 dark:hover:bg-rose-500/25 border border-emerald-300 dark:border-emerald-400/40 text-xs font-bold text-emerald-900 dark:text-emerald-200 cursor-pointer"
          >
            <MailCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate max-w-[140px]">{currentUser.email}</span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white font-mono text-[10px]">
              {activeWorkspace?.current_user_role || 'OWNER'}
            </span>
            <span className="text-[10px] underline ml-0.5">เปลี่ยนอีเมล</span>
          </button>
        )}

        {latestNotification && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-800/30 dark:text-blue-200 dark:border-blue-500/40 text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-xs">{latestNotification}</span>
          </div>
        )}
      </div>

      {/* Right: เวลาปัจจุบัน (Current Time), Search, Dark/Light Switch, Notifications, Help */}
      <div className="flex items-center gap-2.5">
        {/* เวลาปัจจุบัน (Real-Time System Clock) */}
        <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{currentTime}</span>
        </div>

        {/* Search Pill */}
        <button
          onClick={() => setSearchModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
        >
          <Search className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline">ค้นหา...</span>
        </button>

        {/* End Session Pill */}
        {onEndSession && (
          <button
            type="button"
            onClick={onEndSession}
            title="สิ้นสุดการใช้งานและลบข้อมูลชั่วคราวทั้งหมด รวมถึง Session Audit Log"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-xs transition cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>End Session</span>
          </button>
        )}

        {/* Dark / Light Theme Sliding Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={darkMode}
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? 'สลับเป็นโหมดสว่าง (Light Mode)' : 'สลับเป็นโหมดมืด (Dark Mode)'}
          className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out items-center px-1 ${
            darkMode
              ? 'bg-slate-900 border-blue-600/50'
              : 'bg-blue-50 border-blue-200'
          }`}
        >
          <span className="sr-only">Toggle Dark / Light Theme</span>
          <Sun className="w-3.5 h-3.5 text-amber-500 ml-1" />
          <Moon className="w-3.5 h-3.5 text-blue-400 ml-auto mr-1" />
          <span
            className={`pointer-events-none absolute top-1 left-1 inline-flex h-6 w-6 transform items-center justify-center rounded-full shadow-md transition duration-200 ease-in-out ${
              darkMode
                ? 'translate-x-8 bg-blue-800 text-white'
                : 'translate-x-0 bg-white text-blue-900'
            }`}
          >
            {darkMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </span>
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setHelpOpen(false);
            }}
            className="relative p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {criticalAlerts.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl p-3 z-50 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 px-1">
                การแจ้งเตือนระบบ & High-Risk Alerts ({criticalAlerts.length})
              </div>
              {latestNotification && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-400/30 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  ✓ {latestNotification}
                </div>
              )}
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {criticalAlerts.slice(0, 5).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setNotificationsOpen(false);
                      onSelectAlert(a);
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        {a.alert_code}
                      </span>
                      <SeverityBadge severity={a.analysis?.severity} />
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white mt-1 truncate">
                      {a.analysis?.incident_type}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      Host: {a.hostname} · Score: {a.analysis?.risk_score}/100
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 5 SOC Questions Quick Guide */}
        <div className="relative">
          <button
            onClick={() => {
              setHelpOpen(!helpOpen);
              setNotificationsOpen(false);
            }}
            className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {helpOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl p-4 z-50 text-xs space-y-2">
              <div className="font-bold text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> คำถามหลักของ SentinelAI
              </div>
              <ul className="space-y-1.5 text-slate-700 dark:text-slate-200 font-medium text-sm">
                <li>• เกิดเหตุการณ์อะไรขึ้น?</li>
                <li>• เหตุการณ์นี้มีความเสี่ยงระดับใด?</li>
                <li>• เหตุใดจึงจัดอยู่ในระดับความเสี่ยงนี้?</li>
                <li>• เกี่ยวข้องกับ MITRE ATT&CK เทคนิคใด?</li>
                <li>• SOC Analyst ควรตรวจสอบอะไรต่อ?</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Search Modal */}
      {searchModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16 px-4"
          onClick={() => setSearchModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl max-w-2xl w-full rounded-3xl overflow-hidden p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400 ml-3 shrink-0" />
              <input
                type="search"
                autoFocus
                placeholder="ค้นหา Alert Code, Hostname, Source IP, MITRE Technique..."
                value={modalQuery}
                onChange={(e) => setModalQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && modalQuery.trim()) {
                    setSearchModalOpen(false);
                    onQuickSearch(modalQuery.trim());
                  }
                }}
                className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-sm py-2.5 px-2 focus:outline-none"
              />
              {modalQuery.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchModalOpen(false);
                    onQuickSearch(modalQuery.trim());
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer shrink-0"
                >
                  ค้นหา
                </button>
              )}
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                title="ปิดหน้าต่างค้นหา (Esc)"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
                <span>ปิด</span>
              </button>
            </div>
            <div className="p-2 max-h-80 overflow-y-auto space-y-1">
              {filteredModalAlerts.length === 0 ? (
                <div className="py-6 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                  ไม่พบรายการ Alert ที่ตรงกับคำค้นหา — กดปุ่ม &ldquo;ปิด&rdquo; หรือคลิกพื้นที่ว่างด้านนอกเพื่อกลับสู่หน้าหลัก
                </div>
              ) : (
                filteredModalAlerts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSearchModalOpen(false);
                      onSelectAlert(a);
                    }}
                    className="w-full text-left flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {a.alert_code} — {a.analysis?.incident_type || a.description}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                        Host: {a.hostname} · Source IP: {a.src_ip || 'internal'}
                      </div>
                    </div>
                    <SeverityBadge severity={a.analysis?.severity} />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
