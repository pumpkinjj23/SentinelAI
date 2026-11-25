# Project Proposal: SentinelAI
**ชื่อภาษาอังกฤษ:** SentinelAI — AI-Powered SOC Alert Triage and Threat Prioritization Platform  
**ชื่อภาษาไทย:** แพลตฟอร์มปัญญาประดิษฐ์สำหรับวิเคราะห์ คัดกรอง และจัดลำดับความสำคัญของการแจ้งเตือนภัยคุกคามทางไซเบอร์

---

## 1. ที่มาและความสำคัญของปัญหา (Background & Problem Statement)
ศูนย์ปฏิบัติการเฝ้าระวังความมั่นคงปลอดภัยไซเบอร์ (Security Operations Center: SOC) ในปัจจุบันต้องเผชิญกับปัญหา **Alert Fatigue** หรือภาวะการแจ้งเตือนล้นเกินจากระบบ SIEM/EDR เช่น Wazuh, Windows Event Logs และ Firewall Logs นักวิเคราะห์ระดับ Tier-1 และ Tier-2 ต้องเสียเวลาส่วนใหญ่ไปกับการตรวจสอบข้อมูลซ้ำซ้อน ค้นหาความน่าเชื่อถือของ IP/Domain/File Hash (IOC Enrichment) และเทียบเคียงเทคนิคการโจมตีกับกรอบมาตรฐาน MITRE ATT&CK ด้วยตนเอง

นอกจากนี้ การนำ Large Language Model (LLM) มาประยุกต์ใช้ในงาน SOC โดยตรงแบบ Chatbot มักประสบปัญหา **การให้คะแนนความเสี่ยงที่ไม่สม่ำเสมอ (Inconsistent Risk Scoring)** และการขาดหลักฐานอ้างอิงที่ตรวจสอบย้อนหลังได้ (Lack of Auditability)

---

## 2. วัตถุประสงค์ของโครงงาน (Objectives)
1. **พัฒนาระบบรวบรวมและจัดรูปแบบการแจ้งเตือน (Alert Ingestion & Normalization):** รองรับข้อมูลจาก Wazuh (JSON) และไฟล์ CSV Log พร้อมระบบคัดกรองการแจ้งเตือนซ้ำ (Deduplication)
2. **บูรณาการระบบ Rule Engine ร่วมกับ AI Analysis และ MITRE ATT&CK:** แยกการคำนวณคะแนนความเสี่ยง (Deterministic Risk Scoring) ออกจาก LLM เพื่อความแม่นยำและสม่ำเสมอ พร้อมใช้ AI สรุปและอธิบายเหตุผลโดยอ้างอิงหลักฐานต้นทางเพื่อตอบคำถามหลัก 5 ข้อของงาน SOC:
   - *ข้อ 1: เกิดเหตุการณ์อะไรขึ้น?*
   - *ข้อ 2: เหตุการณ์นี้มีความเสี่ยงระดับใด?*
   - *ข้อ 3: เหตุใดจึงจัดอยู่ในระดับความเสี่ยงนี้?*
   - *ข้อ 4: เหตุการณ์นี้เกี่ยวข้องกับ MITRE ATT&CK เทคนิคใด?*
   - *ข้อ 5: SOC Analyst ควรตรวจสอบอะไรต่อ?*
3. **พัฒนากระบวนการ Human-in-the-Loop และ Audit Trail:** ให้ AI ทำหน้าที่เป็นผู้ช่วยวิเคราะห์ (Decision Support) โดยการตัดสินใจขั้นสุดท้ายต้องผ่านการอนุมัติหรือปฏิเสธจาก SOC Analyst พร้อมบันทึกประวัติและหลักฐานแยกจากกันเพื่อการตรวจสอบย้อนหลัง

---

## 3. ขอบเขตของระบบ (Project Scope — 6 Core Modules)
1. **Module 1: Security Alert Collection** — รับข้อมูล JSON/CSV จาก Wazuh และ Dataset มาตรฐาน, ตรวจสอบความสมบูรณ์, Normalize ข้อมูล และตรวจจับ Alert ซ้ำ
2. **Module 2: IOC Enrichment** — ตรวจสอบ IP Address, Domain และ File Hash กับฐานข้อมูล Threat Intelligence (AbuseIPDB / VirusTotal / Local Threat Feed)
3. **Module 3: AI Alert Analysis** — สรุปเหตุการณ์ วิเคราะห์พฤติกรรม อธิบายเหตุผลความเสี่ยง และแนะนำขั้นตอนการตรวจสอบต่อพร้อมอ้างอิงหลักฐานต้นทาง (`evidence_citations`)
4. **Module 4: Risk Prioritization & MITRE Mapping** — คำนวณ Risk Score (0–100), จัดระดับ `CRITICAL` / `HIGH` / `MEDIUM` / `LOW` และทำ Mapping เข้ากับ MITRE ATT&CK STIX
5. **Module 5: SOC Dashboard & Reporting** — แสดงภาพรวมสถานะ, กราฟสัดส่วนความเสี่ยง, Incident Timeline, ตัวชี้วัดความแม่นยำ (Precision/Recall/F1) และส่งออก Incident Report
6. **Module 6: Human-in-the-Loop & Audit Trail** — ระบบ Review สำหรับ Analyst (`APPROVE`, `REJECT`, `FALSE_POSITIVE`, `ESCALATE`) พร้อมบันทึกผู้ดำเนินการ เวลา และเหตุผล

### สิ่งที่อยู่นอกเหนือขอบเขตในเวอร์ชันแรก (Out of Scope)
- ไม่ทำระบบ Auto Block IP หรือ Auto Disable User Account บนระบบจริงโดยไม่ผ่านคนอนุมัติ
- ไม่ทำ Automated Incident Response ที่สั่งรันคำสั่งแก้ไขอัตโนมัติบนเครื่องปลายทาง
- ไม่ฝึกสอนโมเดลพื้นฐาน (Pre-train LLM) ใหม่ตั้งแต่ต้น แต่ใช้สถาปัตยกรรม Hybrid (Rule Engine + Evidence-Grounded AI Prompting)

---

## 4. แผนการดำเนินงาน 4 เดือน (16-Week Development Roadmap)
| เดือนที่ | สัปดาห์ | เป้าหมายหลัก (Deliverables) |
| :--- | :--- | :--- |
| **เดือนที่ 1** | สัปดาห์ 1–4 | **Research & Core Backend:** ศึกษา Wazuh Format, ออกแบบ SRS & Database Schema, พัฒนา FastAPI Ingestion, Normalization, Deduplication และ Rule Engine เบื้องต้น |
| **เดือนที่ 2** | สัปดาห์ 5–8 | **AI & Threat Intelligence:** พัฒนา IOC Enrichment, MITRE ATT&CK Mapping Engine, เชื่อมต่อ LLM/AI Engine และออกแบบโครงสร้างหลักฐานอ้างอิง |
| **เดือนที่ 3** | สัปดาห์ 9–12 | **Dashboard & Integration:** พัฒนา React + TypeScript SOC Dashboard, กราฟ Recharts, Incident Timeline, ระบบอนุมัติ Human-in-the-Loop และ Audit Trail |
| **เดือนที่ 4** | สัปดาห์ 13–16 | **Testing & Finalization:** ทดสอบครบ 12 Test Cases (Pytest), วัดค่า Precision/Recall/F1 กับ Ground Truth Dataset, จัดทำรายงานและเตรียมนำเสนอ |
