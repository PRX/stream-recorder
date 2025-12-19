import {
  GetObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import log from "lambda-log";

const requestHandler = new NodeHttpHandler({ connectionTimeout: 1000 });
const client = new S3Client({ requestHandler });

/**
 * Return the S3 path we're storing recordings of this hour in
 */
export function path({ key }) {
  const path = key.replace(/\/[^/]*$/, "");
  return process.env.S3_PREFIX ? `${process.env.S3_PREFIX}/${path}` : path;
}

/**
 * The key a recording will be written to
 */
export function key({ key }) {
  return process.env.S3_PREFIX ? `${process.env.S3_PREFIX}/${key}` : key;
}

/**
 * The key a wip will be written to
 */
export function wip(rec) {
  return `${key(rec)}.wip`;
}

/**
 * Look for the latest .wip json file for a recording
 */
export async function getProgress(rec) {
  const Bucket = process.env.S3_BUCKET;
  const Prefix = path(rec);
  const res = await client.send(new ListObjectsCommand({ Bucket, Prefix }));
  const wips = (res.Contents || []).filter((c) => c?.Key?.endsWith(".wip"));

  // find the most recently updated
  const sorted = wips.sort((a, b) => {
    if (a.LastModified > b.LastModified) {
      return -1;
    } else if (a.LastModified < b.LastModified) {
      return 1;
    } else {
      return b.Size - a.Size;
    }
  });
  const recent = sorted[0]?.Key;

  // fetch/decode the most recent, if any
  if (recent) {
    const res2 = await client.send(new GetObjectCommand({ Bucket, Key: recent }));
    const body = await res2.Body.transformToString();
    try {
      return JSON.parse(body);
    } catch (_err) {
      log.error(`JSON parse error: ${body}`);
    }
  }

  return null;
}

/**
 * Write an initial .wip json file for a recording
 */
export async function putProgress(rec, json = {}) {
  const Bucket = process.env.S3_BUCKET;
  const Key = wip(rec);
  const Body = JSON.stringify(json);
  await client.send(new PutObjectCommand({ Bucket, Key, Body }));
}
