import React, { useState } from 'react';
import { DashboardSummary } from '../types';

export const ChartsSection: React.FC<{
  summary: DashboardSummary | null;
  onSelectAlertId: (id: number) => void;
}> = ({ summary, onSelectAlertId }) => {
  const [hoveredSev, setHoveredSev] = useState<string | null>(null);

  if (!summary) return null;

  const totalSev = Math.max(
    1,
    summary.severity_distribution.reduce((acc, item) => acc + item.value, 0)
  );
  const maxTacticCount = Math.max(
    1,
    ...summary.mitre_tactic_distribution.map((t) => t.count)
  );

  const sylvaColors: Record<string, string> = {
    CRITICAL: '#e11d48',
    HIGH: '#d97706',
    MEDIUM: '#0284c7',
    LOW: '#059669',
  };

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  const timeline = summary.incident_timeline || [];

  return (
    <>
      {/* 1. Doughnut Card: Risk Severity Distribution */}
      <div className="flex flex-col col-span-full sm:col-span-6 xl:col-span-4 sylva-glass-card rounded-[24px] p-5">
        <header className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/80">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              สัดส่วนระดับความเสี่ยง (Risk Distribution)
            </h2>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Deterministic Rule Scoring (0–100)
            </p>
          </div>
          <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40">
            4 Levels
          </span>
        </header>

        <div className="flex flex-col justify-center grow">
          <div className="flex items-center justify-center relative my-2">
            <svg className="w-40 h-40 -rotate-90" viewBox="0 0 160 160">
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-700"
                strokeWidth="20"
              />
              {summary.severity_distribution.map((entry) => {
                const pct = entry.value / totalSev;
                const strokeDasharray = `${pct * circumference} ${circumference}`;
                const strokeDashoffset = -cumulativePercent * circumference;
                cumulativePercent += pct;
                const color = sylvaColors[entry.name] || entry.color;

                return (
                  <circle
                    key={entry.name}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="transparent"
                    stroke={color}
                    strokeWidth={hoveredSev === entry.name ? '25' : '20'}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredSev(entry.name)}
                    onMouseLeave={() => setHoveredSev(null)}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {hoveredSev
                  ? summary.severity_distribution.find((s) => s.name === hoveredSev)?.value ??
                    summary.total_alerts
                  : summary.total_alerts}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                {hoveredSev || 'Total Alerts'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-3 mt-2 border-t border-slate-200 dark:border-slate-700/80 text-center">
            {summary.severity_distribution.map((d) => {
              const color = sylvaColors[d.name] || d.color;
              return (
                <button
                  key={d.name}
                  onMouseEnter={() => setHoveredSev(d.name)}
                  onMouseLeave={() => setHoveredSev(null)}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  <div className="text-[10px] font-extrabold" style={{ color }}>
                    {d.name}
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {d.value}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Alert Trend Chart (กราฟแนวโน้ม Alert และระดับความเสี่ยงตามเวลา) */}
      <div className="flex flex-col col-span-full sm:col-span-6 xl:col-span-4 sylva-glass-card rounded-[24px] p-5">
        <header className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/80">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              กราฟแนวโน้มการแจ้งเตือน (Alert Trend)
            </h2>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              แนวโน้มคะแนนความเสี่ยงตามลำดับเวลาเกิดเหตุ
            </p>
          </div>
          <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-400/40">
            Live Trend
          </span>
        </header>

        <div className="flex-1 flex flex-col justify-between">
          {/* Interactive Bar/Column Trend across recent timeline alerts */}
          <div className="h-44 flex items-end justify-between gap-2 pt-6 px-2 border-b border-slate-200 dark:border-slate-700/80">
            {timeline.slice(-10).map((item) => {
              const barColor =
                item.severity === 'CRITICAL'
                  ? 'bg-rose-500'
                  : item.severity === 'HIGH'
                  ? 'bg-amber-500'
                  : item.severity === 'MEDIUM'
                  ? 'bg-sky-500'
                  : 'bg-emerald-500';
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectAlertId(item.id)}
                  title={`${item.alert_code} (${item.timestamp}) — Risk Score: ${item.risk_score}`}
                  className="flex-1 flex flex-col items-center gap-1 group cursor-pointer h-full justify-end"
                >
                  <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                    {item.risk_score}
                  </span>
                  <div
                    className={`w-full max-w-[26px] rounded-t-lg transition-all duration-300 group-hover:opacity-80 ${barColor}`}
                    style={{ height: `${Math.max(15, item.risk_score)}%` }}
                  />
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2">
            <span>{timeline[0]?.timestamp || '01:00'}</span>
            <span>ลำดับเวลาเหตุการณ์ (คลิกแท่งกราฟเพื่อดูผล AI)</span>
            <span>{timeline[timeline.length - 1]?.timestamp || 'ล่าสุด'}</span>
          </div>
        </div>
      </div>

      {/* 3. MITRE ATT&CK Tactics Breakdown */}
      <div className="flex flex-col col-span-full xl:col-span-4 sylva-glass-card rounded-[24px] p-5">
        <header className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-700/80">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              สถิติยุทธวิธี MITRE ATT&CK Tactics
            </h2>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              เชื่อมโยงข้อมูล Log เข้ากับเทคนิค STIX
            </p>
          </div>
          <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40">
            {summary.mitre_tactic_distribution.length} Tactics
          </span>
        </header>

        <div className="space-y-3 my-auto">
          {summary.mitre_tactic_distribution.slice(0, 6).map((item, idx) => {
            const widthPct = Math.max(10, Math.round((item.count / maxTacticCount) * 100));
            const grad =
              idx % 3 === 0
                ? 'from-emerald-500 to-teal-600'
                : idx % 3 === 1
                ? 'from-sky-500 to-blue-600'
                : 'from-amber-500 to-emerald-600';
            return (
              <div key={item.tactic} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white truncate">
                    {item.tactic}
                  </span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                    {item.count} รายการ
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`bg-gradient-to-r ${grad} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
