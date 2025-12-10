// helpers to parse envs
const bufferStart = () => (parseInt(process.env.BUFFER_START, 10) || 0) * 1000;
const bufferEnd = () => (parseInt(process.env.BUFFER_END, 10) || 0) * 1000;

// camelcase keys
const camelcase = (obj) =>
  Object.entries(obj).reduce((acc, [key, val]) => {
    acc[key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] = val;
    return acc;
  }, {});

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
    const start = new Date(hour.getTime() - bufferStart());
    const stop = new Date(hour.getTime() + bufferEnd());
    return { ...camelcase(cfg), hour, start, stop };
  });
}

/**
 * What possible hours should we be recording right now?
 */
export function hours(now = new Date()) {
  const h1 = new Date(now.getTime() - bufferEnd());
  h1.setUTCMilliseconds(0);
  h1.setUTCSeconds(0);
  h1.setUTCMinutes(0);
  const h2 = new Date(h1);
  h2.setUTCHours(h1.getUTCHours() + 1);

  // only return 2 hours if we're in the buffer period
  const nowBuffer = new Date(now.getTime() + bufferStart());
  if (h2 <= nowBuffer) {
    return [h1, h2];
  } else {
    return [h1];
  }
}
