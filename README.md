# MathJax API

This Docker image exposes simple APIs to render formulas using MathJax on the server.

## Getting started

To get started, simply run a container from this image:

```sh
docker run --name mathjax-api -d -p 3000:3000 chialab/mathjax-api
```

This will expose the API on port `3000`.

## Rendering formulas

The API consists of a single endpoint `/convert` that accepts `GET` and `POST`
requests containing a JSON payload with at least `format` (either `latex` or
`mathml`) and `source` keys.

The request **MUST** contain an `Accept` header specifying the mime type of the
desired conversion format (either `application/mathml+xml`, `image/png`, or
`image/svg+xml`). The response will then contain an appropriate `Content-Type` and
payload.

### Examples:

 - Render a LaTeX formula as SVG:

    ```sh
    curl -X POST --url http://localhost:3000/convert \
        -H 'Accept: image/svg+xml' \
        -H 'Content-Type: application/json' \
        -d '{"type": "latex", "source": "x^2"}'
    ```

 - Render an inline LaTeX formula as PNG and save it in `example.png`:

    ```sh
    curl -X POST --url http://localhost:3000/convert \
        -H 'Accept: image/png' \
        -H 'Content-Type: application/json' \
        -d '{"type": "latex", "source": "x^2"}' > example.png
    ```

## Running the Web server locally

Provided you have NodeJS and Yarn installed, you can run the following commands:

```sh
yarn install
yarn start
```

This will start the Web server on your local machine. By default the server is
bound to port 3000, but you can override this default by setting the environment
variable `PORT` to the port you wish to use — e.g. `PORT=5000 yarn start`.

## Building the Docker image locally

Run `docker build` in the repository root to build the Docker image locally:

```sh
docker build -t mathjax-api .
```

Alternatively, you can run `make docker-build`.
