import { exec } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { jest } from "@jest/globals";
import { parse } from "../lib/config";
import { path } from "../lib/s3";
import { startRecording } from "../lib/sns";

const s3Client = new S3Client();
const sqsClient = new SQSClient();

// helper to get/delete sqs messages
async function receiveSqsMessages() {
  const QueueUrl = process.env.TEST_SQS_CALLBACK_URL;
  const cmd = new ReceiveMessageCommand({
    QueueUrl,
    MaxNumberOfMessages: 10,
    VisibilityTimeout: 5,
    WaitTimeSeconds: 2,
  });
  let res = await sqsClient.send(cmd);
  const messages = [];
  while (res.Messages?.length) {
    for (const msg of res.Messages) {
      messages.push(JSON.parse(msg.Body));
      const ReceiptHandle = msg.ReceiptHandle;
      await sqsClient.send(new DeleteMessageCommand({ QueueUrl, ReceiptHandle }));
    }
    res = await sqsClient.send(cmd);
  }
  return messages;
}

// waiting for oxbow is slooooow
jest.setTimeout(120 * 1000);

describe("sns integration", () => {
  it.skip("triggers oxbow", async () => {
    const url = process.env.TEST_STREAM_URL;
    const callback = process.env.TEST_SQS_CALLBACK_URL;
    const rec = parse([{ podcastId: 99, id: 88, url, callback }])[0];
    const key = `${path(rec)}/${rec.filename}`;

    // do a short 8 second recording
    const start = Date.now();
    rec.stop = new Date(start + 8000);
    expect(await startRecording(rec)).toEqual(true);

    // wait for the mp3 to show up
    let mp3 = null;
    while (!mp3) {
      try {
        const cmd = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key });
        const res = await s3Client.send(cmd);
        mp3 = await res.Body.transformToByteArray();
      } catch (err) {
        if (err.Code === "NoSuchKey") {
          await new Promise((r) => setTimeout(r, 1000));
        } else {
          throw err;
        }
      }
    }

    // write the mp3 back to disk
    const file = "./tmp/sns-integration-test.mp3";
    try {
      await mkdir(`./tmp`);
    } catch (_err) {}
    await writeFile(file, mp3);

    // ffprobe and check duration
    const opts = "-show_streams -show_format -print_format json";
    const probe = JSON.parse((await promisify(exec)(`ffprobe ${file} ${opts}`)).stdout);
    expect(probe.format.format_name).toEqual("mp3");
    expect(parseFloat(probe.format.duration, 10)).toBeGreaterThanOrEqual(8.0);
    expect(parseFloat(probe.format.duration, 10)).toBeLessThan(9.0);

    // also get the .wip file
    const s3Cmd = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: `${key}.wip` });
    const s3Res = await s3Client.send(s3Cmd);
    const wip = JSON.parse(await s3Res.Body.transformToString());
    expect(wip.start).toBeGreaterThan(start / 1000);
    expect(wip.start).toBeLessThan(Date.now() / 1000);
    expect(wip.now).toBeLessThan(Date.now() / 1000);

    // get the SQS callback messages
    const messages = await receiveSqsMessages();
    const result = messages.find((m) => m.JobResult);
    expect(messages.length).toEqual(3);
    expect(result.JobResult.TaskResults).toHaveLength(1);
    expect(result.JobResult.TaskResults[0].Task).toEqual("FFmpeg");
    expect(result.JobResult.TaskResults[0].FFmpeg.Outputs[0].Duration).toEqual(8000);
    expect(result.JobResult.TaskResults[0].FFmpeg.Outputs[0].StartEpoch).toEqual(wip.start);
  });
});
