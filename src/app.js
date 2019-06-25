const { raw } = require('body-parser');
const express = require('express');
const { handler } = require('./render/index.js');

/** @typedef {{ resource: string, path: string, httpMethod: string, headers: { [x: string]: string }, queryStringParameters: { [x: string]: string }, pathParameters: { [x: string]: string }, body: string, isBase64Encoded: boolean }} LambdaProxyInput */
/** @typedef {{ statusCode: number, headers: { [x: string]: string }, body: string, isBase64Encoded: boolean }} LambdaProxyOutput */

/**
 * Convert ExpressJS incoming request to a Lambda proxy input event.
 *
 * @returns {LambdaProxyInput}
 */
express.request.constructor.prototype.toLambdaEvent = function () {
    return {
        resource: this.route.path,
        path: this.path,
        httpMethod: this.method,
        headers: Object.assign({}, this.headers || {}),
        // multiValueHeaders: { List of strings containing incoming request headers }
        queryStringParameters: Object.assign({}, this.query || {}),
        // multiValueQueryStringParameters: { List of query string parameters }
        pathParameters: Object.assign({}, this.params || {}),
        stageVariables: Object.assign({}, this.app.locals || {}),
        requestContext: {}, // TODO
        body: this.body,
        isBase64Encoded: false,
    };
};

/**
 * Build ExpressJS response from Lambda proxy output.
 *
 * @param {LambdaProxyOutput} res Lambda proxy response.
 * @returns {ThisType}
 */
express.response.constructor.prototype.fromLambdaResponse = function (res) {
    this.status(res.statusCode);
    if (res.headers) {
        this.set(res.headers);
    }
    if (res.body) {
        let buf = Buffer.from(res.body, res.isBase64Encoded ? 'base64' : 'utf8');
        this.set('Content-Length', buf.byteLength);
        this.write(buf);
    }
    this.end();

    return this;
};

const apigw = new express.Router();

// Render endpoint.
apigw
    .route('/render')
    .get(async (req, res, next) => {
        try {
            res.fromLambdaResponse(await handler(req.toLambdaEvent()));
        } catch (err) {
            next(err);
        }
    })
    .post(async (req, res, next) => {
        try {
            res.fromLambdaResponse(await handler(req.toLambdaEvent()));
        } catch (err) {
            next(err);
        }
    });

// Assemble app.
module.exports = express()
    .use(raw({ type: '*/*' }))
    .use(apigw)
    .use((err, req, res, next) => {
        // Error handling.
        console.error('Integration error', err);

        res.status(500)
            .set('Content-Type', 'application/json')
            .send(JSON.stringify({ message: 'Internal server error' }));
    });
