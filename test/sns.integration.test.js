import { exec } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { jest } from "@jest/globals";
import { parse } from "../lib/config";
import { path } from "../lib/s3";
import { startRecording } from "../lib/sns";

const client = new S3Client();

// waiting for oxbow is slooooow
jest.setTimeout(120 * 1000);

describe("sns integration", () => {
  it("triggers oxbow", async () => {
    const rec = parse([{ podcastId: 99, id: 88, url: process.env.TEST_STREAM_URL }])[0];
    const key = `${path(rec)}/${rec.filename}`;

    // do a short 8 second recording
    rec.stop = new Date(Date.now() + 8000);
    expect(await startRecording(rec)).toEqual(true);

    // wait for the mp3 to show up
    let mp3 = null;
    while (!mp3) {
      try {
        const cmd = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key });
        const res = await client.send(cmd);
        mp3 = await res.Body.transformToByteArray();
      } catch (_err) {}
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
    const cmd = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: `${key}.wip` });
    const res = await client.send(cmd);
    const wip = JSON.parse(await res.Body.transformToString());
    expect(wip.elapsed_seconds).toBeGreaterThan(4);
    expect(wip.elapsed_seconds).toBeLessThan(9);
  });
});
