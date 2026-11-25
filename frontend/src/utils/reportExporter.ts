import { DashboardSummary, EvidenceImageAttachment, SecurityAlert } from '../types';
import { formatThaiDateTime } from './formatDateTime';

const STATUS_THAI_LABEL: Record<string, string> = {
  PENDING_REVIEW: 'รอตรวจสอบ (Pending Review)',
  APPROVED: 'อนุมัติแล้ว (Approved)',
  ESCALATED: 'ส่งต่อทีม IR (Escalated)',
  FALSE_POSITIVE: 'แจ้งเตือนลวง (False Positive)',
  REJECTED: 'ปฏิเสธ (Rejected)',
};

/**
 * Generates and downloads a UTF-8 BOM CSV file (Excel-compatible for Thai text)
 * including AI Summary, Remediation/Investigation Steps, and Approval Details.
 */
export function exportAlertsToCSV(alerts: SecurityAlert[], filenamePrefix = 'SentinelAI-Report') {
  const headers = [
    'รหัสแจ้งเตือน (Alert ID)',
    'สถานะการอนุมัติ (Status)',
    'ระดับความรุนแรง (Severity)',
    'คะแนนความเสี่ยง (Risk Score)',
    'ประเภทภัยคุกคาม (Incident Type)',
    'เครื่องเป้าหมาย (Hostname)',
    'Source IP',
    'Destination IP',
    'บัญชีผู้ใช้ (Username)',
    'MITRE ATT&CK',
    'สรุปเหตุการณ์จาก AI (AI Summary)',
    'วิธีแก้ไขและขั้นตอนการตรวจสอบ (Remediation & Investigation Steps)',
    'ผู้อนุมัติ/ตรวจสอบล่าสุด (Reviewed By)',
    'ความคิดเห็นการอนุมัติ (Approval Comment)',
    'วันเวลาที่เกิดเหตุ (Timestamp)',
  ];

  const rows = alerts.map((a) => {
    const an = a.analysis;
    const mitreStr = (an?.mitre_mapping || [])
      .map((m) => `${m.technique_id} (${m.name})`)
      .join(' | ');
    const remediationStr = (an?.recommendations || [])
      .map((r, idx) => `${idx + 1}) ${r.replace(/^\d+\.\s*/, '')}`)
      .join(' ; ');
    const latestAudit = a.audit_logs && a.audit_logs.length > 0 ? a.audit_logs[0] : null;

    const cols = [
      a.alert_code,
      STATUS_THAI_LABEL[a.status] || a.status,
      an?.severity || 'LOW',
      String(an?.risk_score ?? 0),
      an?.incident_type || a.description,
      a.hostname || '',
      a.src_ip || '',
      a.dst_ip || '',
      a.username || '',
      mitreStr,
      (an?.ai_summary || '').replace(/"/g, '""'),
      remediationStr.replace(/"/g, '""'),
      latestAudit ? latestAudit.analyst_name : 'รอการอนุมัติ',
      latestAudit ? latestAudit.comment.replace(/"/g, '""') : '-',
      formatThaiDateTime(a.timestamp),
    ];
    return cols.map((c) => `"${c}"`).join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
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

      const evidenceImages: EvidenceImageAttachment[] = Array.isArray(
        (a.raw_payload as Record<string, unknown>)?.evidence_images
      )
        ? ((a.raw_payload as Record<string, unknown>)
            .evidence_images as EvidenceImageAttachment[])
        : [];

      const evidenceImagesSection =
        evidenceImages.length > 0
          ? `<div style="margin-bottom:12px;">
               <h4 style="margin:0 0 6px 0;font-size:13.5px;color:#047857;">รูปภาพหลักฐานยืนยันจุดน่าสงสัย (${evidenceImages.length} รูป)</h4>
               <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
                 ${evidenceImages
                   .map(
                     (img) => `
                   <div style="border:1px solid #cbd5e1;border-radius:8px;padding:8px;background:#f8fafc;">
                     <img src="${img.image_data}" alt="${img.title}" style="width:100%;max-height:210px;object-fit:contain;background:#0f172a;border-radius:6px;margin-bottom:6px;" />
                     <div style="font-size:12px;font-weight:700;color:#0f172a;word-break:break-word;">${img.title}</div>
                     <div style="font-size:11px;color:#475569;">แนบโดย: ${img.uploaded_by} | ${formatThaiDateTime(
                       img.created_at
                     )}</div>
                   </div>`
                   )
                   .join('')}
               </div>
             </div>`
          : '';

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

        ${evidenceImagesSection}

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
