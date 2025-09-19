const LOCALE = "ko-KR";
const TIME_ZONE = "Asia/Seoul";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

type FormatDateTimeOptions = Pick<Intl.DateTimeFormatOptions, "dateStyle" | "timeStyle">;

const DEFAULT_OPTIONS: FormatDateTimeOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

function getFormatter(options: FormatDateTimeOptions) {
  const key = `${options.dateStyle ?? ""}|${options.timeStyle ?? ""}`;
  const cached = formatterCache.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    ...options,
  });

  formatterCache.set(key, formatter);
  return formatter;
}

export function formatDateTime(
  date: Date,
  options: FormatDateTimeOptions = DEFAULT_OPTIONS,
): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return getFormatter(options).format(date);
}
