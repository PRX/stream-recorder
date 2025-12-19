import { mockSNSPublish } from "../test/support";
import { formatJob, startRecording } from "./sns";

describe("sns", () => {
  const rec = {
    podcastId: 123,
    id: 456,
    hour: new Date("2025-12-09T21:00:00Z"),
    start: new Date("2025-12-09T20:55:00Z"),
    stop: new Date("2025-12-09T22:05:00Z"),
    key: "the/path/some-guid.mp3",
    url: "http://some.where/my-stream.mp3",
    callback: "https://sqs.us-east-1.amazonaws.com/1234/my_callback",
  };

  describe("#formatJob", () => {
    it("formats a job for oxbow", () => {
      // process.env.S3_PREFIX = "some/thing";
      const job = formatJob(rec, rec.start);
      expect(job.Job.Id).toEqual("the/path/some-guid.mp3");
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
        ObjectKey: "the/path/some-guid.mp3",
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
      mockSNSPublish((params) => {
        expect(params.TopicArn).toEqual("topic1");
        expect(JSON.parse(params.Message).Job.Id).toEqual("the/path/some-guid.mp3");
      });

      expect(await startRecording(rec, 0, rec.start)).toEqual(0);
    });

    it("can rotate topics", async () => {
      mockSNSPublish((params) => {
        expect(params.TopicArn).toEqual("topic2");
      });

      expect(await startRecording(rec, 1, rec.start)).toEqual(1);
      expect(await startRecording(rec, 3, rec.start)).toEqual(1);
      expect(await startRecording(rec, 5, rec.start)).toEqual(1);
    });

    it("skips recordings we missed", async () => {
      expect(await startRecording(rec, 0, rec.stop)).toEqual(false);
    });
  });
});
