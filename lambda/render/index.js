const MathJax = require('mathjax-node-svg2png');
const { parseDataUrl, HttpError } = require('./utils');
const { RESPONSE_TYPES } = require('./config');

const DEFAULT_SETTINGS = process.env.MJAX_SETTINGS ? JSON.parse(process.env.MJAX_SETTINGS) : {};

/** @typedef {'image/png' | 'image/svg+xml' | 'application/mathml+xml'} AcceptHeader */
/** @typedef {{ type: 'latex' | 'mathml', inline: boolean, source: string, config: {} }} RequestBody */
/** @typedef {'TeX' | 'inline-TeX' | 'MathML'} InputFormat */
/** @typedef {'png' | 'svg' | 'mathml'} OutputType */

/**
 * Find header's value by its name.
 *
 * @param {{ [x: string]: string|string[] }} allHeaders Haystack of all headers.
 * @param {string} header Needle.
 * @returns {string|string[]}
 */
const getHeader = (allHeaders, header) => allHeaders[Object.keys(allHeaders).find((h) => h.toLowerCase() === header.toLowerCase())];

/**
 * Detect input format.
 *
 * @param {RequestBody} data Request data.
 * @returns {InputFormat}
 */
const getInputFormat = (data) => {
    switch (data.type) {
        case 'mathml':
            return 'MathML';

        case 'latex':
            if (data.inline) {
                return 'inline-TeX';
            }

            return 'TeX';

        default:
            throw new HttpError(400, `Invalid type: ${data.type || ''}`);
    }
};

/**
 * Get output format.
 *
 * @param {AcceptHeader} accept `Accept` header.
 * @returns {OutputType}
 */
const getOutputFormat = (accept) => {
    switch (accept) {
        case RESPONSE_TYPES.mml:
            return 'mathml';

        case RESPONSE_TYPES.png:
            return 'png';

        case RESPONSE_TYPES.svg:
            return 'svg';

        default:
            throw new HttpError(406, `Not acceptable: ${accept || ''}`);
    }
};

/**
 * Typeset math.
 *
 * @param {RequestBody} input Input data.
 * @param {AcceptHeader} target Target conversion format.
 * @returns {Promise<{ contentType: AcceptHeader, data: string, isBase64Encoded?: boolean }>}
 */
const typeset = async (input, target) => {
    const inputFormat = getInputFormat(input);
    const outputType = getOutputFormat(target);

    if (typeof input.source !== 'string' || input.source.trim() === '') {
        throw new HttpError(400, 'Missing or empty source');
    }

    if (outputType === 'mathml' && inputFormat === 'MathML') {
        // No-op conversion MathML-to-MathML.
        return { contentType: RESPONSE_TYPES.mml, data: input.source };
    }

    const settings = Object.assign(input.config || {}, DEFAULT_SETTINGS);
    MathJax.config({
        MathJax: settings,
    });
    MathJax.start();

    switch (outputType) {
        case 'mathml':
        {
            const res = await MathJax.typeset({ math: input.source, format: inputFormat, mml: true });

            return { contentType: RESPONSE_TYPES.mml, data: res.mml };
        }

        case 'png':
        {
            const res = await MathJax.typeset({ math: input.source, format: inputFormat, png: true });

            let { contentType, data, isBase64Encoded } = parseDataUrl(res.png);

            contentType = contentType || RESPONSE_TYPES.png;
            if (!isBase64Encoded) {
                data = Buffer.from(data).toString('base64');
                isBase64Encoded = true;
            }

            return { contentType, isBase64Encoded, data };
        }

        case 'svg':
        {
            const res = await MathJax.typeset({ math: input.source, format: inputFormat, svg: true });

            return { contentType: RESPONSE_TYPES.svg, data: res.svg };
        }

        default:
            throw new HttpError(400, `Invalid output format: ${outputType}`);
    }
};

/**
 * Typeset maths.
 *
 * @param {{ headers: { [x: string]: string }, body: string }} event AWS API Gateway event.
 * @returns {Promise<{ statusCode: number, headers: { [x: string]: string }, body: string, isBase64Encoded?: boolean }>}
 */
exports.handler = async (event) => {
    try {
        if (getHeader(event.headers, 'content-type') !== 'application/json') {
            throw new HttpError(400, 'Invalid request content type');
        }

        const input = JSON.parse(event.body);
        const accept = getHeader(event.headers, 'accept');

        const { contentType, isBase64Encoded = false, data } = await typeset(input, accept);

        return { statusCode: 200, headers: { 'Content-Type': contentType }, body: data, isBase64Encoded };
    } catch (err) {
        console.error('Error', err);

        let statusCode = 500;
        let headers = { 'Content-Type': 'application/json' };
        let message = err.message;
        if (err instanceof SyntaxError) {
            statusCode = 400;
        } else if (err instanceof HttpError) {
            statusCode = err.statusCode;
            headers = Object.assign(headers, err.headers);
        }

        return { statusCode, headers, body: JSON.stringify({ message }) };
    }
};
