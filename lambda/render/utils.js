/**
 * Parse a data URL into its contents along with its metadata (content type, encoding).
 *
 * @param {string} dataUrl Data URL.
 * @returns {{ contentType: AcceptHeader|null, isBase64Encoded: boolean, data: string }}
 */
exports.parseDataUrl = (dataUrl) => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:') || dataUrl.indexOf(',') === -1) {
        throw new Error('Invalid data URL');
    }

    const [ meta, data ] = dataUrl.split(',', 2);

    const isBase64Encoded = meta.endsWith(';base64');
    const contentType = meta.slice('data:'.length, isBase64Encoded ? (meta.length - ';base64'.length) : undefined) || null;

    return { contentType, isBase64Encoded, data }
};

/**
 * Error class that represents an HTTP error.
 *
 * @property {number} statusCode HTTP response status associated with this error.
 * @property {{ [x: string]: string }} headers Map of additional headers to be set in the response.
 */
exports.HttpError = class HttpError extends Error {
    /**
     * HTTP Error constructor.
     *
     * @param {number} statusCode HTTP status code.
     * @param {string} message Error message.
     * @param {{ [x: string]: string }} headers Response HTTP headers.
     */
    constructor(statusCode, message, headers = {}) {
        super(message);

        this.statusCode = statusCode;
        this.headers = headers;
    }
};
