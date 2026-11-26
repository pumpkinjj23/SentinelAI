from typing import Any, Dict, List


# Calibrated weight configuration (tunable against evaluation_ground_truth.json)
SCORING_WEIGHTS: Dict[str, int] = {
    "max_rule_level_points": 42,
    "max_ioc_points": 28,
    "malicious_ioc_base": 20,
    "malicious_ioc_step": 5,
    "suspicious_ioc_base": 12,
    "high_risk_command_points": 10,
    "credential_escalation_points": 15,
    "privileged_account_points": 6,
    "benign_maintenance_deduction": -15,
    "ioc_min_confidence_malicious": 70,
    "ioc_min_confidence_suspicious": 40,
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


def _safe_int(value: Any, default: int = 5, min_val: int = 1, max_val: int = 15) -> int:
    """
    Safely parses integer fields (e.g., rule_level or confidence_score) so malformed
    strings, None, or out-of-range numbers never crash the rule engine.
    """
    try:
        if value is None or isinstance(value, bool):
            parsed = default
        else:
            parsed = int(float(str(value).strip()))
    except (ValueError, TypeError):
        parsed = default
    return max(min_val, min(max_val, parsed))


def _sanitize_mitre_mappings(mitre_mappings: Any) -> List[Dict[str, str]]:
    """
    Validates and normalizes MITRE mapping objects so missing keys or non-dict items
    never cause KeyError / AttributeError.
    """
    if not isinstance(mitre_mappings, list):
        return []
    valid_list: List[Dict[str, str]] = []
    for item in mitre_mappings:
        if not isinstance(item, dict):
            continue
        tech_id = str(item.get("technique_id") or "").strip().upper()
        name = str(item.get("name") or "Unknown Technique").strip()
        tactic = str(item.get("tactic") or "General").strip()
        confidence = str(item.get("confidence") or "MEDIUM").strip().upper()
        if tech_id:
            valid_list.append(
                {
                    "technique_id": tech_id,
                    "name": name,
                    "tactic": tactic,
                    "confidence": confidence,
                }
            )
    return valid_list


def _sanitize_ioc_results(ioc_results: Any) -> List[Dict[str, Any]]:
    """
    Validates IOC enrichment entries and checks source credibility & confidence thresholds.
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
        sanitized.append(
            {
                "value": val,
                "reputation": rep,
                "confidence_score": conf,
                "source": source,
                "is_trusted_source": is_trusted_source,
            }
        )
    return sanitized


def determine_incident_type(
    normalized_alert: Dict[str, Any],
    mitre_mappings: List[Dict[str, Any]],
) -> str:
    """
    Classifies the security incident using specific multi-token context and MITRE technique IDs
    before falling back to broader keywords (e.g., distinguishing '/etc/shadow' privilege escalation
    from 'vssadmin delete shadows' ransomware).
    """
    safe_alert = normalized_alert if isinstance(normalized_alert, dict) else {}
    safe_mitre = _sanitize_mitre_mappings(mitre_mappings)
    mitre_ids = {m["technique_id"] for m in safe_mitre}

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
    if "powershell" in combined or "encodedcommand" in combined or "T1059.001" in mitre_ids:
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
    if safe_mitre:
        return f"{safe_mitre[0]['tactic']}: {safe_mitre[0]['name']}"
    return "General Security Event"


def evaluate_alert_risk(
    normalized_alert: Dict[str, Any],
    ioc_results: List[Dict[str, Any]],
    mitre_mappings: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Module 4: Deterministic Rule Engine for Risk Scoring & Prioritization.
    Calculates a reproducible Risk Score (0-100) and Severity level (CRITICAL, HIGH, MEDIUM, LOW)
    independent of the LLM so scoring is never subject to AI hallucination or drift.

    Hardened against 5 production risks:
    1. Multi-token & MITRE-aware incident classification (distinguishes '/etc/shadow' vs 'shadow copy').
    2. Calibrated, configurable weight table (SCORING_WEIGHTS) validated against ground-truth dataset.
    3. IOC credibility & confidence-score verification (filters out low-confidence / untrusted feeds).
    4. Guarded benign/maintenance deduction (never reduces score if malicious IOCs, high-risk payloads,
       or high SIEM rule levels are present — preventing attacker 'Scheduled Maintenance' spoofing).
    5. Strict defensive input sanitization (_safe_int, _sanitize_mitre_mappings, _sanitize_ioc_results).
    """
    safe_alert = normalized_alert if isinstance(normalized_alert, dict) else {}
    safe_iocs = _sanitize_ioc_results(ioc_results)
    safe_mitre = _sanitize_mitre_mappings(mitre_mappings)

    breakdown: List[Dict[str, Any]] = []
    total_score = 0

    # 1. Base score from SIEM / Wazuh Rule Level (1 - 15 -> up to 42 points)
    rule_level = _safe_int(safe_alert.get("rule_level"), default=5, min_val=1, max_val=15)
    rule_id_str = str(safe_alert.get("rule_id") or "N/A")
    base_points = int(round((rule_level / 15.0) * SCORING_WEIGHTS["max_rule_level_points"]))
    total_score += base_points
    breakdown.append(
        {
            "factor": f"SIEM Rule Level ({rule_level}/15)",
            "points": base_points,
            "reason": f"Base severity weight derived from rule #{rule_id_str} (level {rule_level}).",
        }
    )

    # 2. IOC Threat Intelligence Reputation Score with Credibility & Confidence Verification (up to 28 points)
    verified_malicious_iocs = [
        i
        for i in safe_iocs
        if i["reputation"] == "MALICIOUS"
        and i["confidence_score"] >= SCORING_WEIGHTS["ioc_min_confidence_malicious"]
        and i["is_trusted_source"]
    ]
    unverified_or_suspicious_iocs = [
        i
        for i in safe_iocs
        if (
            i["reputation"] == "SUSPICIOUS"
            and i["confidence_score"] >= SCORING_WEIGHTS["ioc_min_confidence_suspicious"]
        )
        or (
            i["reputation"] == "MALICIOUS"
            and (
                i["confidence_score"] < SCORING_WEIGHTS["ioc_min_confidence_malicious"]
                or not i["is_trusted_source"]
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
            f"{i['value']} ({i['confidence_score']}%)" for i in verified_malicious_iocs
        )
        breakdown.append(
            {
                "factor": "Confirmed Malicious IOC",
                "points": ioc_pts,
                "reason": f"Verified Threat Intelligence flagged high-confidence malicious indicator(s): {ioc_vals}.",
            }
        )
    elif unverified_or_suspicious_iocs:
        ioc_pts = SCORING_WEIGHTS["suspicious_ioc_base"]
        total_score += ioc_pts
        ioc_vals = ", ".join(
            f"{i['value']} ({i['confidence_score']}%)" for i in unverified_or_suspicious_iocs
        )
        breakdown.append(
            {
                "factor": "Suspicious Indicator (IOC)",
                "points": ioc_pts,
                "reason": f"Indicator(s) with moderate confidence or unverified feed detected: {ioc_vals}.",
            }
        )

    # 3. MITRE ATT&CK Tactic & High-Confidence Technique Impact (up to 22 points)
    high_conf_mitre = [m for m in safe_mitre if m["confidence"] in ("HIGH", "MEDIUM")]
    if high_conf_mitre:
        best_tactic_pts = max(
            (HIGH_RISK_TACTICS.get(m["tactic"], 8) for m in high_conf_mitre),
            default=8,
        )
        total_score += best_tactic_pts
        tech_list = ", ".join(f"{m['technique_id']} ({m['name']})" for m in high_conf_mitre)
        breakdown.append(
            {
                "factor": "MITRE ATT&CK Tactic Severity",
                "points": best_tactic_pts,
                "reason": f"Mapped to active attack technique(s): {tech_list}.",
            }
        )

    # 4. Behavioral & Context Modifiers
    cmd = str(safe_alert.get("command_line") or "").lower()
    desc = str(safe_alert.get("description") or "").lower()
    raw_log = str(safe_alert.get("raw_log") or "").lower()
    user = str(safe_alert.get("username") or "").lower()
    combined_evidence = f"{cmd} {desc} {raw_log}"

    has_high_risk_payload = any(
        sig in combined_evidence
        for sig in ["-enc", "delete shadows", "/etc/shadow", "union select", "lsass", "psexesvc"]
    )
    if has_high_risk_payload:
        cmd_pts = SCORING_WEIGHTS["high_risk_command_points"]
        total_score += cmd_pts
        breakdown.append(
            {
                "factor": "High-Risk Command / Payload Signature",
                "points": cmd_pts,
                "reason": "Log or command line contains explicit exploitation, credential access, or destructive payload syntax.",
            }
        )

    has_credential_escalation = "/etc/shadow" in combined_evidence or (
        "sudo" in combined_evidence and user == "www-data"
    )
    if has_credential_escalation:
        esc_pts = SCORING_WEIGHTS["credential_escalation_points"]
        total_score += esc_pts
        breakdown.append(
            {
                "factor": "Critical Credential File / Web-User Sudo Escalation",
                "points": esc_pts,
                "reason": "Service account executed sudo to access root-only credential store (/etc/shadow).",
            }
        )

    if user in ("root", "admin", "administrator", "www-data", "postgres") and rule_level >= 9:
        priv_pts = SCORING_WEIGHTS["privileged_account_points"]
        total_score += priv_pts
        breakdown.append(
            {
                "factor": "Privileged / Critical Service Account",
                "points": priv_pts,
                "reason": f"Event involves sensitive account '{safe_alert.get('username')}'.",
            }
        )

    # 5. Guarded Benign / Low-Noise Reduction Heuristic
    # Security Guard: NEVER deduct points if rule_level > 6, or if malicious/suspicious IOCs exist,
    # or if high-risk payload signatures / credential escalation are present.
    is_truly_benign_context = (
        rule_level <= 6
        and not verified_malicious_iocs
        and not unverified_or_suspicious_iocs
        and not has_high_risk_payload
        and not has_credential_escalation
    )
    if is_truly_benign_context and (
        "scheduled maintenance" in desc or ("3 attempts" in desc and rule_level <= 5)
    ):
        deduct_pts = SCORING_WEIGHTS["benign_maintenance_deduction"]
        total_score += deduct_pts
        breakdown.append(
            {
                "factor": "Low-Noise / Maintenance Context Adjustment",
                "points": deduct_pts,
                "reason": "Verified low-level event (level <= 6) with zero malicious indicators matching maintenance/typo pattern.",
            }
        )

    final_score = max(5, min(100, total_score))

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
