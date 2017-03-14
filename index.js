const http = require('http');
const url = require('url');
const mathjax = require('mathjax-node/lib/mj-single.js');
const _ = require('lodash');

const hostname = '0.0.0.0';
const port = process.env.MJAX_PORT || 0;

const defaultSettings = JSON.parse(process.env.MJAX_SETTINGS || '{"menuSettings":{"semantics":true,"texHints":false}}')

const validMimeTypes = [
    'application/mathml+xml',
    'image/png',
    'image/svg+xml'
];

class RequestHandler {
    // Set of default headers to be added to every response.
    _getDefaultHeaders() {
        return {
            'Access-Control-Allow-Origin': '*',
        };
    }

    // Send an error response.
    _sendError(statusCode) {
        statusCode = parseInt(statusCode)

        let response = {
            'code': parseInt(statusCode),
            'message': http.STATUS_CODES[statusCode],
            'url': this.req.url,
        };

        this.res.setHeader('Content-Type', 'application/json');
        this.res.writeHead(statusCode, this._getDefaultHeaders());
        this.res.end(JSON.stringify(response));
    }

    // Handle an `OPTIONS` request.
    _handleOptions() {
        this.res.setHeader('Access-Control-Allow-Methods', 'GET');
        this.res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        this.res.writeHead(200, this._getDefaultHeaders());
        this.res.end();
    }

    // Parse `Accept` header and return most appropriate mime type.
    _accepts() {
        let header = (this.req.headers['accept'] || '').split(','),
            acceptedMime = false,
            acceptedPriority = 0;

        for (let accept of header) {
            accept = accept.split(';');

            let mime = accept[0],
                priority = accept.length >= 2 ? parseFloat(accept[1].substr(2)) : 1;

            if (validMimeTypes.indexOf(mime) === -1 || priority <= acceptedPriority) {
                continue;
            }

            acceptedMime = mime;
            acceptedPriority = priority;
        }

        if (acceptedMime === false) {
            throw 406;
        }

        return acceptedMime;
    }

    // Serve a single request.
    serve(req, res) {
        this.req = req;
        this.res = res;
        this.body = '';

        this.req.on('data', (chunk) => {
            this.body += chunk;
        });
        this.req.on('end', () => {
            try {
                if (!this.body) {
                    this.body = decodeURIComponent(url.parse(this.req.url).query);
                } else if (this.req.headers['content-type'] !== 'application/json') {
                    throw 415;
                }

                this._serve();
            } catch (err) {
                this._sendError(Number.isInteger(err) ? err : 500);
            }

            console.log(`=====> ${req.method} ${req.url} -> ${res.statusCode}`);
        });
    }

    // Worker for serving requests.
    _serve(req, res) {
        // URL.
        if (url.parse(this.req.url).pathname !== '/convert') {
            throw 404;
        }

        // Request method.
        if (this.req.method === 'OPTIONS') {
            this._handleOptions();

            return;
        }
        if (this.req.method !== 'GET') {
            this.res.setHeader('Allow', 'GET');

            throw 405;
        }

        // Request content type and body.
        try {
            this.body = JSON.parse(this.body);
        } catch (err) {
            throw 400;
        }

        this._render();
    }

    _render() {
        // Type.
        if (!this.body.source || ['latex', 'mathml'].indexOf(this.body.type) === -1) {
            throw 400;
        }

        let type = 'TeX';
        if (this.body.type == 'mathml') {
            type = 'MathML';
        } else if (this.body.inline) {
            type = 'inline-TeX';
        }

        let settings = _.defaults(this.body.config || {}, defaultSettings);
        mathjax.config({
            MathJax: settings,
        });
        mathjax.start();

        let accept = this._accepts();
        if (accept === 'application/mathml+xml' && type === 'MathML') {
            throw 400;
        }

        mathjax.typeset(
            {
                math: this.body.source,
                format: type,
                mml: (accept === 'application/mathml+xml'),
                png: (accept === 'image/png'),
                svg: (accept === 'image/svg+xml'),
            },
            (data) => {
                if (data.errors) {
                    throw 400;
                }

                this.res.setHeader('Content-Type', accept);
                this.res.writeHead(200, this._getDefaultHeaders());

                if (data.png) {
                    data.png = new Buffer(data.png.slice(22), 'base64');
                }

                this.res.end(data.mml || data.png || data.svg);
            }
        );
    }
}

const requestHandler = new RequestHandler();
const server = http.createServer(requestHandler.serve.bind(requestHandler));

server.listen(port, hostname, () => {
    console.log(`=====> Server running at http://${hostname}:${server.address().port}/`);
});
