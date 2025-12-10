require("dotenv").config({ quiet: true });

module.exports = async (_globalConfig, _projectConfig) => {
  if (!process.env.S3_BUCKET) {
    console.error("\n\nERROR: You must set an S3_BUCKET env\n");
    process.exit(1);
  }
};
