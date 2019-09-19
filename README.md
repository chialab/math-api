# Math API

A REST API to do fancy things with formulas, like rendering LaTeX or MathML to
SVG or PNG on the server side using [MathJax for Node](https://github.com/mathjax/MathJax-node),
while leveraging expensive computations on the client.

## As a Serverless application

You can deploy this repository as a serverless application using an AWS CloudFormation
Template to create an AWS API Gateway that invokes Lambda functions to serve requests.

> [**Launch this stack on AWS**](https://console.aws.amazon.com/cloudformation/home#/stacks/new?stackName=MathApi&templateURL=https://chialab-cloudformation-templates.s3-eu-west-1.amazonaws.com/chialab/math-api/master/template.yml)

## As a Docker image

You can pull and run a Docker container to deploy the API on your local machine,
server, Kubernetes cluster, whatever!

To start the container (it will bind on <http://localhost:3000/>):

```sh
docker run --name math-api -d -p 3000:3000 chialab/math-api
```

## Endpoints

- [`GET /render`](#get-render)
- [`POST /render`](#post-render)

### `GET /render`

> An endpoint to render LaTeX and MathML formulas to SVG or PNG.

**Query parameters**:

- `input` (**required**): the format of math in input.  
   **Valid values**: `latex`, `mathml`
- `inline` (_optional_): when `input` is `latex`, optionally enable "inline" mode.  
   **Valid values**: `0`, `1`
- `source` (**required**): the math to be rendered.  
   **Valid values**: _string, depends on the input type_
- `output` (**required**): the output format.  
   **Valid values**: `mathml`, `png`, `svg`
- `width`, `height` (_optional_): when `output` is `png`, specify the dimensions of the image to return.  
   **Valid values**: _positive integers_

**Examples**:

```http
GET /render?input=latex&output=svg&source=x^2 HTTP/1.1
Accept: image/svg+xml
```

```http
GET /render?input=latex&inline=1&output=png&source=x^2&width=512 HTTP/1.1
Accept: image/png
```

### `POST /render`

> An endpoint to render LaTeX and MathML formulas to SVG or PNG.

**Request body (JSON)**:

- `input` (**required**): the format of math in input.  
   **Valid values**: `latex`, `mathml`
- `inline` (_optional_): when `input` is `latex`, optionally enable "inline" mode.  
   **Valid values**: _boolean_
- `source` (**required**): the math to be rendered.  
   **Valid values**: _string, depends on the input type_
- `output` (**required**): the output format.  
   **Valid values**: `mathml`, `png`, `svg`
- `width`, `height` (_optional_): when `output` is `png`, specify the dimensions of the image to return.  
   **Valid values**: _positive integers_

**Examples**:

```http
POST /render
Accept: image/svg+xml
Content-Type: application/json

{
    "input": "latex",
    "output": "svg",
    "source": "e^{i \\pi} + 1 = 0"
}
```

```http
POST /render
Accept: image/png
Content-Type: application/json

{
    "input": "latex",
    "inline": true,
    "output": "png",
    "source": "e^{i \\pi} + 1 = 0",
    "width": 512
}
```

## Development

_All the following instructions assume you have at least [NodeJS](https://nodejs.org/) and [Yarn](https://yarnpkg.com/) installed._

**Start the application locally**:
> `yarn start`

**Run unit tests**:
> `yarn run test`

**Start a simulated AWS API Gateway** (_provided you have AWS SAM Local and Docker installed_):
> `yarn run api-gateway`

**Validate CloudFormation template** (_provided you have AWS CLI installed_)
> `make validate`

**Package CloudFormation template** (_provided you have AWS CLI and Docker installed_)
> `make layers` (_this is needed only the first time, then when updating MathJax version_)
> `make package`

**Deploy CloudFormation template** (_provided you have AWS CLI and Docker installed_)
> `make deploy`
> `make deploy ENVIRONMENT=Production`
