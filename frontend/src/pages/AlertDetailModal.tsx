import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  BrainCircuit,
  Globe,
  Crosshair,
  FileCode2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flag,
  FileText,
  Download,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { IncidentReportResponse, SecurityAlert } from '../types';
import { SeverityBadge, StatusBadge } from '../components/SeverityBadge';
import { fetchIncidentReport, submitAnalystDecision } from '../services/api';

export const AlertDetailModal: React.FC<{
  alert: SecurityAlert | null;
  onClose: () => void;
  onUpdated: (updated: SecurityAlert) => void;
}> = ({ alert, onClose, onUpdated }) => {
  const [analystName, setAnalystName] = useState('กิตติพงศ์ (SOC Analyst Tier-2)');
  const [action, setAction] = useState<'APPROVE' | 'ESCALATE' | 'FALSE_POSITIVE' | 'REJECT'>('APPROVE');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [report, setReport] = useState<IncidentReportResponse | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!alert || !alert.analysis) return null;

  const an = alert.analysis;

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!comment.trim() || comment.trim().length < 3) {
      setError('กรุณาระบุเหตุผลประกอบการตัดสินใจอย่างน้อย 3 ตัวอักษร เพื่อบันทึกใน Audit Trail');
      return;
    }
    try {
      setSubmitting(true);
      const updated = await submitAnalystDecision(alert.id, {
        analyst_name: analystName,
        action,
        comment,
      });
      setComment('');
      onUpdated(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกผล');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setLoadingReport(true);
      const rep = await fetchIncidentReport(alert.id);
      setReport(rep);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถสร้างรายงานได้');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleDownloadReport = () => {
    if (!report) return;
    const blob = new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${alert.alert_code}-Incident-Report.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyReport = () => {
    if (!report) return;
    navigator.clipboard.writeText(report.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm font-bold px-3 py-1 rounded-lg bg-emerald-600 text-white">
              {alert.alert_code}
            </span>
            <SeverityBadge severity={an.severity} />
            <StatusBadge status={alert.status} />
            <span className="text-xs text-slate-600 dark:text-slate-300 font-mono">
              Source: {alert.source} | Rule #{alert.rule_id} (Level {alert.rule_level}) | ซ้ำ: {alert.occurrence_count} ครั้ง
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateReport}
              disabled={loadingReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              {loadingReport ? 'กำลังสร้าง Report...' : 'สร้าง Incident Report'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Generated Report Section */}
          {report && (
            <div className="bg-slate-50 dark:bg-slate-950 border border-emerald-500/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  รายงานอุบัติการณ์ (Incident Triage Report — {report.alert_code})
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyReport}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'คัดลอกแล้ว' : 'คัดลอก Markdown'}
                  </button>
                  <button
                    onClick={handleDownloadReport}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    ดาวน์โหลด .MD
                  </button>
                  <button
                    onClick={() => setReport(null)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white px-2"
                  >
                    ซ่อน
                  </button>
                </div>
              </div>
              <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto whitespace-pre-wrap max-h-72">
                {report.markdown}
              </pre>
            </div>
          )}

          {/* 5 Core Questions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Q1 & Behavioral Context */}
            <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <BrainCircuit className="w-4 h-4" />
                  คำถามที่ 1: เกิดเหตุการณ์อะไรขึ้น? (AI Incident Summary)
                </span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  Engine: {an.ai_provider} ({an.analysis_duration_ms} ms)
                </span>
              </div>
              <p className="text-sm text-slate-900 dark:text-white leading-relaxed font-semibold">
                {an.ai_summary}
              </p>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  การวิเคราะห์พฤติกรรมเชิงเทคนิค (Behavioral Analysis):
                </h4>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  {an.behavior_analysis}
                </p>
              </div>

              {/* Host & Network Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Target Host</span>
                  <span className="text-xs font-mono text-slate-900 dark:text-white font-bold">{alert.hostname}</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Source IP</span>
                  <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 font-bold">{alert.src_ip || 'N/A'}</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Destination IP</span>
                  <span className="text-xs font-mono text-slate-900 dark:text-slate-200 font-semibold">{alert.dst_ip || 'N/A'}</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">User Account</span>
                  <span className="text-xs font-mono text-amber-700 dark:text-amber-300 font-bold">{alert.username || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Q2 & Q3: Risk Score & Why */}
            <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  คำถามที่ 2 & 3: ระดับความเสี่ยงและเหตุผล
                </span>

                <div className="mt-3 flex items-center justify-between bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Rule Engine Risk Score</div>
                    <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {an.risk_score} <span className="text-sm font-normal text-slate-500">/ 100</span>
                    </div>
                  </div>
                  <SeverityBadge severity={an.severity} />
                </div>

                {/* Rule Engine Breakdown */}
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    เกณฑ์การให้คะแนนจาก Rule Engine:
                  </p>
                  {an.scoring_breakdown.map((b, idx) => (
                    <div
                      key={idx}
                      className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
                        <span>{b.factor}</span>
                        <span
                          className={`font-mono ${
                            b.points >= 0
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {b.points >= 0 ? `+${b.points}` : b.points} pts
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{b.reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <strong className="text-slate-900 dark:text-white">สรุปเหตุผล:</strong> {an.risk_justification}
              </div>
            </div>
          </div>

          {/* Q4: MITRE ATT&CK & Module 2: IOC Enrichment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Q4: MITRE ATT&CK Mapping */}
            <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                <Crosshair className="w-4 h-4" />
                คำถามที่ 4: เกี่ยวข้องกับ MITRE ATT&CK เทคนิคใด?
              </span>
              <div className="space-y-2.5">
                {an.mitre_mapping.map((m) => (
                  <div
                    key={m.technique_id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 font-mono text-xs font-bold">
                          {m.technique_id}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{m.name}</span>
                      </div>
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                      >
                        STIX Docs <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Tactic: <span className="text-slate-900 dark:text-slate-200 font-semibold">{m.tactic}</span> | Confidence:{' '}
                      <span className="text-emerald-700 dark:text-emerald-400 font-mono font-bold">{m.confidence}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/80 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800">
                      หลักฐานที่พบ: {m.evidence}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Module 2: IOC Threat Intelligence Enrichment */}
            <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                <Globe className="w-4 h-4" />
                Module 2: ผลการตรวจสอบ IOC (IP / Domain / File Hash)
              </span>
              <div className="space-y-2.5">
                {an.ioc_results.map((ioc, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {ioc.indicator_type}
                        </span>
                        <span className="font-mono text-xs text-slate-900 dark:text-white font-bold truncate">
                          {ioc.value}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                          ioc.reputation === 'MALICIOUS'
                            ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                            : ioc.reputation === 'SUSPICIOUS'
                            ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
                            : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {ioc.reputation} ({ioc.confidence_score}%)
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300">{ioc.details}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Source: {ioc.source}</span>
                      <div className="flex flex-wrap gap-1">
                        {ioc.tags.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-emerald-700 dark:text-emerald-300 border border-slate-200 dark:border-slate-800 font-mono text-[10px]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Q5: SOC Analyst Recommendations & Separated Raw Evidence Vault */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Q5: Recommendations */}
            <div className="bg-slate-50 dark:bg-slate-950/70 border border-emerald-500/40 rounded-xl p-5 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                คำถามที่ 5: SOC Analyst ควรตรวจสอบอะไรต่อ? (AI Recommendations)
              </span>
              <ul className="space-y-2">
                {an.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="text-xs font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 leading-relaxed"
                  >
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            {/* Separated Source Evidence Vault */}
            <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <FileCode2 className="w-4 h-4" />
                หลักฐานต้นทางที่แยกเก็บ (Immutable Source Evidence & Citations)
              </span>
              <div className="space-y-1.5">
                {an.evidence_citations.map((cit, i) => (
                  <div
                    key={i}
                    className="text-[11px] font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800"
                  >
                    {cit}
                  </div>
                ))}
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Raw Security Log:
                </span>
                <pre className="text-xs font-mono text-emerald-300 bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                  {alert.raw_log}
                </pre>
              </div>
            </div>
          </div>

          {/* Module 6: Human-in-the-Loop Approval & Audit Trail */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-emerald-500/40 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Module 6: Human-in-the-Loop Decision & Audit Trail
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  AI ทำหน้าที่เป็นผู้ช่วยวิเคราะห์เท่านั้น การตัดสินใจขั้นสุดท้ายต้องได้รับการอนุมัติจาก SOC Analyst พร้อมบันทึกเหตุผล
                </p>
              </div>
              <StatusBadge status={alert.status} />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/40 text-xs font-semibold text-rose-800 dark:text-rose-200">
                {error}
              </div>
            )}

            <form onSubmit={handleDecisionSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อผู้ตรวจสอบ (SOC Analyst)
                </label>
                <input
                  type="text"
                  value={analystName}
                  onChange={(e) => setAnalystName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  การตัดสินใจ (Decision)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAction('APPROVE')}
                    className={`px-2.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border cursor-pointer ${
                      action === 'APPROVE'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction('ESCALATE')}
                    className={`px-2.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border cursor-pointer ${
                      action === 'ESCALATE'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Escalate IR
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction('FALSE_POSITIVE')}
                    className={`px-2.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border cursor-pointer ${
                      action === 'FALSE_POSITIVE'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5" /> False Positive
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction('REJECT')}
                    className={`px-2.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border cursor-pointer ${
                      action === 'REJECT'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject AI
                  </button>
                </div>
              </div>

              <div className="md:col-span-5 flex flex-col justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  บันทึกผลการตรวจสอบ (Mandatory Audit Comment)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="เช่น ยืนยันผลจาก EDR แล้ว อนุมัติให้แยกเครื่องออกจากเครือข่าย..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition shrink-0 cursor-pointer"
                  >
                    {submitting ? 'กำลังบันทึก...' : 'บันทึกการตัดสินใจ'}
                  </button>
                </div>
              </div>
            </form>

            {/* Existing Audit Trail for this Alert */}
            {alert.audit_logs && alert.audit_logs.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  ประวัติการตัดสินใจของ Alert นี้ ({alert.audit_logs.length} รายการ):
                </p>
                {alert.audit_logs.map((log) => (
                  <div
                    key={log.id}
                    className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">{log.analyst_name}</span> ทำรายการ{' '}
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{log.action}</span> (
                      <span className="text-slate-500">{log.previous_status}</span> →{' '}
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{log.new_status}</span>): {log.comment}
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 shrink-0">
                      {new Date(log.created_at).toLocaleString('th-TH')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
