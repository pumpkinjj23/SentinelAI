import React, { useState, useMemo } from 'react';
import { History, ShieldCheck, Lock, Search } from 'lucide-react';
import { AuditLog } from '../types';
import { StatusBadge } from '../components/SeverityBadge';
import { formatThaiDateTime } from '../utils/formatDateTime';

function parseAuditComment(comment: string): { riskChange: string; cleanComment: string } {
  const match = comment.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    return { riskChange: match[1], cleanComment: match[2] };
  }
  return { riskChange: 'คงค่า Risk Score เดิม', cleanComment: comment };
}

function formatReadableStatus(st: string): string {
  const map: Record<string, string> = {
    PENDING_REVIEW: 'Pending Review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    NEEDS_REANALYSIS: 'Needs Re-analysis',
    ESCALATED: 'Escalated',
    FALSE_POSITIVE: 'False Positive',
  };
  return map[st] || st;
}

export const AuditTrailPage: React.FC<{
  logs: AuditLog[];
  workspaceCode?: string;
  workspaceName?: string;
  userRole?: string;
}> = ({
  logs,
  workspaceCode = 'SNT-WS-001',
  workspaceName = 'My SOC Workspace',
  userRole = 'OWNER',
}) => {
  const [searchAlertId, setSearchAlertId] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'LAST_24H' | 'LAST_7D'>('ALL');

  const filteredLogs = useMemo(() => {
    const now = Date.now();
    return logs.filter((log) => {
      const actionLabel =
        log.action === 'RE_ANALYSIS' || log.action === 'UPDATE_RISK'
          ? log.action
          : log.action.endsWith('_ALERT')
          ? log.action
          : `${log.action}_ALERT`;

      if (
        searchAlertId.trim() &&
        !log.alert_code.toLowerCase().includes(searchAlertId.trim().toLowerCase()) &&
        !log.comment.toLowerCase().includes(searchAlertId.trim().toLowerCase())
      ) {
        return false;
      }
      if (actionFilter !== 'ALL' && actionLabel !== actionFilter) {
        return false;
      }
      if (timeFilter !== 'ALL') {
        const logTime = new Date(log.created_at).getTime();
        if (timeFilter === 'LAST_24H' && now - logTime > 24 * 3600 * 1000) return false;
        if (timeFilter === 'LAST_7D' && now - logTime > 7 * 24 * 3600 * 1000) return false;
        if (timeFilter === 'TODAY') {
          const d = new Date(log.created_at);
          const today = new Date();
          if (
            d.getDate() !== today.getDate() ||
            d.getMonth() !== today.getMonth() ||
            d.getFullYear() !== today.getFullYear()
          ) {
            return false;
          }
        }
      }
      return true;
    });
  }, [logs, searchAlertId, actionFilter, timeFilter]);

  return (
    <div className="space-y-5 pt-1">
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Audit Logs — หน้าประวัติการดำเนินงาน · ห้องปัจจุบัน: {workspaceCode} ({workspaceName})
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-400/40">
                ข้อมูลของห้อง {workspaceCode} · สิทธิ์: {userRole}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5 leading-snug">
              <History className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>ประวัติการดำเนินงานและการตรวจสอบของห้อง {workspaceCode}</span>
            </h2>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5">
              บันทึกเหตุการณ์ที่เกิดขึ้นในระบบ (Log ID, Alert ID, Action, Previous Value, New Value, การเปลี่ยนแปลง Risk Score, Timestamp และ Comment)
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40 shrink-0 whitespace-nowrap">
            บันทึกทั้งหมด {filteredLogs.length} / {logs.length} รายการ
          </span>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700/80">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาด้วย Alert ID (เช่น ALT-0001) หรือ Comment..."
              value={searchAlertId}
              onChange={(e) => setSearchAlertId(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-full text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 w-72"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3.5 py-2 rounded-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
          >
            <option value="ALL">ประเภท Action: ทั้งหมด</option>
            <option value="APPROVE_ALERT">APPROVE_ALERT</option>
            <option value="REJECT_ALERT">REJECT_ALERT</option>
            <option value="RE_ANALYSIS">RE_ANALYSIS</option>
            <option value="ESCALATE_ALERT">ESCALATE_ALERT</option>
            <option value="FALSE_POSITIVE_ALERT">FALSE_POSITIVE_ALERT</option>
          </select>

          <select
            value={timeFilter}
            onChange={(e) =>
              setTimeFilter(e.target.value as 'ALL' | 'TODAY' | 'LAST_24H' | 'LAST_7D')
            }
            className="px-3.5 py-2 rounded-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
          >
            <option value="ALL">ช่วงเวลา: ทั้งหมด</option>
            <option value="TODAY">วันนี้ (Today)</option>
            <option value="LAST_24H">ย้อนหลัง 24 ชั่วโมง</option>
            <option value="LAST_7D">ย้อนหลัง 7 วัน</option>
          </select>
        </div>

        {/* Security Notice per Section 5 & 6 */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
          <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            <strong>รูปแบบการบันทึก Audit Trail (เฉพาะสมาชิกห้อง {workspaceCode}):</strong> บันทึกชื่อผู้ดำเนินการจากรายชื่อสมาชิกที่ได้รับอนุญาตเข้าห้อง ({workspaceCode}) พร้อมบทบาท (<code className="font-mono font-bold text-emerald-700 dark:text-emerald-400">OWNER</code> / <code className="font-mono font-bold text-emerald-700 dark:text-emerald-400">ANALYST</code>) และเพิ่มรายการใหม่เมื่อเกิดเหตุการณ์เท่านั้น (Immutable Append-Only Log)
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700">
            <ShieldCheck className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
            <p className="text-base text-slate-900 dark:text-white font-bold">
              ยังไม่มีประวัติการดำเนินงานใน Audit Logs ที่ตรงกับตัวกรอง
            </p>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">
              เมื่อกดยืนยันผลหรือวิเคราะห์ใหม่ในหน้า AI Analysis หรือบันทึกการตัดสินใจในหน้า Analyst Review ระบบจะแสดงประวัติที่นี่ทันที
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-bold uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80">
                  <th className="py-3 px-3">Log ID</th>
                  <th className="py-3 px-3">Alert ID</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">Previous Value</th>
                  <th className="py-3 px-3">New Value</th>
                  <th className="py-3 px-3">การเปลี่ยนแปลง Risk Score</th>
                  <th className="py-3 px-3">Actor</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70 text-sm">
                {filteredLogs.map((log) => {
                  const { riskChange, cleanComment } = parseAuditComment(log.comment);
                  const isChanged = riskChange.includes('->');
                  const actionLabel =
                    log.action.startsWith('AUTH_') ||
                    log.action === 'RE_ANALYSIS' ||
                    log.action === 'UPDATE_RISK'
                      ? log.action
                      : log.action.endsWith('_ALERT')
                      ? log.action
                      : `${log.action}_ALERT`;

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                    >
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        LOG-{String(log.id).padStart(4, '0')}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        {log.alert_code}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-extrabold text-sky-700 dark:text-sky-400 whitespace-nowrap">
                        {actionLabel}
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatReadableStatus(log.previous_status)}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <StatusBadge status={log.new_status} />
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                            isChanged
                              ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/40'
                              : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {riskChange}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {log.analyst_name}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatThaiDateTime(log.created_at)}
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-800 dark:text-slate-100">
                        {cleanComment}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
