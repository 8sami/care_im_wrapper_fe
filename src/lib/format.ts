import { format } from "date-fns";

// Ported from care_fe's Utils/utils.ts, swapped from dayjs to date-fns
// (this plugin's date library).
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

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
const SECONDS_PER_MONTH = 30 * SECONDS_PER_DAY;
const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;

// Ordered coarsest-threshold-first; the final entry has no upper limit so every
// duration resolves within the table. Deliberately compact and non-localized -- see below.
const RELATIVE_UNITS = [
  {
    limitSeconds: SECONDS_PER_HOUR,
    divisorSeconds: SECONDS_PER_MINUTE,
    suffix: "m",
  },
  {
    limitSeconds: SECONDS_PER_DAY,
    divisorSeconds: SECONDS_PER_HOUR,
    suffix: "h",
  },
  {
    limitSeconds: SECONDS_PER_MONTH,
    divisorSeconds: SECONDS_PER_DAY,
    suffix: "d",
  },
  {
    limitSeconds: SECONDS_PER_YEAR,
    divisorSeconds: SECONDS_PER_MONTH,
    suffix: "mo",
  },
  { limitSeconds: Infinity, divisorSeconds: SECONDS_PER_YEAR, suffix: "y" },
] as const;

// Compact relative time ("2h", "1d") for narrow table rows. Intentionally not localized --
// date-fns's localized form ("2 hours ago") doesn't fit these columns.
export function formatRelativeTime(date: DateLike) {
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(date).getTime()) / 1000),
  );
  if (seconds < SECONDS_PER_MINUTE) return "now";
  for (const { limitSeconds, divisorSeconds, suffix } of RELATIVE_UNITS) {
    if (seconds < limitSeconds) {
      return `${Math.floor(seconds / divisorSeconds)}${suffix}`;
    }
  }
  return `${Math.floor(seconds / SECONDS_PER_YEAR)}y`;
}
