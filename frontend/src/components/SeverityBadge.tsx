import React from 'react';

export const SeverityBadge: React.FC<{ severity?: string }> = ({ severity = 'LOW' }) => {
  const styles: Record<string, string> = {
    CRITICAL:
      'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/50',
    HIGH:
      'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/50',
    MEDIUM:
      'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-400/50',
    LOW:
      'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/50',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border whitespace-nowrap shrink-0 ${
        styles[severity] || styles.LOW
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          severity === 'CRITICAL'
            ? 'bg-rose-600 dark:bg-rose-400'
            : severity === 'HIGH'
            ? 'bg-amber-600 dark:bg-amber-400'
            : severity === 'MEDIUM'
            ? 'bg-sky-600 dark:bg-sky-400'
            : 'bg-emerald-600 dark:bg-emerald-400'
        }`}
      />
      {severity}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, { cls: string; label: string }> = {
    PENDING_REVIEW: {
      cls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/40',
      label: 'Pending Review',
    },
    APPROVED: {
      cls: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40',
      label: 'Approved',
    },
    REJECTED: {
      cls: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/40',
      label: 'Rejected',
    },
    NEEDS_REANALYSIS: {
      cls: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-400/40',
      label: 'Needs Re-analysis',
    },
    ESCALATED: {
      cls: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/20 dark:text-purple-200 dark:border-purple-400/40',
      label: 'Escalated IR',
    },
    FALSE_POSITIVE: {
      cls: 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600',
      label: 'False Positive',
    },
  };

  const item = styles[status] || {
    cls: 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    label: status,
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap shrink-0 ${item.cls}`}
    >
      {item.label}
    </span>
  );
};
