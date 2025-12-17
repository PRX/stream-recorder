require("dotenv").config({ quiet: true });

module.exports = async (_globalConfig, _projectConfig) => {
  if (!process.env.OXBOW_SNS_TOPICS) {
    console.error("\n\nERROR: You must set an OXBOW_SNS_TOPICS env\n");
    process.exit(1);
  }
  if (!process.env.S3_BUCKET) {
    console.error("\n\nERROR: You must set an S3_BUCKET env\n");
    process.exit(1);
  }
  if (!process.env.TEST_SQS_CALLBACK_URL) {
    console.error("\n\nERROR: You must set a TEST_SQS_CALLBACK_URL env\n");
    process.exit(1);
  }
  if (!process.env.TEST_STREAM_URL) {
    console.error("\n\nERROR: You must set a TEST_STREAM_URL env\n");
    process.exit(1);
  }
};
