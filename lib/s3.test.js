import "aws-sdk-client-mock-jest";
import { Readable } from "node:stream";
import { GetObjectCommand, ListObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { jest } from "@jest/globals";
import { sdkStreamMixin } from "@smithy/util-stream";
import { mockClient } from "aws-sdk-client-mock";
import log from "lambda-log";
import { getProgress, path } from "./s3";

const s3Mock = mockClient(S3Client);
const makeStream = (str) => {
  const stream = new Readable();
  stream.push(str);
  stream.push(null);
  return sdkStreamMixin(stream);
};

describe("s3", () => {
  const rec = { podcastId: 123, id: 456, hour: new Date("2025-12-09T21:00:00Z") };

  describe("#path", () => {
    it("returns the S3 path for a recording", async () => {
      expect(path(rec)).toEqual("123/456/2025-12-09/21");

      process.env.S3_PREFIX = "some/thing";
      expect(path(rec)).toEqual("some/thing/123/456/2025-12-09/21");
    });
  });

  describe("getProgress", () => {
    it("looks for s3 recording in progress files", async () => {
      const listObjects = async (params) => {
        expect(params.Bucket).toEqual("my-bucket");
        expect(params.Prefix).toEqual("123/456/2025-12-09/21");
        return { Contents: [] };
      };
      s3Mock.on(ListObjectsCommand).callsFake(listObjects);

      expect(await getProgress(rec)).toBeNull();
    });

    it("returns the most recent wip file", async () => {
      const Contents = [
        { Key: "the/path/1.mp3.wip", LastModified: new Date(1000) },
        { Key: "the/path/2.whatevr", LastModified: new Date(9000) },
        { Key: "the/path/3.aac.wip", LastModified: new Date(8000) },
        { Key: "the/path/4.ogg.wip", LastModified: new Date(7000) },
      ];
      s3Mock.on(ListObjectsCommand).resolves({ Contents });

      const getObject = async (params) => {
        expect(params.Bucket).toEqual("my-bucket");
        expect(params.Key).toEqual("the/path/3.aac.wip");
        return { Body: makeStream('{"some":"json"}') };
      };
      s3Mock.on(GetObjectCommand).callsFake(getObject);

      expect(await getProgress(rec)).toEqual({ some: "json" });
    });

    it("uses file size as the tiebreaker", async () => {
      const Contents = [
        { Key: "the/path/1.mp3.wip", LastModified: new Date(1000), Size: 10 },
        { Key: "the/path/2.whatevr", LastModified: new Date(1000), Size: 90 },
        { Key: "the/path/3.aac.wip", LastModified: new Date(1000), Size: 80 },
        { Key: "the/path/4.ogg.wip", LastModified: new Date(1000), Size: 70 },
      ];
      s3Mock.on(ListObjectsCommand).resolves({ Contents });

      const getObject = async (params) => {
        expect(params.Bucket).toEqual("my-bucket");
        expect(params.Key).toEqual("the/path/3.aac.wip");
        return { Body: makeStream('{"some":"json"}') };
      };
      s3Mock.on(GetObjectCommand).callsFake(getObject);

      expect(await getProgress(rec)).toEqual({ some: "json" });
    });

    it("logs json decode errors", async () => {
      const spy = jest.spyOn(log, "error").mockImplementation();

      const Contents = [{ Key: "the/path/1.mp3.wip" }];
      s3Mock.on(ListObjectsCommand).resolves({ Contents });
      s3Mock.on(GetObjectCommand).resolves({ Body: makeStream("{not json") });

      expect(await getProgress(rec)).toBeNull();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toMatch("JSON parse error");
    });
  });
});
