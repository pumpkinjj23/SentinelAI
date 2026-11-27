import React, { useState } from 'react';
import {
  BrainCircuit,
  ShieldAlert,
  Crosshair,
  Globe,
  CheckCircle2,
  FileCode2,
  UserCheck,
  ExternalLink,
  Printer,
  RefreshCw,
  BookmarkCheck,
} from 'lucide-react';
import { SecurityAlert } from '../types';
import { SeverityBadge, StatusBadge } from '../components/SeverityBadge';
import {
  reanalyzeAlert,
  submitAnalystDecision,
} from '../services/api';
import { exportPrintableRemediationReport } from '../utils/reportExporter';

interface AlertDetailPageProps {
  alerts: SecurityAlert[];
  selectedAlert: SecurityAlert | null;
  workspaceCode?: string;
  workspaceName?: string;
  userEmail?: string;
  userRole?: string;
  onSelectAlert: (alert: SecurityAlert) => void;
  onGoToReview: (alert: SecurityAlert) => void;
  onGoToReports?: () => void;
  onSaveReport?: (alert: SecurityAlert, note?: string) => void;
  onConfirmed?: (updated: SecurityAlert) => void;
}

export const AlertDetailPage: React.FC<AlertDetailPageProps> = ({
  alerts,
  selectedAlert,
  userEmail,
  userRole = 'OWNER',
  onSelectAlert,
  onGoToReview,
  onGoToReports,
  onSaveReport,
  onConfirmed,
}) => {
  const [confirming, setConfirming] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  const activeAlert = selectedAlert || alerts[0];

  if (!activeAlert || !activeAlert.analysis) {
    return (
      <div className="sylva-glass-card rounded-[26px] p-8 text-center">
        <p className="text-base font-bold text-slate-700 dark:text-slate-200">
          ยังไม่มีข้อมูล Alert ที่เลือก กรุณานำเข้าข้อมูลในหน้า Data Sources & Import
        </p>
      </div>
    );
  }

  const an = activeAlert.analysis;

  const handleQuickConfirm = async () => {
    try {
      setConfirming(true);
      setConfirmMsg(null);
      const updated = await submitAnalystDecision(
        activeAlert.id,
        {
          analyst_name: userEmail ? `${userEmail} (${userRole})` : 'Local Operator',
          action: 'APPROVE_ALERT',
          comment: 'ตรวจสอบแล้ว พบหลักฐานสอดคล้องกับผลวิเคราะห์ AI',
          adjusted_severity: an.severity,
          adjusted_risk_score: an.risk_score,
        },
        userEmail
      );
      setConfirmMsg(
        `ยืนยันผลการตรวจสอบ ${updated.alert_code} สำเร็จ (บันทึก APPROVE_ALERT ลงใน Audit Logs แล้ว)`
      );
      if (onConfirmed) onConfirmed(updated);
    } catch (err: unknown) {
      setConfirmMsg(err instanceof Error ? err.message : 'ไม่สามารถยืนยันผลได้');
    } finally {
      setConfirming(false);
    }
  };

  const handleReanalyze = async () => {
    try {
      setReanalyzing(true);
      setConfirmMsg(null);
      const updated = await reanalyzeAlert(activeAlert.id, userEmail);
      setConfirmMsg(`วิเคราะห์ ${updated.alert_code} ใหม่เสร็จสิ้นแล้ว`);
      if (onConfirmed) onConfirmed(updated);
    } catch (err: unknown) {
      setConfirmMsg(err instanceof Error ? err.message : 'ไม่สามารถเรียกวิเคราะห์ใหม่ได้');
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <div className="space-y-5 pt-1">
      {/* Top Bar: Alert Selector, ปุ่มยืนยันผลการตรวจสอบ & Quick Action to Analyst Review */}
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              ผลการวิเคราะห์เชิงลึก (AI Analysis, Risk Scoring & MITRE ATT&CK Mapping)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-snug">
              {activeAlert.alert_code} — {an.incident_type}
            </h2>
            <SeverityBadge severity={an.severity} />
            <StatusBadge status={activeAlert.status} />
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40 whitespace-nowrap">
              AI Analysis: {reanalyzing ? 'Processing...' : 'Completed'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-700/80">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
              เลือก Alert:
            </label>
            <select
              value={activeAlert.id}
              onChange={(e) => {
                setConfirmMsg(null);
                const found = alerts.find((a) => a.id === Number(e.target.value));
                if (found) onSelectAlert(found);
              }}
              className="px-3.5 py-2.5 rounded-xl text-sm font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none max-w-md truncate"
            >
              {alerts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.alert_code} [{a.analysis?.severity}] — {a.analysis?.incident_type || a.description}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Analyze */}
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 text-xs font-extrabold transition cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0 ${reanalyzing ? 'animate-spin' : ''}`} />
              {reanalyzing ? 'กำลังวิเคราะห์...' : 'Analyze (วิเคราะห์ซ้ำ)'}
            </button>

            {/* 2. Review */}
            <button
              onClick={() => onGoToReview(activeAlert)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              Review (ตรวจสอบ & เพิ่มหมายเหตุ)
            </button>

            {/* 3. Download PDF */}
            <button
              onClick={() =>
                exportPrintableRemediationReport(
                  [activeAlert],
                  `รายงานวิเคราะห์เหตุการณ์และแนวทางแก้ไข (${activeAlert.alert_code})`
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              Download PDF
            </button>

            {/* 5. Save Report */}
            {onSaveReport && (
              <button
                onClick={() => {
                  onSaveReport(activeAlert);
                  setConfirmMsg(
                    `บันทึกรายงาน ${activeAlert.alert_code} ลงในรายการ "รายงานที่บันทึกไว้ (Saved Reports)" เรียบร้อยแล้ว!`
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold shadow-xs transition cursor-pointer whitespace-nowrap"
              >
                <BookmarkCheck className="w-3.5 h-3.5 shrink-0" />
                Save Report (บันทึกรายงานนี้)
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmMsg && (
        <div className="p-4 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-900 dark:bg-emerald-500/20 dark:border-emerald-400/40 dark:text-emerald-200 text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{confirmMsg}</span>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 8 Columns: AI Summary, Suspicious Behavior Analysis, Recommendations, Raw Log */}
        <div className="lg:col-span-8 space-y-5 min-w-0">
          {/* AI Summary & วิเคราะห์พฤติกรรมที่น่าสงสัย */}
          <div className="sylva-glass-card rounded-[26px] p-6 space-y-5 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
              <h3 className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 shrink-0" />
                AI Summary & วิเคราะห์พฤติกรรมที่น่าสงสัย
              </h3>
              <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                AI Engine: {an.ai_provider} ({an.analysis_duration_ms} ms)
              </span>
            </div>

            <div>
              <div className="text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase mb-1.5">
                AI Summary (สรุปเหตุการณ์ที่เกิดขึ้น)
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white leading-relaxed bg-slate-50 dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 break-words">
                {an.ai_summary}
              </p>
            </div>

            <div>
              <div className="text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase mb-1.5">
                วิเคราะห์พฤติกรรมที่น่าสงสัย (Suspicious Behavior Analysis)
              </div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed bg-slate-50 dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 break-words">
                {an.behavior_analysis}
              </p>
            </div>

            {an.evidence_citations && an.evidence_citations.length > 0 && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="text-xs font-extrabold text-sky-700 dark:text-sky-400 uppercase">
                    หลักฐานอ้างอิงจาก Alert ที่ AI ใช้ประกอบการวิเคราะห์ (Evidence Citations — {an.evidence_citations.length} รายการ)
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200 border border-sky-300 dark:border-sky-400/40">
                    Evidence-Grounded · Reduced Hallucination Risk
                  </span>
                </div>
                <ul className="space-y-2">
                  {an.evidence_citations.map((cit, idx) => (
                    <li
                      key={idx}
                      className="p-3 rounded-xl bg-sky-50/70 dark:bg-slate-900/90 border border-sky-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed break-all"
                    >
                      {cit}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* แนวทางตรวจสอบเบื้องต้น */}
          <div className="sylva-glass-card rounded-[26px] p-6 space-y-4 overflow-hidden">
            <h3 className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              แนวทางตรวจสอบเบื้องต้นและวิธีแก้ไข (Investigation & Remediation Steps)
            </h3>
            <ul className="space-y-3">
              {an.recommendations.map((rec, idx) => (
                <li
                  key={idx}
                  className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-slate-900/90 border border-emerald-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed break-words"
                >
                  {rec.replace(/^\d+\.\s*/, '• ')}
                </li>
              ))}
            </ul>
          </div>

          {/* Alert ต้นฉบับ */}
          <div className="sylva-glass-card rounded-[26px] p-6 space-y-4 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
              <h3 className="text-base font-extrabold text-amber-700 dark:text-amber-400 uppercase flex items-center gap-2">
                <FileCode2 className="w-5 h-5 shrink-0" />
                Alert ต้นฉบับ และหลักฐานที่แยกเก็บ (Original Alert & Raw Log)
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                  Event ID: <strong>{activeAlert.external_id || activeAlert.alert_code}</strong>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200 border border-sky-300 dark:border-sky-400/40">
                  ตรวจพบเหตุการณ์นี้ {activeAlert.occurrence_count} ครั้ง (Deduplicated)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 min-w-0 overflow-hidden">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                  Source & Rule
                </span>
                <span className="text-sm font-mono font-bold text-slate-900 dark:text-white block mt-0.5 break-words">
                  {activeAlert.source} (#{activeAlert.rule_id} Lv.{activeAlert.rule_level})
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 min-w-0 overflow-hidden">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                  Target Hostname
                </span>
                <span className="text-sm font-mono font-bold text-slate-900 dark:text-white block mt-0.5 break-words">
                  {activeAlert.hostname}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 min-w-0 overflow-hidden">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                  Source IP → Dest IP
                </span>
                <span className="text-sm font-mono font-bold text-emerald-700 dark:text-emerald-400 block mt-0.5 break-words">
                  {activeAlert.src_ip || 'N/A'} → {activeAlert.dst_ip || 'N/A'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 min-w-0 overflow-hidden">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                  Username / Process
                </span>
                <span className="text-sm font-mono font-bold text-slate-900 dark:text-white block mt-0.5 break-words">
                  {activeAlert.username || 'N/A'} ({activeAlert.process_name || 'N/A'})
                </span>
              </div>
            </div>

            {activeAlert.command_line && (
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1.5">
                  Command Line / Payload URI:
                </span>
                <pre className="text-sm font-mono text-amber-300 bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {activeAlert.command_line}
                </pre>
              </div>
            )}

            <div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1.5">
                Raw Security Log ต้นฉบับ:
              </span>
              <pre className="text-sm font-mono text-emerald-300 bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                {activeAlert.raw_log}
              </pre>
            </div>
          </div>

          {/* ผลการตรวจสอบ IOC (Threat Intel) — Moved directly below Alert ต้นฉบับ for balanced height */}
          <div className="sylva-glass-card rounded-[26px] p-6 space-y-4 overflow-hidden">
            <h3 className="text-base font-extrabold text-sky-700 dark:text-sky-400 uppercase flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
              <Globe className="w-5 h-5 shrink-0" />
              ผลการตรวจสอบ IOC (Threat Intel)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {an.ioc_results.map((ioc, i) => {
                const repBadge =
                  ioc.reputation === 'MALICIOUS'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200 border-rose-300 dark:border-rose-400/40'
                    : ioc.reputation === 'SUSPICIOUS'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200 border-amber-300 dark:border-amber-400/40'
                    : 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200 border-sky-300 dark:border-sky-400/40';

                return (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-1.5 overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white break-all">
                        [{ioc.indicator_type.toUpperCase()}] {ioc.value}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${repBadge}`}
                      >
                        {ioc.reputation} ({ioc.confidence_score}%)
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-200 break-words leading-relaxed">
                      {ioc.details}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 4 Columns: Risk Score และเหตุผล, MITRE ATT&CK Mapping */}
        <div className="lg:col-span-4 space-y-5 min-w-0">
          {/* Risk Score และเหตุผล */}
          <div className="sylva-glass-card rounded-[26px] p-6 space-y-4 overflow-hidden">
            <h3 className="text-base font-extrabold text-rose-700 dark:text-rose-400 uppercase flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              Risk Score และเหตุผล
            </h3>

            <div className="flex items-center justify-between gap-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700">
              <div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Deterministic Risk Score
                </div>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {an.risk_score} <span className="text-sm font-normal text-slate-500">/ 100</span>
                </div>
              </div>
              <SeverityBadge severity={an.severity} />
            </div>

            <div className="space-y-2.5">
              {an.scoring_breakdown.map((b, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-sm overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2 font-bold text-slate-900 dark:text-white">
                    <span className="break-words">{b.factor}</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 shrink-0">
                      {b.points >= 0 ? `+${b.points}` : b.points} คะแนน
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 break-words leading-relaxed">
                    {b.reason}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 break-words leading-relaxed">
              <strong className="text-slate-900 dark:text-white">คำอธิบายสรุป:</strong>{' '}
              {an.risk_justification}
            </div>
          </div>

          {/* MITRE ATT&CK Mapping */}
          <div className="sylva-glass-card rounded-[26px] p-6 space-y-3 overflow-hidden">
            <h3 className="text-base font-extrabold text-purple-700 dark:text-purple-400 uppercase flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
              <Crosshair className="w-5 h-5 shrink-0" />
              MITRE ATT&CK Mapping
            </h3>

            <div className="space-y-3">
              {an.mitre_mapping.map((m) => (
                <div
                  key={m.technique_id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-2 overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-400/40 font-mono text-xs font-bold">
                      {m.technique_id}
                    </span>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      MITRE Docs <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white break-words">
                    {m.name}
                  </div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Tactic: <strong>{m.tactic}</strong> · Confidence: <strong>{m.confidence}</strong>
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 break-words leading-relaxed">
                    {m.evidence}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
