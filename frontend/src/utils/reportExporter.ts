import { DashboardSummary, SecurityAlert } from '../types';
import { formatThaiDateTime } from './formatDateTime';

const STATUS_THAI_LABEL: Record<string, string> = {
  PENDING_REVIEW: 'รอตรวจสอบ (Pending Review)',
  APPROVED: 'อนุมัติแล้ว (Approved)',
  ESCALATED: 'ส่งต่อทีม IR (Escalated)',
  FALSE_POSITIVE: 'แจ้งเตือนลวง (False Positive)',
  REJECTED: 'ปฏิเสธ (Rejected)',
};

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generates and downloads a rich, styled Excel Spreadsheet (.xls) with UTF-8 encoding
 * featuring a Deep Navy SOC banner, Executive KPI summary strip, color-coded Severity/Status
 * cells, visual risk bars, multi-line bulleted Remediation Steps, and crisp borders.
 * Opens natively in Microsoft Excel, LibreOffice Calc, WPS Office, and Google Sheets.
 */
export function exportAlertsToCSV(alerts: SecurityAlert[], filenamePrefix = 'SentinelAI-Report') {
  const nowStr = formatThaiDateTime(new Date());
  const totalCount = alerts.length;
  const criticalCount = alerts.filter((a) => a.analysis?.severity === 'CRITICAL').length;
  const highCount = alerts.filter((a) => a.analysis?.severity === 'HIGH').length;
  const mediumCount = alerts.filter((a) => a.analysis?.severity === 'MEDIUM').length;
  const lowCount = alerts.filter((a) => (a.analysis?.severity || 'LOW') === 'LOW').length;
  const approvedCount = alerts.filter((a) => a.status === 'APPROVED').length;
  const pendingCount = alerts.filter((a) => a.status === 'PENDING_REVIEW').length;

  const sevStyles: Record<string, { bg: string; color: string }> = {
    CRITICAL: { bg: '#ffe4e6', color: '#9f1239' },
    HIGH: { bg: '#fef3c7', color: '#92400e' },
    MEDIUM: { bg: '#dbeafe', color: '#1e3a8a' },
    LOW: { bg: '#d1fae5', color: '#065f46' },
  };

  const statusStyles: Record<string, { bg: string; color: string }> = {
    APPROVED: { bg: '#dcfce7', color: '#166534' },
    PENDING_REVIEW: { bg: '#fef9c3', color: '#854d0e' },
    ESCALATED: { bg: '#f3e8ff', color: '#6b21a8' },
    FALSE_POSITIVE: { bg: '#f1f5f9', color: '#475569' },
    REJECTED: { bg: '#fee2e2', color: '#991b1b' },
  };

  const dataRowsHtml = alerts
    .map((a, idx) => {
      const an = a.analysis;
      const severity = an?.severity || 'LOW';
      const riskScore = an?.risk_score ?? 0;
      const sevStyle = sevStyles[severity] || sevStyles.LOW;
      const stStyle = statusStyles[a.status] || { bg: '#f8fafc', color: '#334155' };
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

      const filledBlocks = Math.round(riskScore / 10);
      const riskBar = '█'.repeat(Math.max(0, Math.min(10, filledBlocks))) + '░'.repeat(Math.max(0, 10 - filledBlocks));

      const mitreHtml =
        (an?.mitre_mapping || []).length > 0
          ? (an?.mitre_mapping || [])
              .map((m) => `<b>${escapeHtml(m.technique_id)}</b> — ${escapeHtml(m.name)}`)
              .join('<br/>')
          : '-';

      const remediationHtml =
        (an?.recommendations || []).length > 0
          ? (an?.recommendations || [])
              .map((r, rIdx) => `${rIdx + 1}. ${escapeHtml(r.replace(/^\d+\.\s*/, ''))}`)
              .join('<br/>')
          : '-';

      const latestAudit = a.audit_logs && a.audit_logs.length > 0 ? a.audit_logs[0] : null;
      const reviewedBy = latestAudit ? latestAudit.analyst_name : 'รอการอนุมัติ';
      const reviewComment = latestAudit ? latestAudit.comment : '-';

      return `
        <tr style="background:${rowBg};vertical-align:top;">
          <td style="border:1px solid #cbd5e1;padding:8px;font-family:Consolas,monospace;font-weight:bold;color:#1e3a8a;text-align:center;white-space:nowrap;">${escapeHtml(a.alert_code)}</td>
          <td style="border:1px solid #cbd5e1;padding:8px;background:${stStyle.bg};color:${stStyle.color};font-weight:bold;text-align:center;white-space:nowrap;">${escapeHtml(STATUS_THAI_LABEL[a.status] || a.status)}</td>
          <td style="border:1px solid #cbd5e1;padding:8px;background:${sevStyle.bg};color:${sevStyle.color};font-weight:bold;text-align:center;white-space:nowrap;">${escapeHtml(severity)}</td>
          <td style="border:1px solid #cbd5e1;padding:8px;background:${sevStyle.bg};color:${sevStyle.color};font-weight:bold;text-align:center;white-space:nowrap;">${riskScore} / 100<br/><span style="font-size:10px;letter-spacing:0.5px;">${riskBar}</span></td>
          <td style="border:1px solid #cbd5e1;padding:8px;font-weight:bold;color:#0f172a;">${escapeHtml(an?.incident_type || a.description)}</td>
          <td style="border:1px solid #cbd5e1;padding:8px;font-family:Consolas,monospace;color:#1e293b;">${escapeHtml(a.hostname || '-')}</td>
          <td style="border:1px solid #cbd5e1;padding:8px;font-family:Consolas,monospace;color:#1e293b;mso-number-format:'\\@';">${escapeHtml(a.src_ip || '-')}</td>
          <td style="border:1px solid #cbd5e1;padding:8px;font-family:Consolas,monospace;color:#1e293b;mso-number-format:'\\@';">${escapeHtml(a.dst_ip || '-')}</td>
          <td style="border:1px solid #cbd5e1;padding:8px;font-family:Consolas,monospace;color:#1e293b;">${escapeHtml(a.username || '-')}</td>
          <td style="border:1px solid #cbd5e1;padding:8px;color:#1e3a8a;font-size:11pt;">${mitreHtml}</td>
          <td style="border:1px solid #cbd5e1;padding:8px;color:#1e293b;line-height:1.45;">${escapeHtml(an?.ai_summary || '-')}</td>
          <td style="border:1px solid #cbd5e1;padding:8px;background:#f0fdf4;color:#064e3b;line-height:1.5;">${remediationHtml}</td>
          <td style="border:1px solid #cbd5e1;padding:8px;font-weight:bold;color:#334155;">${escapeHtml(reviewedBy)}</td>
          <td style="border:1px solid #cbd5e1;padding:8px;color:#334155;">${escapeHtml(reviewComment)}</td>
          <td style="border:1px solid #cbd5e1;padding:8px;font-family:Consolas,monospace;color:#475569;white-space:nowrap;">${escapeHtml(formatThaiDateTime(a.timestamp))}</td>
        </tr>`;
    })
    .join('');

  const excelHtml = `\uFEFF<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8" />
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>SentinelAI SOC Report</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
            <x:FreezePanes/>
            <x:FrozenNoSplit/>
            <x:SplitHorizontal>6</x:SplitHorizontal>
            <x:TopRowBottomPane>6</x:TopRowBottomPane>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: 'Sarabun', 'Tahoma', 'Segoe UI', sans-serif; font-size: 11pt; color: #0f172a; }
    table { border-collapse: collapse; }
    td, th { mso-number-format: "\\@"; }
  </style>
</head>
<body>
  <table>
    <!-- Executive Banner -->
    <tr>
      <td colspan="15" style="background:#1e3a8a;color:#ffffff;font-size:16pt;font-weight:bold;padding:14px 16px;border:1px solid #1e3a8a;">
        🛡️ SentinelAI — AI-Assisted Security Alert Analysis &amp; Remediation Report
      </td>
    </tr>
    <tr>
      <td colspan="15" style="background:#eff6ff;color:#1e3a8a;font-size:10.5pt;font-weight:bold;padding:7px 16px;border:1px solid #bfdbfe;">
        วันที่ออกรายงาน: ${escapeHtml(nowStr)} &nbsp;|&nbsp; จำนวนเหตุการณ์ทั้งหมด: ${totalCount} รายการ &nbsp;|&nbsp; มาตรฐานการประเมิน: Wazuh Rule Engine + MITRE ATT&amp;CK + Human-in-the-Loop
      </td>
    </tr>

    <!-- Executive KPI Summary Strip -->
    <tr>
      <td colspan="2" style="background:#f1f5f9;color:#0f172a;font-weight:bold;text-align:center;padding:8px;border:1px solid #cbd5e1;">ทั้งหมด (Total)<br/><span style="font-size:14pt;">${totalCount}</span></td>
      <td colspan="2" style="background:#ffe4e6;color:#9f1239;font-weight:bold;text-align:center;padding:8px;border:1px solid #fda4af;">CRITICAL<br/><span style="font-size:14pt;">${criticalCount}</span></td>
      <td colspan="2" style="background:#fef3c7;color:#92400e;font-weight:bold;text-align:center;padding:8px;border:1px solid #fcd34d;">HIGH<br/><span style="font-size:14pt;">${highCount}</span></td>
      <td colspan="2" style="background:#dbeafe;color:#1e3a8a;font-weight:bold;text-align:center;padding:8px;border:1px solid #93c5fd;">MEDIUM<br/><span style="font-size:14pt;">${mediumCount}</span></td>
      <td colspan="2" style="background:#d1fae5;color:#065f46;font-weight:bold;text-align:center;padding:8px;border:1px solid #6ee7b7;">LOW<br/><span style="font-size:14pt;">${lowCount}</span></td>
      <td colspan="2" style="background:#dcfce7;color:#166534;font-weight:bold;text-align:center;padding:8px;border:1px solid #86efac;">อนุมัติแล้ว (Approved)<br/><span style="font-size:14pt;">${approvedCount}</span></td>
      <td colspan="3" style="background:#fef9c3;color:#854d0e;font-weight:bold;text-align:center;padding:8px;border:1px solid #fde047;">รอตรวจสอบ (Pending)<br/><span style="font-size:14pt;">${pendingCount}</span></td>
    </tr>

    <tr><td colspan="15" style="height:8px;border:none;"></td></tr>

    <!-- Table Column Headers -->
    <tr style="background:#0f172a;color:#ffffff;font-weight:bold;text-align:center;">
      <th style="border:1px solid #334155;padding:10px 8px;width:110px;">รหัสแจ้งเตือน<br/>(Alert ID)</th>
      <th style="border:1px solid #334155;padding:10px 8px;width:160px;">สถานะการอนุมัติ<br/>(Status)</th>
      <th style="border:1px solid #334155;padding:10px 8px;width:110px;">ระดับความรุนแรง<br/>(Severity)</th>
      <th style="border:1px solid #334155;padding:10px 8px;width:120px;">คะแนนความเสี่ยง<br/>(Risk Score)</th>
      <th style="border:1px solid #334155;padding:10px 8px;width:220px;">ประเภทภัยคุกคาม<br/>(Incident Type)</th>
      <th style="border:1px solid #334155;padding:10px 8px;width:150px;">เครื่องเป้าหมาย<br/>(Hostname)</th>
      <th style="border:1px solid #334155;padding:10px 8px;width:125px;">Source IP</th>
      <th style="border:1px solid #334155;padding:10px 8px;width:125px;">Destination IP</th>
      <th style="border:1px solid #334155;padding:10px 8px;width:130px;">บัญชีผู้ใช้<br/>(Username)</th>
      <th style="border:1px solid #334155;padding:10px 8px;width:210px;">MITRE ATT&amp;CK</th>
      <th style="border:1px solid #334155;padding:10px 8px;width:300px;">สรุปเหตุการณ์จาก AI<br/>(AI Summary)</th>
      <th style="border:1px solid #334155;padding:10px 8px;width:340px;">วิธีแก้ไขและขั้นตอนการตรวจสอบ<br/>(Remediation Steps)</th>
      <th style="border:1px solid #334155;padding:10px 8px;width:150px;">ผู้ตรวจสอบล่าสุด<br/>(Reviewed By)</th>
      <th style="border:1px solid #334155;padding:10px 8px;width:220px;">ความคิดเห็นการอนุมัติ<br/>(Approval Comment)</th>
      <th style="border:1px solid #334155;padding:10px 8px;width:165px;">วันเวลาที่เกิดเหตุ<br/>(Timestamp)</th>
    </tr>

    <!-- Data Rows -->
    ${dataRowsHtml}
  </table>
</body>
</html>`;

  const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Generates a clean, standalone A4 Printable HTML/PDF Report where the report header
 * and the incident card stay together on Page 1 (never splitting the header onto a blank page)
 * and all background colors/badges are preserved 100% identically in PDF print.
 */
export function exportPrintableRemediationReport(
  alertsToExport: SecurityAlert[],
  reportTitle: string,
  summary?: DashboardSummary | null
) {
  const nowStr = formatThaiDateTime(new Date());

  const incidentSections = alertsToExport
    .map((a, index) => {
      const an = a.analysis;
      if (!an) return '';
      const latestAudit = a.audit_logs && a.audit_logs.length > 0 ? a.audit_logs[0] : null;
      const statusLabel = STATUS_THAI_LABEL[a.status] || a.status;

      const sevColors: Record<string, { bg: string; text: string; border: string }> = {
        CRITICAL: { bg: '#ffe4e6', text: '#9f1239', border: '#fb7185' },
        HIGH: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
        MEDIUM: { bg: '#e0f2fe', text: '#075985', border: '#38bdf8' },
        LOW: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
      };
      const sevStyle = sevColors[an.severity] || sevColors.LOW;

      const mitreRows = an.mitre_mapping
        .map(
          (m) => `
          <tr>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;font-family:monospace;font-weight:800;color:#047857;background:#ecfdf5;white-space:nowrap;">${m.technique_id}</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;font-weight:700;word-break:break-word;">${m.name}</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;word-break:break-word;">${m.tactic}</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;font-size:12px;word-break:break-word;">${m.evidence}</td>
          </tr>`
        )
        .join('');

      const remediationList = an.recommendations
        .map(
          (rec) =>
            `<li style="margin-bottom:6px;padding:8px 12px;background:#ecfdf5;border-left:4px solid #059669;border-radius:6px;font-weight:700;color:#064e3b;word-break:break-word;">${rec.replace(
              /^\d+\.\s*/,
              ''
            )}</li>`
        )
        .join('');

      const iocList =
        an.ioc_results.length > 0
          ? an.ioc_results
              .map(
                (ioc) =>
                  `<li style="margin-bottom:3px;word-break:break-all;"><strong>[${ioc.indicator_type.toUpperCase()}] ${ioc.value}</strong> — สถานะ: <strong>${ioc.reputation} (${ioc.confidence_score}%)</strong> | <span style="word-break:break-word;">${ioc.details}</span></li>`
              )
              .join('')
          : '<li>ไม่พบ IOC ภายนอก (กิจกรรมภายในเครือข่าย)</li>';

      // Note: Do NOT put page-break-inside:avoid on the outer card so it never gets pushed off Page 1!
      // If there are multiple alerts, start subsequent alerts on a new page cleanly.
      const pageBreakRule = index > 0 ? 'page-break-before: always; margin-top: 10px;' : '';

      return `
      <div style="border:2px solid #cbd5e1;border-radius:12px;padding:16px 18px;margin-bottom:18px;background:#ffffff;${pageBreakRule}">
        <!-- Top Header Row -->
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;border-bottom:2px solid #e2e8f0;padding-bottom:10px;margin-bottom:12px;">
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-width:0;">
            <span style="display:inline-block;font-family:monospace;font-size:13px;font-weight:800;background:#059669;color:#ffffff;border:1px solid #047857;padding:4px 10px;border-radius:6px;white-space:nowrap;">${a.alert_code}</span>
            <span style="font-size:16px;font-weight:800;color:#0f172a;word-break:break-word;">${an.incident_type}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;">
            <span style="display:inline-block;white-space:nowrap;font-size:12px;font-weight:800;padding:4px 10px;border-radius:999px;background:${sevStyle.bg};color:${sevStyle.text};border:1px solid ${sevStyle.border};">
              Severity: ${an.severity} (${an.risk_score}/100)
            </span>
            <span style="display:inline-block;white-space:nowrap;font-size:12px;font-weight:800;padding:4px 10px;border-radius:999px;background:#d1fae5;color:#065f46;border:1px solid #10b981;">
              สถานะ: ${statusLabel}
            </span>
          </div>
        </div>

        <table style="width:100%;table-layout:fixed;border-collapse:collapse;margin-bottom:12px;font-size:12.5px;">
          <tr>
            <td style="padding:6px 10px;background:#f8fafc;border:1px solid #cbd5e1;width:25%;word-break:break-word;"><strong>เครื่องเป้าหมาย (Host):</strong><br/>${a.hostname}</td>
            <td style="padding:6px 10px;background:#f8fafc;border:1px solid #cbd5e1;width:25%;word-break:break-word;"><strong>Source IP:</strong><br/>${a.src_ip || 'N/A'}</td>
            <td style="padding:6px 10px;background:#f8fafc;border:1px solid #cbd5e1;width:25%;word-break:break-word;"><strong>Destination IP:</strong><br/>${a.dst_ip || 'N/A'}</td>
            <td style="padding:6px 10px;background:#f8fafc;border:1px solid #cbd5e1;width:25%;word-break:break-word;"><strong>บัญชีผู้ใช้:</strong><br/>${a.username || 'N/A'}</td>
          </tr>
        </table>

        <div style="margin-bottom:10px;">
          <h4 style="margin:0 0 4px 0;font-size:13.5px;color:#0f172a;">สรุปเหตุการณ์และพฤติกรรมที่ตรวจพบ (AI Incident & Behavior Summary)</h4>
          <div style="margin:0;font-size:12.5px;line-height:1.55;color:#1e293b;background:#f8fafc;padding:10px 12px;border-radius:8px;border:1px solid #e2e8f0;word-break:break-word;">
            <div style="margin-bottom:6px;"><strong>สรุปเหตุการณ์:</strong> ${an.ai_summary}</div>
            <div><strong>การวิเคราะห์พฤติกรรม:</strong> ${an.behavior_analysis}</div>
          </div>
        </div>

        <div style="margin-bottom:10px;">
          <h4 style="margin:0 0 4px 0;font-size:13.5px;color:#0f172a;">เหตุผลประกอบระดับความเสี่ยง และผลการตรวจ IOC</h4>
          <p style="margin:0 0 4px 0;font-size:12.5px;line-height:1.5;color:#334155;word-break:break-word;">${an.risk_justification}</p>
          <ul style="margin:4px 0 0 18px;padding:0;font-size:12px;color:#334155;">${iocList}</ul>
        </div>

        <div style="margin-bottom:12px;">
          <h4 style="margin:0 0 6px 0;font-size:13.5px;color:#047857;">วิธีแก้ไขและแนวทางการตรวจสอบ/ระงับเหตุ (Approved Remediation & Action Plan)</h4>
          <ol style="margin:0;padding-left:20px;font-size:12.5px;line-height:1.55;">
            ${remediationList}
          </ol>
        </div>

        <div style="margin-bottom:12px;">
          <h4 style="margin:0 0 4px 0;font-size:13.5px;color:#0f172a;">เทคนิค MITRE ATT&CK ที่เกี่ยวข้อง</h4>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#f1f5f9;text-align:left;">
                <th style="padding:6px 10px;border:1px solid #cbd5e1;width:100px;">Technique ID</th>
                <th style="padding:6px 10px;border:1px solid #cbd5e1;width:200px;">Technique Name</th>
                <th style="padding:6px 10px;border:1px solid #cbd5e1;width:140px;">Tactic</th>
                <th style="padding:6px 10px;border:1px solid #cbd5e1;">หลักฐานที่ตรวจพบ</th>
              </tr>
            </thead>
            <tbody>${mitreRows}</tbody>
          </table>
        </div>

        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 12px;font-size:12.5px;word-break:break-word;">
          <strong style="color:#065f46;">บันทึกการอนุมัติโดยผู้ตรวจสอบ (Analyst Approval & Audit Record):</strong><br/>
          ${
            latestAudit
              ? `<span><strong>ผู้ดำเนินการ:</strong> ${latestAudit.analyst_name} | <strong>การตัดสินใจ:</strong> ${latestAudit.action} (${
                  STATUS_THAI_LABEL[latestAudit.new_status] || latestAudit.new_status
                }) | <strong>เวลา:</strong> ${formatThaiDateTime(
                  latestAudit.created_at
                )}</span><br/>
                 <span><strong>ความคิดเห็น/สั่งการเพิ่มเติม:</strong> ${latestAudit.comment}</span>`
              : `<span>สถานะปัจจุบัน: ${statusLabel} (ใช้แนวทางแก้ไขมาตรฐานตามคำแนะนำของระบบ)</span>`
          }
        </div>
      </div>`;
    })
    .join('');

  const htmlDoc = `<!doctype html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>${reportTitle}</title>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      font-family: 'Sarabun', system-ui, sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      margin: 0;
      padding: 20px;
    }
    .report-container {
      max-width: 920px;
      margin: 0 auto;
      background: #ffffff;
      padding: 24px 28px;
      border-radius: 14px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.08);
    }
    .no-print-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 10px;
      margin-bottom: 18px;
    }
    .btn-print {
      background: #10b981;
      color: #022c22;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 14px;
      cursor: pointer;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .report-container {
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
        border-radius: 0 !important;
      }
      .no-print-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="no-print-bar">
      <div>
        <strong>SentinelAI Report Preview</strong> — กดปุ่ม "พิมพ์ / บันทึกเป็น PDF" ด้านขวาเพื่อบันทึกเป็นไฟล์ PDF (เนื้อหาและหัวรายงานจะอยู่ในหน้าเดียวกัน)
      </div>
      <button class="btn-print" onclick="window.print()">🖨️ พิมพ์ / บันทึกเป็น PDF</button>
    </div>

    <!-- Header stays attached directly to the first section on Page 1 -->
    <div style="border-bottom:3px solid #059669;padding-bottom:10px;margin-bottom:14px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:10px;page-break-after:avoid;break-after:avoid;">
      <div>
        <div style="font-size:11px;font-weight:800;color:#059669;letter-spacing:0.8px;text-transform:uppercase;">
          SentinelAI — SOC Intelligence & Incident Remediation Report
        </div>
        <h1 style="margin:2px 0 0 0;font-size:20px;font-weight:800;color:#0f172a;">${reportTitle}</h1>
      </div>
      <div style="text-align:right;font-size:12px;color:#475569;">
        <div><strong>วันที่ออกรายงาน:</strong> ${nowStr}</div>
        <div><strong>จำนวนเหตุการณ์ในรายงาน:</strong> ${alertsToExport.length} รายการ</div>
      </div>
    </div>

    ${
      summary
        ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;text-align:center;page-break-after:avoid;break-after:avoid;">
            <div style="padding:8px 10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;">
              <div style="font-size:11px;color:#64748b;font-weight:700;">Alerts ทั้งหมดในระบบ</div>
              <div style="font-size:18px;font-weight:800;color:#0f172a;">${summary.total_alerts}</div>
            </div>
            <div style="padding:8px 10px;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;">
              <div style="font-size:11px;color:#047857;font-weight:700;">ตรวจสอบ/อนุมัติแล้ว</div>
              <div style="font-size:18px;font-weight:800;color:#065f46;">${summary.reviewed_count}</div>
            </div>
            <div style="padding:8px 10px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;">
              <div style="font-size:11px;color:#b45309;font-weight:700;">รอตรวจสอบ</div>
              <div style="font-size:18px;font-weight:800;color:#92400e;">${summary.pending_review_count}</div>
            </div>
            <div style="padding:8px 10px;background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;">
              <div style="font-size:11px;color:#1d4ed8;font-weight:700;">รายการในรายงานนี้</div>
              <div style="font-size:18px;font-weight:800;color:#1e3a8a;">${alertsToExport.length}</div>
            </div>
          </div>`
        : ''
    }

    ${incidentSections}
  </div>
</body>
</html>`;

  const printWin = window.open('', '_blank');
  if (printWin) {
    printWin.document.open();
    printWin.document.write(htmlDoc);
    printWin.document.close();
  } else {
    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SentinelAI-Remediation-Report-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
