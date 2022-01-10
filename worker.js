import fs from 'fs';
import { generatePNG } from './mandelbrot';
import { logBurstWorker, getS3UploadPromise, writeBurstResult } from './utils';

const DEBUG = (process.env.DEBUG === 'true');
const outputBucket = process.env.OUTPUT_BUCKET;
const outputPrefix = process.env.OUTPUT_PREFIX;
const batchResultsTTLMinutes = 15;

export const fractalLocalDisk = async (event) => {
  const params = event.params || {
    imageWidth: 1280,
    imageHeight: 1080,
    // tileWidth: 80,
    // tileHeight: 90,
    colorScheme: 'pickColorHSV2',
  };
  await generatePNG(fs.createWriteStream('fractal.png'), params);
  return 'Wrote image to disk';
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

  // Generate all images in the current batch
  for (let i = startIndex; i < endIndex; i += 1) {
    const params = {
      tileIndex: i,
      key: `${outputPrefix}/tiles/${i}.png`,
      ...jobParameters,
    };

    const { bodyStream, uploadPromise } = getS3UploadPromise(outputBucket, params.key);

    pngPromises.push(generatePNG(bodyStream, params));
    uploadPromises.push(uploadPromise);

    if (DEBUG) console.log(`Generating tile at s3://${outputBucket}/${params.key}`);
  }

  // Wait for the PNGs to be generated and written to S3
  console.log('Awaiting PNG generation...');
  await Promise.all(pngPromises);
  await Promise.all(uploadPromises);

  // Files have been written, now update the DB with the batch results
  console.log('Writing to DynamoDB...');
  const ttlDelta = batchResultsTTLMinutes * 60;
  await writeBurstResult(tasksTableName, jobId, batchId, ttlDelta);

  if (DEBUG) console.log(`Wrote ${pngPromises.length} tiles to s3://${outputBucket}/${outputPrefix}/tiles`);

  return true;
};
