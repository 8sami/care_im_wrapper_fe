import { format } from "date-fns";

// Ported from care_fe's Utils/utils.ts, swapped from dayjs to date-fns
// (the plugin's chosen date lib per build-plan Phase 0).
const DATE_FORMAT = "dd/MM/yyyy";
const TIME_FORMAT = "hh:mm a";
const DATE_TIME_FORMAT = `${TIME_FORMAT}; ${DATE_FORMAT}`;

type DateLike = string | number | Date;

export function formatDateTime(date: DateLike, dateFormat?: string) {
  const d = new Date(date);
  if (dateFormat) return format(d, dateFormat);
  const isMidnight =
    d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
  return format(d, isMidnight ? DATE_FORMAT : DATE_TIME_FORMAT);
}

const RELATIVE_UNITS = [
  { limitSeconds: 3600, divisorSeconds: 60, suffix: "m" },
  { limitSeconds: 86400, divisorSeconds: 3600, suffix: "h" },
  { limitSeconds: 2592000, divisorSeconds: 86400, suffix: "d" },
  { limitSeconds: 31536000, divisorSeconds: 2592000, suffix: "mo" },
] as const;

// Compact relative time ("2h", "1d") for table/card rows; pair with a
// formatDateTime tooltip for the absolute timestamp.
export function formatRelativeTime(date: DateLike) {
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(date).getTime()) / 1000),
  );
  if (seconds < 60) return "now";
  for (const { limitSeconds, divisorSeconds, suffix } of RELATIVE_UNITS) {
    if (seconds < limitSeconds) {
      return `${Math.floor(seconds / divisorSeconds)}${suffix}`;
    }
  }
  return `${Math.floor(seconds / 31536000)}y`;
}
