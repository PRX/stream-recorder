import { hours, parse, recordTimes } from "./config";

describe("config", () => {
  describe("#parse", () => {
    it("checks start dates", () => {
      expect(parse([{}], new Date("2025-12-09T21:58Z"))).toHaveLength(1);
      expect(parse([{ startDate: "2025-12-09" }], new Date("2025-12-09T21:58Z"))).toHaveLength(1);
      expect(parse([{ startDate: "2025-12-10" }], new Date("2025-12-09T21:58Z"))).toHaveLength(0);

      // but it COULD start recording before startDate due to a buffer
      process.env.BUFFER_START = 120;
      expect(parse([{ startDate: "2025-12-10" }], new Date("2025-12-09T23:57Z"))).toHaveLength(0);
      expect(parse([{ startDate: "2025-12-10" }], new Date("2025-12-09T23:58Z"))).toHaveLength(1);
    });

    it("checks end dates", () => {
      expect(parse([{ endDate: "2025-12-10" }], new Date("2025-12-09T21:58Z"))).toHaveLength(1);
      expect(parse([{ endDate: "2025-12-09" }], new Date("2025-12-09T21:58Z"))).toHaveLength(1);
      expect(parse([{ endDate: "2025-12-08" }], new Date("2025-12-09T21:58Z"))).toHaveLength(0);
      expect(parse([{ endDate: "2025-12-08" }], new Date("2025-12-09T00:03Z"))).toHaveLength(0);
    });

    it("checks weekdays", () => {
      const recordDays = [0, 2, 6];

      // NOTE: 12/7 is a sunday
      expect(parse([{ recordDays }], new Date("2025-12-07"))).toHaveLength(1);
      expect(parse([{ recordDays }], new Date("2025-12-08"))).toHaveLength(0);
      expect(parse([{ recordDays }], new Date("2025-12-09"))).toHaveLength(1);
      expect(parse([{ recordDays }], new Date("2025-12-10"))).toHaveLength(0);
      expect(parse([{ recordDays }], new Date("2025-12-11"))).toHaveLength(0);
      expect(parse([{ recordDays }], new Date("2025-12-12"))).toHaveLength(0);
      expect(parse([{ recordDays }], new Date("2025-12-13"))).toHaveLength(1);
      expect(parse([{ recordDays }], new Date("2025-12-14"))).toHaveLength(1);
    });

    it("checks hours of the day", () => {
      const recordHours = [0, 2, 14, 23];

      expect(parse([{ recordHours }], new Date("2025-12-09T00:12:34Z"))).toHaveLength(1);
      expect(parse([{ recordHours }], new Date("2025-12-09T01:12:34Z"))).toHaveLength(0);
      expect(parse([{ recordHours }], new Date("2025-12-09T02:12:34Z"))).toHaveLength(1);
      expect(parse([{ recordHours }], new Date("2025-12-09T03:12:34Z"))).toHaveLength(0);
      expect(parse([{ recordHours }], new Date("2025-12-09T14:12:34Z"))).toHaveLength(1);
      expect(parse([{ recordHours }], new Date("2025-12-09T15:12:34Z"))).toHaveLength(0);
      expect(parse([{ recordHours }], new Date("2025-12-09T23:12:34Z"))).toHaveLength(1);

      // works with buffer offset
      expect(parse([{ recordHours }], new Date("2025-12-09T01:59:59Z"))).toHaveLength(0);
      process.env.BUFFER_START = 120;
      expect(parse([{ recordHours }], new Date("2025-12-09T01:59:59Z"))).toHaveLength(1);
    });
  });

  describe("#recordTimes", () => {
    it("combines configs with their hour start/stop times", () => {
      process.env.BUFFER_START = 120;
      process.env.BUFFER_END = 5;

      const url = "http://some/stream/url.flac";
      const times = recordTimes({ what_ev: "val", url }, new Date("2025-12-09T21:58Z"));
      expect(times.length).toEqual(2);

      expect(times[0].whatEv).toEqual("val");
      expect(times[0].hour).toEqual(new Date("2025-12-09T21:00:00Z"));
      expect(times[0].start).toEqual(new Date("2025-12-09T20:58:00Z"));
      expect(times[0].stop).toEqual(new Date("2025-12-09T22:00:05Z"));
      expect(times[0].filename).toMatch(/[0-9a-f-]{36}\.flac/);

      expect(times[1].whatEv).toEqual("val");
      expect(times[1].hour).toEqual(new Date("2025-12-09T22:00:00Z"));
      expect(times[1].start).toEqual(new Date("2025-12-09T21:58:00Z"));
      expect(times[1].stop).toEqual(new Date("2025-12-09T23:00:05Z"));
      expect(times[1].filename).toMatch(/[0-9a-f-]{36}\.flac/);
    });
  });

  describe("#hours", () => {
    it("returns hours we should be recording", () => {
      const h1 = new Date("2025-12-09T21:00Z");
      const h2 = new Date("2025-12-09T22:00Z");

      expect(hours(new Date("2025-12-09T21:00Z"))).toEqual([h1]);
      expect(hours(new Date("2025-12-09T21:59:59Z"))).toEqual([h1]);
      expect(hours(new Date("2025-12-09T22:00:00Z"))).toEqual([h2]);
      expect(hours(new Date("2025-12-09T22:12:34.567Z"))).toEqual([h2]);
    });

    it("applies a start time buffer", () => {
      const h1 = new Date("2025-12-09T21:00Z");
      const h2 = new Date("2025-12-09T22:00Z");

      process.env.BUFFER_START = 120;
      expect(hours(new Date("2025-12-09T21:00Z"))).toEqual([h1]);
      expect(hours(new Date("2025-12-09T21:57:59Z"))).toEqual([h1]);
      expect(hours(new Date("2025-12-09T21:58Z"))).toEqual([h1, h2]);
      expect(hours(new Date("2025-12-09T21:58:01Z"))).toEqual([h2]);
      expect(hours(new Date("2025-12-09T22:00Z"))).toEqual([h2]);
    });
  });
});
