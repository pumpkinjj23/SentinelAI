/**
 * Formats any ISO / SQLite UTC / Date input into Thailand local time (Asia/Bangkok, UTC+7)
 * in clean 24-hour format WITHOUT seconds (e.g., "25/11/2569 10:33 น.").
 *
 * Also fixes naive UTC timestamps from SQLite ("2026-11-25T03:33:10.123456")
 * by appending "Z" so JavaScript converts UTC 03:33 -> 10:33 Thailand time properly.
 */
export function formatThaiDateTime(input?: string | Date | null): string {
  if (!input) return '-';

  let dateObj: Date;
  if (input instanceof Date) {
    dateObj = input;
  } else {
    const raw = String(input).trim();
    // If ISO-like timestamp lacks timezone offset ('Z' or '+/-HH:MM'), treat as UTC
    const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/i.test(raw);
    const normalized =
      !hasTimezone && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw)
        ? `${raw.replace(' ', 'T')}Z`
        : raw;
    dateObj = new Date(normalized);
  }

  if (isNaN(dateObj.getTime())) {
    return String(input);
  }

  const formatted = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(dateObj);

  return `${formatted.replace(',', '')} น.`;
}
