beforeEach(() => {
  process.env.BUFFER_START = "";
  process.env.BUFFER_END = "";
  process.env.CONFIG_URL = "http://my.conf";
  process.env.OXBOW_SNS_TOPICS = "topic1,topic2";
  process.env.S3_BUCKET = "my-bucket";
  process.env.S3_PREFIX = "";
});
