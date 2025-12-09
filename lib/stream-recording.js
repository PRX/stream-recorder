const parseDate = (str, offsetDays = 0) => {
  if (str) {
    const date = new Date(`${str}T00:00:00Z`);
    date.setDate(date.getDate() + offsetDays);
    return date;
  } else {
    return null;
  }
};

export default class StreamRecording {
  constructor(config = {}) {
    this.id = config.id;
    this.gid = config.gid;
    this.podcastId = config.podcast_id;
    this.url = config.url;
    this.startDate = parseDate(config.start_date);
    this.endDate = parseDate(config.end_date, 1);
    this.recordDays = config.record_days;
    this.recordHours = config.record_hours;
    this.callback = config.callback;
  }

  duration() {
    return 3600 * 1000;
  }

  bufferStart() {
    return (parseInt(process.env.BUFFER_START, 10) || 0) * 1000;
  }

  bufferEnd() {
    return (parseInt(process.env.BUFFER_END, 10) || 0) * 1000;
  }

  path(now = new Date()) {
    const pre = process.env.S3_PREFIX;
    const str = now.toISOString();
    const day = str.substr(0, 10);
    const hour = str.substr(11, 2);
    return [pre, this.podcastId, this.id, day, hour].filter((v) => v).join("/");
  }

  isScheduled(now = new Date(), bs = this.bufferStart(), be = this.bufferEnd()) {
    // TODO: is this even the right place to apply these?
    const _startAt = new Date(now.getTime() - bs * 1000);
    const _endAt = new Date(now.getTime() + be * 1000);

    if (this.startDate && now < this.startDate) {
      return false;
    } else if (this.endDate && now >= this.endDate) {
      return false;
    } else if (this.recordDays && !this.recordDays.includes(now.getUTCDay())) {
      return false;
    } else if (this.recordHours && !this.recordHours.includes(now.getUTCHours())) {
      return false;
    }

    return true;
  }
}
