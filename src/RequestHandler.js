
const http = require('http');
const url = require('url');
const mathjax = require('mathjax-node');
const _ = require('underscore');

/**
 * @const {Array.<string>} List of accepted MIME types.
 */
const validMimeTypes = [
    'application/mathml+xml',
    'image/png',
    'image/svg+xml'
];

/**
 * Handle requests.
 * @constructor
 */
class RequestHandler {
    constructor() {
        /**
         * Logger.
         *
         * @param {function(string)}
         */
        this.log = console.log;

        /**
         * MathJax default settings.
         *
         * @param {Object}
         */
        this.defaultSettings = {
            menuSettings: {semantics: true, texHints:false}
        };
    }

    /**
     * Set of default headers to be added to every response.
     *
     * @return {Object.<string, string>}
     */
    _getDefaultHeaders() {
        return {
            'Access-Control-Allow-Origin': '*',
        };
    }

    /**
     * Send an error response.
     *
     * @param {!number} statusCode HTTP status code.
     * @param {?string} message response message
     */
    _sendError(statusCode, message) {
        statusCode = parseInt(statusCode)

        let response = {
            code: parseInt(statusCode),
            message: message || http.STATUS_CODES[statusCode],
            url: this.req.url,
        };

        this.res.setHeader('Content-Type', 'application/json');
        this.res.writeHead(statusCode, this._getDefaultHeaders());
        this.res.end(JSON.stringify(response));
    }

    /**
     * Handle an `OPTIONS` request.
     */
    _handleOptions() {
        this.res.setHeader('Access-Control-Allow-Methods', 'GET');
        this.res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        this.res.writeHead(200, this._getDefaultHeaders());
        this.res.end();
    }

    /**
     * Parse request data.
     *
     * @param {?string} body Request body.
     * @return {?Object}
     */
    _input(body) {
        let queryString = url.parse(this.req.url).query;

        if (this.req.headers['content-type'] === 'application/json') {
            try {
                return JSON.parse(body || decodeURIComponent(queryString));
            } catch (err) {
                return null;
            }
        }

        try {
            return JSON.parse(decodeURIComponent(queryString));
        } catch (err) {
            return require('querystring').parse(queryString);
        }
    }

    /**
     * Parse `Accept` header and return most appropriate MIME type.
     *
     * @return {(string|boolean)}
     */
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

        return acceptedMime;
    }

    /**
     * Serve a single request.
     *
     * @param {http.IncomingMessage} req Server request object.
     * @param {http.ServerResponse} res Server response object.
     */
    serve(req, res) {
        console.time('serve');
        console.time('input');
        this.req = req;
        this.res = res;

        let body = '';
        this.req.on('data', (chunk) => {
            body += chunk;
        });
        this.req.on('end', () => {
            console.timeEnd('input');
            this._serve(body)
                .then(
                    (data) => {
                        console.timeEnd('serve');
                        this.log(`${this.req.method} ${this.req.url} -> ${this.res.statusCode}`);
                    },
                    (err) => {
                        console.timeEnd('serve');
                        console.error(err);
                        this.log(`${this.req.method} ${this.req.url} -> ${this.res.statusCode}`);
                    }
                );
            return;
            try {
                this._serve(body);
            } catch (err) {
                if (!Number.isInteger(err)) {
                    this.log(err);
                    err = 500;
                }
                this._sendError(err);
            }

            this.log(`${this.req.method} ${this.req.url} -> ${this.res.statusCode}`);
        });
    }

    /**
     * Worker for serving requests.
     *
     * @param {string} body Request body.
     * @return {Promise}
     */
    _serve(body) {
        console.time('prepare');
        // URL.
        if (url.parse(this.req.url).pathname !== '/convert') {
            this._sendError(404);

            return;
        }

        // Request method.
        if (this.req.method === 'OPTIONS') {
            this._handleOptions();

            return;
        }
        if (this.req.method !== 'GET') {
            this.res.setHeader('Allow', 'GET');
            this._sendError(405);

            return;
        }

        // Request data.
        let contentType = this.req.headers['content-type'];
        if (contentType && contentType !== 'application/json') {
            this._sendError(400, 'Unsupported Content-Type (must be "application/json")');

            return;
        }
        let data = this._input(body);

        // Accepted MIME type.
        let accepts = this._accepts();
        if (!accepts) {
            this._sendError(406);

            return;
        }

        return this.render(data, accepts)
            .then(
                (data) => {
                    this.res.setHeader('Content-Type', accepts);
                    this.res.writeHead(200, this._getDefaultHeaders());
                    this.res.end(data);
                },
                (err) => {
                    this._sendError(err.code, err.message);
                }
            );
    }

    /**
     * Validate request data.
     *
     * @param {?Object} data Request data.
     * @return {(string|boolean)}
     */
    validate(data) {
        if (!data) {
            return 'Empty data or invalid JSON';
        }
        if (!data.source) {
            return 'Missing or empty "source"';
        }
        if (['latex', 'mathml'].indexOf(data.type) === -1) {
            return 'Missing or invalid "type" (must be one of "latex" or "mathml")';
        }

        return true;
    }

    /**
     * Render LaTeX or MathML.
     *
     * @param {?Object} data Request data.
     * @param {string} mimeType Target MIME type.
     * @return {Promise}
     */
    render(data, mimeType) {
        // Basic input validation.
        let validation = this.validate(data);
        if (validation !== true) {
            return Promise.reject({code: 400, message: validation});
        }

        let type = 'TeX';
        if (data.type == 'mathml') {
            type = 'MathML';
        } else if (data.inline) {
            type = 'inline-TeX';
        }

        if (mimeType === 'application/mathml+xml' && type === 'MathML') {
            return Promise.reject({code: 400, message: 'Nothing to convert'});
        }

        console.timeEnd('prepare');
        console.time('render');

        let settings = _.defaults(data.config || {}, this.defaultSettings);
        mathjax.config({
            MathJax: settings,
        });
        mathjax.start();

        return new Promise((resolve, reject) => {
            mathjax.typeset(
                {
                    math: data.source,
                    format: type,
                    mml: (mimeType === 'application/mathml+xml'),
                    png: (mimeType === 'image/png'),
                    svg: (mimeType === 'image/svg+xml'),
                },
                (data) => {
                    console.timeEnd('render');
                    if (data.errors) {
                        reject({code: 400, message: 'Invalid "source"'});
                    }

                    if (data.png) {
                        data.png = new Buffer(data.png.slice(22), 'base64');
                    }

                    resolve(data.mml || data.png || data.svg);
                }
            );
        });
    }
}

exports.RequestHandler = RequestHandler;
