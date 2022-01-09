import sharp from 'sharp';
import { getS3ContentWithRetry, removeKey, getUploadPromise } from './utils';

const DEBUG = Boolean(process.env.DEBUG);
const DELETE_TILES = Boolean(process.env.DELETE_TILES);
const outputBucket = process.env.OUTPUT_BUCKET;
const outputPrefix = process.env.OUTPUT_PREFIX;

export const handler = async (event) => {
  if (DEBUG) console.log('Input event:', JSON.stringify(event));

  // Parameters
  const {
    jobId,
    timedOut,
    completed,
    withErrors,
    fatalErrors,
    elapsedSecs,
    jobParameters,
  } = event;

  console.log(`Job ${jobId} took ${elapsedSecs} seconds`);

  if (fatalErrors && fatalErrors.length > 0) {
    console.log('Job had fatal errors, combiner will not run.');
    return event;
  }

  if (timedOut) {
    console.log('Job timed out, attempting to continue...');
  }

  if (withErrors) {
    console.log('Some tasks had errors, attempting to continue...');
  }

  if (!completed) {
    console.log('Job did not complete correctly, attempting to continue...');
  }

  const {
    numTiles,
    tileWidth,
    tileHeight,
    imageWidth,
    imageHeight,
  } = jobParameters;

  const finalImage = sharp({
    create: {
      width: imageWidth,
      height: imageHeight,
      channels: 4,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 1.0,
      },
    },
  });

  if (DEBUG) console.log(`Combining ${numTiles} tiles into a ${imageWidth}x${imageHeight} image`);

  const tiles = [];
  for (let tileIndex = 0; tileIndex < numTiles; tileIndex += 1) {
    const key = `${outputPrefix}/tiles/${tileIndex}.png`;
    // eslint-disable-next-line no-await-in-loop
    const buffer = await getS3ContentWithRetry(outputBucket, key);
    if (buffer) {
      const tileX = Math.floor(((tileWidth * tileIndex) % imageWidth) / tileWidth);
      const tileY = Math.floor((tileHeight * tileIndex) / imageWidth);
      const x = tileX * tileWidth;
      const y = tileY * tileHeight;
      console.log(`Adding tile ${tileIndex} (${tileWidth}x${tileHeight}) to the final image at (${x},${y})`);
      tiles.push({
        key,
        input: buffer,
        top: y,
        left: x,
      });
    }
  }

  const key = `${outputPrefix}/final_image.png`;
  const { bodyStream, uploadPromise } = getUploadPromise(outputBucket, key);
  await finalImage.composite(tiles).png().pipe(bodyStream);
  await uploadPromise;

  if (DELETE_TILES) {
    const deletePromises = [];
    tiles.forEach((tile) => {
      deletePromises.push(removeKey(outputBucket, tile.key));
    });
    await Promise.all(deletePromises);
    if (DEBUG) console.log('Deleted tiles');
  }

  return `Generated s3://${outputBucket}/${key}`;
};
