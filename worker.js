import fs from 'fs';
import { generatePNG } from './mandelbrot';
import { logBurstWorker, getUploadPromise, writeBurstResult } from './utils';

const DEBUG = Boolean(process.env.DEBUG);
const outputBucket = process.env.OUTPUT_BUCKET;
const outputPrefix = process.env.OUTPUT_PREFIX;
const outputKey = 'fractal.png';
const batchResultsTTLMinutes = 15;

export const fractalLocalDisk = async (event) => {
  const params = event.params || { };
  await generatePNG(fs.createWriteStream('fractal.png'), params);
  return 'Wrote image to disk';
};

export const fractalS3 = async (event) => {
  const params = event.params || { };
  const key = outputPrefix + outputKey;
  const { bodyStream, uploadPromise } = getUploadPromise(outputBucket, key);
  await generatePNG(bodyStream, params);
  await uploadPromise;
  return `Wrote image to s3://${outputBucket}/${key}`;
};

export const handler = async (event) => {
  const {
    tasksTableName,
    jobId,
    batchId,
    startIndex,
    endIndex,
    jobParameters,
  } = event;

  logBurstWorker(event);

  const uploadPromises = [];
  const pngPromises = [];

  for (let tileIndex = startIndex; tileIndex <= endIndex; tileIndex += 1) {
    const params = {
      tileIndex,
      ...jobParameters,
    };
    const key = `${outputPrefix}/tiles/${tileIndex}.png`;
    const { bodyStream, uploadPromise } = getUploadPromise(outputBucket, key);
    pngPromises.push(generatePNG(bodyStream, params));
    uploadPromises.push(uploadPromise);
    if (DEBUG) console.log(`Generating tile at s3://${outputBucket}/${key}`);
  }

  await Promise.all(pngPromises);
  await Promise.all(uploadPromises);

  // Files have been written, now update the DB with the batch results
  const ttlDelta = batchResultsTTLMinutes * 60;
  return writeBurstResult(tasksTableName, jobId, batchId, ttlDelta);
};
