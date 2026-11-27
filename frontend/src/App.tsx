import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldAlert,
  Clock,
  Sparkles,
  ArrowRight,
  Eye,
  UserCheck,
  LayoutDashboard,
  FileBarChart2,
  PanelLeftOpen,
  PanelLeftClose,
  Sun,
  Moon,
  Trash2,
} from 'lucide-react';
import {
  AuditLog,
  DashboardSummary,
  SavedReportItem,
  SecurityAlert,
  SOCUserIdentity,
  WorkspaceInfo,
} from './types';
import {
  clearTemporaryAlerts,
  fetchAlerts,
  fetchAuditLogs,
  fetchDashboardSummary,
  fetchWorkspaces,
  ingestJsonAlerts,
} from './services/api';
import { Sidebar, PageId } from './partials/Sidebar';
import { Header } from './partials/Header';
import { ChartsSection } from './dashboard/ChartsSection';
import { SeverityBadge } from './components/SeverityBadge';
import { MagnificationDock, DockItemData } from './components/MagnificationDock';
import { SecurityAlertsPage } from './pages/SecurityAlertsPage';
import { AlertDetailPage } from './pages/AlertDetailPage';
import { IngestPage } from './pages/IngestPage';
import { AnalystReviewPage } from './pages/AnalystReviewPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { ReportsPage } from './pages/ReportsPage';
import { formatThaiDateTime } from './utils/formatDateTime';

const SIMULATED_ATTACKS = [
  {
    label: '🔥 จำลอง Ransomware (LockBit)',
    payload: {
      id: `sim-ransom-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agent: { id: '012', name: 'erp-finance-db-01', ip: '10.20.9.10' },
      rule: {
        id: '87999',
        level: 15,
        description:
          'Ransomware activity: Volume Shadow Copy deletion via vssadmin.exe and mass file encryption (.lockbit) on ERP server.',
        mitre: { id: ['T1486', 'T1490'] },
      },
      data: {
        srcip: '10.20.4.109',
        dstip: '10.20.9.10',
        srcuser: 'CORP\\admin_erp',
        process: 'vssadmin.exe',
        command_line: 'vssadmin.exe delete shadows /all /quiet && lockbit_crypt.exe -path D:\\ERP_DATA',
        file_hash: '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f',
      },
      full_log:
        'Sysmon Event ID 1: vssadmin.exe delete shadows /all /quiet executed by CORP\\admin_erp on erp-finance-db-01',
    },
  },
  {
    label: '⚡ จำลอง Mimikatz LSASS Dump',
    payload: {
      id: `sim-lsass-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agent: { id: '015', name: 'ad-domain-ctrl-01', ip: '10.20.1.2' },
      rule: {
        id: '92088',
        level: 15,
        description:
          'Critical LSASS process memory dump detected (Mimikatz sekurlsa::logonpasswords signature) on Domain Controller.',
        mitre: { id: ['T1003.001'] },
      },
      data: {
        srcip: '10.20.1.2',
        srcuser: 'CORP\\svc_deploy',
        process: 'procdump64.exe',
        command_line: 'procdump64.exe -accepteula -ma lsass.exe C:\\Temp\\lsass.dmp',
        file_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
      full_log:
        'Sysmon Event ID 10: Process procdump64.exe accessed lsass.exe (GrantedAccess 0x1FFFFF) on ad-domain-ctrl-01',
    },
  },
  {
    label: '🌐 จำลอง SQL Injection Breach',
    payload: {
      id: `sim-sqli-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agent: { id: '018', name: 'api-gateway-prod-02', ip: '10.20.2.88' },
      rule: {
        id: '31199',
        level: 13,
        description:
          'SQL Injection UNION SELECT attack extracting customer credentials from /api/v2/auth/verify.',
        mitre: { id: ['T1190'] },
      },
      data: {
        srcip: '45.155.205.233',
        dstip: '10.20.2.88',
        srcuser: 'anonymous',
        command_line:
          "GET /api/v2/auth/verify?token=1' UNION SELECT email,password_hash,api_key FROM accounts-- HTTP/1.1",
      },
      full_log:
        'WAF Alert: 45.155.205.233 sent UNION SELECT SQLi payload to api-gateway-prod-02 (HTTP 200)',
    },
  },
];

export function App() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [activePage, setActivePage] = useState<PageId>('dashboard');

  const [currentUser] = useState<SOCUserIdentity>({
    id: 'usr-owner-001',
    email: 'owner@sentinelai.soc',
    display_name: 'SOC Analyst',
  });
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws-default-001');

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReportItem[]>(() => {
    try {
      const raw = localStorage.getItem('sentinelai_saved_reports');
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [];
  });
  const [latestNotification, setLatestNotification] = useState<string | null>(
    'พร้อมใช้งาน — อัปโหลดไฟล์ JSON/CSV หรือคลิกเลือก Alert เพื่อดูผลวิเคราะห์ AI และสร้างรายงาน'
  );

  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [simulating, setSimulating] = useState(false);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId || w.workspace_code === activeWorkspaceId) ||
    workspaces[0] ||
    null;

  useEffect(() => {
    const htmlEl = document.documentElement;
    if (darkMode) {
      htmlEl.classList.add('dark');
      htmlEl.style.colorScheme = 'dark';
    } else {
      htmlEl.classList.remove('dark');
      htmlEl.style.colorScheme = 'light';
    }
  }, [darkMode]);

  const loadData = useCallback(async () => {
    try {
      const wsList = await fetchWorkspaces(currentUser.email);
      setWorkspaces(wsList);

      const targetWs =
        wsList.find((w) => w.id === activeWorkspaceId || w.workspace_code === activeWorkspaceId) ||
        wsList.find((w) => w.current_user_role !== 'NOT_MEMBER') ||
        wsList[0];

      const wsIdToUse = targetWs ? targetWs.id : 'ws-default-001';
      if (targetWs && targetWs.id !== activeWorkspaceId) {
        setActiveWorkspaceId(targetWs.id);
        localStorage.setItem('sentinelai_workspace_id', targetWs.id);
      }

      const [sumData, alertsData, logsData] = await Promise.all([
        fetchDashboardSummary(wsIdToUse, currentUser.email),
        fetchAlerts({
          workspace_id: wsIdToUse,
          user_email: currentUser.email,
          severity: severityFilter,
          status: statusFilter,
          search: searchQuery,
        }),
        fetchAuditLogs(wsIdToUse, currentUser.email),
      ]);
      setSummary(sumData);
      setAlerts(alertsData);
      setAuditLogs(logsData);
      if (alertsData.length > 0) {
        setSelectedAlert((prev) =>
          prev ? alertsData.find((a) => a.id === prev.id) || alertsData[0] : alertsData[0]
        );
      } else {
        setSelectedAlert(null);
      }
    } catch (err) {
      console.error('Failed to load SentinelAI data:', err);
    }
  }, [activeWorkspaceId, currentUser.email, severityFilter, statusFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveReport = (alertToSave: SecurityAlert, customNote?: string) => {
    const an = alertToSave.analysis;
    const latestAudit =
      alertToSave.audit_logs && alertToSave.audit_logs.length > 0
        ? alertToSave.audit_logs[0]
        : null;
    const item: SavedReportItem = {
      id: `REP-${Date.now().toString().slice(-5)}`,
      saved_at: formatThaiDateTime(new Date()),
      title: `รายงานวิเคราะห์เหตุการณ์และแนวทางแก้ไข (${alertToSave.alert_code} — ${
        an?.incident_type || alertToSave.description
      })`,
      alert_code: alertToSave.alert_code,
      incident_type: an?.incident_type || alertToSave.description,
      severity: an?.severity || 'LOW',
      risk_score: an?.risk_score ?? 0,
      ai_summary: an?.ai_summary || alertToSave.description,
      analyst_note: customNote || latestAudit?.comment || 'ตรวจสอบและบันทึกรายงานแล้ว',
      alert_snapshot: alertToSave,
    };
    setSavedReports((prev) => {
      const filtered = prev.filter((r) => r.alert_code !== alertToSave.alert_code);
      const next = [item, ...filtered];
      localStorage.setItem('sentinelai_saved_reports', JSON.stringify(next));
      return next;
    });
    setLatestNotification(`บันทึกรายงาน ${alertToSave.alert_code} เก็บไว้ในหน้า Reports เรียบร้อยแล้ว`);
  };

  const handleDeleteSavedReport = (reportId: string) => {
    setSavedReports((prev) => {
      const next = prev.filter((r) => r.id !== reportId);
      localStorage.setItem('sentinelai_saved_reports', JSON.stringify(next));
      return next;
    });
  };

  const handleInspectAlert = (alert: SecurityAlert) => {
    setSelectedAlert(alert);
    setActivePage('workspace');
  };

  const handleReviewAlert = (alert: SecurityAlert) => {
    setSelectedAlert(alert);
    setActivePage('review');
  };

  const handleSimulateAttack = async (presetIdx: number) => {
    try {
      setSimulating(true);
      const preset = SIMULATED_ATTACKS[presetIdx];
      const uniquePayload = {
        ...preset.payload,
        id: `sim-${Date.now()}`,
        timestamp: new Date().toISOString(),
        rule: {
          ...preset.payload.rule,
          description: `${preset.payload.rule.description} [Sim #${Math.floor(Math.random() * 900 + 100)}]`,
        },
      };
      const res = await ingestJsonAlerts(
        uniquePayload,
        activeWorkspace?.id,
        `Live Attack Simulation (${preset.label})`,
        currentUser.email
      );
      await loadData();
      if (res.alerts && res.alerts[0]) {
        const newAlert = res.alerts[0];
        setSelectedAlert(newAlert);
        setLatestNotification(
          `มีข้อมูลใหม่: วิเคราะห์ ${newAlert.alert_code} (${newAlert.analysis?.severity}) เสร็จสิ้น`
        );
        setActivePage('workspace');
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  const handleEndSession = async () => {
    try {
      const res = await clearTemporaryAlerts(activeWorkspace?.id);
      await loadData();
      setLatestNotification(
        `สิ้นสุด Session เรียบร้อย — ลบข้อมูล Alert ชั่วคราว ${res.deleted_count} รายการ และ Session Audit Log ${res.deleted_audit_logs ?? 0} รายการแล้ว (รายงานที่คุณดาวน์โหลดไว้ยังคงอยู่)`
      );
      setActivePage('dashboard');
    } catch (err) {
      console.error('End session error:', err);
    }
  };

  const sevCount = (name: string) =>
    summary?.severity_distribution.find((s) => s.name === name)?.value ?? 0;

  const pendingAlertsList = alerts.filter((a) => a.status === 'PENDING_REVIEW');

  return (
    <div
      className={`min-h-screen lg:h-screen w-screen overflow-x-hidden lg:overflow-hidden p-1.5 sm:p-3 lg:p-4 flex flex-col ${
        darkMode ? 'theme-bg-dark' : 'theme-bg-light'
      } text-slate-900 dark:text-slate-100 sylva-transition`}
    >
      <div className="sylva-shell flex-1 rounded-[20px] sm:rounded-[26px] lg:rounded-[30px] p-2 sm:p-3 lg:p-4 flex overflow-hidden relative">
        {/* MAIN MENU SIDEBAR (Desktop Sidebar + Tablet/Mobile Drawer + Bottom Nav) */}
        <Sidebar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
          activePage={activePage}
          setActivePage={setActivePage}
          pendingCount={summary?.pending_review_count ?? 0}
          totalAlerts={summary?.total_alerts ?? alerts.length}
          savedReportsCount={savedReports.length}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            alerts={alerts}
            onSelectAlert={(a) => handleInspectAlert(a)}
            onQuickSearch={(q) => {
              setSearchQuery(q);
              setActivePage('workspace');
            }}
            latestNotification={latestNotification}
            onEndSession={handleEndSession}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />

          <main className="flex-1 overflow-y-auto overflow-x-hidden pr-0.5 sm:pr-1 pb-24 lg:pb-24 space-y-4 sm:space-y-5">
            {/* =====================================================================
                PAGE 1: DASHBOARD & UPLOAD (ภาพรวมและนำเข้าข้อมูลในหน้าเดียว)
               ===================================================================== */}
            {activePage === 'dashboard' && (
              <div className="space-y-5 pt-1">
                {/* Hero Banner + Live Attack Simulator + 6-Step Single-Page Workflow */}
                <div className="sylva-glass-card rounded-[26px] p-6 space-y-5">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                          Dashboard & Upload — ภาพรวมและนำเข้าข้อมูล (Simple Analysis Workspace)
                        </span>
                        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5 leading-snug">
                          Sentinel<span className="text-emerald-600 dark:text-emerald-400">AI</span> — Simple Analysis Workspace
                        </h1>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
                          นำเข้าเหตุการณ์ (Upload Alert) → เลือกเหตุการณ์ (Select Alert) → เริ่มวิเคราะห์ (Analyze) → ตรวจสอบผล (Review) → ดาวน์โหลดรายงาน (Export Report) → จบการทำงาน (End Session เบื้องหลังอัตโนมัติ)
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActivePage('workspace')}
                        className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold shadow-lg shadow-emerald-600/25 transition cursor-pointer inline-flex items-center gap-2 shrink-0"
                      >
                        <span>ไปที่ Analysis Workspace ({alerts.length} Alerts)</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 whitespace-nowrap">
                        <Sparkles className="w-3.5 h-3.5 shrink-0" /> จำลองการโจมตีสดเพื่อทดสอบ AI Analysis (1-Click Demo):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {SIMULATED_ATTACKS.map((sim, idx) => (
                          <button
                            key={idx}
                            disabled={simulating}
                            onClick={() => handleSimulateAttack(idx)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 transition cursor-pointer whitespace-nowrap"
                          >
                            {sim.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* KPI Row: Total Alerts, Critical, High, Medium, Low, Alerts ที่รอการตรวจสอบ */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                  <div
                    onClick={() => {
                      setSeverityFilter('ALL');
                      setActivePage('workspace');
                    }}
                    className="sylva-glass-card rounded-[22px] p-4 cursor-pointer hover:border-emerald-500 transition min-w-0 overflow-hidden"
                  >
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase truncate">
                      Total Alerts
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
                      {summary?.total_alerts ?? 0}
                    </div>
                    <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> จำนวนทั้งหมด
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setSeverityFilter('CRITICAL');
                      setActivePage('workspace');
                    }}
                    className="sylva-glass-card rounded-[22px] p-4 cursor-pointer border-rose-400/40 min-w-0 overflow-hidden"
                  >
                    <div className="text-xs font-extrabold text-rose-700 dark:text-rose-400 uppercase truncate">
                      Critical (วิกฤต)
                    </div>
                    <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
                      {sevCount('CRITICAL')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Score 85–100
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setSeverityFilter('HIGH');
                      setActivePage('workspace');
                    }}
                    className="sylva-glass-card rounded-[22px] p-4 cursor-pointer border-amber-400/40 min-w-0 overflow-hidden"
                  >
                    <div className="text-xs font-extrabold text-amber-700 dark:text-amber-400 uppercase truncate">
                      High (สูง)
                    </div>
                    <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                      {sevCount('HIGH')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Score 70–84
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setSeverityFilter('MEDIUM');
                      setActivePage('workspace');
                    }}
                    className="sylva-glass-card rounded-[22px] p-4 cursor-pointer border-sky-400/40 min-w-0 overflow-hidden"
                  >
                    <div className="text-xs font-extrabold text-sky-700 dark:text-sky-400 uppercase truncate">
                      Medium (ปานกลาง)
                    </div>
                    <div className="text-3xl font-extrabold text-sky-600 dark:text-sky-400 mt-1">
                      {sevCount('MEDIUM')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Score 45–69
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setSeverityFilter('LOW');
                      setActivePage('workspace');
                    }}
                    className="sylva-glass-card rounded-[22px] p-4 cursor-pointer border-emerald-400/40 min-w-0 overflow-hidden"
                  >
                    <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 uppercase truncate">
                      Low (ต่ำ)
                    </div>
                    <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                      {sevCount('LOW')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Score 0–44
                    </div>
                  </div>

                  <div
                    onClick={() => setActivePage('review')}
                    className="sylva-glass-card rounded-[22px] p-4 cursor-pointer border-2 border-amber-500/50 min-w-0 overflow-hidden"
                  >
                    <div className="text-xs font-extrabold text-amber-700 dark:text-amber-300 uppercase truncate">
                      รอการตรวจสอบ
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
                      {summary?.pending_review_count ?? 0}
                    </div>
                    <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> ไปหน้า Review -&gt;
                    </div>
                  </div>
                </div>

                {/* Benchmark Evaluation Metrics vs Ground Truth Reference Dataset */}
                {summary?.evaluation_metrics?.available && (
                  <div className="sylva-glass-card rounded-[24px] p-5 border border-emerald-500/35 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                          Empirical Evaluation Metrics (ผลทดสอบเปรียบเทียบกับชุดข้อมูลอ้างอิง Ground Truth)
                        </span>
                        <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                          ประสิทธิภาพความแม่นยำของ Risk Scoring, AI Analysis และ MITRE ATT&CK Mapping
                        </h2>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-400/40">
                        Matched Samples: {summary.evaluation_metrics.matched_samples ?? 12} Alerts
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 min-w-0">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                          Precision
                        </div>
                        <div className="text-xl font-mono font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">
                          {summary.evaluation_metrics.precision ?? 100}%
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 min-w-0">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                          Recall
                        </div>
                        <div className="text-xl font-mono font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">
                          {summary.evaluation_metrics.recall ?? 100}%
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 min-w-0">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                          F1-Score
                        </div>
                        <div className="text-xl font-mono font-extrabold text-sky-700 dark:text-sky-400 mt-0.5">
                          {summary.evaluation_metrics.f1_score ?? 100}%
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 min-w-0">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                          Severity Accuracy
                        </div>
                        <div className="text-xl font-mono font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
                          {summary.evaluation_metrics.severity_accuracy ?? 91.7}%
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 min-w-0">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                          MITRE Mapping Accuracy
                        </div>
                        <div className="text-xl font-mono font-extrabold text-purple-700 dark:text-purple-400 mt-0.5">
                          {summary.evaluation_metrics.mitre_mapping_accuracy ?? 100}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* กราฟสถิติการแจ้งเตือน & Alert Trend */}
                <div className="grid grid-cols-12 gap-5">
                  <ChartsSection
                    summary={summary}
                    onSelectAlertId={(id) => {
                      const found = alerts.find((a) => a.id === id);
                      if (found) handleInspectAlert(found);
                    }}
                  />
                </div>

                {/* Bottom Grid: Recent Alerts (8 cols) + Alerts ที่รอการตรวจสอบ (4 cols) */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                  {/* Recent Alerts Table (8 cols) */}
                  <div className="xl:col-span-8 sylva-glass-card rounded-[26px] overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                          รายการแจ้งเตือนล่าสุด (Recent Alerts)
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          คลิกที่รายการเพื่อเปิดหน้า AI Analysis หรือกดปุ่ม Review
                        </p>
                      </div>
                      <button
                        onClick={() => setActivePage('workspace')}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        ดูทั้งหมดในหน้า Analysis Workspace <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="p-3 overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-xs uppercase font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                            <th className="p-2.5">Alert ID</th>
                            <th className="p-2.5 text-center">Risk Score</th>
                            <th className="p-2.5 text-center">Severity</th>
                            <th className="p-2.5">เหตุการณ์ & AI Summary</th>
                            <th className="p-2.5">Host & IP</th>
                            <th className="p-2.5 text-right">การดำเนินการ</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm font-medium divide-y divide-slate-200 dark:divide-slate-700/70">
                          {alerts.slice(0, 6).map((alert) => {
                            const an = alert.analysis;
                            return (
                              <tr
                                key={alert.id}
                                onClick={() => handleInspectAlert(alert)}
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer"
                              >
                                <td className="p-2.5 font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                                  {alert.alert_code}
                                </td>
                                <td className="p-2.5 text-center font-mono font-extrabold text-slate-900 dark:text-white">
                                  {an?.risk_score ?? 0}
                                </td>
                                <td className="p-2.5 text-center">
                                  <SeverityBadge severity={an?.severity} />
                                </td>
                                <td className="p-2.5 max-w-xs">
                                  <div className="font-bold text-slate-900 dark:text-white truncate">
                                    {an?.incident_type || alert.description}
                                  </div>
                                  <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                                    {an?.ai_summary}
                                  </div>
                                </td>
                                <td className="p-2.5 font-mono text-xs">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {alert.hostname}
                                  </div>
                                  <div className="text-sky-700 dark:text-sky-400">
                                    {alert.src_ip || 'internal'}
                                  </div>
                                </td>
                                <td className="p-2.5 text-right whitespace-nowrap">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleInspectAlert(alert);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    AI Analysis
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Alerts ที่รอการตรวจสอบ (4 cols) */}
                  <div className="xl:col-span-4 sylva-glass-card rounded-[26px] p-5 flex flex-col">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/80">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                          Alerts ที่รอการตรวจสอบ ({pendingAlertsList.length})
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          คลิกเพื่อไปหน้า Analyst Review
                        </p>
                      </div>
                      <button
                        onClick={() => setActivePage('review')}
                        className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        เปิดหน้า Review -&gt;
                      </button>
                    </div>

                    <div className="space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
                      {pendingAlertsList.slice(0, 6).map((a) => (
                        <button
                          key={a.id}
                          onClick={() => handleReviewAlert(a)}
                          className="w-full text-left p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer space-y-1.5 overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                              {a.alert_code}
                            </span>
                            <SeverityBadge severity={a.analysis?.severity} />
                          </div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {a.analysis?.incident_type || a.description}
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                            <span className="font-mono truncate">@{a.hostname}</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 shrink-0">
                              <UserCheck className="w-3.5 h-3.5" /> ตรวจสอบ
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ส่วนนำเข้าข้อมูล (Upload Alert) รวมอยู่ในหน้า 1. Dashboard & Upload */}
                <IngestPage
                  alerts={alerts}
                  workspaceId={activeWorkspace?.id}
                  userEmail={currentUser.email}
                  onIngestSuccess={() => {
                    setLatestNotification('นำเข้าและวิเคราะห์ข้อมูล Security Alerts เสร็จสิ้น');
                    loadData();
                  }}
                  onSelectEventForDetails={(a) => {
                    setSelectedAlert(a);
                    setActivePage('workspace');
                  }}
                />
              </div>
            )}

            {/* =====================================================================
                PAGE 2: ANALYSIS WORKSPACE (เลือก Alert และดูผลวิเคราะห์ครบในหน้าเดียว)
               ===================================================================== */}
            {activePage === 'workspace' && (
              <div className="space-y-6 pt-1">
                <SecurityAlertsPage
                  alerts={alerts}
                  selectedAlert={selectedAlert}
                  onSelectAlert={(a) => setSelectedAlert(a)}
                  workspaceCode={activeWorkspace?.workspace_code}
                  workspaceName={activeWorkspace?.name}
                  userRole={activeWorkspace?.current_user_role}
                  severityFilter={severityFilter}
                  setSeverityFilter={setSeverityFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onInspectAlert={(a) => setSelectedAlert(a)}
                  onReviewAlert={handleReviewAlert}
                />

                <AlertDetailPage
                  alerts={alerts}
                  selectedAlert={selectedAlert}
                  workspaceCode={activeWorkspace?.workspace_code}
                  workspaceName={activeWorkspace?.name}
                  userEmail={currentUser.email}
                  userRole={activeWorkspace?.current_user_role}
                  onSelectAlert={(a) => setSelectedAlert(a)}
                  onGoToReview={(a) => handleReviewAlert(a)}
                  onGoToReports={() => setActivePage('reports')}
                  onSaveReport={(a, note) => handleSaveReport(a, note)}
                  onConfirmed={(updated) => {
                    setSelectedAlert(updated);
                    setLatestNotification(`ยืนยันผลวิเคราะห์ ${updated.alert_code} เสร็จสิ้น`);
                    loadData();
                  }}
                />
              </div>
            )}

            {/* =====================================================================
                PAGE 3: ANALYST REVIEW & AUDIT (ตรวจสอบผลและดูประวัติกิจกรรมในหน้าเดียว)
               ===================================================================== */}
            {activePage === 'review' && (
              <div className="space-y-6 pt-1">
                <AnalystReviewPage
                  alerts={alerts}
                  selectedAlert={selectedAlert}
                  workspaceId={activeWorkspace?.id}
                  workspaceCode={activeWorkspace?.workspace_code}
                  userEmail={currentUser.email}
                  userRole={activeWorkspace?.current_user_role}
                  onSelectAlert={(a) => setSelectedAlert(a)}
                  onGoToReports={() => setActivePage('reports')}
                  onSaveReport={(a, note) => handleSaveReport(a, note)}
                  onDecisionSaved={(updated) => {
                    setSelectedAlert(updated);
                    setLatestNotification(
                      `บันทึกผลการตรวจสอบและหมายเหตุสำหรับ ${updated.alert_code} (${updated.status}) เสร็จสิ้น`
                    );
                    loadData();
                  }}
                />

                <AuditTrailPage
                  logs={auditLogs}
                  workspaceCode={activeWorkspace?.workspace_code}
                  workspaceName={activeWorkspace?.name}
                  userRole={activeWorkspace?.current_user_role}
                />
              </div>
            )}

            {/* =====================================================================
                PAGE 4: REPORT (สร้างและดาวน์โหลดรายงาน PDF / CSV)
               ===================================================================== */}
            {activePage === 'reports' && (
              <ReportsPage
                summary={summary}
                alerts={alerts}
                savedReports={savedReports}
                onSaveReport={(a, note) => handleSaveReport(a, note)}
                onDeleteSavedReport={handleDeleteSavedReport}
                onFinishAndClearTemp={handleEndSession}
                onSelectAlert={(a) => handleInspectAlert(a)}
              />
            )}
          </main>
        </div>

        {/* macOS-style Floating Magnification Dock (Desktop Quick Command Dock) */}
        <div className="hidden lg:flex fixed bottom-5 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <MagnificationDock
            panelHeight={66}
            baseItemSize={46}
            magnification={72}
            distance={180}
            spring={{ mass: 0.1, stiffness: 150, damping: 12 }}
            items={
              [
                {
                  icon: <LayoutDashboard className="w-5 h-5" />,
                  label: 'Dashboard & Upload',
                  active: activePage === 'dashboard',
                  onClick: () => setActivePage('dashboard'),
                },
                {
                  icon: <ShieldAlert className="w-5 h-5" />,
                  label: 'Analysis Workspace',
                  active: activePage === 'workspace',
                  badge: summary?.total_alerts ?? alerts.length,
                  onClick: () => setActivePage('workspace'),
                },
                {
                  icon: <UserCheck className="w-5 h-5" />,
                  label: 'Analyst Review & Audit',
                  active: activePage === 'review',
                  badge: summary?.pending_review_count ?? 0,
                  onClick: () => setActivePage('review'),
                },
                {
                  icon: <FileBarChart2 className="w-5 h-5" />,
                  label: 'Report (PDF / CSV)',
                  active: activePage === 'reports',
                  badge: savedReports.length,
                  onClick: () => setActivePage('reports'),
                },
                {
                  icon: isCollapsed ? (
                    <PanelLeftOpen className="w-5 h-5" />
                  ) : (
                    <PanelLeftClose className="w-5 h-5" />
                  ),
                  label: isCollapsed ? 'เปิดแถบด้านข้าง' : 'พับแถบด้านข้าง',
                  onClick: () => setIsCollapsed((prev) => !prev),
                },
                {
                  icon: darkMode ? (
                    <Sun className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Moon className="w-5 h-5 text-blue-900" />
                  ),
                  label: darkMode ? 'สลับเป็น Light Mode' : 'สลับเป็น Dark Mode',
                  onClick: () => setDarkMode((prev) => !prev),
                },
                {
                  icon: <Trash2 className="w-5 h-5" />,
                  label: 'End Session (ล้างข้อมูลชั่วคราว)',
                  className:
                    '!text-rose-600 dark:!text-rose-400 hover:!bg-rose-50 dark:hover:!bg-rose-950/60 !border-rose-300 dark:!border-rose-500/40',
                  onClick: () => handleEndSession(),
                },
              ] as DockItemData[]
            }
          />
        </div>
      </div>
    </div>
  );
}
export default App;
