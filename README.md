# MathJax API

This Docker image exposes simple APIs to render formulas using MathJax on the server.

## Getting started

To get started, simply run a container from this image:

```
$ docker run --name mathjax-node -d -p 8080:80 chialab/mathjax-node
```

This will expose the API on port `8080`.

## Converting formulas

The API consists of a single endpoint `GET /convert` that accepts requests containing a
JSON payload with at least `format` (either `latex` or `mathml`) and `source` keys.

The request **MUST** contain an `Accept` header specifying the mime type of the
desired conversion format (either `application/mathml+xml`, `image/png`, or
`image/svg+xml`). The response will then contain an appropriate `Content-Type` and
payload.

**Example:**

```
$ curl -X GET -H 'Content-Type: application/json' -H 'Accept: image/svg+xml' -d '{"type": "latex", "source": "x^2"}' http://localhost:8080/convert
```

## API reference

The API reference, in Swagger format, can be found in the root of the [source Git
repository](https://github.com/Chialab/mathjax-docker/blob/master/swagger.yaml).
