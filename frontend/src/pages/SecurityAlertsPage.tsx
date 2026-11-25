import React, { useState, useMemo } from 'react';
import {
  Search,
  Eye,
  UserCheck,
  ShieldAlert,
  ArrowUpDown,
  FileCode2,
  ArrowRight,
} from 'lucide-react';
import { SecurityAlert } from '../types';
import { SeverityBadge, StatusBadge } from '../components/SeverityBadge';
import { formatThaiDateTime } from '../utils/formatDateTime';

interface SecurityAlertsPageProps {
  alerts: SecurityAlert[];
  selectedAlert?: SecurityAlert | null;
  onSelectAlert?: (alert: SecurityAlert) => void;
  workspaceCode?: string;
  workspaceName?: string;
  userRole?: string;
  severityFilter: string;
  setSeverityFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onInspectAlert: (alert: SecurityAlert) => void;
  onReviewAlert: (alert: SecurityAlert) => void;
}

export const SecurityAlertsPage: React.FC<SecurityAlertsPageProps> = ({
  alerts,
  selectedAlert,
  onSelectAlert,
  severityFilter,
  setSeverityFilter,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  onInspectAlert,
  onReviewAlert,
}) => {
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'risk_desc' | 'risk_asc' | 'time_desc' | 'time_asc'>('risk_desc');
  const activeAlert = selectedAlert || alerts[0] || null;

  const availableSources = useMemo(() => {
    const s = new Set<string>();
    alerts.forEach((a) => {
      if (a.source) s.add(a.source);
    });
    return Array.from(s);
  }, [alerts]);

  const filteredAndSortedAlerts = useMemo(() => {
    const list = alerts.filter((a) => {
      if (sourceFilter !== 'ALL' && a.source !== sourceFilter) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      const scoreA = a.analysis?.risk_score ?? 0;
      const scoreB = b.analysis?.risk_score ?? 0;
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();

      if (sortBy === 'risk_desc') return scoreB - scoreA || timeB - timeA;
      if (sortBy === 'risk_asc') return scoreA - scoreB || timeB - timeA;
      if (sortBy === 'time_desc') return timeB - timeA;
      return timeA - timeB;
    });
  }, [alerts, sourceFilter, sortBy]);

  return (
    <div className="space-y-5">
      {/* กล่องแสดงรายละเอียดของ Alert ที่กำลังเลือกวิเคราะห์ (3. Alert Details — หน้ารายละเอียดเหตุการณ์) */}
      {activeAlert && (
        <div className="sylva-glass-card rounded-[26px] p-6 space-y-4 border-2 border-emerald-500/40">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700/80 pb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                Analysis Workspace — เลือก Alert และดูผลวิเคราะห์ครบในหน้าเดียว
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
                <FileCode2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  เหตุการณ์ที่เลือกวิเคราะห์: {activeAlert.alert_code} — {activeAlert.description}
                </span>
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onReviewAlert(activeAlert)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 cursor-pointer inline-flex items-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" />
                ไปที่ขั้นตอนถัดไป: Analyst Review & Audit <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 6 ฟิลด์หลักตามข้อกำหนด: Alert ID & Timestamp, Source IP & Destination IP, Alert Source, Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 min-w-0 overflow-hidden">
              <span className="text-slate-500 dark:text-slate-400 font-bold block">
                Alert ID & Timestamp
              </span>
              <span className="text-sm font-mono font-extrabold text-emerald-700 dark:text-emerald-400 block mt-0.5">
                {activeAlert.alert_code}
              </span>
              <span className="font-mono text-slate-600 dark:text-slate-300 block">
                {formatThaiDateTime(activeAlert.timestamp)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 min-w-0 overflow-hidden">
              <span className="text-slate-500 dark:text-slate-400 font-bold block">
                Source IP → Destination IP
              </span>
              <span className="text-sm font-mono font-extrabold text-sky-700 dark:text-sky-400 block mt-0.5 break-all">
                Src: {activeAlert.src_ip || 'N/A'}
              </span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 block break-all">
                Dst: {activeAlert.dst_ip || 'N/A'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 min-w-0 overflow-hidden">
              <span className="text-slate-500 dark:text-slate-400 font-bold block">
                Alert Source & Hostname
              </span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white block mt-0.5 truncate">
                {activeAlert.source} (Rule #{activeAlert.rule_id || 'N/A'})
              </span>
              <span className="font-mono text-slate-600 dark:text-slate-300 block truncate">
                Host: {activeAlert.hostname || 'N/A'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 min-w-0 overflow-hidden">
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-bold block">
                  Severity & Risk Score
                </span>
                <span className="text-lg font-mono font-extrabold text-slate-900 dark:text-white block mt-0.5">
                  {activeAlert.analysis?.risk_score ?? 0} / 100
                </span>
              </div>
              <SeverityBadge severity={activeAlert.analysis?.severity} />
            </div>
          </div>

          {/* Event Description & ข้อมูลต้นฉบับที่ได้รับจากไฟล์ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 block">
                Event Description (คำอธิบายเหตุการณ์):
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed break-words">
                {activeAlert.description}
              </p>
            </div>

            <div className="lg:col-span-7 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 overflow-hidden">
              <span className="text-xs font-extrabold text-emerald-400 block">
                ข้อมูลต้นฉบับที่ได้รับจากไฟล์ (Original Raw Log / Payload):
              </span>
              <pre className="text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                {activeAlert.raw_log}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Page Header & Search / Filter Bar */}
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4">
        <div className="space-y-4">
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
              ตารางเลือกเหตุการณ์ (คลิกที่แถวเพื่อดูรายละเอียดด้านบน หรือกดปุ่ม AI Analysis)
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5 leading-snug">
              <ShieldAlert className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                รายการเหตุการณ์ทั้งหมด ({filteredAndSortedAlerts.length}{' '}
                รายการ)
              </span>
            </h2>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">
              ค้นหาด้วย Alert ID หรือ Description, กรองตาม Severity / Status / แหล่งข้อมูล (Source), และเรียงลำดับตาม Risk Score หรือวันเวลา
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700/80">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหา Alert ID, Description, Host, IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-full text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 w-64"
              />
            </div>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3.5 py-2 rounded-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="ALL">Severity: ทั้งหมด</option>
              <option value="CRITICAL">CRITICAL (85–100)</option>
              <option value="HIGH">HIGH (70–84)</option>
              <option value="MEDIUM">MEDIUM (45–69)</option>
              <option value="LOW">LOW (0–44)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 rounded-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="ALL">Status: ทั้งหมด</option>
              <option value="PENDING_REVIEW">Pending Review (รอตรวจสอบ)</option>
              <option value="APPROVED">Approved (ยืนยันผลแล้ว)</option>
              <option value="REJECTED">Rejected (ไม่ยอมรับผลวิเคราะห์)</option>
              <option value="NEEDS_REANALYSIS">Needs Re-analysis (ต้องวิเคราะห์ใหม่)</option>
              <option value="ESCALATED">Escalated IR (ส่งต่อทีม IR)</option>
              <option value="FALSE_POSITIVE">False Positive (แจ้งเตือนลวง)</option>
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3.5 py-2 rounded-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="ALL">แหล่งข้อมูล (Source): ทั้งหมด</option>
              {availableSources.map((src) => (
                <option key={src} value={src}>
                  Source: {src}
                </option>
              ))}
            </select>

            <div className="inline-flex items-center gap-1.5 ml-auto">
              <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as 'risk_desc' | 'risk_asc' | 'time_desc' | 'time_asc'
                  )
                }
                className="px-3.5 py-2 rounded-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="risk_desc">เรียงตาม: Risk Score (สูง → ต่ำ)</option>
                <option value="risk_asc">เรียงตาม: Risk Score (ต่ำ → สูง)</option>
                <option value="time_desc">เรียงตาม: วันและเวลา (ล่าสุดก่อน)</option>
                <option value="time_asc">เรียงตาม: วันและเวลา (เก่าสุดก่อน)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Alerts Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] uppercase font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-3">Alert ID & ห้องเจ้าของข้อมูล</th>
                <th className="py-3 px-3">Source & Rule ID</th>
                <th className="py-3 px-3">Risk Score</th>
                <th className="py-3 px-3 text-center">Severity</th>
                <th className="py-3 px-3">Description (รายละเอียดเหตุการณ์)</th>
                <th className="py-3 px-3">Source IP → Destination IP</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="text-xs font-medium divide-y divide-slate-200 dark:divide-slate-700/70">
              {filteredAndSortedAlerts.map((alert) => {
                const an = alert.analysis;
                const score = an?.risk_score ?? 0;

                return (
                  <tr
                    key={alert.id}
                    onClick={() => (onSelectAlert ? onSelectAlert(alert) : onInspectAlert(alert))}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer ${
                      activeAlert?.id === alert.id ? 'bg-emerald-50/70 dark:bg-emerald-500/10' : ''
                    }`}
                  >
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {alert.alert_code}
                        </span>
                        {alert.occurrence_count > 1 && (
                          <span
                            title="จำนวนครั้งที่ตรวจพบ Event ซ้ำโดยระบบ Deduplication"
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200 border border-amber-300 dark:border-amber-400/40"
                          >
                            ซ้ำ {alert.occurrence_count}x
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {formatThaiDateTime(alert.timestamp)}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {alert.source}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        Rule ID: #{alert.rule_id || 'N/A'}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white w-7">
                          {score}
                        </span>
                        <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              score >= 85
                                ? 'bg-rose-500'
                                : score >= 70
                                ? 'bg-amber-500'
                                : score >= 45
                                ? 'bg-sky-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <SeverityBadge severity={an?.severity} />
                    </td>

                    <td className="py-3.5 px-3 max-w-md">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {alert.description}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                        Host: {alert.hostname} · {an?.incident_type}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 font-mono whitespace-nowrap">
                      <div className="text-[11px] font-semibold text-sky-700 dark:text-sky-400">
                        Src: {alert.src_ip || 'N/A'}
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Dst: {alert.dst_ip || 'N/A'}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <StatusBadge status={alert.status} />
                    </td>

                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectAlert(alert);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs border border-slate-300 dark:border-slate-600 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          AI Analysis
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onReviewAlert(alert);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Review
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
