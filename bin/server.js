const http = require('http');
const url = require('url');
const { handler } = require('../lambda/render/index');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const port = process.env.PORT || 3000;

/**
 * Log in commonlog format.
 *
 * @param {Date} date Request date.
 * @param {http.IncomingMessage} req Request.
 * @param {http.ServerResponse} res Response.
 * @param {number} bytesSent Number of bytes sent in response's body.
 * @returns {void}
 */
const commonLog = (date, req, res, bytesSent) => {
    const pad = (val) => ('00' + val.toString()).slice(-2);
    const tzOffset = Math.abs(date.getTimezoneOffset());
    const tzOffsetStr = `${date.getTimezoneOffset() >= 0 ? '+' : '-'}${pad(Math.floor(tzOffset / 60))}${pad((tzOffset % 60))}`;;
    const dateStr = `${pad(date.getDate())}/${MONTHS[date.getMonth()]}/${date.getFullYear()}:${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${tzOffsetStr}`;

    console.log(`${req.connection.remoteAddress} - - [${dateStr}] "${req.method} ${req.url} HTTP/${req.httpVersion}" ${res.statusCode} ${bytesSent || '-'}`);
};

const server = http.createServer((req, res) => {
    const date = new Date();
    const requestUrl = url.parse(req.url);

    /**
     * Send response.
     *
     * @param {number} statusCode Response status code.
     * @param {http.OutgoingHttpHeaders} headers Response HTTP headers.
     * @param {string|ArrayBuffer|undefined} body Response body.
     * @returns {}
     */
    const send = (statusCode, headers = {}, body = undefined) => {
        if (body) {
            res.setHeader('Content-Length', Buffer.byteLength(body));
        }

        res.writeHead(statusCode, headers);
        res.end(body, () => {
            commonLog(date, req, res, body ? Buffer.byteLength(body) : 0);
        });
    };

    /**
     * Send an HTTP error.
     *
     * @param {number} statusCode Response status code.
     * @param {string|undefined} message Error message.
     * @param {http.OutgoingHttpHeaders} headers Response HTTP headers.
     * @returns {void}
     */
    const error = (statusCode, message = undefined, headers = {}) => send(
        statusCode,
        Object.assign({ 'Content-Type': 'application/json' }, headers),
        JSON.stringify({ message: message || http.STATUS_CODES[statusCode] }),
    );

    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
    });
    req.on('end', async () => {
        try {
            const event = {
                headers: req.headers,
                body,
            };

            if (requestUrl.pathname === '/convert') {
                // Convert.
                switch (req.method) {
                    case 'GET':
                    case 'POST':
                    {
                        const { statusCode, headers, body, isBase64Encoded = false } = await handler(event);

                        if (isBase64Encoded) {
                            return send(statusCode, headers, Buffer.from(body, 'base64'));
                        }

                        return send(statusCode, headers, body);
                    }

                    default:
                        return error(405, `Method not allowed: ${req.method}`, { 'Allow': 'GET,POST' });
                }
            }

            return error(404);
        } catch (err) {
            console.error(err);

            return error(500);
        }
    });
});

server.on('listening', () => {
    console.error(`Server running at http://localhost:${server.address().port}/convert`);
});
server.listen(port);
