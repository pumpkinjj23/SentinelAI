import csv
import hashlib
import io
from datetime import datetime, timezone
from typing import Any, Dict, List

try:
    import pandas as pd
except ImportError:
    pd = None


class AlertValidationError(ValueError):
    """Raised when an incoming alert payload lacks mandatory fields."""
    pass


def parse_timestamp(ts_val: Any) -> datetime:
    if not ts_val:
        return datetime.now(timezone.utc)
    if isinstance(ts_val, datetime):
        return ts_val if ts_val.tzinfo else ts_val.replace(tzinfo=timezone.utc)
    try:
        ts_str = str(ts_val).strip()
        if ts_str.endswith("Z"):
            ts_str = ts_str[:-1] + "+00:00"
        dt = datetime.fromisoformat(ts_str)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


def compute_dedup_hash(
    source: str,
    rule_id: str,
    hostname: str,
    src_ip: str,
    dst_ip: str,
    username: str,
    description: str,
) -> str:
    """
    Computes a deterministic SHA-256 fingerprint for deduplicating repeated alerts.
    """
    key = "|".join(
        [
            str(source or "").lower().strip(),
            str(rule_id or "").lower().strip(),
            str(hostname or "").lower().strip(),
            str(src_ip or "").lower().strip(),
            str(dst_ip or "").lower().strip(),
            str(username or "").lower().strip(),
            str(description or "").lower().strip(),
        ]
    )
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def normalize_alert_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes either a Wazuh JSON alert or a flat/generic JSON/CSV alert row
    into SentinelAI's canonical alert format.
    """
    if not isinstance(payload, dict) or not payload:
        raise AlertValidationError("Alert payload must be a non-empty JSON object.")

    # Detect Wazuh structured format vs flat format
    rule_obj = payload.get("rule") if isinstance(payload.get("rule"), dict) else {}
    agent_obj = payload.get("agent") if isinstance(payload.get("agent"), dict) else {}
    data_obj = payload.get("data") if isinstance(payload.get("data"), dict) else {}

    description = (
        rule_obj.get("description")
        or payload.get("description")
        or payload.get("message")
        or payload.get("title")
    )
    if not description or not str(description).strip() or str(description).strip().lower() == "nan":
        raise AlertValidationError("Missing mandatory alert 'description' or 'rule.description'.")

    description = str(description).strip()

    external_id = (
        payload.get("id")
        or payload.get("event_id")
        or payload.get("alert_id")
        or payload.get("external_id")
    )
    external_id = str(external_id).strip() if external_id and str(external_id).lower() != "nan" else None

    source = payload.get("source") or ("Wazuh" if rule_obj or agent_obj else "Custom-JSON")
    rule_id = str(rule_obj.get("id") or payload.get("rule_id") or "RULE-GEN")

    raw_level = rule_obj.get("level") if rule_obj.get("level") is not None else payload.get("rule_level", 6)
    try:
        rule_level = max(0, min(16, int(float(raw_level))))
    except (ValueError, TypeError):
        rule_level = 6

    hostname = (
        agent_obj.get("name")
        or payload.get("hostname")
        or data_obj.get("hostname")
        or "unknown-host"
    )
    src_ip = (
        data_obj.get("srcip")
        or data_obj.get("src_ip")
        or payload.get("src_ip")
        or payload.get("srcip")
        or agent_obj.get("ip")
    )
    dst_ip = (
        data_obj.get("dstip")
        or data_obj.get("dst_ip")
        or payload.get("dst_ip")
        or payload.get("dstip")
        or agent_obj.get("ip")
    )
    username = (
        data_obj.get("srcuser")
        or data_obj.get("dstuser")
        or payload.get("username")
        or payload.get("user")
    )
    process_name = (
        data_obj.get("process")
        or payload.get("process_name")
        or payload.get("process")
    )
    command_line = (
        data_obj.get("command_line")
        or data_obj.get("url")
        or payload.get("command_line")
    )
    domain = data_obj.get("domain") or payload.get("domain")
    file_hash = data_obj.get("file_hash") or payload.get("file_hash")
    protocol = data_obj.get("protocol") or payload.get("protocol")

    raw_log = (
        payload.get("full_log")
        or payload.get("raw_log")
        or description
    )

    def clean_opt(val: Any) -> str | None:
        if val is None:
            return None
        s = str(val).strip()
        if not s or s.lower() in ("nan", "none", "null"):
            return None
        return s

    hostname = clean_opt(hostname) or "unknown-host"
    src_ip = clean_opt(src_ip)
    dst_ip = clean_opt(dst_ip)
    username = clean_opt(username)
    process_name = clean_opt(process_name)
    command_line = clean_opt(command_line)
    domain = clean_opt(domain)
    file_hash = clean_opt(file_hash)
    protocol = clean_opt(protocol)
    raw_log = clean_opt(raw_log) or description

    dedup_hash = compute_dedup_hash(
        source=str(source),
        rule_id=rule_id,
        hostname=hostname,
        src_ip=src_ip or "",
        dst_ip=dst_ip or "",
        username=username or "",
        description=description,
    )

    return {
        "external_id": external_id,
        "dedup_hash": dedup_hash,
        "source": str(source).strip(),
        "timestamp": parse_timestamp(payload.get("timestamp")),
        "rule_id": rule_id,
        "rule_level": rule_level,
        "description": description,
        "hostname": hostname,
        "src_ip": src_ip,
        "dst_ip": dst_ip,
        "username": username,
        "process_name": process_name,
        "command_line": command_line,
        "domain": domain,
        "file_hash": file_hash,
        "protocol": protocol,
        "raw_log": raw_log,
        "raw_payload": payload,
    }


def parse_csv_content(csv_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Uses Pandas (with standard library csv.DictReader fallback) to parse CSV security log files
    into a list of raw dictionary payloads.
    """
    if pd is not None:
        try:
            df = pd.read_csv(io.BytesIO(csv_bytes)).fillna("")
            if df.empty:
                raise AlertValidationError("Uploaded CSV file contains no rows.")
            return df.to_dict(orient="records")
        except AlertValidationError:
            raise
        except Exception as exc:
            raise AlertValidationError(f"Invalid CSV file format: {exc}") from exc

    try:
        text = csv_bytes.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        records = [dict(row) for row in reader]
    except Exception as exc:
        raise AlertValidationError(f"Invalid CSV file format: {exc}") from exc

    if not records:
        raise AlertValidationError("Uploaded CSV file contains no rows.")

    return records
