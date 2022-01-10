/* eslint-disable no-return-await */
/* eslint-disable arrow-body-style */

import AWS from 'aws-sdk';
import stream from 'stream';
import { backOff } from 'exponential-backoff';

const DEBUG = (process.env.DEBUG === 'true');
const s3 = new AWS.S3();
const lambda = new AWS.Lambda();
const db = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

const retryOptions = {
  jitter: 'full',
  maxDelay: 10000,
  startingDelay: 500,
  numOfAttempts: 3,
};

const getS3Content = async (bucket, key) => {
  try {
    if (DEBUG) console.log(`Getting content from s3://${bucket}/${key}`);
    const response = await s3.getObject({ Bucket: bucket, Key: key }).promise();
    return response.Body;
  } catch (e) {
    if (DEBUG) console.error(`Error getting content s3://${bucket}/${key}`, e);
    throw e; // rethrow it
  }
};

// Retrieve a file from S3
export const getS3ContentWithRetry = async (bucket, key) => {
  return await backOff(() => getS3Content(bucket, key), {
    ...retryOptions,
    retry: (e, attemptNumber) => {
      console.error(`Failed attempt ${attemptNumber}/${retryOptions.numOfAttempts} getting object s3://${bucket}/${key}`, e);
      return true;
    },
  });
};

// Remove key from an S3 bucket
export const getRemoveKeyPromise = (bucket, key) => {
  try {
    const res = s3.deleteObject({ Bucket: bucket, Key: key }).promise();
    console.log(`Removed object s3://${bucket}/${key}`);
    return res;
  } catch (e) {
    if (DEBUG) console.error(`Error removing object s3://${bucket}/${key}`, e);
    throw e; // rethrow it
  }
};

export const getS3UploadPromise = (bucket, key) => {
  const bodyStream = new stream.PassThrough();
  const params = { Bucket: bucket, Key: key, Body: bodyStream };
  const uploadPromise = s3.upload(params, (err, data) => {
    console.log(err, data);
  }).promise();
  return { bodyStream, uploadPromise };
};

// Invoke another Lambda function
export const invokeFunction = async (functionName, parameters) => {
  if (DEBUG) console.log(`Invoke sync ${functionName} with`, parameters);
  const params = {
    FunctionName: functionName,
    Payload: JSON.stringify(parameters),
    LogType: 'Tail',
  };
  try {
    return await lambda.invoke(params).promise();
  } catch (e) {
    console.error(`Error invoking ${functionName}`, params, e);
    throw e; // rethrow it
  }
};

// Invoke another Lambda function asynchronously
export const invokeAsync = async (functionName, parameters) => {
  if (DEBUG) console.log(`Invoke async ${functionName} with`, parameters);
  const params = {
    FunctionName: functionName,
    InvokeArgs: JSON.stringify(parameters),
  };
  try {
    return await lambda.invokeAsync(params).promise();
  } catch (e) {
    console.error(`Error invoking async ${functionName}`, params, e);
    throw e; // rethrow it
  }
};

export const putDbItem = async (tableName, item) => {
  await db.putItem({
    TableName: tableName,
    Item: item,
  }).promise();
};

export const putDbItemWithRetry = async (tableName, item) => {
  await backOff(() => putDbItem(tableName, item), {
    ...retryOptions,
    retry: (e, attemptNumber) => {
      console.error(`Failed attempt ${attemptNumber}/${retryOptions.numOfAttempts} to insert ${item} -> ${tableName}`, e);
      return true;
    },
  });
};

export const writeBurstResult = async (tasksTableName, jobId, batchId, ttlSeconds, attrs = {}) => {
  const ttl = (Math.floor(+new Date() / 1000) + ttlSeconds).toString();
  const item = {
    jobId: { S: jobId },
    batchId: { N: `${batchId}` },
    ttl: { N: ttl },
    ...attrs,
  };
  await putDbItemWithRetry(tasksTableName, item);
};

export const logBurstWorker = async (event) => {
  const {
    jobId,
    batchId,
  } = event;
  console.log('Input event:', JSON.stringify(event));
  console.log(`Job Id: ${jobId}`);
  console.log(`Batch Id: ${batchId}`);
};
