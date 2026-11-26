import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flag,
  BrainCircuit,
  Sliders,
  Printer,
  Download,
  RefreshCw,
  BookmarkCheck,
  FileBarChart2,
} from 'lucide-react';
import { SecurityAlert } from '../types';
import { SeverityBadge, StatusBadge } from '../components/SeverityBadge';
import {
  reanalyzeAlert,
  submitAnalystDecision,
} from '../services/api';
import {
  exportAlertsToCSV,
  exportPrintableRemediationReport,
} from '../utils/reportExporter';

interface AnalystReviewPageProps {
  alerts: SecurityAlert[];
  selectedAlert: SecurityAlert | null;
  workspaceId?: string;
  workspaceCode?: string;
  userEmail?: string;
  userRole?: string;
  onSelectAlert: (alert: SecurityAlert) => void;
  onDecisionSaved: (updated: SecurityAlert) => void;
  onGoToReports?: () => void;
  onSaveReport?: (alert: SecurityAlert, note?: string) => void;
}

export const AnalystReviewPage: React.FC<AnalystReviewPageProps> = ({
  alerts,
  selectedAlert,
  userEmail,
  onSelectAlert,
  onDecisionSaved,
  onGoToReports,
  onSaveReport,
}) => {
  const [queueFilter, setQueueFilter] = useState<'pending' | 'all'>('pending');
  const pendingAlerts = alerts.filter((a) => a.status === 'PENDING_REVIEW');
  const queueList =
    queueFilter === 'pending' && pendingAlerts.length > 0 ? pendingAlerts : alerts;

  const activeAlert = selectedAlert || queueList[0] || alerts[0];

  const [reviewerName, setReviewerName] = useState<string>('SOC Analyst');
  const [action, setAction] = useState<
    'APPROVE' | 'REJECT' | 'NEEDS_REANALYSIS' | 'ESCALATE' | 'FALSE_POSITIVE'
  >('APPROVE');
  const [adjustedSeverity, setAdjustedSeverity] = useState<string>(
    activeAlert?.analysis?.severity || 'HIGH'
  );
  const [adjustedScore, setAdjustedScore] = useState<number>(
    activeAlert?.analysis?.risk_score ?? 80
  );
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (activeAlert?.analysis) {
      setAdjustedSeverity(activeAlert.analysis.severity);
      setAdjustedScore(activeAlert.analysis.risk_score);
    }
  }, [activeAlert?.id]);

  const deriveSeverityFromScore = (score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' => {
    if (score >= 85) return 'CRITICAL';
    if (score >= 70) return 'HIGH';
    if (score >= 45) return 'MEDIUM';
    return 'LOW';
  };

  if (!activeAlert || !activeAlert.analysis) {
    return (
      <div className="sylva-glass-card rounded-[26px] p-8 text-center">
        <p className="text-base font-bold text-slate-700 dark:text-slate-200">
          ไม่มีรายการ Alert สำหรับตรวจสอบ
        </p>
      </div>
    );
  }

  const an = activeAlert.analysis;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!comment.trim() || comment.trim().length < 3) {
      setFeedback({
        type: 'error',
        text: 'กรุณากรอกความคิดเห็นประกอบการตัดสินใจอย่างน้อย 3 ตัวอักษร',
      });
      return;
    }

    try {
      setSubmitting(true);
      const formattedActor = reviewerName.trim() || 'SOC Analyst';

      const updated = await submitAnalystDecision(
        activeAlert.id,
        {
          analyst_name: formattedActor,
          action: `${action}_ALERT`,
          comment,
          adjusted_severity: adjustedSeverity,
          adjusted_risk_score: Number(adjustedScore),
        },
        userEmail
      );
      setComment('');
      setFeedback({
        type: 'success',
        text: `บันทึกผลการตัดสินใจ (${action}_ALERT) สำหรับ ${updated.alert_code} ลงใน Audit Logs เรียบร้อยแล้ว!`,
      });
      onDecisionSaved(updated);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถบันทึกผลการตัดสินใจได้',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pt-1">
      {/* Header */}
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4">
        <div className="min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
            Analyst Review & Audit — ตรวจสอบผลและดูประวัติกิจกรรมในหน้าเดียว
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5 leading-snug">
            <UserCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>ตรวจสอบผลวิเคราะห์ เพิ่มหมายเหตุ ยืนยันผล และดู Session Audit Log</span>
          </h2>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
            ครบทุกปุ่มการทำงานหลัก: <strong>Analyze</strong> (วิเคราะห์ซ้ำ), <strong>Review</strong> (ยืนยันผลและเพิ่มหมายเหตุ), <strong>Generate Report</strong>, <strong>Download PDF</strong> และ <strong>Save Report</strong> (เก็บเฉพาะรายงานที่เลือกบันทึก)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700/80">
          {/* 1. Analyze */}
          <button
            type="button"
            onClick={async () => {
              const updated = await reanalyzeAlert(activeAlert.id, userEmail);
              setFeedback({
                type: 'success',
                text: `วิเคราะห์เหตุการณ์ ${updated.alert_code} ซ้ำด้วย AI เรียบร้อยแล้ว`,
              });
              onDecisionSaved(updated);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 text-xs font-extrabold transition cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
            Analyze (วิเคราะห์ซ้ำ)
          </button>

          {/* 2. Generate Report */}
          {onGoToReports && (
            <button
              type="button"
              onClick={onGoToReports}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              <FileBarChart2 className="w-3.5 h-3.5 shrink-0" />
              Generate Report
            </button>
          )}

          {/* 3. Download PDF */}
          <button
            type="button"
            onClick={() =>
              exportPrintableRemediationReport(
                [activeAlert],
                `รายงานผลการวิเคราะห์และวิธีแก้ไขภัยคุกคาม (${activeAlert.alert_code})`
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold shadow-xs transition cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 shrink-0" />
            Download PDF
          </button>

          {/* 4. Save Report */}
          {onSaveReport && (
            <button
              type="button"
              onClick={() => {
                onSaveReport(activeAlert, comment.trim() || undefined);
                setFeedback({
                  type: 'success',
                  text: `บันทึกรายงาน ${activeAlert.alert_code} เก็บไว้ในหน้า Reports (Saved Reports) เรียบร้อยแล้ว!`,
                });
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              <BookmarkCheck className="w-3.5 h-3.5 shrink-0" />
              Save Report (เก็บเฉพาะรายงานนี้)
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              exportAlertsToCSV([activeAlert], `SentinelAI-Report-${activeAlert.alert_code}`)
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 text-xs font-bold transition cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            Download CSV
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-sm font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-500/20 dark:border-emerald-400/40 dark:text-emerald-200'
              : 'bg-rose-100 border-rose-300 text-rose-900 dark:bg-rose-500/20 dark:border-rose-400/40 dark:text-rose-200'
          }`}
        >
          <span>{feedback.text}</span>
          {feedback.type === 'success' && (
            <button
              type="button"
              onClick={() =>
                exportPrintableRemediationReport(
                  [activeAlert],
                  `รายงานผลการอนุมัติและวิธีแก้ไขภัยคุกคาม (${activeAlert.alert_code})`
                )
              }
              className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              🖨️ พิมพ์ / ดาวน์โหลด Report ที่อนุมัตินี้ทันที
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 4 Columns: รายการที่รอตรวจสอบ */}
        <div className="lg:col-span-4 sylva-glass-card rounded-[26px] p-5 flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/80">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              รายการที่รอตรวจสอบ
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setQueueFilter('pending')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                  queueFilter === 'pending'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                รอตรวจ ({pendingAlerts.length})
              </button>
              <button
                type="button"
                onClick={() => setQueueFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                  queueFilter === 'all'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                ทั้งหมด ({alerts.length})
              </button>
            </div>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[640px] pr-1">
            {queueList.map((a) => {
              const isSelected = a.id === activeAlert.id;
              return (
                <button
                  key={a.id}
                  onClick={() => onSelectAlert(a)}
                  className={`w-full text-left p-4 rounded-2xl border transition cursor-pointer space-y-2 overflow-hidden ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                      {a.alert_code}
                    </span>
                    <SeverityBadge severity={a.analysis?.severity} />
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {a.analysis?.incident_type || a.description}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate">
                      @{a.hostname}
                    </span>
                    <StatusBadge status={a.status} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 8 Columns: AI Evaluation Review + Analyst Decision Form */}
        <div className="lg:col-span-8 space-y-5 min-w-0">
          {/* ตรวจสอบผลและวิธีแก้ไขจาก AI */}
          <div className="sylva-glass-card rounded-[26px] p-6 space-y-4 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  ตรวจสอบผลวิเคราะห์และวิธีแก้ไขจาก AI ({activeAlert.alert_code})
                </h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-200">
                  Risk Score: {an.risk_score}/100
                </span>
                <SeverityBadge severity={an.severity} />
                <StatusBadge status={activeAlert.status} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="text-xs font-extrabold uppercase text-emerald-700 dark:text-emerald-400">
                AI Summary (สรุปเหตุการณ์):
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white leading-relaxed break-words">
                {an.ai_summary}
              </p>
              <div className="text-xs font-extrabold uppercase text-slate-600 dark:text-slate-300 pt-2">
                เหตุผลประกอบคะแนนความเสี่ยง:
              </div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed break-words">
                {an.risk_justification}
              </p>
            </div>

            <div>
              <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 mb-2.5">
                แนวทางตรวจสอบและวิธีแก้ไขจาก AI (Investigation & Remediation Steps):
              </div>
              <ul className="space-y-2.5">
                {an.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-slate-900/90 border border-emerald-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-slate-100 break-words leading-relaxed"
                  >
                    {rec.replace(/^\d+\.\s*/, '• ')}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ฟอร์มการตัดสินใจ */}
          <form
            onSubmit={handleSubmit}
            className="sylva-glass-card rounded-[26px] p-6 space-y-5 border-2 border-emerald-500/40"
          >
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
              <Sliders className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              บันทึกผลการตัดสินใจ ปรับระดับความเสี่ยง และเพิ่มความคิดเห็น
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  ผู้ตรวจสอบ (Analyst / Reviewer)
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="พิมพ์ชื่อผู้ตรวจสอบ / ผู้อนุมัติ..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  ปรับระดับความเสี่ยง (เดิม: {an.severity})
                </label>
                <select
                  value={adjustedSeverity}
                  onChange={(e) => {
                    const sev = e.target.value as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
                    setAdjustedSeverity(sev);
                    const defaultScores: Record<string, number> = {
                      CRITICAL: 92,
                      HIGH: 78,
                      MEDIUM: 55,
                      LOW: 25,
                    };
                    if (deriveSeverityFromScore(adjustedScore) !== sev) {
                      setAdjustedScore(defaultScores[sev]);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="CRITICAL">CRITICAL (85–100)</option>
                  <option value="HIGH">HIGH (70–84)</option>
                  <option value="MEDIUM">MEDIUM (45–69)</option>
                  <option value="LOW">LOW (0–44)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  ปรับคะแนน Risk Score (เดิม: {an.risk_score})
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={adjustedScore}
                  onChange={(e) => {
                    const nextScore = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    setAdjustedScore(nextScore);
                    setAdjustedSeverity(deriveSeverityFromScore(nextScore));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                เลือกสถานะการตรวจสอบ (Review Status — แยกจาก Severity)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <button
                  type="button"
                  onClick={() => setAction('APPROVE')}
                  className={`py-3 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                    action === 'APPROVE'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Approved
                </button>

                <button
                  type="button"
                  onClick={() => setAction('REJECT')}
                  className={`py-3 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                    action === 'REJECT'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <XCircle className="w-4 h-4 shrink-0" /> Rejected
                </button>

                <button
                  type="button"
                  onClick={() => setAction('NEEDS_REANALYSIS')}
                  className={`py-3 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                    action === 'NEEDS_REANALYSIS'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <BrainCircuit className="w-4 h-4 shrink-0" /> Needs Re-analysis
                </button>

                <button
                  type="button"
                  onClick={() => setAction('ESCALATE')}
                  className={`py-3 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                    action === 'ESCALATE'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" /> Escalate IR
                </button>

                <button
                  type="button"
                  onClick={() => setAction('FALSE_POSITIVE')}
                  className={`py-3 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                    action === 'FALSE_POSITIVE'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <Flag className="w-4 h-4 shrink-0" /> False Positive
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                เพิ่มความคิดเห็น (Comment)
              </label>
              <textarea
                rows={3}
                placeholder="เช่น ตรวจสอบแล้ว พบหลักฐานสอดคล้อง..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5">
              {onSaveReport && (
                <button
                  type="button"
                  onClick={() => {
                    onSaveReport(activeAlert, comment.trim() || undefined);
                    setFeedback({
                      type: 'success',
                      text: `บันทึกรายงาน ${activeAlert.alert_code} เก็บไว้ในหน้า Reports (Saved Reports) เรียบร้อยแล้ว!`,
                    });
                  }}
                  className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-sm shadow-md shadow-purple-600/20 transition cursor-pointer inline-flex items-center gap-1.5"
                >
                  <BookmarkCheck className="w-4 h-4" />
                  Save Report (บันทึกรายงานนี้เก็บไว้)
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                {submitting ? 'กำลังบันทึกผล...' : 'Review (บันทึกผลตรวจสอบ & หมายเหตุ)'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
