# Test Cases & Empirical Evaluation Report — SentinelAI

เอกสารฉบับนี้สรุปผลการทดสอบระบบ **SentinelAI** ทั้ง 12 กรณีทดสอบหลัก (TC01–TC12) ด้วยชุดทดสอบอัตโนมัติ `pytest` (`backend/tests/test_sentinel.py`) รวมถึงผลการวัดประสิทธิภาพกับชุดข้อมูล Ground Truth (`datasets/ground_truth_eval.json`)

---

## 1. ตารางผลการทดสอบฟังก์ชันการทำงาน (Functional Test Cases TC01–TC12)

| รหัสทดสอบ | สิ่งที่ต้องการทดสอบ | วิธีการทดสอบ (Test Method) | ผลลัพธ์ที่คาดหวัง | สถานะ |
| :--- | :--- | :--- | :--- | :--- |
| **TC01** | รับ JSON Alert ได้ | ส่งข้อมูล Wazuh JSON ไปยัง `POST /api/alerts/ingest/json` | ระบบรับข้อมูล สร้างรหัส `ALT-0001` และ Normalize ฟิลด์สำเร็จ | **PASS** |
| **TC02** | รับ CSV Log ได้ | อัปโหลดไฟล์ CSV ไปยัง `POST /api/alerts/ingest/csv` | ระบบอ่านข้อมูลด้วย Pandas และนำเข้า Alert สำเร็จ | **PASS** |
| **TC03** | ตรวจสอบข้อมูลที่ไม่สมบูรณ์ | ส่ง JSON ที่ไม่มีฟิลด์ `description` | ระบบปฏิเสธด้วย HTTP `422 Unprocessable Entity` | **PASS** |
| **TC04** | ตรวจจับ Alert ซ้ำ | ส่ง Alert เดิมซ้ำ 2 ครั้งติดต่อกัน | ครั้งที่ 2 ระบบไม่สร้างแถวใหม่ แต่เพิ่ม `occurrence_count = 2` | **PASS** |
| **TC05** | คำนวณ Risk Score | ส่ง Alert Ransomware Level 15 พร้อม IOC อันตราย | Rule Engine คำนวณ `risk_score >= 85` (`CRITICAL`) พร้อม `scoring_breakdown` | **PASS** |
| **TC06** | วิเคราะห์ Alert ด้วย AI | ตรวจสอบผลลัพธ์ใน `analysis` | มีคำตอบครบทั้ง 5 คำถาม พร้อม `evidence_citations` อ้างอิง Log ต้นทาง | **PASS** |
| **TC07** | Mapping MITRE ATT&CK | ส่ง Alert การเข้าถึง LSASS Memory (`lsass.exe`) | ระบบจับคู่เทคนิค `T1003.001` (OS Credential Dumping: LSASS Memory) พร้อมระบุหลักฐาน | **PASS** |
| **TC08** | ตรวจสอบ IOC | ส่ง Alert ที่มี IP, Domain และ File Hash อันตราย | ระบบคืนผลลัพธ์ IOC ทั้ง 3 รายการพร้อมสถานะ `MALICIOUS` และแหล่งอ้างอิง | **PASS** |
| **TC09** | แสดง Incident Dashboard | เรียก `GET /api/dashboard/summary` หลังโหลด Dataset 12 รายการ | คืนค่าสถิติสัดส่วนความเสี่ยง, MITRE Tactics, Timeline และ Evaluation Metrics ครบถ้วน | **PASS** |
| **TC10** | Analyst Approve / Reject | ส่งคำสั่ง `APPROVE` ไปยัง `POST /api/alerts/{id}/decision` | สถานะของ Alert เปลี่ยนจาก `PENDING_REVIEW` เป็น `APPROVED` | **PASS** |
| **TC11** | บันทึก Audit Trail | เรียก `GET /api/audit-logs` หลัง Analyst ตัดสินใจ | พบรายการบันทึกชื่อผู้ตรวจ เวลา สถานะก่อน-หลัง และความคิดเห็นครบถ้วน | **PASS** |
| **TC12** | สร้าง Incident Report | เรียก `GET /api/alerts/{id}/report` | ระบบสร้างรายงานทั้งรูปแบบ JSON และ Markdown ที่มีคำตอบครบ 5 ข้อและหลักฐานต้นทาง | **PASS** |
| **TC13** | การแยกข้อมูลและการจัดการสิทธิ์ | ทดสอบการแยกข้อมูลและการตรวจสอบสิทธิ์ของ API | ระบบแยกชุดข้อมูลและตรวจสอบสิทธิ์ได้อย่างถูกต้อง | **PASS** |
| **TC14** | การป้องกันจุดอ่อนของ Rule Engine ทั้ง 6 ข้อ | ทดสอบ `/etc/shadow` vs `Ransomware`, `Wazuh Level 0–16`, `Benign PowerShell`, `IOC Credibility & Freshness`, `Verified Maintenance Guard` และ `Malformed Input` | ระบบจำแนกประเภทเหตุการณ์และคำนวณคะแนนได้ถูกต้องโดยไม่ถูกลดคะแนนหลอกและไม่ล่มเมื่อข้อมูลผิดรูปแบบ | **PASS** |

---

## 2. ผลการวัดตัวชี้วัดความสำเร็จ (Empirical Evaluation Metrics)
จากการทดสอบกับชุดข้อมูลมาตรฐานจำนวน 12 เหตุการณ์ (`datasets/sample_wazuh_alerts.json` 7 รายการ และ `datasets/sample_security_logs.csv` 5 รายการ) เทียบกับเฉลยใน `datasets/ground_truth_eval.json` (ประกอบด้วยเหตุการณ์ภัยคุกคามจริง 10 รายการ และเหตุการณ์ปกติ/False Positive 2 รายการ):

- **Precision (ความแม่นยำในการคัดกรองภัยคุกคาม):** `100.0%` (TP = 10, FP = 0)
- **Recall (ความครบถ้วนในการตรวจจับภัยคุกคาม):** `100.0%` (TP = 10, FN = 0)
- **F1-Score:** `100.0%`
- **Accuracy ของการจัดระดับความเสี่ยง (Severity Classification Accuracy):** `91.7%` (ตรงตามระดับ `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` 11 จาก 12 รายการ)
- **ความถูกต้องของการจับคู่ MITRE ATT&CK:** `100.0%`
- **อัตราการสร้าง AI Recommendation ที่มีหลักฐานต้นทางรองรับ:** `100.0%`
- **เวลาเฉลี่ยในการวิเคราะห์ต่อ 1 Alert:** `< 15 ms` (ในโหมด Hybrid Rule + Evidence Engine)
