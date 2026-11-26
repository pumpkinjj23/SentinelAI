# Software Requirement Specification (SRS) — SentinelAI

## 1. ภาพรวมของระบบ (System Overview)
**SentinelAI** เป็นแพลตฟอร์ม AI สำหรับช่วยวิเคราะห์และจัดลำดับความสำคัญของการแจ้งเตือนภัยคุกคามทางไซเบอร์ (**AI-Powered SOC Alert Triage and Prioritization Platform**) พัฒนาด้วยสถาปัตยกรรม Full-Stack ประกอบด้วย **Python + FastAPI Backend** และ **React + TypeScript Frontend**

ระบบออกแบบภายใต้แนวคิด **No Login / No Register & Temporary Session Workspace**:
- ผู้ใช้งานสามารถเปิดเว็บไซต์และเริ่มนำเข้าไฟล์แจ้งเตือนจาก **Wazuh** (JSON หรือ CSV) หรือกรอกข้อมูล Alert ด้วยตนเองได้ทันทีโดยไม่ต้องล็อกอิน
- ข้อมูลทั้งหมดในระหว่างการวิเคราะห์จะถูกจัดเก็บแบบชั่วคราวใน **Temporary Session**
- เมื่อผู้ใช้งานดาวน์โหลดรายงาน PDF / CSV เสร็จสิ้นและกดปุ่ม **End Session** ระบบจะลบข้อมูลชั่วคราวที่เกี่ยวข้องกับการวิเคราะห์ทั้งหมด รวมถึง **Session Audit Log**

---

## 2. โครงสร้างหน้าหลักของระบบ (4 Main Screens)

1. **`Dashboard & Upload`**
   - แสดงภาพรวมข้อมูล Alert ใน Session ปัจจุบัน (`Total Alerts`, `Critical`, `High`, `Medium`, `Low`, กราฟสรุปผล)
   - รองรับการอัปโหลดไฟล์ JSON และ CSV จาก Wazuh การกรอกข้อมูล Alert ด้วยตนเอง และการตรวจสอบความถูกต้องของข้อมูลก่อนนำเข้า
2. **`Analysis Workspace`**
   - แสดงรายการ Alert ทั้งหมดใน Session ปัจจุบัน สามารถคลิกเลือกและสลับวิเคราะห์ Alert แต่ละรายการจากไฟล์เดียวกันได้ทันทีโดยไม่ต้องอัปโหลดใหม่
   - มีปุ่ม **Analyze** เพื่อประมวลผล Data Normalization, Deterministic Risk Scoring (0–100), AI Analysis, MITRE ATT&CK Mapping และ Prioritization
   - แสดงรายละเอียดเหตุการณ์ (`Alert Details`), คะแนนความเสี่ยง (`Risk Score`), ผลวิเคราะห์ AI (`AI Analysis`) และข้อมูล `MITRE ATT&CK` ในหน้าเดียว
3. **`Analyst Review & Audit`**
   - รองรับกระบวนการ **Human-in-the-Loop**: นักวิเคราะห์ตรวจสอบผลของ AI พิมพ์ชื่อผู้ตรวจสอบ เพิ่มหมายเหตุ ปรับระดับความเสี่ยง หรือยืนยันผลการวิเคราะห์
   - แสดง **Session Audit Log** บันทึกประวัติกิจกรรมทั้งหมดที่เกิดขึ้นภายใน Session ปัจจุบัน
4. **`Report`**
   - แสดงตัวอย่างรายงานสรุปผลการวิเคราะห์และแนวทางแก้ไขเหตุการณ์
   - รองรับการดาวน์โหลดรายงานเป็นไฟล์ **PDF** และ **CSV**
   - มีปุ่ม **End Session** เพื่อลบข้อมูลชั่วคราวและ Session Audit Log ทั้งหมดเมื่อสิ้นสุดการใช้งาน

---

## 3. ข้อกำหนดฟังก์ชันหลัก (Functional Requirements)

| รหัส | ชื่อฟังก์ชัน | รายละเอียดการทำงาน |
| :--- | :--- | :--- |
| **FR-01** | **Upload & Validate Alerts** | รองรับการอัปโหลดไฟล์ Wazuh JSON, CSV และการกรอกข้อมูล Alert ด้วยตนเอง พร้อมตรวจสอบรูปแบบข้อมูลและคัดกรองรายการซ้ำ (Deduplication) |
| **FR-02** | **Session Alert Selection** | แสดงตารางรายการ Alert ที่นำเข้าใน Session ปัจจุบันให้เลือกวิเคราะห์ทีละรายการ และสลับไปวิเคราะห์รายการอื่นในไฟล์เดียวกันได้ทันที |
| **FR-03** | **Hybrid AI & Risk Analysis** | ประมวลผล Data Normalization, คำนวณ Risk Score (0–100), สรุปเหตุการณ์ด้วย AI, จับคู่เทคนิค MITRE ATT&CK และจัดลำดับความสำคัญ (`Critical`, `High`, `Medium`, `Low`) |
| **FR-04** | **Human-in-the-Loop Review** | ผู้ใช้งานสามารถยืนยัน ปฏิเสธ ปรับคะแนนความเสี่ยง และเพิ่มหมายเหตุ พร้อมบันทึกลงใน Session Audit Log |
| **FR-05** | **Report Generation (PDF / CSV)** | สร้างและดาวน์โหลดรายงาน PDF และ CSV ที่รวมข้อมูล Alert, Risk Score, AI Analysis, MITRE ATT&CK และผลการตรวจสอบของนักวิเคราะห์ |
| **FR-06** | **End Session Data Cleanup** | เมื่อกดปุ่ม **End Session** ระบบจะลบข้อมูล Alert ชั่วคราว ผลวิเคราะห์ ประวัติการนำเข้า และ Session Audit Log ทั้งหมดออกจากเซสชัน |
