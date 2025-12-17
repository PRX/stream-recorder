import log from "lambda-log";
import { parse } from "./lib/config";
import { getConfig } from "./lib/http";
import { getProgress, putProgress } from "./lib/s3";
import { startRecording } from "./lib/sns";

const epoch = () => Date.now() / 1000;
const startupTime = () => epoch() - (parseInt(process.env.OXBOW_STARTUP_TIME, 10) || 0);
const wipTime = () => epoch() - (parseInt(process.env.OXBOW_WIP_TIME, 10) || 0);
const startOxbow = async (rec, idx = 0) => {
  const oxbow = await startRecording(rec, idx);
  const pending = epoch();
  await putProgress(rec, { oxbow, pending });
};

/**
 * Figure out what audio streams we should be recording right now, and
 * make sure they're running via Oxbow.
 */
export const handler = async (_event) => {
  const config = await getConfig();
  const recs = parse(config);

  // check/start oxbow recordings
  for (const rec of recs) {
    try {
      const wip = await getProgress(rec);
      if (wip?.pending) {
        handlePending(rec, wip);
      } else if (wip) {
        handleRunning(rec, wip);
      } else {
        handleNew(rec);
      }
    } catch (err) {
      log.error("Recording error!", { error: err, ...rec });
    }
  }
};

/**
 * We kicked off an oxbow, but the ffmpeg recording hasn't started. If it seems
 * like it won't start, kick off another one.
 */
async function handlePending(rec, wip) {
  if (wip.pending > startupTime()) {
    log.info("Recording pending", { ...rec, wip });
  } else {
    if (rec.hour < new Date()) {
      log.error("Recording lapsed", { ...rec, wip });
    } else {
      log.warn("Recording delayed", { ...rec, wip });
    }
    const idx = parseInt(wip.oxbow, 10);
    const nextIdx = Number.isNaN(idx) ? 0 : idx + 1;
    await startOxbow(rec, nextIdx);
  }
}

/**
 * Oxbow has at least started recording, so check the heartbeat .wip timestamp
 */
async function handleRunning(rec, wip) {
  if (wip.now >= wipTime()) {
    log.info("Recording running", { ...rec, wip });
  } else {
    log.error("Recording restart", { ...rec, wip });
    await startOxbow(rec);
  }
}

/**
 * No executions have started yet
 */
async function handleNew(rec) {
  if (rec.hour < new Date()) {
    log.info("Recording partial", rec);
  } else {
    log.info("Recording start", rec);
  }
  await startOxbow(rec);
}
