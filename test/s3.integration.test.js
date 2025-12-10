import {
  DeleteObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getProgress, path } from "../lib/s3";

const client = new S3Client();

describe("s3 integration", () => {
  const hour = new Date("2025-12-09T21:00:00Z");
  const rec = { id: 456, podcastId: 123, hour };
  const Bucket = process.env.S3_BUCKET;
  const Prefix = path(rec);

  beforeEach(async () => {
    const res = await client.send(new ListObjectsCommand({ Bucket, Prefix }));
    for (const { Key } of res.Contents || []) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: Key }));
    }
  });

  it("gets the latest wip recording", async () => {
    expect(await getProgress(rec)).toBeNull();

    const b1 = "something non json";
    const b2 = '{"thing":"two"}';
    const b3 = '{"thing":"three"}';

    await client.send(new PutObjectCommand({ Bucket, Body: b1, Key: `${Prefix}/one.flac` }));
    await client.send(new PutObjectCommand({ Bucket, Body: b2, Key: `${Prefix}/two.mp3.wip` }));
    expect(await getProgress(rec)).toEqual({ thing: "two" });

    // send something with LastModified 1 second later - it wins
    await new Promise((r) => setTimeout(r, 1000));
    await client.send(new PutObjectCommand({ Bucket, Body: b3, Key: `${Prefix}/three.aac.wip` }));
    expect(await getProgress(rec)).toEqual({ thing: "three" });
  });
});
