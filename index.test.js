import { jest } from "@jest/globals";
import log from "lambda-log";
import nock from "nock";
import { handler } from "./index";
import { clearCache } from "./lib/http";
import { mockS3Get, mockS3List, mockS3Put, mockSNSPublish } from "./test/support";

const cfg = [
  {
    id: 2,
    gid: "gid://feeder/StreamRecording/2",
    podcast_id: 1,
    url: "http://some/stream/url.mp3",
    callback: "https://some-sqs-url",
  },
];

function mockTime(str) {
  const now = new Date(str);
  jest.useFakeTimers({ advanceTimers: true }).setSystemTime(now);
  return Math.floor(now.getTime() / 1000.0);
}

describe("index", () => {
  beforeEach(() => {
    clearCache();
    nock("http://my.config").get("/streams.json").reply(200, JSON.stringify(cfg));
    info = jest.spyOn(log, "info").mockImplementation();
    warn = jest.spyOn(log, "warn").mockImplementation();
    error = jest.spyOn(log, "error").mockImplementation();
    process.env.BUFFER_START = 120;
    process.env.BUFFER_END = 60;
  });

  describe(".handler", () => {
    it("starts oxbow recordings", async () => {
      const epoch = mockTime("2025-12-09T21:58Z");
      mockS3List({});
      mockS3Put((params) => {
        expect(params.Bucket).toEqual("my-bucket");
        expect(params.Key).toMatch("1/2/2025-12-09/22/");
        expect(params.Key).toMatch(".mp3.wip");
        expect(JSON.parse(params.Body).oxbow).toEqual(0);
        expect(JSON.parse(params.Body).pending).toBeGreaterThanOrEqual(epoch);
        expect(JSON.parse(params.Body).pending).toBeLessThanOrEqual(epoch + 1);
      });
      mockSNSPublish((params) => {
        expect(params.TopicArn).toEqual("topic1");
        expect(params.Message).toMatch(`-t ${3600 + 120 + 60}`);
        expect(params.Message).toMatch("http://some/stream/url.mp3");
        expect(params.Message).toMatch('"Queue":"https://some-sqs-url"');
      });

      await handler();
      expect(error.mock.calls).toEqual([]);
      expect(warn.mock.calls).toEqual([]);
      expect(info).toHaveBeenCalledTimes(1);
      expect(info.mock.calls[0][0]).toEqual("Recording start");
    });

    it("starts partial oxbow recordings", async () => {
      mockTime("2025-12-09T23:30Z");
      mockS3List({});
      mockS3Put((params) => {
        expect(params.Key).toMatch("1/2/2025-12-09/23/");
      });
      mockSNSPublish((params) => {
        expect(params.TopicArn).toEqual("topic1");
        expect(params.Message).toMatch(`-t ${1800 + 60}`);
      });

      await handler();
      expect(error.mock.calls).toEqual([]);
      expect(warn.mock.calls).toEqual([]);
      expect(info).toHaveBeenCalledTimes(1);
      expect(info.mock.calls[0][0]).toEqual("Recording partial");
    });

    it("logs running recordings", async () => {
      const epoch = mockTime("2025-12-09T21:58Z");
      mockS3List({ Contents: [{ Key: "1/2/2025-12-09/22/foo.mp3.wip" }] });
      mockS3Get({ Body: `{"now":${epoch - 5}}` });
      mockSNSPublish(() => {
        throw new Error("Should not have published");
      });

      await handler();
      expect(error.mock.calls).toEqual([]);
      expect(warn.mock.calls).toEqual([]);
      expect(info).toHaveBeenCalledTimes(1);
      expect(info.mock.calls[0][0]).toEqual("Recording running");
    });

    it("restarts stopped recordings", async () => {
      const epoch = mockTime("2025-12-09T22:30Z");
      mockS3List({ Contents: [{ Key: "1/2/2025-12-09/22/foo.mp3.wip" }] });
      mockS3Get({ Body: `{"now":${epoch - 120}}` });
      mockS3Put((params) => {
        expect(params.Key).toMatch("1/2/2025-12-09/22/");
      });
      mockSNSPublish((params) => {
        expect(params.TopicArn).toEqual("topic1");
        expect(params.Message).toMatch(`-t ${1800 + 60}`);
      });

      await handler();
      expect(error.mock.calls.length).toEqual(1);
      expect(error.mock.calls[0][0]).toEqual("Recording restart");
      expect(warn.mock.calls).toEqual([]);
      expect(info.mock.calls).toEqual([]);
    });

    it("logs pending recordings", async () => {
      const epoch = mockTime("2025-12-09T21:58Z");
      mockS3List({ Contents: [{ Key: "1/2/2025-12-09/22/foo.mp3.wip" }] });
      mockS3Get({ Body: `{"pending":${epoch - 5}}` });
      mockSNSPublish(() => {
        throw new Error("Should not have published");
      });

      await handler();
      expect(error.mock.calls).toEqual([]);
      expect(warn.mock.calls).toEqual([]);
      expect(info).toHaveBeenCalledTimes(1);
      expect(info.mock.calls[0][0]).toEqual("Recording pending");
    });

    it("restarts delayed recordings", async () => {
      const epoch = mockTime("2025-12-09T21:59Z");
      mockS3List({ Contents: [{ Key: "1/2/2025-12-09/22/foo.mp3.wip" }] });
      mockS3Get({ Body: `{"pending":${epoch - 120},"oxbow":0}` });
      mockS3Put((params) => {
        expect(params.Key).toMatch("1/2/2025-12-09/22/");
        expect(JSON.parse(params.Body).oxbow).toEqual(1);
      });
      mockSNSPublish((params) => {
        expect(params.TopicArn).toEqual("topic2");
        expect(params.Message).toMatch(`-t ${3600 + 60 + 60}`);
      });

      await handler();
      expect(error.mock.calls).toEqual([]);
      expect(warn.mock.calls.length).toEqual(1);
      expect(warn.mock.calls[0][0]).toEqual("Recording delayed");
      expect(info.mock.calls).toEqual([]);
    });

    it("restarts lapsed recordings", async () => {
      const epoch = mockTime("2025-12-09T22:10Z");
      mockS3List({ Contents: [{ Key: "1/2/2025-12-09/22/foo.mp3.wip" }] });
      mockS3Get({ Body: `{"pending":${epoch - 120}}` });
      mockS3Put((params) => {
        expect(params.Key).toMatch("1/2/2025-12-09/22/");
      });
      mockSNSPublish((params) => {
        expect(params.TopicArn).toEqual("topic1");
        expect(params.Message).toMatch(`-t ${3600 - 600 + 60}`);
      });

      await handler();
      expect(error.mock.calls.length).toEqual(1);
      expect(error.mock.calls[0][0]).toEqual("Recording lapsed");
      expect(warn.mock.calls).toEqual([]);
      expect(info.mock.calls).toEqual([]);
    });
  });
});
