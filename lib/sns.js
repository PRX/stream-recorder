import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { key } from "./s3.js";

const requestHandler = new NodeHttpHandler({ connectionTimeout: 1000 });
const client = new SNSClient({ requestHandler });

/**
 * Format an oxbow job for a stream recording
 */
export function formatJob(rec, now = new Date()) {
  if (!rec.url || !rec.stop || rec.stop <= now) {
    return null;
  }

  const duration = Math.round((rec.stop.getTime() - now.getTime()) / 1000);
  const format = (rec.filename || "").split(".")[1] || "mp3";
  const BucketName = process.env.S3_BUCKET;
  const ObjectKey = key(rec);

  return {
    Job: {
      Id: rec.gid || rec.filename,
      Tasks: [
        {
          Type: "FFmpeg",
          FFmpeg: {
            Inputs: `-t ${duration} -i "${rec.url}"`,
            Outputs: [
              {
                Format: format,
                Destination: { Mode: "AWS/S3", BucketName, ObjectKey },
              },
            ],
          },
        },
      ],
      Callbacks: [{ Type: "AWS/SQS", Queue: rec.callback }],
    },
  };
}

/**
 * Start a new oxbow stream recording
 */
export async function startRecording(rec, oxbowIndex = 0, now = new Date()) {
  const job = formatJob(rec, now);
  if (!job) {
    return false;
  }

  const topics = process.env.OXBOW_SNS_TOPICS.split(",");
  const TopicArn = topics[oxbowIndex % topics.length];
  const Message = JSON.stringify(job);
  await client.send(new PublishCommand({ TopicArn, Message }));
  return oxbowIndex % topics.length;
}
