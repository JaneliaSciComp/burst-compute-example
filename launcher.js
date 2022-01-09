/* eslint-disable import/prefer-default-export */
import { invokeFunction } from './utils';

const dispatchFunctionArn = process.env.DISPATCH_FUNCTION_ARN;
const workerFunctionArn = process.env.WORKER_FUNCTION_ARN;
const combinerFunctionArn = process.env.COMBINER_FUNCTION_ARN;
const maxParallelism = Number(process.env.MAX_PARALLELISM) || 3000;

export const handler = async (event) => {
  const imageWidth = event.imageWidth || 1600;
  const imageHeight = event.imageHeight || 1200;
  const tileWidth = event.tileWidth || 200;
  const tileHeight = event.tileHeight || 200;
  const batchSize = event.batchSize || 10;
  const numLevels = event.numLevels || 1;
  const numTiles = (imageWidth / tileWidth) * (imageHeight / tileHeight);
  const parameters = {
    workerFunctionName: workerFunctionArn,
    combinerFunctionName: combinerFunctionArn,
    startIndex: 0,
    endIndex: numTiles,
    batchSize,
    numLevels,
    maxParallelism,
    searchTimeoutSecs: 100,
    jobParameters: {
      ...event,
      imageWidth,
      imageHeight,
      tileWidth,
      tileHeight,
      numTiles,
    },
  };
  await invokeFunction(dispatchFunctionArn, parameters);
  return `Launched generation of ${numTiles} tiles`;
};
