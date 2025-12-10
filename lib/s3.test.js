import { path } from "./s3";

describe("s3", () => {
  describe("#path", () => {
    it("returns the S3 path for a recording", async () => {
      const rec = { podcastId: 123, id: 456, hour: new Date("2025-12-09T21:00:00Z") };
      expect(path(rec)).toEqual("123/456/2025-12-09/21");

      process.env.S3_PREFIX = "some/thing";
      expect(path(rec)).toEqual("some/thing/123/456/2025-12-09/21");
    });
  });
});
