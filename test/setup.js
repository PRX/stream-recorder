beforeEach(() => {
  process.env.BUFFER_START = "";
  process.env.BUFFER_END = "";
  process.env.CONFIG_URL = "http://my.config/streams.json";
  process.env.OXBOW_SNS_TOPICS = "topic1,topic2";
  process.env.OXBOW_STARTUP_TIME = "120";
  process.env.OXBOW_WIP_TIME = "30";
  process.env.S3_BUCKET = "my-bucket";
  process.env.S3_PREFIX = "";
});
