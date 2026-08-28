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

// Ported from care_fe's Utils/utils.ts.
export function formatName(
  user?: {
    first_name?: string;
    last_name?: string;
    prefix?: string | null;
    suffix?: string | null;
    username?: string;
  } | null,
  hidePrefixSuffix = false,
) {
  if (!user) return "-";
  const name = [
    hidePrefixSuffix ? undefined : user.prefix,
    user.first_name,
    user.last_name,
    hidePrefixSuffix ? undefined : user.suffix,
  ]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");
  return name || user.username || "-";
}

/**
 * Patient age for a printed header, ported from care_fe's `formatPatientAge`
 * (abbreviated form, which is what the diagnostic report print view uses).
 *
 * care_fe localizes the unit via i18next `age_*_short` keys; those keys live in the host's
 * locale bundle, not this plug's, so the units are hardcoded English abbreviations here.
 * The age arithmetic itself follows care_fe's bands exactly: years only above 18, years and
 * months from 2, months and days from 1 year, weeks and days from 29 days, days below that.
 */
export function formatPatientAge(patient: {
  date_of_birth?: string | null;
  year_of_birth?: number | null;
  deceased_datetime?: string | null;
}) {
  if (!patient?.date_of_birth && !patient?.year_of_birth) return "-";

  const start = patient.date_of_birth
    ? new Date(patient.date_of_birth)
    : new Date(patient.year_of_birth!, 0, 1);
  const end = patient.deceased_datetime
    ? new Date(patient.deceased_datetime)
    : new Date();

  const totalDays = Math.floor(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  const months = wholeMonthsBetween(start, end);
  const years = Math.floor(months / 12);

  // Without a date of birth a finer breakdown would only be spuriously precise.
  if (!patient.date_of_birth) {
    return `${patient.year_of_birth} (${years}y)`;
  }

  if (years >= 18) return `${years}y`;

  if (years >= 2) {
    const remainingMonths = months - years * 12;
    return remainingMonths === 0
      ? `${years}y`
      : `${years}y ${remainingMonths}mo`;
  }

  if (months >= 12) {
    const afterMonths = new Date(start);
    afterMonths.setMonth(afterMonths.getMonth() + months);
    const remainingDays = Math.floor(
      (end.getTime() - afterMonths.getTime()) / (1000 * 60 * 60 * 24),
    );
    return remainingDays === 0
      ? `${months}mo`
      : `${months}mo ${remainingDays}d`;
  }

  if (totalDays >= 29) {
    const weeks = Math.floor(totalDays / 7);
    const remainingDays = totalDays % 7;
    return remainingDays === 0 ? `${weeks}w` : `${weeks}w ${remainingDays}d`;
  }

  return `${totalDays}d`;
}

function wholeMonthsBetween(start: Date, end: Date) {
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(months, 0);
}
