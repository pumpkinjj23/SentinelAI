from typing import Any, Dict, List


HIGH_RISK_TACTICS = {
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


def determine_incident_type(normalized_alert: Dict[str, Any], mitre_mappings: List[Dict[str, Any]]) -> str:
    desc = (normalized_alert.get("description") or "").lower()
    if "ransomware" in desc or "shadow" in desc:
        return "Ransomware & Recovery Inhibition"
    if "lsass" in desc or "credential dumping" in desc or "mimikatz" in desc:
        return "Credential Dumping (LSASS Memory)"
    if "powershell" in desc or "encodedcommand" in desc:
        return "Malicious Script Execution & C2 Stager"
    if "sql injection" in desc or "union select" in desc:
        return "Web Application Exploit (SQL Injection)"
    if "lateral movement" in desc or "psexec" in desc:
        return "Lateral Movement via Remote Service"
    if "exfiltration" in desc:
        return "Unauthorized Data Exfiltration"
    if "dns tunneling" in desc or "c2 beacon" in desc:
        return "Command & Control DNS Tunneling"
    if "sudo" in desc or "privilege" in desc:
        return "Unauthorized Privilege Escalation"
    if "port scan" in desc or "enumeration" in desc:
        return "Network Reconnaissance & Port Scanning"
    if "brute force" in desc or "failed password" in desc:
        return "Brute Force Authentication Attack"
    if "kerberos" in desc:
        return "Authentication Anomaly (Kerberos)"
    if mitre_mappings:
        return f"{mitre_mappings[0]['tactic']}: {mitre_mappings[0]['name']}"
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
    """
    breakdown: List[Dict[str, Any]] = []
    total_score = 0

    # 1. Base score from SIEM / Wazuh Rule Level (1 - 15 -> up to 42 points)
    rule_level = int(normalized_alert.get("rule_level", 5))
    base_points = int(round((rule_level / 15.0) * 42))
    total_score += base_points
    breakdown.append(
        {
            "factor": f"SIEM Rule Level ({rule_level}/15)",
            "points": base_points,
            "reason": f"Base severity weight derived from rule #{normalized_alert.get('rule_id')} (level {rule_level}).",
        }
    )

    # 2. IOC Threat Intelligence Reputation Score (up to 28 points)
    malicious_iocs = [i for i in ioc_results if i.get("reputation") == "MALICIOUS"]
    suspicious_iocs = [i for i in ioc_results if i.get("reputation") == "SUSPICIOUS"]

    if malicious_iocs:
        ioc_pts = min(28, 20 + (len(malicious_iocs) - 1) * 5)
        total_score += ioc_pts
        ioc_vals = ", ".join(i["value"] for i in malicious_iocs)
        breakdown.append(
            {
                "factor": "Confirmed Malicious IOC",
                "points": ioc_pts,
                "reason": f"Threat Intelligence flagged high-confidence malicious indicator(s): {ioc_vals}.",
            }
        )
    elif suspicious_iocs:
        ioc_pts = 12
        total_score += ioc_pts
        ioc_vals = ", ".join(i["value"] for i in suspicious_iocs)
        breakdown.append(
            {
                "factor": "Suspicious Indicator (IOC)",
                "points": ioc_pts,
                "reason": f"Indicator(s) with elevated risk score detected: {ioc_vals}.",
            }
        )

    # 3. MITRE ATT&CK Tactic & High-Confidence Technique Impact (up to 22 points)
    high_conf_mitre = [m for m in mitre_mappings if m.get("confidence") in ("HIGH", "MEDIUM")]
    if high_conf_mitre:
        best_tactic_pts = max(
            (HIGH_RISK_TACTICS.get(m.get("tactic", ""), 8) for m in high_conf_mitre),
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

    # 4. Behavioral & Context Modifiers (Command line obfuscation, Privileged user, Maintenance benign check)
    cmd = (normalized_alert.get("command_line") or "").lower()
    desc = (normalized_alert.get("description") or "").lower()
    raw_log = (normalized_alert.get("raw_log") or "").lower()
    user = (normalized_alert.get("username") or "").lower()
    combined_evidence = f"{cmd} {desc} {raw_log}"

    if any(sig in combined_evidence for sig in ["-enc", "delete shadows", "/etc/shadow", "union select", "lsass", "psexesvc"]):
        cmd_pts = 10
        total_score += cmd_pts
        breakdown.append(
            {
                "factor": "High-Risk Command / Payload Signature",
                "points": cmd_pts,
                "reason": "Log or command line contains explicit exploitation, credential access, or destructive payload syntax.",
            }
        )

    if "/etc/shadow" in combined_evidence or ("sudo" in combined_evidence and user == "www-data"):
        esc_pts = 15
        total_score += esc_pts
        breakdown.append(
            {
                "factor": "Critical Credential File / Web-User Sudo Escalation",
                "points": esc_pts,
                "reason": "Service account executed sudo to access root-only credential store (/etc/shadow).",
            }
        )

    if user in ("root", "admin", "administrator", "www-data", "postgres") and rule_level >= 9:
        priv_pts = 6
        total_score += priv_pts
        breakdown.append(
            {
                "factor": "Privileged / Critical Service Account",
                "points": priv_pts,
                "reason": f"Event involves sensitive account '{normalized_alert.get('username')}'.",
            }
        )

    # 5. Benign / Low-Noise Reduction Heuristic (to reduce False Positives on routine maintenance or minor typos)
    if "scheduled maintenance" in desc or ("3 attempts" in desc and rule_level <= 5):
        deduct_pts = -15
        total_score += deduct_pts
        breakdown.append(
            {
                "factor": "Low-Noise / Maintenance Context Adjustment",
                "points": deduct_pts,
                "reason": "Event matches known maintenance window or low-threshold user typo pattern.",
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

    incident_type = determine_incident_type(normalized_alert, mitre_mappings)

    return {
        "risk_score": final_score,
        "severity": severity,
        "incident_type": incident_type,
        "scoring_breakdown": breakdown,
    }
