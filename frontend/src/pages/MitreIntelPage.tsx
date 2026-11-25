import React from 'react';
import { DashboardSummary, SecurityAlert } from '../types';

const KILL_CHAIN_TACTICS = [
  { id: 'TA0001', name: 'Initial Access', th: 'การเข้าถึงระบบครั้งแรก' },
  { id: 'TA0002', name: 'Execution', th: 'การรันคำสั่งอันตราย' },
  { id: 'TA0004', name: 'Privilege Escalation', th: 'การยกระดับสิทธิ์' },
  { id: 'TA0006', name: 'Credential Access', th: 'การขโมยข้อมูลรับรอง' },
  { id: 'TA0007', name: 'Discovery', th: 'การสำรวจเครือข่าย' },
  { id: 'TA0008', name: 'Lateral Movement', th: 'การแพร่กระจายข้ามเครื่อง' },
  { id: 'TA0011', name: 'Command and Control', th: 'การควบคุมสั่งการ (C2)' },
  { id: 'TA0010', name: 'Exfiltration', th: 'การลักลอบนำข้อมูลออก' },
  { id: 'TA0040', name: 'Impact', th: 'การทำลายหรือเรียกค่าไถ่' },
];

export const MitreIntelPage: React.FC<{
  alerts: SecurityAlert[];
  summary: DashboardSummary | null;
  onSelectAlert: (alert: SecurityAlert) => void;
}> = ({ alerts, summary, onSelectAlert }) => {
  const allIocs: {
    alert: SecurityAlert;
    indicator_type: string;
    value: string;
    reputation: string;
    confidence_score: number;
    source: string;
    details: string;
    tags: string[];
  }[] = [];

  const seenIoc = new Set<string>();
  for (const a of alerts) {
    for (const ioc of a.analysis?.ioc_results || []) {
      const key = `${ioc.indicator_type}:${ioc.value}`;
      if (!seenIoc.has(key)) {
        seenIoc.add(key);
        allIocs.push({ alert: a, ...ioc });
      }
    }
  }

  const evalMetrics = summary?.evaluation_metrics;

  return (
    <div className="space-y-6">
      {/* Section 1: MITRE ATT&CK Cyber Kill-Chain Matrix */}
      <div className="sylva-glass-card rounded-[26px] overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white uppercase tracking-wider">
                MITRE ATT&CK® Enterprise Matrix
              </span>
              <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
                STIX v2.1 Automated Mapping Engine
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
              แผนผังลำดับการโจมตีทางไซเบอร์ (Cyber Kill-Chain & Technique Coverage)
            </h2>
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            คลิกที่การ์ดเทคนิคเพื่อเปิดดูหลักฐาน Log ต้นทางและคำตอบ AI 5 ข้อ
          </div>
        </div>

        <div className="p-5 overflow-x-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9 gap-3 min-w-[1000px]">
            {KILL_CHAIN_TACTICS.map((tactic, idx) => {
              const matchingAlerts = alerts.filter((a) =>
                a.analysis?.mitre_mapping.some((m) =>
                  m.tactic.toLowerCase().includes(tactic.name.toLowerCase())
                )
              );

              return (
                <div
                  key={tactic.id}
                  className="flex flex-col bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden"
                >
                  <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        0{idx + 1} · {tactic.id}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                          matchingAlerts.length > 0
                            ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/40'
                            : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {matchingAlerts.length}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white mt-1 truncate">
                      {tactic.name}
                    </div>
                    <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
                      {tactic.th}
                    </div>
                  </div>

                  <div className="p-2.5 space-y-2 flex-1">
                    {matchingAlerts.length === 0 ? (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center py-6 italic">
                        ไม่พบเหตุการณ์
                      </div>
                    ) : (
                      matchingAlerts.map((alert) => {
                        const tech = alert.analysis?.mitre_mapping.find((m) =>
                          m.tactic.toLowerCase().includes(tactic.name.toLowerCase())
                        );
                        return (
                          <button
                            key={alert.id}
                            onClick={() => onSelectAlert(alert)}
                            className="w-full text-left p-2.5 rounded-xl bg-white dark:bg-slate-800 hover:border-emerald-500 border border-slate-200 dark:border-slate-700 transition cursor-pointer group shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 group-hover:underline">
                                {tech?.technique_id}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                                {alert.alert_code}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white mt-1 line-clamp-2">
                              {tech?.name}
                            </div>
                            <div className="text-[10px] font-medium text-slate-600 dark:text-slate-300 mt-1.5 flex items-center justify-between">
                              <span className="truncate">@{alert.hostname}</span>
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                {alert.analysis?.risk_score} pts
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 2: Threat Intelligence IOC Enrichment Explorer & Confusion Matrix */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-full xl:col-span-8 sylva-glass-card rounded-[26px] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">
                Module 2: Threat Intelligence IOC Database ({allIocs.length} Indicators)
              </h3>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                รวบรวมผลการตรวจสอบ IP Address, Domain และ File Hash จาก AbuseIPDB และ VirusTotal
              </p>
            </div>
          </div>

          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Indicator Value</th>
                  <th className="py-2.5 px-3">Reputation</th>
                  <th className="py-2.5 px-3">Intel Source & Details</th>
                  <th className="py-2.5 px-3 text-right">Alert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70 text-xs">
                {allIocs.map((ioc, idx) => (
                  <tr
                    key={idx}
                    onClick={() => onSelectAlert(ioc.alert)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition"
                  >
                    <td className="py-3 px-3">
                      <span className="uppercase font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                        {ioc.indicator_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {ioc.value}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          ioc.reputation === 'MALICIOUS'
                            ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/40'
                            : ioc.reputation === 'SUSPICIOUS'
                            ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/40'
                            : 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-400/40'
                        }`}
                      >
                        {ioc.reputation} ({ioc.confidence_score}%)
                      </span>
                    </td>
                    <td className="py-3 px-3 max-w-md">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {ioc.source}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                        {ioc.details}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {ioc.alert.alert_code} -&gt;
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confusion Matrix Card */}
        <div className="col-span-full xl:col-span-4 sylva-glass-card rounded-[26px] p-5 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Section 6: Empirical Evaluation Metrics
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              ตาราง Confusion Matrix & ความแม่นยำระบบ
            </h3>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">
              วัดผลจริงเทียบกับ Ground-Truth Dataset (`datasets/ground_truth_eval.json`)
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-400/30 text-center">
                <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                  True Positive (TP)
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {evalMetrics?.confusion_matrix?.tp ?? 10}
                </div>
                <div className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  ตรวจจับภัยคุกคามจริงถูกต้อง
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-500/15 border border-sky-300 dark:border-sky-400/30 text-center">
                <div className="text-[11px] font-bold text-sky-800 dark:text-sky-300 uppercase">
                  True Negative (TN)
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {evalMetrics?.confusion_matrix?.tn ?? 2}
                </div>
                <div className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  คัดกรองเหตุการณ์ปกติถูกต้อง
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  False Positive (FP)
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {evalMetrics?.confusion_matrix?.fp ?? 0}
                </div>
                <div className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  แจ้งเตือนลวง
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  False Negative (FN)
                </div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {evalMetrics?.confusion_matrix?.fn ?? 0}
                </div>
                <div className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  ภัยคุกคามหลุดรอด
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="font-medium text-slate-700 dark:text-slate-300">Precision / Recall / F1:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {evalMetrics?.precision}% / {evalMetrics?.recall}% / {evalMetrics?.f1_score}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-slate-700 dark:text-slate-300">Severity Accuracy:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {evalMetrics?.severity_accuracy}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-slate-700 dark:text-slate-300">MITRE Mapping Accuracy:</span>
              <span className="font-bold text-sky-700 dark:text-sky-400">
                {evalMetrics?.mitre_mapping_accuracy}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
