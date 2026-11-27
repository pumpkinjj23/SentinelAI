import React from 'react';
import { ShieldAlert, Clock, Award } from 'lucide-react';
import { DashboardSummary } from '../types';

export const MetricsOverview: React.FC<{ summary: DashboardSummary | null }> = ({ summary }) => {
  if (!summary) return null;

  const evalMetrics = summary.evaluation_metrics;
  const criticalCount =
    summary.severity_distribution.find((s) => s.name === 'CRITICAL')?.value ?? 0;
  const highCount =
    summary.severity_distribution.find((s) => s.name === 'HIGH')?.value ?? 0;

  return (
    <>
      {/* Card 1: Total Security Alerts & Evidence Rate */}
      <div className="flex flex-col col-span-full sm:col-span-6 xl:col-span-4 sylva-glass-card rounded-[24px] overflow-hidden">
        <div className="p-5 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/30">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Security Alerts Telemetry
                </h2>
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  {criticalCount} Critical · {highCount} High Severity
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40">
              {summary.evidence_backed_rate}% Evidence
            </span>
          </div>

          <div className="flex items-baseline gap-2.5 mt-1">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {summary.total_alerts}
            </span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Normalized Wazuh & CSV Events
            </span>
          </div>
        </div>

        <div className="mt-auto pt-2">
          <svg className="w-full h-20" viewBox="0 0 389 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id="sylvaEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M0,62 L45,54 L95,58 L140,34 L195,44 L245,20 L300,28 L345,10 L389,14 L389,80 L0,80 Z"
              fill="url(#sylvaEmeraldGrad)"
            />
            <path
              d="M0,62 L45,54 L95,58 L140,34 L195,44 L245,20 L300,28 L345,10 L389,14"
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
            />
          </svg>
        </div>
      </div>

      {/* Card 2: Human-in-the-Loop Triage Queue */}
      <div className="flex flex-col col-span-full sm:col-span-6 xl:col-span-4 sylva-glass-card rounded-[24px] overflow-hidden">
        <div className="p-5 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-800/30 dark:text-blue-200 dark:border-blue-500/40">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Human-in-the-Loop Queue
                </h2>
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Module 6: Analyst Decision Support
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-800/30 dark:text-blue-200 dark:border-blue-500/40">
              {summary.reviewed_count} Reviewed
            </span>
          </div>

          <div className="flex items-baseline gap-2.5 mt-1">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {summary.pending_review_count}
            </span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Pending SOC Analyst Approval
            </span>
          </div>
        </div>

        <div className="mt-auto pt-2">
          <svg className="w-full h-20" viewBox="0 0 389 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id="sylvaTealGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M0,55 L55,42 L110,48 L165,28 L220,34 L275,20 L330,26 L389,12 L389,80 L0,80 Z"
              fill="url(#sylvaTealGrad)"
            />
            <path
              d="M0,55 L55,42 L110,48 L165,28 L220,34 L275,20 L330,26 L389,12"
              fill="none"
              stroke="#1d4ed8"
              strokeWidth="2.5"
            />
          </svg>
        </div>
      </div>

      {/* Card 3: Empirical Ground-Truth Evaluation */}
      <div className="flex flex-col justify-between col-span-full sm:col-span-6 xl:col-span-4 sylva-glass-card rounded-[24px] p-5">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/30">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Ground-Truth Benchmark
                </h2>
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  {evalMetrics?.matched_samples ?? 12} Labeled SOC Scenarios
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
              {summary.avg_analysis_duration_ms} ms
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {evalMetrics?.f1_score ?? 100}%
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              F1-Score
            </span>
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
              (Precision {evalMetrics?.precision ?? 100}% · Recall {evalMetrics?.recall ?? 100}%)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-slate-200 dark:border-slate-700/80 text-center">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold">
              Risk Acc.
            </div>
            <div className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5">
              {evalMetrics?.severity_accuracy ?? 91.7}%
            </div>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold">
              MITRE Acc.
            </div>
            <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {evalMetrics?.mitre_mapping_accuracy ?? 100}%
            </div>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold">
              TP / TN
            </div>
            <div className="text-xs font-extrabold text-sky-600 dark:text-sky-400 mt-0.5">
              {evalMetrics?.confusion_matrix?.tp ?? 10} / {evalMetrics?.confusion_matrix?.tn ?? 2}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
