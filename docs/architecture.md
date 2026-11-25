# System Architecture & Workflow Design — SentinelAI

## 1. สถาปัตยกรรมระบบและลำดับการทำงาน (System Architecture & 6-Step Workflow)
สถาปัตยกรรมของ **SentinelAI** ออกแบบให้รองรับการทำงานแบบ **Temporary Session Workflow (ไม่ต้อง Login หรือสมัครสมาชิก)** ผ่านหน้าจอหลัก 4 หน้า (`Dashboard & Upload`, `Analysis Workspace`, `Analyst Review & Audit`, `Report`) โดยมีขั้นตอนการประมวลผลตั้งแต่การนำเข้าข้อมูลจนถึงการล้างข้อมูลเมื่อจบ Session ดังนี้

```mermaid
flowchart TD
    subgraph Step1["1. นำเข้าข้อมูล (Dashboard & Upload)"]
        U1["อัปโหลดไฟล์ Wazuh JSON / CSV\nหรือกรอกข้อมูล Alert ด้วยตนเอง"]
        U2["ตรวจสอบความถูกต้องของข้อมูล\n(Schema Validation & Deduplication)"]
    end

    subgraph Step2_3["2 & 3. เลือกและวิเคราะห์เหตุการณ์ (Analysis Workspace)"]
        A1["เลือก Alert จากรายการใน Session\n(สลับดูรายการในไฟล์เดียวกันได้ทันที)"]
        A2["Data Normalization\nจัดรูปแบบข้อมูลมาตรฐาน"]
        A3["Deterministic Risk Scoring\nคำนวณคะแนนความเสี่ยง 0-100"]
        A4["AI Analysis & MITRE ATT&CK Mapping\nสรุปเหตุการณ์ + จับคู่เทคนิคโจมตี"]
        A5["Prioritization\nจัดลำดับความสำคัญ Critical / High / Medium / Low"]
    end

    subgraph Step4["4. ตรวจสอบและยืนยันผล (Analyst Review & Audit)"]
        R1["Human-in-the-Loop Review\nเพิ่มหมายเหตุ / แนบรูปหลักฐาน / ปรับหรือยืนยันผล"]
        R2["Session Audit Log\nบันทึกประวัติกิจกรรมใน Session ปัจจุบัน"]
    end

    subgraph Step5_6["5 & 6. สร้างรายงานและสิ้นสุดการใช้งาน (Report & End Session)"]
        P1["Generate Report\nแสดงตัวอย่างและดาวน์โหลด PDF / CSV"]
        P2["End Session\nลบข้อมูลชั่วคราวทั้งหมด รวมถึง Session Audit Log"]
    end

    U1 --> U2 --> A1
    A1 --> A2 --> A3 --> A4 --> A5
    A5 --> R1 --> R2 --> P1 --> P2
```

---

## 2. ลำดับการโต้ตอบระหว่างผู้ใช้งานและระบบ (Session Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor User as ผู้ใช้งาน (SOC Analyst)
    participant UI as React 4-Page UI
    participant API as FastAPI Backend
    participant Engine as Risk + AI + MITRE Engine
    participant DB as Temporary Session Storage

    User->>UI: 1. อัปโหลดไฟล์ JSON / CSV หรือกรอก Alert (หน้า Dashboard & Upload)
    UI->>API: POST /api/ingest/json หรือ /api/ingest/csv
    API->>Engine: Data Normalization + Risk Scoring + AI Analysis + MITRE Mapping
    Engine-->>API: คืนค่า Risk Score (0-100), Severity, AI Summary, MITRE Techniques
    API->>DB: บันทึกข้อมูล Alert และผลวิเคราะห์ใน Session ปัจจุบัน
    User->>UI: 2. เลือก Alert ที่ต้องการตรวจสอบ (หน้า Analysis Workspace)
    User->>UI: 3. กดปุ่ม Analyze เพื่อประมวลผล/อัปเดตผลการวิเคราะห์เชิงลึก
    UI->>API: POST /api/alerts/{id}/reanalyze
    API->>DB: อัปเดตผลวิเคราะห์และบันทึก Session Audit Log
    User->>UI: 4. ตรวจสอบผล เพิ่มหมายเหตุ แนบรูปภาพ และยืนยันผล (หน้า Analyst Review & Audit)
    UI->>API: POST /api/alerts/{id}/decision
    API->>DB: บันทึกผลการตัดสินใจและเพิ่มรายการใน Session Audit Log
    User->>UI: 5. เปิดหน้า Report เพื่อดูตัวอย่างและดาวน์โหลด PDF / CSV
    User->>UI: 6. กดปุ่ม End Session (สิ้นสุดการใช้งาน)
    UI->>API: DELETE /api/alerts/clear-temporary
    API->>DB: ลบข้อมูลชั่วคราวทั้งหมดใน Session รวมถึง Session Audit Log
```
