# PRX Stream Recording Orchestrator

Lambda to ensure stream recordings get kicked off.

# Description

Using a configuration file containing a list of streams to record when, ensure that
[Oxbow](https://github.com/PRX/Oxbow/) is running at the correct times and redundancy levels.

The Oxbow task is a simple FFmpeg process in Fargate, which recordings audio to S3 along with
a heartbeat to tell us it's still running.

All callbacks for the Oxbow task are sent back to Feeder. So it can eventually copy/process
the resulting audio file.

<img alt="Stream recording architecture diagram" src="https://raw.githubusercontent.com/PRX/stream-recorder/refs/heads/main/stream-recording-drawio.svg" />

