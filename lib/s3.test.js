import { jest } from "@jest/globals";
import log from "lambda-log";
import { mockS3Get, mockS3List, mockS3Put } from "../test/support";
import { getProgress, key, path, putProgress, wip } from "./s3";

describe("s3", () => {
  const rec = {
    podcastId: 123,
    id: 456,
    hour: new Date("2025-12-09T21:00:00Z"),
    filename: "foo.bar",
  };

  describe("#path", () => {
    it("returns the S3 path for a recording", () => {
      expect(path(rec)).toEqual("123/456/2025-12-09/21");

      process.env.S3_PREFIX = "some/thing";
      expect(path(rec)).toEqual("some/thing/123/456/2025-12-09/21");
    });
  });

  describe("#key", () => {
    it("returns the S3 key for a recording", () => {
      expect(key(rec)).toEqual("123/456/2025-12-09/21/foo.bar");

      process.env.S3_PREFIX = "some/thing";
      expect(key(rec)).toEqual("some/thing/123/456/2025-12-09/21/foo.bar");
    });
  });

  describe("#wip", () => {
    it("returns the S3 key for a wip", () => {
      expect(wip(rec)).toEqual("123/456/2025-12-09/21/foo.bar.wip");

      process.env.S3_PREFIX = "some/thing";
      expect(wip(rec)).toEqual("some/thing/123/456/2025-12-09/21/foo.bar.wip");
    });
  });

  describe("getProgress", () => {
    it("looks for s3 recording in progress files", async () => {
      mockS3List((params) => {
        expect(params.Bucket).toEqual("my-bucket");
        expect(params.Prefix).toEqual("123/456/2025-12-09/21");
        return { Contents: [] };
      });

      expect(await getProgress(rec)).toBeNull();
    });

    it("returns the most recent wip file", async () => {
      const Contents = [
        { Key: "the/path/1.mp3.wip", LastModified: new Date(1000) },
        { Key: "the/path/2.whatevr", LastModified: new Date(9000) },
        { Key: "the/path/3.aac.wip", LastModified: new Date(8000) },
        { Key: "the/path/4.ogg.wip", LastModified: new Date(7000) },
      ];
      mockS3List({ Contents });

      mockS3Get((params) => {
        expect(params.Bucket).toEqual("my-bucket");
        expect(params.Key).toEqual("the/path/3.aac.wip");
        return { Body: '{"some":"json"}' };
      });

      expect(await getProgress(rec)).toEqual({ some: "json" });
    });

    it("uses file size as the tiebreaker", async () => {
      const Contents = [
        { Key: "the/path/1.mp3.wip", LastModified: new Date(1000), Size: 10 },
        { Key: "the/path/2.whatevr", LastModified: new Date(1000), Size: 90 },
        { Key: "the/path/3.aac.wip", LastModified: new Date(1000), Size: 80 },
        { Key: "the/path/4.ogg.wip", LastModified: new Date(1000), Size: 70 },
      ];
      mockS3List({ Contents });

      mockS3Get((params) => {
        expect(params.Bucket).toEqual("my-bucket");
        expect(params.Key).toEqual("the/path/3.aac.wip");
        return { Body: '{"some":"json"}' };
      });

      expect(await getProgress(rec)).toEqual({ some: "json" });
    });

    it("logs json decode errors", async () => {
      const spy = jest.spyOn(log, "error").mockImplementation();

      const Contents = [{ Key: "the/path/1.mp3.wip" }];
      mockS3List({ Contents });
      mockS3Get({ Body: "{not json" });

      expect(await getProgress(rec)).toBeNull();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toMatch("JSON parse error");
    });
  });

  describe("putProgress", () => {
    it("writes an s3 progress file", async () => {
      mockS3Put((params) => {
        expect(params.Bucket).toEqual("my-bucket");
        expect(params.Key).toEqual("123/456/2025-12-09/21/foo.bar.wip");
        expect(params.Body).toEqual('{"hello":"world"}');
      });

      await putProgress(rec, { hello: "world" });
    });
  });
});
