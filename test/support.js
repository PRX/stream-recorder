import "aws-sdk-client-mock-jest";
import { Readable } from "node:stream";
import {
  GetObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { sdkStreamMixin } from "@smithy/util-stream";
import { mockClient } from "aws-sdk-client-mock";

const s3Mock = mockClient(S3Client);
const snsMock = mockClient(SNSClient);
const makeStream = (str) => {
  const stream = new Readable();
  stream.push(str);
  stream.push(null);
  return sdkStreamMixin(stream);
};

/**
 * Mock list requests
 */
export function mockS3List(val) {
  const listObjects = async (params) => {
    return typeof val === "function" ? val(params) : val;
  };
  s3Mock.on(ListObjectsCommand).callsFake(listObjects);
}

/**
 * Mock get requests, handling the messy Body streaming bit
 */
export function mockS3Get(val) {
  const getObject = async (params) => {
    const res = typeof val === "function" ? val(params) : val;
    if (res.Body) {
      res.Body = makeStream(res.Body);
    }
    return res;
  };
  s3Mock.on(GetObjectCommand).callsFake(getObject);
}

/**
 * Mock put requests
 */
export function mockS3Put(val) {
  const putObject = async (params) => {
    return typeof val === "function" ? val(params) : val;
  };
  s3Mock.on(PutObjectCommand).callsFake(putObject);
}

/**
 * Mock sns publishes
 */
export function mockSNSPublish(val) {
  const publish = async (params) => {
    return typeof val === "function" ? val(params) : val;
  };
  snsMock.on(PublishCommand).callsFake(publish);
}
