import log from "lambda-log";

// Intl.DateTime settings
const locale = "en-US";
const weekday = "long";
const hour = "numeric";
const hourCycle = "h24";

// convert weekday names to integers (same as "getUTCDay")
const wdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Return the weekday index in a timezone
 */
export function timezoneDay(date, timeZone = null) {
  if (!timeZone) {
    return date.getUTCDay();
  }

  try {
    const str = date.toLocaleString(locale, { timeZone, weekday });
    return wdays.indexOf(str);
  } catch (err) {
    log.warn("Unsupported timezone", { date, timeZone, err });
    return date.getUTCDay();
  }
}

// try to extract the hour in a timezone
export function timezoneHours(date, timeZone = null) {
  if (!timeZone) {
    return date.getUTCHours();
  }

  try {
    const str = date.toLocaleString("en-US", { timeZone, hour, hourCycle });
    return parseInt(str, 10) % 24;
  } catch (err) {
    log.warn("Unsupported timezone", { date, timeZone, err });
    return date.getUTCHours();
  }
}
