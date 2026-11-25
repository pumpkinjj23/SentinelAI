from typing import Any, Dict, List

# STIX-aligned MITRE ATT&CK Enterprise Knowledge Base
MITRE_KNOWLEDGE_BASE: Dict[str, Dict[str, Any]] = {
    "T1110": {
        "technique_id": "T1110",
        "name": "Brute Force",
        "tactic": "Credential Access",
        "url": "https://attack.mitre.org/techniques/T1110/",
        "keywords": ["brute force", "failed password", "failed login", "authentication_failures", "pre-authentication failed", "kerberos pre-authentication"],
    },
    "T1059.001": {
        "technique_id": "T1059.001",
        "name": "Command and Scripting Interpreter: PowerShell",
        "tactic": "Execution",
        "url": "https://attack.mitre.org/techniques/T1059/001/",
        "keywords": ["powershell", "-enc", "encodedcommand", "downloadstring", "-w hidden"],
    },
    "T1105": {
        "technique_id": "T1105",
        "name": "Ingress Tool Transfer",
        "tactic": "Command and Control",
        "url": "https://attack.mitre.org/techniques/T1105/",
        "keywords": ["downloadstring", "downloading payload", "webclient", "stage2", "curl ", "wget "],
    },
    "T1003.001": {
        "technique_id": "T1003.001",
        "name": "OS Credential Dumping: LSASS Memory",
        "tactic": "Credential Access",
        "url": "https://attack.mitre.org/techniques/T1003/001/",
        "keywords": ["lsass", "credential dumping", "mimikatz", "0x1010", "sekurlsa"],
    },
    "T1190": {
        "technique_id": "T1190",
        "name": "Exploit Public-Facing Application",
        "tactic": "Initial Access",
        "url": "https://attack.mitre.org/techniques/T1190/",
        "keywords": ["sql injection", "union select", "sql_injection", "/api/", "xss", "rce"],
    },
    "T1486": {
        "technique_id": "T1486",
        "name": "Data Encrypted for Impact",
        "tactic": "Impact",
        "url": "https://attack.mitre.org/techniques/T1486/",
        "keywords": ["ransomware", ".lockbit", "mass file modification", "encrypted"],
    },
    "T1490": {
        "technique_id": "T1490",
        "name": "Inhibit System Recovery",
        "tactic": "Impact",
        "url": "https://attack.mitre.org/techniques/T1490/",
        "keywords": ["vssadmin", "delete shadows", "shadow copy", "bcdedit", "wbadmin"],
    },
    "T1548.003": {
        "technique_id": "T1548.003",
        "name": "Abuse Elevation Control Mechanism: Sudo and Sudo Caching",
        "tactic": "Privilege Escalation",
        "url": "https://attack.mitre.org/techniques/T1548/003/",
        "keywords": ["sudo", "/etc/shadow", "privilege_escalation", "tty=pts"],
    },
    "T1046": {
        "technique_id": "T1046",
        "name": "Network Service Discovery",
        "tactic": "Discovery",
        "url": "https://attack.mitre.org/techniques/T1046/",
        "keywords": ["port scan", "syn_scan", "syn scan", "service enumeration", "scanned 120 ports"],
    },
    "T1071.004": {
        "technique_id": "T1071.004",
        "name": "Application Layer Protocol: DNS",
        "tactic": "Command and Control",
        "url": "https://attack.mitre.org/techniques/T1071/004/",
        "keywords": ["dns tunneling", "c2 beacon", "high-entropy subdomain", "c2-beacon"],
    },
    "T1021.002": {
        "technique_id": "T1021.002",
        "name": "Remote Services: SMB/Windows Admin Shares",
        "tactic": "Lateral Movement",
        "url": "https://attack.mitre.org/techniques/T1021/002/",
        "keywords": ["smb lateral movement", "psexec", "admin$", "ipc$"],
    },
    "T1569.002": {
        "technique_id": "T1569.002",
        "name": "System Services: Service Execution",
        "tactic": "Execution",
        "url": "https://attack.mitre.org/techniques/T1569/002/",
        "keywords": ["psexesvc", "eventid 7045", "service installation", "new service"],
    },
    "T1041": {
        "technique_id": "T1041",
        "name": "Exfiltration Over C2 Channel",
        "tactic": "Exfiltration",
        "url": "https://attack.mitre.org/techniques/T1041/",
        "keywords": ["data exfiltration", "large outbound", "gb transferred", "transferred"],
    },
    "T1078": {
        "technique_id": "T1078",
        "name": "Valid Accounts",
        "tactic": "Defense Evasion / Initial Access",
        "url": "https://attack.mitre.org/techniques/T1078/",
        "keywords": ["session opened", "authentication_success", "scheduled maintenance", "valid account"],
    },
}


def map_alert_to_mitre(normalized_alert: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Maps a normalized alert to MITRE ATT&CK techniques using:
    1. Explicit Wazuh rule.mitre STIX tags if present in raw_payload
    2. Behavioral keyword & command-line signature matching against MITRE_KNOWLEDGE_BASE
    Always records the exact evidence string that triggered the mapping.
    """
    mappings: List[Dict[str, Any]] = []
    added_ids = set()

    raw_payload = normalized_alert.get("raw_payload", {})
    rule_obj = raw_payload.get("rule", {}) if isinstance(raw_payload, dict) else {}
    mitre_obj = rule_obj.get("mitre", {}) if isinstance(rule_obj, dict) else {}

    # 1. Check explicit Wazuh MITRE IDs first
    explicit_ids = mitre_obj.get("id", []) if isinstance(mitre_obj, dict) else []
    if isinstance(explicit_ids, str):
        explicit_ids = [explicit_ids]

    for tid in explicit_ids:
        tid_clean = str(tid).strip().upper()
        if tid_clean in MITRE_KNOWLEDGE_BASE and tid_clean not in added_ids:
            kb = MITRE_KNOWLEDGE_BASE[tid_clean]
            added_ids.add(tid_clean)
            mappings.append(
                {
                    "technique_id": kb["technique_id"],
                    "name": kb["name"],
                    "tactic": kb["tactic"],
                    "confidence": "HIGH",
                    "evidence": f"Wazuh Rule #{normalized_alert.get('rule_id')} explicitly tagged {tid_clean} ({kb['name']}).",
                    "url": kb["url"],
                }
            )

    # 2. Pattern matching across description, command_line, and raw_log
    searchable_blob = " ".join(
        [
            str(normalized_alert.get("description") or ""),
            str(normalized_alert.get("command_line") or ""),
            str(normalized_alert.get("raw_log") or ""),
            str(normalized_alert.get("process_name") or ""),
        ]
    ).lower()

    for tid, kb in MITRE_KNOWLEDGE_BASE.items():
        if tid in added_ids:
            continue
        matched_kw = [kw for kw in kb["keywords"] if kw in searchable_blob]
        if matched_kw:
            added_ids.add(tid)
            mappings.append(
                {
                    "technique_id": kb["technique_id"],
                    "name": kb["name"],
                    "tactic": kb["tactic"],
                    "confidence": "HIGH" if len(matched_kw) >= 2 else "MEDIUM",
                    "evidence": f"Matched behavioral indicator(s) in log/command: {', '.join(matched_kw)}",
                    "url": kb["url"],
                }
            )

    # Fallback if no specific technique matched: do not force an unverified technique
    if not mappings:
        mappings.append(
            {
                "technique_id": "UNMAPPED",
                "name": "ไม่สามารถระบุ Technique ได้อย่างมั่นใจ (Insufficient Evidence)",
                "tactic": "Unclassified / General Telemetry",
                "confidence": "LOW",
                "evidence": "หลักฐานใน Event Log ไม่เพียงพอสำหรับการจับคู่ MITRE ATT&CK Technique อย่างแม่นยำ (ระบบไม่บังคับจับคู่หากไม่มีหลักฐานชัดเจน)",
                "url": "https://attack.mitre.org/",
            }
        )

    return mappings
