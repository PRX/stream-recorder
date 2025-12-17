import "aws-sdk-client-mock-jest";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { mockClient } from "aws-sdk-client-mock";
import { formatJob, startRecording } from "./sns";

const snsMock = mockClient(SNSClient);

describe("sns", () => {
  const rec = {
    podcastId: 123,
    id: 456,
    gid: "gid://feeder/StreamRecording/456",
    hour: new Date("2025-12-09T21:00:00Z"),
    start: new Date("2025-12-09T20:55:00Z"),
    stop: new Date("2025-12-09T22:05:00Z"),
    filename: "some-guid.mp3",
    url: "http://some.where/my-stream.mp3",
    callback: "https://sqs.us-east-1.amazonaws.com/1234/my_callback",
  };

  describe("#formatJob", () => {
    it("formats a job for oxbow", () => {
      const job = formatJob(rec, rec.start);
      expect(job.Job.Id).toEqual(rec.gid);
      expect(job.Job.Tasks).toHaveLength(1);
      expect(job.Job.Callbacks).toHaveLength(1);

      // records 70 minutes = 4200 seconds
      const ffmpeg = job.Job.Tasks[0].FFmpeg;
      expect(ffmpeg.Inputs).toEqual(`-t 4200 -i "${rec.url}"`);

      expect(ffmpeg.Outputs).toHaveLength(1);
      expect(ffmpeg.Outputs[0].Format).toEqual("mp3");
      expect(ffmpeg.Outputs[0].Destination).toEqual({
        Mode: "AWS/S3",
        BucketName: "my-bucket",
        ObjectKey: "123/456/2025-12-09/21/some-guid.mp3",
      });

      expect(job.Job.Callbacks[0]).toEqual({
        Type: "AWS/SQS",
        Queue: "https://sqs.us-east-1.amazonaws.com/1234/my_callback",
      });
    });

    it("records longer if we start early", () => {
      const now = new Date(rec.start.getTime() - 12 * 1000);
      const job = formatJob(rec, now);

      // add 12 seconds
      const ffmpeg = job.Job.Tasks[0].FFmpeg;
      expect(ffmpeg.Inputs).toEqual(`-t 4212 -i "${rec.url}"`);
    });

    it("records shorter if we start late", () => {
      const now = new Date(rec.start.getTime() + 5 * 1000);
      const job = formatJob(rec, now);

      // subtract 5 seconds
      const ffmpeg = job.Job.Tasks[0].FFmpeg;
      expect(ffmpeg.Inputs).toEqual(`-t 4195 -i "${rec.url}"`);
    });

    it("returns null if we missed it", () => {
      expect(formatJob(rec, rec.stop)).toBeNull();
      expect(formatJob(rec, new Date(rec.stop.getTime() + 1000))).toBeNull();
      expect(formatJob(rec, new Date(rec.stop.getTime() - 1))).not.toBeNull();
    });
  });

  describe("#startRecording", () => {
    it("starts an oxbow job", async () => {
      const publish = async (params) => {
        expect(params.TopicArn).toEqual("topic1");
        expect(JSON.parse(params.Message).Job.Id).toEqual("gid://feeder/StreamRecording/456");
      };
      snsMock.on(PublishCommand).callsFake(publish);

      expect(await startRecording(rec, rec.start)).toEqual(true);
    });

    it("skips recordings we missed", async () => {
      expect(await startRecording(rec, rec.stop)).toEqual(false);
    });
  });
});
