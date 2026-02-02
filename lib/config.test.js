import { jest } from "@jest/globals";
import log from "lambda-log";
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

    it("handles timezones", () => {
      const recordDays = [0, 2, 6];
      const recordHours = [0, 2, 7, 23];
      const timeZone = "America/Denver";
      const config = { recordDays, recordHours, timeZone };

      // NOTE: denver is UTC-7 in december
      expect(parse([config], new Date("2025-12-09T06:12:34Z"))).toHaveLength(0);
      expect(parse([config], new Date("2025-12-09T07:12:34Z"))).toHaveLength(1);
      expect(parse([config], new Date("2025-12-09T08:12:34Z"))).toHaveLength(0);
      expect(parse([config], new Date("2025-12-09T09:12:34Z"))).toHaveLength(1);
      expect(parse([config], new Date("2025-12-09T14:12:34Z"))).toHaveLength(1);

      // 6:00 hours into 12/10 (monday) is 23:00 hours (sunday) in denver
      expect(parse([config], new Date("2025-12-10T05:12:34Z"))).toHaveLength(0);
      expect(parse([config], new Date("2025-12-10T06:12:34Z"))).toHaveLength(1);
      expect(parse([config], new Date("2025-12-10T07:12:34Z"))).toHaveLength(0);

      // on nov 2nd, denver went to UTC-7
      config.recordDays = null;
      expect(parse([config], new Date("2025-11-01T13:12:34Z"))).toHaveLength(1);
      expect(parse([config], new Date("2025-11-01T14:12:34Z"))).toHaveLength(0);
      expect(parse([config], new Date("2025-11-02T13:12:34Z"))).toHaveLength(0);
      expect(parse([config], new Date("2025-11-02T14:12:34Z"))).toHaveLength(1);

      // on march 8th, denver goes back to UTC-6
      expect(parse([config], new Date("2026-03-07T13:12:34Z"))).toHaveLength(0);
      expect(parse([config], new Date("2026-03-07T14:12:34Z"))).toHaveLength(1);
      expect(parse([config], new Date("2026-03-08T13:12:34Z"))).toHaveLength(1);
      expect(parse([config], new Date("2026-03-08T14:12:34Z"))).toHaveLength(0);
    });

    it("warns on unsupported timezones", () => {
      const timeZone = "America/Blah";
      const config = { timeZone };
      const warn = jest.spyOn(log, "warn").mockImplementation();

      expect(parse([config], new Date("2025-12-09T06:12:34Z"))).toHaveLength(1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toEqual("Unsupported timezone");
    });
  });

  describe("#recordTimes", () => {
    it("combines configs with their hour start/stop times", () => {
      process.env.BUFFER_START = 120;
      process.env.BUFFER_END = 5;

      const rec = {
        podcast_id: 123,
        id: 456,
        url: "http://some/stream/url.flac",
        what_ev: "val",
      };
      const times = recordTimes(rec, new Date("2025-12-09T21:58Z"));
      expect(times.length).toEqual(2);

      expect(times[0].whatEv).toEqual("val");
      expect(times[0].hour).toEqual(new Date("2025-12-09T21:00:00Z"));
      expect(times[0].start).toEqual(new Date("2025-12-09T20:58:00Z"));
      expect(times[0].stop).toEqual(new Date("2025-12-09T22:00:05Z"));
      expect(times[0].key).toMatch(/^123\/456\/2025-12-09T21:00Z\/2025-12-09T22:00Z\//);
      expect(times[0].key).toMatch(/[0-9a-f-]{36}\.flac$/);

      expect(times[1].whatEv).toEqual("val");
      expect(times[1].hour).toEqual(new Date("2025-12-09T22:00:00Z"));
      expect(times[1].start).toEqual(new Date("2025-12-09T21:58:00Z"));
      expect(times[1].stop).toEqual(new Date("2025-12-09T23:00:05Z"));
      expect(times[1].key).toMatch(/^123\/456\/2025-12-09T22:00Z\/2025-12-09T23:00Z\//);
      expect(times[1].key).toMatch(/[0-9a-f-]{36}\.flac$/);

      // filename guids are always different
      const f1 = times[0].key.split("/").pop();
      const f2 = times[1].key.split("/").pop();
      expect(f1).not.toEqual(f2);
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
