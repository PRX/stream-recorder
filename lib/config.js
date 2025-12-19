import { extname } from "node:path";
import { v4 } from "uuid";

// helpers to parse envs
const bufferStart = () => (parseInt(process.env.BUFFER_START, 10) || 0) * 1000;
const bufferEnd = () => (parseInt(process.env.BUFFER_END, 10) || 0) * 1000;

// camelcase keys
const camelcase = (obj) =>
  Object.entries(obj).reduce((acc, [key, val]) => {
    acc[key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] = val;
    return acc;
  }, {});

// add an hour to a date
const nextHour = (h1) => {
  const h2 = new Date(h1);
  h2.setUTCHours(h1.getUTCHours() + 1);
  return h2;
};

/**
 * Parse stream recording configs, returning all the streams and
 * hours that should be recording right now
 */
export function parse(cfgs = [], now = new Date()) {
  return cfgs.flatMap((cfg) => {
    return recordTimes(cfg, now).filter((rec) => {
      if (rec.startDate) {
        const startDate = new Date(`${rec.startDate}T00:00:00Z`);
        if (rec.hour < startDate) {
          return false;
        }
      }

      if (rec.endDate) {
        const endDate = new Date(`${rec.endDate}T00:00:00Z`);
        endDate.setUTCDate(endDate.getUTCDate() + 1);
        if (rec.hour >= endDate) {
          return false;
        }
      }

      if (rec.recordDays?.length && !rec.recordDays.includes(rec.hour.getUTCDay())) {
        return false;
      }

      if (rec.recordHours?.length && !rec.recordHours.includes(rec.hour.getUTCHours())) {
        return false;
      }

      return true;
    });
  });
}

/**
 * Combine configs and hourly recording start/stop times
 */
export function recordTimes(cfg = {}, now = new Date()) {
  return hours(now).map((hour) => {
    const uuid = v4();

    // add buffers for start/stop times
    const start = new Date(hour.getTime() - bufferStart());
    const stop = new Date(hour.getTime() + 3600 * 1000 + bufferEnd());

    // write to a unique filename (TODO: detect extension/format)
    const ext = extname(cfg.url || "").replace(".", "") || "mp3";
    const filename = `${uuid}.${ext}`;

    // job_id that Feeder can decode to find the stream-recording + time-range
    const podStr = cfg.podcast_id || "_unknown";
    const streamStr = cfg.id || "_unknown";
    const hourStr = hour.toISOString().replace(":00.000Z", "Z");
    const nextStr = nextHour(hour).toISOString().replace(":00.000Z", "Z");
    const key = [podStr, streamStr, hourStr, nextStr, filename].join("/");

    return { ...camelcase(cfg), hour, start, stop, key };
  });
}

/**
 * What possible hours should we be recording right now?
 */
export function hours(now = new Date()) {
  const hours = [];
  const h1 = new Date(now.getTime());
  h1.setUTCMilliseconds(0);
  h1.setUTCSeconds(0);
  h1.setUTCMinutes(0);
  const h2 = nextHour(h1);

  // first hour must have at least buffer seconds left
  if (h2.getTime() - now.getTime() >= bufferStart()) {
    hours.push(h1);
  }

  // second hour must be in its buffer-start period
  const h2Start = new Date(h2.getTime() - bufferStart());
  if (h2Start <= now) {
    hours.push(h2);
  }

  return hours;
}
