# burst-compute-example

Simple example of the [burst-compute](https://github.com/JaneliaSciComp/burst-compute) framework. Generates a Mandelbrot Set image in N pieces and stitches them together to demonstrate the power of burst computation in the cloud.

## Deployment

1. You must have the [Serverless Framework](https://www.serverless.com/framework/docs/getting-started) installed and configured.
2. Ensure you have successfully deployed [burst-compute](https://github.com/JaneliaSciComp/burst-compute) to your AWS account.
3. Create an S3 bucket where the fractal image will be generated.
4. Then deploy the example functions, substituting your region and bucket name:

    npm install
    BUCKET=burst-compute-example npm run sls -- deploy --region us-east-1

This will deploy a *launcher* function you will use the launch burst computation, along with *worker* and *combiner* functions that will be called by the  burst-compute framework.

## Usage

1. Open the deployed [burst-compute-example-prod-launcher](https://console.aws.amazon.com/lambda/home#/functions/burst-compute-example-prod-launcher) Lambda function in the AWS console.
2. Create a test event. It can be empty (e.g. `{}`) or include any of the following fields:
    * `imageWidth`: the width of the final image in pixels
    * `imageHeight`: the height of the final image in pixels
    * `tileWidth`: the width of each tile in pixels
    * `tileHeight`: the height of each tile in pixels
    * `batchSize`: the maximum number of tiles to process serially
    * `numLevels`: the number of levels in the invoker lambda function tree
    * `lookAt`: a point in the complex plane to look at
    * `zoom`: the width and height of the complex plane
    * `iterations`: the number of iterations to perform
    * `autoIterations`: if true, iterations is calculated automatically based on the size of the image
    * `escapeRadius`: radius of circle on the complex plane used to determine if a point is in the set
    * `superSamples`: number of times to sample the image
    * `colorScheme`: the color scheme to use (pickColorHSV1, pickColorHSV2, pickColorHSV3, pickColorGrayscale2)

3. Invoke the function with your test event to launch burst computation
4. Check your bucket for the result under /fractal/final.png

You can also monitor progress by checking the burst-compute state machine in the [AWS Step Functions console](https://console.aws.amazon.com/states/home).

## Example Input Events

```javascript
{
  "imageWidth": 8000,
  "imageHeight": 6000,
  "tileWidth": 200,
  "tileHeight": 200,
  "batchSize": 4,
  "numLevels": 2,
  "colorScheme": "pickColorHSV2"
}
```

## Development

To deploy to a non-prod environment, specify the stage:

    npm run sls -- deploy --stage dev

To run the linter:

    npm run sls -- lint

To run the unit tests:

    npm run sls -- test

## Credits

The mandelbrot rendering code is adapted from [mandelbrot-js](https://github.com/cslarsen/mandelbrot-js) by Christian Larsen, licensed under Apache License 2.0.
