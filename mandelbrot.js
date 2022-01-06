/* eslint-disable */

import sharp from 'sharp';

const DEBUG = true;

/*
 * This code is derived from the web-based mandelbrot renderer described below.
 * I modified it to make it run on either server or client and packaged it as a ES6 library,
 * so that it can be used as a burst compute example function.
 *
 * Original license:
 * The Mandelbrot Set, in HTML5 canvas and javascript.
 * https://github.com/cslarsen/mandelbrot-js
 *
 * Copyright (C) 2012, 2018 Christian Stigen Larsen
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.  You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 */

/*
 * Global constants:
 */
// const zoomStart = 3.4;
const interiorColor = [0, 0, 0, 255];

/*
 * Main renderer equation.
 *
 * Returns number of iterations and values of Z_{n}^2 = Tr + Ti at the time
 * we either converged (n == iterations) or diverged.  We use these to
 * determined the color at the current pixel.
 *
 * The Mandelbrot set is rendered taking
 *
 *     Z_{n+1} = Z_{n}^2 + C
 *
 * with C = x + iy, based on the "look at" coordinates.
 *
 * The Julia set can be rendered by taking
 *
 *     Z_{0} = C = x + iy
 *     Z_{n+1} = Z_{n} + K
 *
 * for some arbitrary constant K.  The point C for Z_{0} must be the
 * current pixel we're rendering, but K could be based on the "look at"
 * coordinate, or by letting the user select a point on the screen.
 */
function iterateEquation(Cr, Ci, escapeRadius, iterations) {
  let Zr = 0;
  let Zi = 0;
  let Tr = 0;
  let Ti = 0;
  let n = 0;

  for (; n < iterations && (Tr + Ti) <= escapeRadius; n += 1) {
    Zi = 2 * Zr * Zi + Ci;
    Zr = Tr - Ti + Cr;
    Tr = Zr * Zr;
    Ti = Zi * Zi;
  }

  /*
   * Four more iterations to decrease error term;
   * see http://linas.org/art-gallery/escape/escape.html
   */
  for (let e = 0; e < 4; e += 1) {
    Zi = 2 * Zr * Zi + Ci;
    Zr = Tr - Ti + Cr;
    Tr = Zr * Zr;
    Ti = Zi * Zi;
  }

  return [n, Tr, Ti];
}

/*
 * Convert hue-saturation-value/luminosity to RGB.
 *
 * Input ranges:
 *   H =   [0, 360] (integer degrees)
 *   S = [0.0, 1.0] (float)
 *   V = [0.0, 1.0] (float)
 */
function hsvToRgb(h, s, v) {
  let v2 = v;
  if (v2 > 1.0) v2 = 1.0;
  const hp = h / 60.0;
  const c = v2 * s;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb = [0, 0, 0];

  if (hp >= 0 && hp < 1) rgb = [c, x, 0];
  if (hp >= 1 && hp < 2) rgb = [x, c, 0];
  if (hp >= 2 && hp < 3) rgb = [0, c, x];
  if (hp >= 3 && hp < 4) rgb = [0, x, c];
  if (hp >= 4 && hp < 5) rgb = [x, 0, c];
  if (hp >= 5 && hp < 6) rgb = [c, 0, x];

  const m = v2 - c;
  rgb[0] += m;
  rgb[1] += m;
  rgb[2] += m;

  rgb[0] *= 255;
  rgb[1] *= 255;
  rgb[2] *= 255;
  return rgb;
}

function addRGB(v, w) {
  const v2 = v;
  v2[0] += w[0];
  v2[1] += w[1];
  v2[2] += w[2];
  v2[3] += w[3];
  return v2;
}

function divRGB(v, div) {
  const v2 = v;
  v2[0] /= div;
  v2[1] /= div;
  v2[2] /= div;
  v2[3] /= div;
  return v2;
}

function smoothColor(steps, n, Tr, Ti) {
  // Some constants used with smoothColor
  const logBase = 1.0 / Math.log(2.0);
  const logHalfBase = Math.log(0.5) * logBase;
  /*
   * Original smoothing equation is
   *
   * var v = 1 + n - Math.log(Math.log(Math.sqrt(Zr*Zr+Zi*Zi)))/Math.log(2.0);
   *
   * but can be simplified using some elementary logarithm rules to
   */
  return 5 + n - logHalfBase - Math.log(Math.log(Tr + Ti)) * logBase;
}

function pickColorHSV1(steps, n, Tr, Ti) {
  // converged?
  if (n === steps) { return interiorColor; }

  const v = smoothColor(steps, n, Tr, Ti);
  const c = hsvToRgb((360.0 * v) / steps, 1.0, 1.0);
  c.push(255); // alpha
  return c;
}

function pickColorHSV2(steps, n, Tr, Ti) {
  // converged?
  if (n === steps) { return interiorColor; }

  const v = smoothColor(steps, n, Tr, Ti);
  const c = hsvToRgb((360.0 * v) / steps, 1.0, (10.0 * v) / steps);
  c.push(255); // alpha
  return c;
}

function pickColorHSV3(steps, n, Tr, Ti) {
  // converged?
  if (n === steps) { return interiorColor; }

  const v = smoothColor(steps, n, Tr, Ti);
  const c = hsvToRgb((360.0 * v) / steps, 1.0, (10.0 * v) / steps);

  // swap red and blue
  const t = c[0];
  // eslint-disable-next-line prefer-destructuring
  c[0] = c[2];
  c[2] = t;

  c.push(255); // alpha
  return c;
}

function pickColorGrayscale(steps, n, Tr, Ti) {
  // converged?
  if (n === steps) { return interiorColor; }

  let v = smoothColor(steps, n, Tr, Ti);
  v = Math.floor((512.0 * v) / steps);
  if (v > 255) v = 255;
  return [v, v, v, 255];
}

function pickColorGrayscale2(steps, n, Tr, Ti) {
  if (n === steps) { // converged?
    let c = 255 - (Math.floor(255.0 * Math.sqrt(Tr + Ti)) % 255);
    if (c < 0) c = 0;
    if (c > 255) c = 255;
    return [c, c, c, 255];
  }

  return pickColorGrayscale(steps, n, Tr, Ti);
}

function getColorPicker(p) {
  if (p === 'pickColorHSV1') return pickColorHSV1;
  if (p === 'pickColorHSV2') return pickColorHSV2;
  if (p === 'pickColorHSV3') return pickColorHSV3;
  if (p === 'pickColorGrayscale2') return pickColorGrayscale2;
  return pickColorGrayscale;
}
/*
 * Render the Mandelbrot set
 */
function draw(
  img,
  imageWidth,
  imageHeight,
  tileWidth,
  tileHeight,
  tileIndex,
  zoomParam,
  lookAt,
  iterations,
  autoIterations,
  escapeRadius,
  superSamples,
  colorScheme,
) {
  const tileX = Math.floor(((tileWidth * tileIndex) % imageWidth) / tileWidth);
  const tileY = Math.floor((tileHeight * tileIndex) / imageWidth);
  const tileExtentsX = [tileX * tileWidth, (tileX + 1) * tileWidth];
  const tileExtentsY = [tileY * tileHeight, (tileY + 1) * tileHeight];

  const pickColor = getColorPicker(colorScheme);
  const zoom = zoomParam;
  const xRange = [lookAt[0] - zoom[0] / 2, lookAt[0] + zoom[0] / 2];
  const yRange = [lookAt[1] - zoom[1] / 2, lookAt[1] + zoom[1] / 2];

  /*
  * Adjust aspect ratio based on plot ranges and canvas dimensions.
  */
  const ratio = Math.abs(xRange[1] - xRange[0]) / Math.abs(yRange[1] - yRange[0]);
  const sratio = imageWidth / imageHeight;
  if (sratio > ratio) {
    const xf = sratio / ratio;
    xRange[0] *= xf;
    xRange[1] *= xf;
    zoom[0] *= xf;
  } else {
    const yf = ratio / sratio;
    yRange[0] *= yf;
    yRange[1] *= yf;
    zoom[1] *= yf;
  }

  let steps = iterations;
  if (autoIterations) {
    const f = Math.sqrt(
      0.001 + 2.0 * Math.min(
        Math.abs(xRange[0] - xRange[1]),
        Math.abs(yRange[0] - yRange[1]),
      ),
    );
    steps = Math.floor(223.0 / f);
  }

  const escapeRadius2 = escapeRadius ** 2.0;
  const Cr_step = (xRange[1] - xRange[0]) / (0.5 + (imageWidth - 1));
  const Ci_step = (yRange[1] - yRange[0]) / (0.5 + (imageHeight - 1));

  if (DEBUG) {
    console.log(`Generating ${tileWidth}x${tileHeight} tile of ${imageWidth}x${imageHeight} image`);
    console.log(`  zoom: ${zoom}`);
    console.log(`  lookAt: ${lookAt}`);
    console.log(`  iterations: ${iterations}`);
    console.log(`  autoIterations: ${autoIterations}`);
    console.log(`  escapeRadius: ${escapeRadius}`);
    console.log(`  superSamples: ${superSamples}`);
    console.log(`  colorScheme: ${colorScheme}`);
    console.log(`  tileIndex: ${tileIndex}`);
    console.log(`  tileCoords: (${tileX}, ${tileY})`);
    console.log(`  tileExtentsX: ${tileExtentsX[0]} ${tileExtentsX[1]}`);
    console.log(`  tileExtentsY: ${tileExtentsY[0]} ${tileExtentsY[1]}`);
  }

  function drawLineSuperSampled(Ci, offset, Cr_init) {
    let Cr = Cr_init;

    for (let x = 0; x < tileWidth; ++x, Cr += Cr_step) {
      let color = [0, 0, 0, 255];

      for (let s = 0; s < superSamples; ++s) {
        const rx = Math.random() * Cr_step;
        const ry = Math.random() * Ci_step;
        const p = iterateEquation(Cr - rx / 2, Ci - ry / 2, escapeRadius2, steps);
        color = addRGB(color, pickColor(steps, p[0], p[1], p[2]));
      }

      color = divRGB(color, superSamples);

      const idx = (offset + x) << 2;
      img[idx] = color[0];
      img[idx + 1] = color[1];
      img[idx + 2] = color[2];
      img[idx + 3] = 255;
    }
  }

  function drawLine(Ci, offset, Cr_init) {
    let Cr = Cr_init;
    for (let x = 0; x < tileWidth; ++x, Cr += Cr_step) {
      const p = iterateEquation(Cr, Ci, escapeRadius2, steps);
      const color = pickColor(steps, p[0], p[1], p[2]);
      const idx = (offset + x) << 2;
      img[idx] = color[0];
      img[idx + 1] = color[1];
      img[idx + 2] = color[2];
      img[idx + 3] = 255;
    }
  }

  const start = (new Date()).getTime();
  let pixels = 0;
  let Ci = yRange[0] + (Ci_step * tileExtentsY[0]);
  let sy = 0;
  const drawLineFunc = superSamples > 1 ? drawLineSuperSampled : drawLine;

  while (sy < tileHeight) {
    drawLineFunc(Ci, sy * tileWidth, xRange[0] + (Cr_step * tileExtentsX[0]));
    Ci += Ci_step;
    pixels += tileWidth / 4;
    sy += 1;
  }

  const now = (new Date()).getTime();
  const elapsedMS = now - start;
  const renderTime = (elapsedMS / 1000.0).toFixed(1); // 1 comma
  if (DEBUG) console.log(`Render time: ${renderTime} ms`);
  const speed = Math.floor(pixels / elapsedMS);
  if (DEBUG) console.log(`Render speed: ${speed} pixels/second`);
}

export const generateImage = async (params) => {
  const zoom = params.zoom || [2.6549836959630824, 1.447598253275109];
  const lookAt = params.lookAt || [-0.6, 0];
  const iterations = 'iterations' in params ? params.iterations : 100;
  const autoIterations = 'autoIterations' in params ? params.autoIterations : true;
  const escapeRadius = params.escapeRadius || 10.0;
  const superSamples = params.superSamples || 1;
  const colorScheme = params.colorScheme || 'pickColorHSV1';
  const imageWidth = params.imageWidth || 1024;
  const imageHeight = params.imageHeight || 786;
  const tileWidth = params.tileWidth || imageWidth;
  const tileHeight = params.tileHeight || imageHeight;
  const tileIndex = params.tileIndex || 0;
  const buffer32 = Buffer.alloc(4 * tileWidth * tileHeight);
  const bitmap32 = new Uint8Array(buffer32.buffer);

  draw(
    bitmap32,
    imageWidth,
    imageHeight,
    tileWidth,
    tileHeight,
    tileIndex,
    zoom,
    lookAt,
    iterations,
    autoIterations,
    escapeRadius,
    superSamples,
    colorScheme,
  );

  return bitmap32;
};

export const generatePNG = async (writeStream, params) => {
  const imageWidth = params.imageWidth || 1024;
  const imageHeight = params.imageHeight || 786;
  const tileWidth = params.tileWidth || imageWidth;
  const tileHeight = params.tileHeight || imageHeight;
  const buffer = await generateImage({
    ...params,
    imageWidth,
    imageHeight,
    tileWidth,
    tileHeight,
  });
  const image = sharp(buffer, {
    raw: {
      width: tileWidth,
      height: tileHeight,
      channels: 4
    }
  });
  await image.png().pipe(writeStream);
};
