import React, { useState, useMemo } from 'react';
import {
  FileBarChart2,
  Download,
  Printer,
  BrainCircuit,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Wrench,
  Database,
  Crosshair,
  BookmarkCheck,
  Trash2,
} from 'lucide-react';
import { DashboardSummary, SavedReportItem, SecurityAlert } from '../types';
import { SeverityBadge, StatusBadge } from '../components/SeverityBadge';
import {
  exportAlertsToCSV,
  exportPrintableRemediationReport,
} from '../utils/reportExporter';
import { formatThaiDateTime } from '../utils/formatDateTime';

interface ReportsPageProps {
  summary: DashboardSummary | null;
  alerts: SecurityAlert[];
  savedReports?: SavedReportItem[];
  onSaveReport?: (alert: SecurityAlert, note?: string) => void;
  onDeleteSavedReport?: (reportId: string) => void;
  onFinishAndClearTemp?: () => void;
  onSelectAlert: (alert: SecurityAlert) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  summary,
  alerts,
  savedReports = [],
  onSaveReport,
  onDeleteSavedReport,
  onFinishAndClearTemp,
  onSelectAlert,
}) => {
  const [filterMode, setFilterMode] = useState<'approved_only' | 'all'>('approved_only');
  const [timeRange, setTimeRange] = useState<'ALL' | 'LAST_24H' | 'LAST_7D'>('ALL');
  const [reportCategory, setReportCategory] = useState<'ALL' | 'HIGH_RISK' | 'APPROVED'>('ALL');
  const [exportHistory, setExportHistory] = useState<
    { id: string; timestamp: string; format: 'PDF' | 'CSV'; title: string; count: number }[]
  >([
    {
      id: 'EXP-0001',
      timestamp: formatThaiDateTime(new Date()),
      format: 'PDF',
      title: 'รายงานสรุปเหตุการณ์และวิธีแก้ไขเบื้องต้น',
      count: alerts.length || 12,
    },
  ]);

  if (!summary) return null;

  const filteredByTimeAlerts = useMemo(() => {
    const now = Date.now();
    return alerts.filter((a) => {
      if (timeRange !== 'ALL') {
        const ts = new Date(a.timestamp).getTime();
        if (timeRange === 'LAST_24H' && now - ts > 24 * 3600 * 1000) return false;
        if (timeRange === 'LAST_7D' && now - ts > 7 * 24 * 3600 * 1000) return false;
      }
      if (reportCategory === 'HIGH_RISK') {
        const sev = a.analysis?.severity;
        return sev === 'CRITICAL' || sev === 'HIGH';
      }
      if (reportCategory === 'APPROVED') {
        return a.status === 'APPROVED' || a.status === 'ESCALATED';
      }
      return true;
    });
  }, [alerts, timeRange, reportCategory]);

  const sourceDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    alerts.forEach((a) => {
      const s = a.source || 'Unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([source, count]) => ({ source, count }));
  }, [alerts]);

  const recordExport = (format: 'PDF' | 'CSV', title: string, count: number) => {
    setExportHistory((prev) => [
      {
        id: `EXP-000${prev.length + 1}`,
        timestamp: formatThaiDateTime(new Date()),
        format,
        title,
        count,
      },
      ...prev,
    ]);
  };

  const approvedAlerts = filteredByTimeAlerts.filter(
    (a) => a.status === 'APPROVED' || a.status === 'ESCALATED'
  );
  const displayedRemediationAlerts =
    filterMode === 'approved_only' && approvedAlerts.length > 0
      ? approvedAlerts
      : filteredByTimeAlerts;

  return (
    <div className="space-y-6 pt-1">
      {/* Header & Main Export Actions */}
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4">
        <div className="min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
            Report — สร้างและดาวน์โหลดรายงาน (PDF / CSV พร้อม Session Audit Log)
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5 leading-snug">
            <FileBarChart2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>สร้างและดาวน์โหลดรายงานผลการวิเคราะห์ (PDF / CSV)</span>
          </h2>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
            ส่งออกรายงาน PDF / CSV พร้อม Session Audit Log และบันทึกรายงานสำคัญ (ระบบจัดการ Session Management & Data Cleanup ให้อัตโนมัติอยู่เบื้องหลัง)
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-700/80">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as 'ALL' | 'LAST_24H' | 'LAST_7D')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="ALL">ช่วงเวลาของรายงาน: ทั้งหมด</option>
              <option value="LAST_24H">ช่วงเวลา: ย้อนหลัง 24 ชั่วโมง</option>
              <option value="LAST_7D">ช่วงเวลา: ย้อนหลัง 7 วัน</option>
            </select>

            <select
              value={reportCategory}
              onChange={(e) =>
                setReportCategory(e.target.value as 'ALL' | 'HIGH_RISK' | 'APPROVED')
              }
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="ALL">ประเภทข้อมูล: เหตุการณ์ทั้งหมด ({alerts.length})</option>
              <option value="HIGH_RISK">ประเภทข้อมูล: เฉพาะความเสี่ยงสูง (Critical / High)</option>
              <option value="APPROVED">ประเภทข้อมูล: เฉพาะที่ยืนยันผลแล้ว (Approved)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                const targetList =
                  approvedAlerts.length > 0 ? approvedAlerts : filteredByTimeAlerts;
                const title =
                  approvedAlerts.length > 0
                    ? `รายงานเหตุการณ์ที่อนุมัติแล้วพร้อมวิธีแก้ไข (${approvedAlerts.length} รายการ)`
                    : `รายงานสรุปการวิเคราะห์และวิธีแก้ไขภัยคุกคาม (${filteredByTimeAlerts.length} รายการ)`;
                recordExport('PDF', title, targetList.length);
                exportPrintableRemediationReport(targetList, title, summary);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4 shrink-0" />
              ส่งออก Report ที่อนุมัติพร้อมวิธีแก้ไข (PDF)
            </button>

            <button
              onClick={() => {
                const targetList =
                  approvedAlerts.length > 0 ? approvedAlerts : filteredByTimeAlerts;
                recordExport(
                  'CSV',
                  'SentinelAI-Approved-Remediation-Report.csv',
                  targetList.length
                );
                exportAlertsToCSV(targetList, 'SentinelAI-Approved-Remediation-Report');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-extrabold shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              Export CSV พร้อมวิธีแก้ไข (.csv)
            </button>

            <button
              onClick={() => {
                const title = `รายงานสรุปเหตุการณ์ภัยคุกคามทั้งหมด (${filteredByTimeAlerts.length} รายการ)`;
                recordExport('PDF', title, filteredByTimeAlerts.length);
                exportPrintableRemediationReport(filteredByTimeAlerts, title, summary);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold border border-slate-600 transition cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4 shrink-0" />
              Export รายงานรวมทั้งหมด (PDF)
            </button>

            {onFinishAndClearTemp && (
              <button
                type="button"
                onClick={onFinishAndClearTemp}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-extrabold shadow-sm transition cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                สิ้นสุด Session และลบข้อมูลชั่วคราว (End Session)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================
          SAVED REPORTS SECTION (เก็บเฉพาะรายงานที่ผู้ใช้เลือกบันทึก Save Report)
         ======================================================================== */}
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4 border-2 border-purple-500/40">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 block">
              Report-Only Persistence Policy (เก็บเฉพาะรายงานที่ผู้ใช้เลือกบันทึก)
            </span>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
              <BookmarkCheck className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>รายงานที่ผู้ใช้เลือกบันทึกไว้ (Saved Reports — {savedReports.length} รายการ)</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              ระบบเก็บเฉพาะรายงานที่คุณกดปุ่ม <strong>Save Report</strong> เท่านั้น เพื่อลดความซับซ้อนและสามารถกลับมาดาวน์โหลด PDF ได้ตลอดเวลาแม้จะลบข้อมูล Alert ชั่วคราวไปแล้ว
            </p>
          </div>
        </div>

        {savedReports.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
            ยังไม่มีรายงานที่กดบันทึก — คุณสามารถกดปุ่ม <strong>&ldquo;Save Report&rdquo;</strong> จากหน้า AI Analysis, หน้า Analyst Review หรือการ์ดรายงานด้านล่างเพื่อเก็บเฉพาะรายงานที่สำคัญไว้ที่นี่
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {savedReports.map((rep) => (
              <div
                key={rep.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-purple-300 dark:border-purple-500/30 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-purple-600 text-white font-mono text-xs font-extrabold">
                        {rep.alert_code}
                      </span>
                      <SeverityBadge severity={rep.severity} />
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                        Risk Score: {rep.risk_score}/100
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      บันทึกเมื่อ: {rep.saved_at}
                    </span>
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {rep.incident_type}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {rep.ai_summary}
                  </p>
                  {rep.analyst_note && (
                    <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      หมายเหตุผู้ตรวจสอบ: {rep.analyst_note}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        exportPrintableRemediationReport([rep.alert_snapshot], rep.title)
                      }
                      className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Download PDF
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        exportAlertsToCSV(
                          [rep.alert_snapshot],
                          `SentinelAI-Saved-${rep.alert_code}`
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      CSV
                    </button>
                  </div>

                  {onDeleteSavedReport && (
                    <button
                      type="button"
                      onClick={() => onDeleteSavedReport(rep.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      ลบรายงานที่บันทึก
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================
          NEW SECTION: รายงานที่อนุมัติแล้ว พร้อมวิธีแก้ไขและแนวทางดำเนินการ
         ======================================================================== */}
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-5 border-2 border-emerald-500/40">
        <div className="space-y-3 border-b border-slate-200 dark:border-slate-700/80 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white leading-snug">
                รายการที่อนุมัติแล้ว พร้อมวิธีแก้ไขและแนวทางระงับเหตุ (Approved Remediation Reports)
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              แสดงรายการเหตุการณ์ที่ผ่านการอนุมัติ พร้อมขั้นตอนวิธีแก้ไข (Remediation Steps) และปุ่มส่งออกเป็นไฟล์ Report แยกรายเหตุการณ์ได้ทันที
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterMode('approved_only')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer whitespace-nowrap ${
                filterMode === 'approved_only'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
              }`}
            >
              เฉพาะที่อนุมัติแล้ว ({approvedAlerts.length})
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer whitespace-nowrap ${
                filterMode === 'all'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
              }`}
            >
              แสดงทุกเหตุการณ์พร้อมวิธีแก้ไข ({alerts.length})
            </button>
          </div>
        </div>

        {filterMode === 'approved_only' && approvedAlerts.length === 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-400/30 text-sm font-medium text-amber-900 dark:text-amber-200">
            ยังไม่มีรายการที่กด Approve ในหน้า Analyst Review ระบบจึงแสดงรายการทั้งหมดพร้อมวิธีแก้ไขด้านล่างเพื่อให้คุณสามารถทดลองส่งออก Report ได้ทันที
          </div>
        )}

        <div className="space-y-4">
          {displayedRemediationAlerts.map((a) => {
            const an = a.analysis;
            if (!an) return null;
            const latestAudit = a.audit_logs && a.audit_logs.length > 0 ? a.audit_logs[0] : null;

            return (
              <div
                key={a.id}
                className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-4 overflow-hidden"
              >
                {/* Card Top Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                    <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-mono text-sm font-extrabold whitespace-nowrap">
                      {a.alert_code}
                    </span>
                    <span className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                      {an.incident_type}
                    </span>
                    <SeverityBadge severity={an.severity} />
                    <StatusBadge status={a.status} />
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                      Host: <strong>{a.hostname}</strong> · IP: <strong>{a.src_ip || 'internal'}</strong> · Score: <strong>{an.risk_score}/100</strong>
                    </span>
                  </div>

                  {/* Per-Alert Export Report Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {onSaveReport && (
                      <button
                        type="button"
                        onClick={() => onSaveReport(a)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold shadow-xs transition cursor-pointer whitespace-nowrap"
                      >
                        <BookmarkCheck className="w-3.5 h-3.5 shrink-0" />
                        Save Report
                      </button>
                    )}
                    <button
                      onClick={() =>
                        exportPrintableRemediationReport(
                          [a],
                          `รายงานการอนุมัติและวิธีแก้ไขเหตุการณ์ (${a.alert_code} — ${an.incident_type})`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
                    >
                      <Printer className="w-3.5 h-3.5 shrink-0" />
                      Download PDF
                    </button>
                    <button
                      onClick={() => exportAlertsToCSV([a], `SentinelAI-Report-${a.alert_code}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold border border-slate-300 dark:border-slate-600 transition cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      CSV
                    </button>
                  </div>
                </div>

                {/* AI Summary & Remediation Steps side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-5 space-y-2.5">
                    <div className="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400">
                      สรุปเหตุการณ์และผลการอนุมัติ
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed bg-white dark:bg-slate-800/90 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                      {an.ai_summary}
                    </p>

                    {latestAudit ? (
                      <div className="p-3.5 rounded-xl bg-emerald-100/70 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-400/30 text-xs space-y-1">
                        <div className="font-bold text-emerald-900 dark:text-emerald-200">
                          ✓ อนุมัติ/ตรวจสอบโดย: {latestAudit.analyst_name} ({latestAudit.action})
                        </div>
                        <div className="text-emerald-800 dark:text-emerald-100 font-medium">
                          ความคิดเห็น: {latestAudit.comment}
                        </div>
                        <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                          เวลา: {formatThaiDateTime(latestAudit.created_at)}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                        สถานะ: รอการอนุมัติจาก Analyst (สามารถส่งออกแนวทางแก้ไขเบื้องต้นได้ทันที)
                      </div>
                    )}
                  </div>

                  {/* วิธีแก้ไขและแนวทางการระงับเหตุ (Remediation Playbook) */}
                  <div className="lg:col-span-7 space-y-2">
                    <div className="text-xs font-extrabold uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <Wrench className="w-4 h-4" />
                      วิธีแก้ไขและแนวทางการตรวจสอบ/ระงับเหตุ (Remediation & Action Steps)
                    </div>
                    <ul className="space-y-2">
                      {an.recommendations.map((rec, idx) => (
                        <li
                          key={idx}
                          className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border-l-4 border-l-emerald-500 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed"
                        >
                          {rec.replace(/^\d+\.\s*/, `${idx + 1}. `)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================
          EXISTING SECTIONS (เก็บส่วนสรุปเดิมไว้ครบถ้วนตามที่ต้องการ)
         ======================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Summary Counts (4 cols) */}
        <div className="xl:col-span-4 sylva-glass-card rounded-[26px] p-6 space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
            <ShieldAlert className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            สรุปจำนวน Alerts ในระบบ
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 min-w-0 overflow-hidden">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
                ทั้งหมด
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {summary.total_alerts}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-400/30 min-w-0 overflow-hidden">
              <div className="text-xs font-bold text-amber-800 dark:text-amber-300 truncate">
                รอตรวจสอบ
              </div>
              <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">
                {summary.pending_review_count}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-400/30 min-w-0 overflow-hidden">
              <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 truncate">
                ตรวจแล้ว
              </div>
              <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
                {summary.reviewed_count}
              </div>
            </div>
          </div>
        </div>

        {/* Severity Statistics (8 cols) */}
        <div className="xl:col-span-8 sylva-glass-card rounded-[26px] p-6 space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700/80 pb-3">
            สถิติระดับความรุนแรง (Severity Distribution Statistics)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {summary.severity_distribution.map((sev) => {
              const pct =
                summary.total_alerts > 0
                  ? Math.round((sev.value / summary.total_alerts) * 100)
                  : 0;
              return (
                <div
                  key={sev.name}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex flex-col justify-between min-w-0 overflow-hidden space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <SeverityBadge severity={sev.name} />
                  </div>
                  <div className="flex items-baseline justify-between gap-2 pt-1">
                    <div>
                      <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                        {sev.value}
                      </span>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">
                        รายการ
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: sev.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Source Distribution & MITRE ATT&CK Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-6 sylva-glass-card rounded-[26px] p-6 space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
            <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            สถิติแหล่งที่มาของ Alerts (Alert Source Distribution)
          </h3>
          <div className="space-y-3">
            {sourceDistribution.map((item) => {
              const pct =
                alerts.length > 0 ? Math.round((item.count / alerts.length) * 100) : 0;
              return (
                <div
                  key={item.source}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-900 dark:text-white">{item.source}</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400">
                      {item.count} Events ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="xl:col-span-6 sylva-glass-card rounded-[26px] p-6 space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
            <Crosshair className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            สรุป MITRE ATT&CK Tactics ที่เกี่ยวข้อง
          </h3>
          <div className="space-y-2.5">
            {summary.mitre_tactic_distribution.map((tac) => {
              const pct =
                summary.total_alerts > 0
                  ? Math.min(100, Math.round((tac.count / summary.total_alerts) * 100))
                  : 0;
              return (
                <div
                  key={tac.tactic}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-900 dark:text-white">{tac.tactic}</span>
                    <span className="font-mono text-purple-700 dark:text-purple-400">
                      {tac.count} Alerts
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* สรุปผลการวิเคราะห์ AI รายเหตุการณ์ */}
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
          <BrainCircuit className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          สรุปผลการวิเคราะห์ AI รายเหตุการณ์ (AI Analysis Summary Table)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-3">Alert ID</th>
                <th className="py-3 px-3">ความเสี่ยง</th>
                <th className="py-3 px-3">ประเภทภัยคุกคาม & MITRE</th>
                <th className="py-3 px-3">สรุปผลการวิเคราะห์จาก AI (AI Summary)</th>
                <th className="py-3 px-3">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70 text-sm">
              {alerts.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => onSelectAlert(a)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition"
                >
                  <td className="py-3.5 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    {a.alert_code}
                  </td>
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <SeverityBadge severity={a.analysis?.severity} />
                    <span className="ml-1.5 font-mono font-bold text-slate-700 dark:text-slate-200">
                      ({a.analysis?.risk_score})
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {a.analysis?.incident_type}
                    </div>
                    <div className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                      {(a.analysis?.mitre_mapping || []).map((m) => m.technique_id).join(', ')}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 max-w-xl text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                    {a.analysis?.ai_summary}
                  </td>
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* สรุปเหตุการณ์ตามช่วงเวลา */}
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
          <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          สรุปเหตุการณ์ตามช่วงเวลา (Chronological Incident Summary)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {summary.incident_timeline.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                const found = alerts.find((a) => a.id === item.id);
                if (found) onSelectAlert(found);
              }}
              className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center justify-between gap-2 min-w-0 overflow-hidden"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {item.timestamp}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {item.alert_code}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate mt-1">
                  {item.incident_type}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Host: {item.hostname}
                </div>
              </div>
              <div className="shrink-0">
                <SeverityBadge severity={item.severity} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* ประวัติการส่งออกรายงาน (Export Report History) */}
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
          <FileBarChart2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          ประวัติการส่งออกรายงาน (Export Report History)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2.5 px-3">Export ID</th>
                <th className="py-2.5 px-3">วันและเวลา</th>
                <th className="py-2.5 px-3">รูปแบบไฟล์</th>
                <th className="py-2.5 px-3">ชื่อรายงาน</th>
                <th className="py-2.5 px-3 text-right">จำนวนเหตุการณ์</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70 text-xs font-medium">
              {exportHistory.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="py-3 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {exp.id}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                    {exp.timestamp}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2.5 py-0.5 rounded-full font-mono font-bold bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200 border border-sky-300 dark:border-sky-400/40">
                      {exp.format}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                    {exp.title}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                    {exp.count} รายการ
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
