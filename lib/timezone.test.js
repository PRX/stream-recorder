import { jest } from "@jest/globals";
import log from "lambda-log";
import { timezoneDay, timezoneHours } from "./timezone";

describe("timezone", () => {
  describe("#timezoneDay", () => {
    it("returns UTC weekdays", () => {
      expect(timezoneDay(new Date("2026-02-01"))).toEqual(0);
      expect(timezoneDay(new Date("2026-02-02"))).toEqual(1);
      expect(timezoneDay(new Date("2026-02-03"))).toEqual(2);
      expect(timezoneDay(new Date("2026-02-04"))).toEqual(3);
      expect(timezoneDay(new Date("2026-02-05"))).toEqual(4);
      expect(timezoneDay(new Date("2026-02-06"))).toEqual(5);
      expect(timezoneDay(new Date("2026-02-07"))).toEqual(6);
      expect(timezoneDay(new Date("2026-02-08"))).toEqual(0);
      expect(timezoneDay(new Date("2026-02-09"))).toEqual(1);
    });

    it("returns weekday numbers in a timezone", () => {
      const tz1 = "America/Denver";
      expect(timezoneDay(new Date("2026-02-01"), tz1)).toEqual(6);
      expect(timezoneDay(new Date("2026-02-02"), tz1)).toEqual(0);
      expect(timezoneDay(new Date("2026-02-08"), tz1)).toEqual(6);
      expect(timezoneDay(new Date("2026-02-09"), tz1)).toEqual(0);

      // denver is UTC-7
      expect(timezoneDay(new Date("2026-02-01T06:59Z"), tz1)).toEqual(6);
      expect(timezoneDay(new Date("2026-02-01T07:00Z"), tz1)).toEqual(0);

      // paris is UTC+1
      const tz2 = "Europe/Paris";
      expect(timezoneDay(new Date("2026-01-31T22:59Z"), tz2)).toEqual(6);
      expect(timezoneDay(new Date("2026-01-31T23:00Z"), tz2)).toEqual(0);
      expect(timezoneDay(new Date("2026-02-01T23:00Z"), tz2)).toEqual(1);
    });

    it("handles unknown timezones", () => {
      const warn = jest.spyOn(log, "warn").mockImplementation();

      const tz = "America/Blenver";
      expect(timezoneDay(new Date("2026-02-01"), tz)).toEqual(0);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toEqual("Unsupported timezone");
    });
  });

  describe("#timezoneHours", () => {
    it("returns UTC hours", () => {
      expect(timezoneHours(new Date("2026-02-02T03:01Z"))).toEqual(3);
      expect(timezoneHours(new Date("2026-02-02T13:01Z"))).toEqual(13);
      expect(timezoneHours(new Date("2026-02-02T23:01Z"))).toEqual(23);
    });

    it("returns hour numbers in a timezone", () => {
      const tz1 = "America/Denver";
      expect(timezoneHours(new Date("2026-02-02T03:01Z"), tz1)).toEqual(20);
      expect(timezoneHours(new Date("2026-02-02T07:01Z"), tz1)).toEqual(0);
      expect(timezoneHours(new Date("2026-02-02T09:01Z"), tz1)).toEqual(2);

      // // on nov 2nd, denver went to UTC-7
      expect(timezoneHours(new Date("2025-11-01T06:01Z"), tz1)).toEqual(0);
      expect(timezoneHours(new Date("2025-11-01T07:01Z"), tz1)).toEqual(1);
      expect(timezoneHours(new Date("2025-11-02T06:01Z"), tz1)).toEqual(0);
      expect(timezoneHours(new Date("2025-11-02T07:01Z"), tz1)).toEqual(1);
      expect(timezoneHours(new Date("2025-11-02T08:01Z"), tz1)).toEqual(1);
      expect(timezoneHours(new Date("2025-11-02T09:01Z"), tz1)).toEqual(2);

      // on march 8th, denver goes back to UTC-6
      expect(timezoneHours(new Date("2026-03-07T06:01Z"), tz1)).toEqual(23);
      expect(timezoneHours(new Date("2026-03-07T07:01Z"), tz1)).toEqual(0);
      expect(timezoneHours(new Date("2026-03-08T06:01Z"), tz1)).toEqual(23);
      expect(timezoneHours(new Date("2026-03-08T07:01Z"), tz1)).toEqual(0);
      expect(timezoneHours(new Date("2026-03-08T08:01Z"), tz1)).toEqual(1);
      expect(timezoneHours(new Date("2026-03-08T09:01Z"), tz1)).toEqual(3);

      // paris is UTC+1
      const tz2 = "Europe/Paris";
      expect(timezoneHours(new Date("2026-02-02T03:01Z"), tz2)).toEqual(4);
      expect(timezoneHours(new Date("2026-02-02T13:01Z"), tz2)).toEqual(14);
      expect(timezoneHours(new Date("2026-02-02T23:01Z"), tz2)).toEqual(0);
    });

    it("handles unknown timezones", () => {
      const warn = jest.spyOn(log, "warn").mockImplementation();

      const tz = "America/Blenver";
      expect(timezoneHours(new Date("2026-02-02T03:01Z"), tz)).toEqual(3);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toEqual("Unsupported timezone");
    });
  });
});
