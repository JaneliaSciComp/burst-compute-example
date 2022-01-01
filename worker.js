import fs from 'fs';
import stream from 'stream';
import AWS from 'aws-sdk';
import { generatePNG } from './mandelbrot';

const outputBucket = process.env.OUTPUT_BUCKET;
const outputPrefix = process.env.OUTPUT_PREFIX;
const outputKey = 'fractal.png';

// Write an object into S3 as JSON
// const putObject = async (Bucket, Key, data) => {
//   try {
//     if (DEBUG) console.log(`Putting object to ${Bucket}:${Key}`);
//     const s3 = new AWS.S3();
//     const res = await s3
//       .putObject({
//         Bucket,
//         Key,
//         Body: data,
//         ContentType: 'image/png',
//       })
//       .promise();
//     if (DEBUG) {
//       console.log(`Put object to ${Bucket}:${Key}:`, data, res);
//     }
//   } catch (e) {
//     console.error('Error putting object', data, `to ${Bucket}:${Key}`, e);
//     throw e;
//   }
//   return `s3://${Bucket}/${Key}`;
// };

export const fractalLocalDisk = async (event) => {
  const params = event.params || { };
  // { tileWidth: 200, tileHeight: 200, tileIndex: 10 };
  await generatePNG(fs.createWriteStream('fractal.png'), params);

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Fractal generated locally',
        input: event,
      },
      null,
      2,
    ),
  };
};

function getUploadPromise(bucket, key, bodyStream) {
  const params = { Bucket: bucket, Key: key, Body: bodyStream };
  const s3 = new AWS.S3();
  return s3.upload(params, (err, data) => {
    console.log(err, data);
  }).promise();
}

export const fractalS3 = async (event) => {
  const params = event.params || { };
  const key = outputPrefix + outputKey;

  const bodyStream = new stream.PassThrough();
  const uploadPromise = getUploadPromise(outputBucket, key, bodyStream);
  await generatePNG(bodyStream, params);

  await uploadPromise;
  console.log('S3 upload completed successfully');

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: `Fractal generated on S3 on bucket ${outputBucket}`,
        input: event,
      },
      null,
      2,
    ),
  };
};

// export const worker = async (event) => {
//   const { tasksTableName, jobId, batchId, startIndex, endIndex, jobParameters } = event;

//   // The next three log statements are parsed by the analyzer. DO NOT CHANGE.
//   console.log('Input event:', JSON.stringify(event));
//   console.log(`Job Id: ${jobId}`);
//   console.log(`Batch Id: ${batchId}`);

//   return true;
// };
