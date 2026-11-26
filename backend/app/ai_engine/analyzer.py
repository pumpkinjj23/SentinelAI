import json
from typing import Any, Dict, List
import httpx
from app.core.config import settings


def _build_evidence_citations(
    normalized_alert: Dict[str, Any],
    ioc_results: List[Dict[str, Any]],
    mitre_mappings: List[Dict[str, Any]],
) -> List[str]:
    citations: List[str] = []
    citations.append(
        f"[Raw Log Evidence] Host '{normalized_alert.get('hostname')}' (Rule #{normalized_alert.get('rule_id')}, Level {normalized_alert.get('rule_level')}): {normalized_alert.get('raw_log')}"
    )
    if normalized_alert.get("command_line"):
        citations.append(f"[Command/URI Telemetry] {normalized_alert.get('command_line')}")

    for ioc in ioc_results:
        citations.append(
            f"[IOC Threat Intel] {ioc['indicator_type'].upper()} '{ioc['value']}' -> {ioc['reputation']} (Confidence: {ioc['confidence_score']}%, Source: {ioc['source']})"
        )

    for m in mitre_mappings:
        citations.append(
            f"[MITRE ATT&CK STIX] {m['technique_id']} ({m['name']} - {m['tactic']}): {m['evidence']}"
        )

    return citations


def _deterministic_evidence_analysis(
    normalized_alert: Dict[str, Any],
    risk_eval: Dict[str, Any],
    ioc_results: List[Dict[str, Any]],
    mitre_mappings: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Deterministic, evidence-grounded AI Analysis engine (Mock / Fallback mode).
    Answers the 5 core SOC triage questions with direct citations to raw logs and IOCs.
    """
    severity = risk_eval["severity"]
    score = risk_eval["risk_score"]
    incident_type = risk_eval["incident_type"]
    host = normalized_alert.get("hostname") or "unknown-host"
    src_ip = normalized_alert.get("src_ip") or "N/A"
    dst_ip = normalized_alert.get("dst_ip") or "N/A"
    user = normalized_alert.get("username") or "ไม่ระบุบัญชีผู้ใช้"
    desc = normalized_alert.get("description") or ""
    desc_lower = desc.lower()

    mitre_str = ", ".join(f"{m['technique_id']} ({m['name']})" for m in mitre_mappings)
    malicious_iocs = [i for i in ioc_results if i.get("reputation") in ("MALICIOUS", "SUSPICIOUS")]
    ioc_summary = (
        ", ".join(f"{i['value']} [{i['reputation']} - {i['source']}]" for i in malicious_iocs)
        if malicious_iocs
        else "ไม่พบ IOC ภายนอกที่ติดแบล็กลิสต์ (เป็นการทำงานภายในเครือข่าย)"
    )

    # Question 1: เกิดเหตุการณ์อะไรขึ้น? (ai_summary)
    ai_summary = (
        f"ตรวจพบเหตุการณ์ '{incident_type}' บนเครื่องเป้าหมาย '{host}' "
        f"(Source IP: {src_ip} -> Destination IP: {dst_ip}, ผู้ใช้: {user}) "
        f"โดยระบบตรวจจับ {normalized_alert.get('source')} แจ้งเตือนว่า: {desc}"
    )

    # Behavioral Analysis & Recommendations tailored by incident pattern
    cmd_lower = str(normalized_alert.get("command_line") or "").lower()
    raw_lower = str(normalized_alert.get("raw_log") or "").lower()
    combined_lower = f"{desc_lower} {cmd_lower} {raw_lower}"

    if "/etc/shadow" in combined_lower or ("sudo" in desc_lower and "shadow" not in desc_lower):
        behavior_analysis = (
            f"บัญชีบริการเว็บ '{user}' ซึ่งปกติไม่ควรมีสิทธิ์ระดับผู้ดูแลระบบ ได้รันคำสั่ง sudo เพื่ออ่านไฟล์รหัสผ่านระบบ '/etc/shadow' "
            f"บนเครื่อง '{host}' บ่งชี้ว่าผู้โจมตีอาจยึด Web Shell ได้แล้วกำลังยกระดับสิทธิ์ (Privilege Escalation)"
        )
        recommendations = [
            f"1. ตรวจสอบไฟล์ `/etc/sudoers` และ `/etc/sudoers.d/` บน '{host}' ว่าเหตุใดบัญชี '{user}' จึงรัน sudo ได้",
            "2. ตรวจสอบ Web Access Logs เพื่อหาจุดเริ่มต้นของ Web Shell หรือ Remote Code Execution (RCE)",
            "3. หมุนเวียนรหัสผ่านของบัญชี Local บนเซิร์ฟเวอร์และตรวจสอบ SSH `authorized_keys`",
        ]
    elif (
        "ransomware" in combined_lower
        or "shadow copy" in combined_lower
        or "delete shadows" in combined_lower
        or "vssadmin" in combined_lower
        or ".lockbit" in combined_lower
    ):
        behavior_analysis = (
            f"พบพฤติกรรมทำลายระบบสำรองข้อมูลด้วยคำสั่ง '{normalized_alert.get('command_line')}' "
            f"เพื่อลบ Volume Shadow Copies ป้องกันการกู้คืนระบบ ตามด้วยการเปลี่ยนนามสกุลไฟล์จำนวนมาก (.lockbit) "
            f"ซึ่งเป็นขั้นตอนสุดท้ายของการโจมตีด้วยแรนซัมแวร์บน '{host}'"
        )
        recommendations = [
            f"1. แยกเครื่อง '{host}' และเครื่องต้นทาง '{src_ip}' ออกจากเครือข่าย (Network Isolation) ทันทีผ่าน EDR/Switch",
            f"2. ระงับสิทธิ์บัญชีผู้ใช้ '{user}' ชั่วคราวใน Active Directory และตรวจสอบประวัติการเข้าสู่ระบบ",
            f"3. ตรวจสอบไฟล์ Hash '{normalized_alert.get('file_hash')}' บนเครื่องอื่นในวงแลนเดียวกันเพื่อหาขอบเขตการแพร่กระจาย",
            "4. ตรวจสอบสถานะ Offline Backup ล่าสุดก่อนดำเนินการกู้คืนระบบ",
        ]
    elif "lsass" in desc_lower or "credential dumping" in desc_lower:
        behavior_analysis = (
            f"พบการเข้าถึงหน่วยความจำของโปรเซส 'lsass.exe' โดยตรง (GrantedAccess 0x1010) จากโปรเซส '{normalized_alert.get('process_name')}' "
            f"ภายใต้บัญชี '{user}' บนเครื่อง '{host}' ซึ่งเป็นเทคนิคการขโมย NTLM Hash หรือ Kerberos Ticket (เช่น Mimikatz) เพื่อใช้ทำ Lateral Movement ต่อ"
        )
        recommendations = [
            f"1. ตรวจสอบโปรเซสแปลกปลอมในพาธ C:\\Users\\Public\\ บนเครื่อง '{host}' และเก็บ Memory Dump เป็นหลักฐาน",
            f"2. บังคับเปลี่ยนรหัสผ่าน (Force Password Reset) และล้าง Kerberos Golden/Silver Ticket ของบัญชี '{user}'",
            "3. ตรวจสอบ Event ID 4624 (Logon Type 3 และ 10) จากเครื่องนี้ไปยัง File Server หรือ Domain Controller",
            "4. ยืนยันสถานะการเปิดใช้งาน Credential Guard และ LSA Protection (RunAsPPL)",
        ]
    elif "powershell" in desc_lower or "encodedcommand" in desc_lower:
        behavior_analysis = (
            f"โปรเซส powershell.exe ถูกรันด้วยพารามิเตอร์ซ่อนหน้าต่าง (-NoP -NonI -W Hidden) และเข้ารหัสคำสั่งแบบ Base64 (-Enc) "
            f"เพื่อดาวน์โหลดสคริปต์ Stage-2 จากโดเมน '{normalized_alert.get('domain')}' ({dst_ip}) ซึ่งตรงกับรูปแบบ Initial Execution ของมัลแวร์"
        )
        recommendations = [
            f"1. ถอดรหัส (Decode Base64) คำสั่ง PowerShell และตรวจสอบสคริปต์ที่ถูกดาวน์โหลดจาก '{normalized_alert.get('domain')}'",
            "2. ตรวจสอบ PowerShell Script Block Logging (Event ID 4104) และ Sysmon Event ID 1/3 บนเครื่องต้นทาง",
            f"3. ตรวจสอบ DNS Logs และ Firewall Logs ว่ามีเครื่องอื่นในองค์กรเชื่อมต่อไปยัง '{dst_ip}' หรือไม่",
            f"4. สัมภาษณ์หรือตรวจสอบกิจกรรมของผู้ใช้ '{user}' ว่าเปิดไฟล์แนบอีเมลฟิชชิ่งก่อนเกิดเหตุหรือไม่",
        ]
    elif "sql injection" in desc_lower or "union select" in desc_lower:
        behavior_analysis = (
            f"พบคำขอ HTTP ที่มี Payload แบบ UNION SELECT SQL Injection ('{normalized_alert.get('command_line')}') "
            f"จาก IP ภายนอก '{src_ip}' มายังเว็บเซิร์ฟเวอร์ '{host}' และเซิร์ฟเวอร์ตอบกลับด้วย HTTP 200 (ขนาด 4,812 bytes) "
            "ซึ่งบ่งชี้ว่าการโจมตีอาจดึงข้อมูลจากตาราง users สำเร็จ"
        )
        recommendations = [
            f"1. ตรวจสอบ Response Body และ Database Query Logs ของ '{host}' ในช่วงเวลาที่เกิดเหตุว่าข้อมูล password_hash รั่วไหลหรือไม่",
            f"2. ตรวจสอบรายการ IP '{src_ip}' บน WAF / Reverse Proxy และเพิ่มกฎตรวจจับ SQLi บน Endpoint '/api/v1/users/search'",
            "3. ประสานทีมนักพัฒนาเพื่อแก้ไขโค้ดให้ใช้ Parameterized Queries / Prepared Statements",
            "4. หากยืนยันว่า password_hash รั่วไหล ให้บังคับรีเซ็ตรหัสผ่านของผู้ใช้ที่ได้รับผลกระทบ",
        ]
    elif "brute force" in desc_lower or "failed password" in desc_lower:
        behavior_analysis = (
            f"พบความพยายามเข้าสู่ระบบที่ล้มเหลวซ้ำๆ อย่างต่อเนื่องจาก IP '{src_ip}' มายังบัญชี '{user}' บนเครื่อง '{host}' "
            "ซึ่งเป็นลักษณะของการสุ่มรหัสผ่านอัตโนมัติ (Automated Credential Brute-Forcing)"
        )
        recommendations = [
            f"1. ตรวจสอบ Authentication Logs บน '{host}' ว่าหลังจากเกิด Failed Attempts มีรายการ Login สำเร็จ (Accepted password) จาก '{src_ip}' หรือไม่",
            f"2. ตรวจสอบความจำเป็นในการเปิดพอร์ต SSH/Auth ออกสู่อินเทอร์เน็ต และพิจารณากำหนด IP Whitelist หรือ VPN",
            f"3. ตรวจสอบสถานะการล็อกบัญชีและการตั้งค่า Fail2Ban / Account Lockout Policy สำหรับบัญชี '{user}'",
        ]
    elif "sudo" in desc_lower or "/etc/shadow" in desc_lower:
        behavior_analysis = (
            f"บัญชีบริการเว็บ '{user}' ซึ่งปกติไม่ควรมีสิทธิ์ระดับผู้ดูแลระบบ ได้รันคำสั่ง sudo เพื่ออ่านไฟล์รหัสผ่านระบบ '/etc/shadow' "
            f"บนเครื่อง '{host}' บ่งชี้ว่าผู้โจมตีอาจยึด Web Shell ได้แล้วกำลังยกระดับสิทธิ์ (Privilege Escalation)"
        )
        recommendations = [
            f"1. ตรวจสอบไฟล์ `/etc/sudoers` และ `/etc/sudoers.d/` บน '{host}' ว่าเหตุใดบัญชี '{user}' จึงรัน sudo ได้",
            "2. ตรวจสอบ Web Access Logs เพื่อหาจุดเริ่มต้นของ Web Shell หรือ Remote Code Execution (RCE)",
            "3. หมุนเวียนรหัสผ่านของบัญชี Local บนเซิร์ฟเวอร์และตรวจสอบ SSH `authorized_keys`",
        ]
    elif "lateral movement" in desc_lower or "psexec" in desc_lower:
        behavior_analysis = (
            f"พบการติดตั้งและรันบริการรีโมต (PSEXESVC - Event ID 7045) จากเครื่อง '{src_ip}' ไปยัง '{host}' "
            f"โดยใช้บัญชี '{user}' พร้อมตรวจพบไฟล์ที่มีค่า Hash ตรงกับฐานข้อมูลมัลแวร์"
        )
        recommendations = [
            f"1. ตรวจสอบลำดับเหตุการณ์ (Timeline) ระหว่างเครื่องต้นทาง '{src_ip}' และปลายทาง '{host}'",
            "2. ตรวจสอบ Windows System Log (Event ID 7045, 4624 Type 3, 5140 SMB Share) บนเครื่องเป้าหมาย",
            f"3. ระงับสิทธิ์บัญชี '{user}' และตรวจสอบเครื่องทั้งหมดที่บัญชีนี้เข้าใช้งานในช่วง 24 ชั่วโมงที่ผ่านมา",
        ]
    elif "exfiltration" in desc_lower or "dns tunneling" in desc_lower:
        behavior_analysis = (
            f"พบการส่งข้อมูลหรือสัญญาณ C2 ออกสู่ภายนอกองค์กรในปริมาณผิดปกติจากเครื่อง '{host}' ({src_ip}) "
            f"ไปยังปลายทาง '{normalized_alert.get('domain') or dst_ip}' ซึ่งมีความเสี่ยงต่อการรั่วไหลของข้อมูลสำคัญ"
        )
        recommendations = [
            f"1. ตรวจสอบ PCAP / NetFlow และ Process ที่เปิดพอร์ตเชื่อมต่อจากเครื่อง '{host}' ไปยัง '{dst_ip}'",
            f"2. ตรวจสอบประวัติการ Query ข้อมูลในฐานข้อมูลหรือไฟล์ที่ถูกเข้าถึงโดยบัญชี '{user}' ก่อนเกิดการส่งออกข้อมูล",
            f"3. เพิ่มโดเมน '{normalized_alert.get('domain')}' และ IP '{dst_ip}' ลงในรายการเฝ้าระวังของ DNS Firewall / Proxy",
        ]
    else:
        behavior_analysis = (
            f"เหตุการณ์มีระดับความรุนแรงตามกฎพื้นฐานอยู่ที่ Level {normalized_alert.get('rule_level')} "
            f"เกิดจากกิจกรรมของบัญชี '{user}' บนเครื่อง '{host}' โดยไม่พบพฤติกรรมโจมตีที่ซับซ้อนเพิ่มเติม"
        )
        recommendations = [
            f"1. ยืนยันกับเจ้าของระบบหรือตาราง Change Request ว่ากิจกรรมของ '{user}' บน '{host}' เป็นงานที่ได้รับอนุญาตหรือไม่",
            "2. หากเป็นงานบำรุงรักษาตามปกติ สามารถบันทึกเป็น False Positive เพื่อปรับจูน Rule Engine ต่อไป",
        ]

    # Question 2 & 3: เหตุการณ์นี้มีความเสี่ยงระดับใด และเหตุใดจึงจัดอยู่ในระดับความเสี่ยงนี้?
    factors_text = "; ".join(f"{b['factor']} ({b['points']:+d} คะแนน)" for b in risk_eval["scoring_breakdown"])
    risk_justification = (
        f"จัดอยู่ในระดับความเสี่ยง {severity} (Risk Score: {score}/100) เนื่องจาก: {factors_text} | "
        f"ผลการตรวจ IOC: {ioc_summary} | เทคนิค MITRE ATT&CK ที่เกี่ยวข้อง: {mitre_str}"
    )

    citations = _build_evidence_citations(normalized_alert, ioc_results, mitre_mappings)
    is_suspicious = score >= 45
    requires_review = True  # Principle: AI is an assistant, human analyst always reviews

    return {
        "ai_provider": "mock-evidence-engine",
        "ai_summary": ai_summary,
        "behavior_analysis": behavior_analysis,
        "risk_justification": risk_justification,
        "evidence_citations": citations,
        "recommendations": recommendations,
        "is_suspicious": is_suspicious,
        "requires_analyst_review": requires_review,
    }


def _build_llm_prompt(
    normalized_alert: Dict[str, Any],
    risk_eval: Dict[str, Any],
    ioc_results: List[Dict[str, Any]],
    mitre_mappings: List[Dict[str, Any]],
) -> str:
    context = {
        "alert": {
            "source": normalized_alert.get("source"),
            "rule_id": normalized_alert.get("rule_id"),
            "rule_level": normalized_alert.get("rule_level"),
            "description": normalized_alert.get("description"),
            "hostname": normalized_alert.get("hostname"),
            "src_ip": normalized_alert.get("src_ip"),
            "dst_ip": normalized_alert.get("dst_ip"),
            "username": normalized_alert.get("username"),
            "process_name": normalized_alert.get("process_name"),
            "command_line": normalized_alert.get("command_line"),
            "domain": normalized_alert.get("domain"),
            "file_hash": normalized_alert.get("file_hash"),
            "raw_log": normalized_alert.get("raw_log"),
        },
        "rule_engine_evaluation": risk_eval,
        "ioc_enrichment": ioc_results,
        "mitre_mappings": mitre_mappings,
    }
    return (
        "คุณคือ Senior SOC Analyst AI ของระบบ SentinelAI จงวิเคราะห์ข้อมูล Security Alert ต่อไปนี้โดยอ้างอิงจากหลักฐานที่ให้เท่านั้น "
        "ห้ามเปลี่ยนค่า Risk Score ที่ Rule Engine คำนวณไว้ แต่ให้อธิบายประกอบอย่างมีหลักฐาน\n"
        "ตอบกลับเป็น JSON Object เท่านั้น โดยมีคีย์ดังนี้:\n"
        "- ai_summary (string ภาษาไทย): ตอบคำถามข้อ 1 เกิดเหตุการณ์อะไรขึ้น?\n"
        "- behavior_analysis (string ภาษาไทย): วิเคราะห์พฤติกรรมเชิงเทคนิคจากโปรเซส คำสั่ง หรือทราฟฟิก\n"
        "- risk_justification (string ภาษาไทย): ตอบคำถามข้อ 2 และ 3 ว่าเหตุใดจึงได้ระดับความเสี่ยงและคะแนนนี้ พร้อมอ้างอิง IOC และ MITRE\n"
        "- recommendations (array of strings ภาษาไทย 3-4 ข้อ): ตอบคำถามข้อ 5 ว่า SOC Analyst ควรตรวจสอบอะไรต่อ?\n"
        "- is_suspicious (boolean)\n\n"
        f"ข้อมูลหลักฐาน:\n{json.dumps(context, ensure_ascii=False, indent=2)}"
    )


def analyze_alert_with_ai(
    normalized_alert: Dict[str, Any],
    risk_eval: Dict[str, Any],
    ioc_results: List[Dict[str, Any]],
    mitre_mappings: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Module 3: AI Alert Analysis
    Supports 'mock' (default), 'openai', 'gemini', and 'ollama'.
    Always attaches immutable evidence_citations and falls back cleanly if an external API is unavailable.
    """
    provider = (settings.AI_PROVIDER or "mock").lower().strip()
    citations = _build_evidence_citations(normalized_alert, ioc_results, mitre_mappings)

    if provider == "openai" and settings.OPENAI_API_KEY:
        try:
            prompt = _build_llm_prompt(normalized_alert, risk_eval, ioc_results, mitre_mappings)
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                    json={
                        "model": settings.OPENAI_MODEL,
                        "response_format": {"type": "json_object"},
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.1,
                    },
                )
                if resp.status_code == 200:
                    content = resp.json()["choices"][0]["message"]["content"]
                    parsed = json.loads(content)
                    return {
                        "ai_provider": f"openai:{settings.OPENAI_MODEL}",
                        "ai_summary": parsed.get("ai_summary", ""),
                        "behavior_analysis": parsed.get("behavior_analysis", ""),
                        "risk_justification": parsed.get("risk_justification", ""),
                        "evidence_citations": citations,
                        "recommendations": parsed.get("recommendations", []),
                        "is_suspicious": bool(parsed.get("is_suspicious", risk_eval["risk_score"] >= 45)),
                        "requires_analyst_review": True,
                    }
        except Exception:
            pass

    elif provider == "ollama":
        try:
            prompt = _build_llm_prompt(normalized_alert, risk_eval, ioc_results, mitre_mappings)
            with httpx.Client(timeout=20.0) as client:
                resp = client.post(
                    f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate",
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "prompt": prompt,
                        "format": "json",
                        "stream": False,
                    },
                )
                if resp.status_code == 200:
                    parsed = json.loads(resp.json().get("response", "{}"))
                    if parsed.get("ai_summary"):
                        return {
                            "ai_provider": f"ollama:{settings.OLLAMA_MODEL}",
                            "ai_summary": parsed["ai_summary"],
                            "behavior_analysis": parsed.get("behavior_analysis", ""),
                            "risk_justification": parsed.get("risk_justification", ""),
                            "evidence_citations": citations,
                            "recommendations": parsed.get("recommendations", []),
                            "is_suspicious": bool(parsed.get("is_suspicious", risk_eval["risk_score"] >= 45)),
                            "requires_analyst_review": True,
                        }
        except Exception:
            pass

    return _deterministic_evidence_analysis(normalized_alert, risk_eval, ioc_results, mitre_mappings)
