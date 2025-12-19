# PRX Stream Recording Orchestrator

AWS Lambda to ensure stream recordings get kicked off.

# Description

Using a configuration file containing a list of stream-urls-to-record-when, ensure that
[Oxbow](https://github.com/PRX/Oxbow/) is running at the correct times and redundancy levels.

The Oxbow task is a simple FFmpeg process in Fargate, which recordings audio to S3 along with
a heartbeat to tell us it's still running.

All callbacks for the Oxbow task are sent back to Feeder. So it can eventually copy/process
the resulting audio file.

<img alt="Stream recording architecture diagram" src="https://raw.githubusercontent.com/PRX/stream-recorder/refs/heads/main/stream-recording-drawio.svg" />

## Stream Configuration

The configuration JSON is written by [Feeder](https://github.com/PRX/feeder.prx.org), must be HTTP accessible,
and has a format something like:

```json
[
  {
    "podcast_id": 123,
    "id": 456,
    "url": "http://some.stream/url.mp3",
    "start_date": "2025-12-17",
    "end_date": null,
    "record_days": [0, 3, 5],
    "record_hours": [13, 19, 22],
    "callback": "https://sqs.us-east-1.amazonaws.com/123/my_queue_name"
  }
]
```

This gives us enough information to determine what days/hours we should be recording the
stream, and where to callback to so Feeder knows about the audio file.

## Environment Variables

Configurable settings can be found in `env-example`:

- `BUFFER_START` How many seconds early (before the top of the hour) should we call Oxbow.
- `BUFFER_END` How many seconds after the end of the hour should we keep recording.
- `CONFIG_URL` Location of the stream json config file.
- `OXBOW_SNS_TOPICS` Comma separated list of Oxbow SNS topic ARNs.
- `OXBOW_STARTUP_TIME` How long after calling Oxbow do we expect to see `.wip` heartbeat file. Once past this elapsed time, we start another redundant Oxbow job.
- `OXBOW_WIP_TIME` How long between `.wip` timestamps before we consider the Oxbow execution "dead", and start another.
- `S3_BUCKET` S3 bucket Oxbow should write to
- `S3_PREFIX` S3 prefix to use within bucket _(optional)_

# Developing

## Installation

PRX uses [asdf](https://asdf-vm.com/) to manage NodeJS - make sure you've got the correct
version of node, and then just run `yarn` to install dependencies.

## Unit Tests

Running the regular tests requires no external dependencies - they are all mocked out.
So after installing you can just:

```sh
yarn test
yarn watch
```

## Integration Tests

These tests are much slower, and require actual AWS resources _as well as_ an actual
working Oxbow deployment. To get started, fill in your `.env`:

```sh
cp env-example .env
vi .env
```

In addition to the Oxbow/S3 ENVs, you'll also need:

- `TEST_SQS_CALLBACK_URL` An SQS url we can use to check test callbacks from Oxbow
- `TEST_STREAM_URL` An audio stream we'll make a short recording from
- You must also have `ffmpeg` installed locally

Because the `test/*.integration.test.js` files are pretty slow, they are all commented out
by default. Change `it.skip` to `it.only` (or just `it`) to actually run them:

```sh
yarn integration
yarn integration-watch
```

## Linting

This repo is linted with [Biome](https://biomejs.dev/). Make sure your editor is configured for
linting, or just manually run them:

```sh
yarn lint
yarn lint-fix
```

## Deploying

This app is continuously deployed via [PRX Infrastructure](https://github.com/PRX/Infrastructure/blob/master/stacks/serverless/dovetail-cdn-arranger.yml).
So just checkout your branch, PR against `main`, keep moving, and make good decisions!

# License

[AGPL License](https://www.gnu.org/licenses/agpl-3.0.html)
