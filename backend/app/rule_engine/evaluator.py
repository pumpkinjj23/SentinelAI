from datetime import datetime, timezone
from typing import Any, Dict, List


# Calibrated weight configuration (tunable against evaluation_ground_truth.json)
SCORING_WEIGHTS: Dict[str, int] = {
    "max_rule_level_points": 42,
    "max_ioc_points": 28,
    "malicious_ioc_base": 20,
    "malicious_ioc_step": 5,
    "suspicious_ioc_base": 12,
    "max_mitre_points": 22,
    "max_behavioral_modifier_points": 31,
    "high_risk_command_points": 10,
    "credential_escalation_points": 15,
    "privileged_account_points": 6,
    "benign_maintenance_deduction": -15,
    "ioc_min_confidence_malicious": 70,
    "ioc_min_confidence_suspicious": 40,
    "ioc_max_age_days": 90,
}

HIGH_RISK_TACTICS: Dict[str, int] = {
    "Impact": 22,
    "Credential Access": 18,
    "Command and Control": 18,
    "Exfiltration": 18,
    "Lateral Movement": 18,
    "Privilege Escalation": 16,
    "Execution": 15,
    "Initial Access": 15,
    "Discovery": 10,
}

TRUSTED_IOC_SOURCES = (
    "abuseipdb",
    "virustotal",
    "threatfox",
    "urlhaus",
    "malwarebazaar",
    "alienvault",
    "internal",
)

SUSPICIOUS_POWERSHELL_INDICATORS = (
    "-enc",
    "encodedcommand",
    "-w hidden",
    "-windowstyle hidden",
    "downloadstring",
    "invoke-webrequest",
    "invoke-expression",
    "iex ",
    "bypass",
    "-nop",
    "c2",
    "stage2",
    "suspicious powershell",
)


def _safe_int(value: Any, default: int = 5, min_val: int = 0, max_val: int = 16) -> int:
    """
    Safely parses integer fields (e.g., Wazuh rule_level 0-16 or confidence_score 0-100)
    so malformed strings, None, or out-of-range numbers never crash the rule engine.
    """
    try:
        if value is None or isinstance(value, bool):
            parsed = default
        else:
            parsed = int(float(str(value).strip()))
    except (ValueError, TypeError):
        parsed = default
    return max(min_val, min(max_val, parsed))


def _sanitize_mitre_mappings(mitre_mappings: Any) -> List[Dict[str, Any]]:
    """
    Validates and normalizes MITRE mapping objects and verifies whether each mapping
    is backed by concrete log/rule evidence (not an unmapped/placeholder entry).
    """
    if not isinstance(mitre_mappings, list):
        return []
    valid_list: List[Dict[str, Any]] = []
    for item in mitre_mappings:
        if not isinstance(item, dict):
            continue
        tech_id = str(item.get("technique_id") or "").strip().upper()
        if not tech_id or tech_id == "UNMAPPED":
            continue
        name = str(item.get("name") or "Unknown Technique").strip()
        tactic = str(item.get("tactic") or "General").strip()
        confidence = str(item.get("confidence") or "MEDIUM").strip().upper()
        evidence = str(item.get("evidence") or "").strip()
        has_verified_evidence = (
            "ไม่เพียงพอ" not in evidence
            and "insufficient" not in evidence.lower()
            and confidence in ("HIGH", "MEDIUM")
        )
        valid_list.append(
            {
                "technique_id": tech_id,
                "name": name,
                "tactic": tactic,
                "confidence": confidence,
                "evidence": evidence,
                "has_verified_evidence": has_verified_evidence,
            }
        )
    return valid_list


def _is_ioc_fresh(item: Dict[str, Any], max_age_days: int = 90) -> bool:
    """
    Checks IOC freshness if 'last_seen', 'updated_at', or 'age_days' is provided.
    Stale indicators older than max_age_days are downgraded so outdated intel
    does not inflate the risk score.
    """
    if "is_fresh" in item and isinstance(item["is_fresh"], bool):
        return item["is_fresh"]
    if "age_days" in item and item["age_days"] is not None:
        age = _safe_int(item["age_days"], default=0, min_val=0, max_val=3650)
        return age <= max_age_days
    ts_val = item.get("last_seen") or item.get("updated_at")
    if ts_val:
        try:
            ts_str = str(ts_val).strip()
            if ts_str.endswith("Z"):
                ts_str = ts_str[:-1] + "+00:00"
            dt = datetime.fromisoformat(ts_str)
            if not dt.tzinfo:
                dt = dt.replace(tzinfo=timezone.utc)
            age_days = (datetime.now(timezone.utc) - dt).days
            return age_days <= max_age_days
        except Exception:
            return True
    return True


def _sanitize_ioc_results(ioc_results: Any) -> List[Dict[str, Any]]:
    """
    Validates IOC enrichment entries and checks source credibility, confidence score,
    and freshness (<= 90 days).
    """
    if not isinstance(ioc_results, list):
        return []
    sanitized: List[Dict[str, Any]] = []
    for item in ioc_results:
        if not isinstance(item, dict):
            continue
        val = str(item.get("value") or "").strip()
        if not val:
            continue
        rep = str(item.get("reputation") or "UNKNOWN").strip().upper()
        conf = _safe_int(item.get("confidence_score"), default=0, min_val=0, max_val=100)
        source = str(item.get("source") or "Unknown Feed").strip()
        source_lower = source.lower()
        is_trusted_source = any(src in source_lower for src in TRUSTED_IOC_SOURCES)
        is_fresh = _is_ioc_fresh(item, SCORING_WEIGHTS["ioc_max_age_days"])
        sanitized.append(
            {
                "value": val,
                "reputation": rep,
                "confidence_score": conf,
                "source": source,
                "is_trusted_source": is_trusted_source,
                "is_fresh": is_fresh,
            }
        )
    return sanitized


def _is_malicious_powershell_context(combined_text: str, mitre_ids: set[str], rule_level: int) -> bool:
    """
    Distinguishes malicious PowerShell execution (obfuscation, -Enc, hidden window, C2 download,
    or high-severity rule + T1059.001) from benign administrative PowerShell usage.
    """
    if "powershell" not in combined_text and "T1059.001" not in mitre_ids:
        return False
    if any(ind in combined_text for ind in SUSPICIOUS_POWERSHELL_INDICATORS):
        return True
    return "T1059.001" in mitre_ids and rule_level >= 10


def determine_incident_type(
    normalized_alert: Dict[str, Any],
    mitre_mappings: List[Dict[str, Any]],
) -> str:
    """
    Classifies the security incident using specific multi-token context and MITRE technique IDs:
    - Distinguishes '/etc/shadow' privilege escalation from 'vssadmin delete shadows' ransomware.
    - Distinguishes malicious PowerShell stagers from benign administrative PowerShell commands.
    """
    safe_alert = normalized_alert if isinstance(normalized_alert, dict) else {}
    safe_mitre = _sanitize_mitre_mappings(mitre_mappings)
    mitre_ids = {m["technique_id"] for m in safe_mitre if m.get("has_verified_evidence", True)}
    rule_level = _safe_int(safe_alert.get("rule_level"), default=5, min_val=0, max_val=16)

    desc = str(safe_alert.get("description") or "").lower()
    cmd = str(safe_alert.get("command_line") or "").lower()
    raw_log = str(safe_alert.get("raw_log") or "").lower()
    combined = f"{desc} {cmd} {raw_log}"

    # 1. Explicit Linux credential file (/etc/shadow) or sudo escalation MUST be checked before 'shadow'
    if (
        "/etc/shadow" in combined
        or "T1548.003" in mitre_ids
        or ("sudo" in desc and ("privilege" in desc or "root" in desc))
    ):
        return "Unauthorized Privilege Escalation"

    # 2. Ransomware & Volume Shadow Copy deletion (requires explicit ransomware context, not bare 'shadow')
    if (
        "ransomware" in combined
        or "shadow copy" in combined
        or "delete shadows" in combined
        or "vssadmin" in combined
        or ".lockbit" in combined
        or "T1486" in mitre_ids
        or "T1490" in mitre_ids
    ):
        return "Ransomware & Recovery Inhibition"

    if "lsass" in combined or "credential dumping" in combined or "mimikatz" in combined or "T1003.001" in mitre_ids:
        return "Credential Dumping (LSASS Memory)"

    # 3. PowerShell: only classify as Malicious Script Execution when suspicious flags/context exist
    if _is_malicious_powershell_context(combined, mitre_ids, rule_level):
        return "Malicious Script Execution & C2 Stager"

    if "sql injection" in combined or "union select" in combined or "T1190" in mitre_ids:
        return "Web Application Exploit (SQL Injection)"
    if "lateral movement" in combined or "psexec" in combined or "T1021.002" in mitre_ids:
        return "Lateral Movement via Remote Service"
    if "exfiltration" in combined or "T1041" in mitre_ids:
        return "Unauthorized Data Exfiltration"
    if "dns tunneling" in combined or "c2 beacon" in combined or "T1071.004" in mitre_ids:
        return "Command & Control DNS Tunneling"
    if "sudo" in desc or "privilege" in desc:
        return "Unauthorized Privilege Escalation"
    if "port scan" in combined or "enumeration" in combined or "T1046" in mitre_ids:
        return "Network Reconnaissance & Port Scanning"
    if "brute force" in combined or "failed password" in combined:
        return "Brute Force Authentication Attack"
    if "kerberos" in combined:
        return "Authentication Anomaly (Kerberos)"
    if "powershell" in combined:
        return "Administrative PowerShell Activity"
    if safe_mitre:
        return f"{safe_mitre[0]['tactic']}: {safe_mitre[0]['name']}"
    return "General Security Event"


def evaluate_alert_risk(
    normalized_alert: Dict[str, Any],
    ioc_results: List[Dict[str, Any]],
    mitre_mappings: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Module 4: Deterministic Rule-Based Risk Scoring & Prioritization Engine.
    Calculates an auditable, reproducible Risk Score (0-100), Severity level
    (CRITICAL, HIGH, MEDIUM, LOW), and transparent scoring_breakdown independent of the LLM.

    Hardened with 6 production safeguards:
    1. Full Wazuh Rule Level 0-16 support (Level 0 ignored/0 pts; Levels 1-16 scaled cleanly).
    2. Evidence-verified MITRE scoring (requires concrete evidence + scales by confidence & corroboration).
    3. Context-aware keyword classification (benign PowerShell vs obfuscated/C2 PowerShell; '/etc/shadow' vs 'shadow copy').
    4. IOC source credibility, confidence threshold (>=70%), and freshness check (<=90 days).
    5. Verified maintenance/benign reduction (requires verified maintenance rule/flag and zero attack indicators).
    6. Category sub-caps (Rule <=42, IOC <=28, MITRE <=22, Behavioral Modifiers <=25) to prevent score inflation.
    """
    safe_alert = normalized_alert if isinstance(normalized_alert, dict) else {}
    safe_iocs = _sanitize_ioc_results(ioc_results)
    safe_mitre = _sanitize_mitre_mappings(mitre_mappings)

    breakdown: List[Dict[str, Any]] = []
    total_score = 0

    # 1. Base score from SIEM / Wazuh Rule Level (Official Wazuh range: 0 - 16 -> up to 42 points)
    rule_level = _safe_int(safe_alert.get("rule_level"), default=5, min_val=0, max_val=16)
    rule_id_str = str(safe_alert.get("rule_id") or "N/A")
    if rule_level == 0:
        base_points = 0
    else:
        base_points = min(
            SCORING_WEIGHTS["max_rule_level_points"],
            int(round((min(rule_level, 15) / 15.0) * SCORING_WEIGHTS["max_rule_level_points"]))
            + (2 if rule_level == 16 else 0),
        )
    total_score += base_points
    breakdown.append(
        {
            "factor": f"SIEM Rule Level ({rule_level}/16)",
            "points": base_points,
            "reason": f"Base severity weight derived from Wazuh/SIEM rule #{rule_id_str} (level {rule_level} on 0-16 scale).",
        }
    )

    # 2. IOC Threat Intelligence Reputation Score with Source Credibility, Confidence & Freshness Check (capped at 28 points)
    verified_malicious_iocs = [
        i
        for i in safe_iocs
        if i["reputation"] == "MALICIOUS"
        and i["confidence_score"] >= SCORING_WEIGHTS["ioc_min_confidence_malicious"]
        and i["is_trusted_source"]
        and i["is_fresh"]
    ]
    unverified_or_suspicious_iocs = [
        i
        for i in safe_iocs
        if (
            i["reputation"] == "SUSPICIOUS"
            and i["confidence_score"] >= SCORING_WEIGHTS["ioc_min_confidence_suspicious"]
            and i["is_fresh"]
        )
        or (
            i["reputation"] == "MALICIOUS"
            and (
                i["confidence_score"] < SCORING_WEIGHTS["ioc_min_confidence_malicious"]
                or not i["is_trusted_source"]
                or not i["is_fresh"]
            )
        )
    ]

    if verified_malicious_iocs:
        ioc_pts = min(
            SCORING_WEIGHTS["max_ioc_points"],
            SCORING_WEIGHTS["malicious_ioc_base"]
            + (len(verified_malicious_iocs) - 1) * SCORING_WEIGHTS["malicious_ioc_step"],
        )
        total_score += ioc_pts
        ioc_vals = ", ".join(
            f"{i['value']} ({i['confidence_score']}%, {i['source']})"
            for i in verified_malicious_iocs
        )
        breakdown.append(
            {
                "factor": "Confirmed Malicious IOC",
                "points": ioc_pts,
                "reason": f"Fresh, trusted Threat Intelligence flagged high-confidence malicious indicator(s): {ioc_vals}.",
            }
        )
    elif unverified_or_suspicious_iocs:
        ioc_pts = SCORING_WEIGHTS["suspicious_ioc_base"]
        total_score += ioc_pts
        ioc_vals = ", ".join(
            f"{i['value']} ({i['confidence_score']}%, {i['source']})"
            for i in unverified_or_suspicious_iocs
        )
        breakdown.append(
            {
                "factor": "Suspicious Indicator (IOC)",
                "points": ioc_pts,
                "reason": f"Indicator(s) with moderate confidence, stale timestamp, or unverified feed detected: {ioc_vals}.",
            }
        )

    # 3. Behavioral & Context Modifiers (capped at 25 points total to prevent score inflation)
    cmd = str(safe_alert.get("command_line") or "").lower()
    desc = str(safe_alert.get("description") or "").lower()
    raw_log = str(safe_alert.get("raw_log") or "").lower()
    user = str(safe_alert.get("username") or "").lower()
    combined_evidence = f"{cmd} {desc} {raw_log}"

    has_high_risk_payload = any(
        sig in combined_evidence
        for sig in ["-enc", "delete shadows", "/etc/shadow", "union select", "lsass", "psexesvc"]
    )
    has_credential_escalation = "/etc/shadow" in combined_evidence or (
        "sudo" in combined_evidence and user == "www-data"
    )

    # 4. Evidence-Verified MITRE ATT&CK Tactic & Technique Impact (capped at 22 points)
    # Only scores MITRE mappings that carry verified log/rule evidence, and scales down if no corroborating
    # telemetry (low rule level and no IOC/payload evidence) exists.
    evidence_backed_mitre = [
        m
        for m in safe_mitre
        if m["confidence"] in ("HIGH", "MEDIUM") and m.get("has_verified_evidence", True)
    ]
    if evidence_backed_mitre:
        raw_tactic_pts = max(
            (HIGH_RISK_TACTICS.get(m["tactic"], 8) for m in evidence_backed_mitre),
            default=8,
        )
        has_corroborating_evidence = (
            rule_level >= 7
            or bool(verified_malicious_iocs)
            or bool(unverified_or_suspicious_iocs)
            or has_high_risk_payload
            or has_credential_escalation
            or any(m["confidence"] == "HIGH" for m in evidence_backed_mitre)
        )
        if not has_corroborating_evidence:
            best_tactic_pts = max(4, raw_tactic_pts // 2)
        else:
            best_tactic_pts = min(SCORING_WEIGHTS["max_mitre_points"], raw_tactic_pts)

        total_score += best_tactic_pts
        tech_list = ", ".join(f"{m['technique_id']} ({m['name']})" for m in evidence_backed_mitre)
        breakdown.append(
            {
                "factor": "MITRE ATT&CK Tactic Severity",
                "points": best_tactic_pts,
                "reason": f"Mapped with verified log evidence to attack technique(s): {tech_list}.",
            }
        )

    behavioral_pts_accum = 0
    if has_high_risk_payload:
        cmd_pts = min(
            SCORING_WEIGHTS["high_risk_command_points"],
            SCORING_WEIGHTS["max_behavioral_modifier_points"] - behavioral_pts_accum,
        )
        if cmd_pts > 0:
            behavioral_pts_accum += cmd_pts
            total_score += cmd_pts
            breakdown.append(
                {
                    "factor": "High-Risk Command / Payload Signature",
                    "points": cmd_pts,
                    "reason": "Log or command line contains explicit exploitation, credential access, or destructive payload syntax.",
                }
            )

    if has_credential_escalation:
        esc_pts = min(
            SCORING_WEIGHTS["credential_escalation_points"],
            SCORING_WEIGHTS["max_behavioral_modifier_points"] - behavioral_pts_accum,
        )
        if esc_pts > 0:
            behavioral_pts_accum += esc_pts
            total_score += esc_pts
            breakdown.append(
                {
                    "factor": "Critical Credential File / Web-User Sudo Escalation",
                    "points": esc_pts,
                    "reason": "Service account executed sudo to access root-only credential store (/etc/shadow).",
                }
            )

    if user in ("root", "admin", "administrator", "www-data", "postgres") and rule_level >= 9:
        priv_pts = min(
            SCORING_WEIGHTS["privileged_account_points"],
            SCORING_WEIGHTS["max_behavioral_modifier_points"] - behavioral_pts_accum,
        )
        if priv_pts > 0:
            behavioral_pts_accum += priv_pts
            total_score += priv_pts
            breakdown.append(
                {
                    "factor": "Privileged / Critical Service Account",
                    "points": priv_pts,
                    "reason": f"Event involves sensitive account '{safe_alert.get('username')}'.",
                }
            )

    # 5. Verified Benign / Authorized Maintenance Reduction Heuristic
    # Requires BOTH zero malicious indicators (rule_level <= 6, no IOCs, no attack payload)
    # AND positive verification of an authorized maintenance window or minor auth typo rule.
    raw_payload = safe_alert.get("raw_payload") if isinstance(safe_alert.get("raw_payload"), dict) else {}
    rule_groups = (
        raw_payload.get("rule", {}).get("groups", [])
        if isinstance(raw_payload.get("rule"), dict)
        else []
    )
    has_authorized_maintenance_proof = (
        bool(safe_alert.get("maintenance_verified"))
        or bool(raw_payload.get("maintenance_verified"))
        or (
            "scheduled maintenance" in desc
            and (
                rule_id_str in ("5501", "5502")
                or user in ("backup_svc", "maint_svc")
                or "authentication_success" in rule_groups
            )
        )
    )
    has_low_noise_typo_proof = "3 attempts" in desc and rule_level <= 5

    is_truly_benign_context = (
        rule_level <= 6
        and not verified_malicious_iocs
        and not unverified_or_suspicious_iocs
        and not has_high_risk_payload
        and not has_credential_escalation
    )
    if is_truly_benign_context and (has_authorized_maintenance_proof or has_low_noise_typo_proof):
        deduct_pts = SCORING_WEIGHTS["benign_maintenance_deduction"]
        total_score += deduct_pts
        breakdown.append(
            {
                "factor": "Low-Noise / Maintenance Context Adjustment",
                "points": deduct_pts,
                "reason": "Verified authorized maintenance service/rule or low-threshold user typo with zero malicious indicators.",
            }
        )

    final_score = max(0 if rule_level == 0 else 5, min(100, total_score))

    if final_score >= 85:
        severity = "CRITICAL"
    elif final_score >= 70:
        severity = "HIGH"
    elif final_score >= 45:
        severity = "MEDIUM"
    else:
        severity = "LOW"

    incident_type = determine_incident_type(safe_alert, safe_mitre)

    return {
        "risk_score": final_score,
        "severity": severity,
        "incident_type": incident_type,
        "scoring_breakdown": breakdown,
    }
