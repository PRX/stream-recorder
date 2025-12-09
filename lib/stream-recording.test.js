import StreamRecording from "./stream-recording";

describe("stream-recording", () => {
  describe("#path", () => {
    it("returns the S3 path", async () => {
      const rec = new StreamRecording({ podcast_id: 123, id: 456 });
      const now = new Date("2025-12-09T21:59:19Z");
      expect(rec.path(now)).toEqual("123/456/2025-12-09/21");

      process.env.S3_PREFIX = "some/thing";
      expect(rec.path(now)).toEqual("some/thing/123/456/2025-12-09/21");
    });
  });

  describe("#isScheduled", () => {
    it("checks start dates", async () => {
      const rec = new StreamRecording({ start_date: "2025-12-10" });
      expect(rec.isScheduled(new Date("2025-12-09T21:59:19Z"))).toEqual(false);
      expect(rec.isScheduled(new Date("2025-12-09T23:59:59Z"))).toEqual(false);
      expect(rec.isScheduled(new Date("2025-12-10T00:00:00Z"))).toEqual(true);
      expect(rec.isScheduled(new Date("2025-12-11T00:00:00Z"))).toEqual(true);
    });

    it("checks end dates", async () => {
      const rec = new StreamRecording({ end_date: "2025-12-10" });
      expect(rec.isScheduled(new Date("2025-12-10T21:59:19Z"))).toEqual(true);
      expect(rec.isScheduled(new Date("2025-12-10T23:59:59Z"))).toEqual(true);
      expect(rec.isScheduled(new Date("2025-12-11T00:00:00Z"))).toEqual(false);
      expect(rec.isScheduled(new Date("2025-12-12T00:00:00Z"))).toEqual(false);
    });

    it("checks weekdays", async () => {
      const rec = new StreamRecording({ record_days: [0, 2, 6] });
      expect(rec.isScheduled(new Date("2025-12-07T12:34:56Z"))).toEqual(true);
      expect(rec.isScheduled(new Date("2025-12-08T12:34:56Z"))).toEqual(false);
      expect(rec.isScheduled(new Date("2025-12-09T12:34:56Z"))).toEqual(true);
      expect(rec.isScheduled(new Date("2025-12-10T12:34:56Z"))).toEqual(false);
      expect(rec.isScheduled(new Date("2025-12-11T12:34:56Z"))).toEqual(false);
      expect(rec.isScheduled(new Date("2025-12-12T12:34:56Z"))).toEqual(false);
      expect(rec.isScheduled(new Date("2025-12-13T12:34:56Z"))).toEqual(true);
      expect(rec.isScheduled(new Date("2025-12-14T12:34:56Z"))).toEqual(true);
    });

    it("checks hours of the day", async () => {
      const rec = new StreamRecording({ record_hours: [0, 2, 14, 23] });
      expect(rec.isScheduled(new Date("2025-12-09T00:34:56Z"))).toEqual(true);
      expect(rec.isScheduled(new Date("2025-12-09T01:34:56Z"))).toEqual(false);
      expect(rec.isScheduled(new Date("2025-12-09T02:34:56Z"))).toEqual(true);
      expect(rec.isScheduled(new Date("2025-12-09T13:34:56Z"))).toEqual(false);
      expect(rec.isScheduled(new Date("2025-12-09T14:34:56Z"))).toEqual(true);
      expect(rec.isScheduled(new Date("2025-12-09T15:34:56Z"))).toEqual(false);
      expect(rec.isScheduled(new Date("2025-12-09T22:34:56Z"))).toEqual(false);
      expect(rec.isScheduled(new Date("2025-12-09T23:34:56Z"))).toEqual(true);
      expect(rec.isScheduled(new Date("2025-12-10T00:00:00Z"))).toEqual(true);
    });
  });
});
