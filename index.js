const http = require('http');
const RequestHandler = require('./src/RequestHandler.js').RequestHandler;

const port = process.env.MJAX_PORT || 0;

const requestHandler = new RequestHandler();
requestHandler.log = (msg) => console.log(`=====> ${msg}`);
if (!!process.env.MJAX_SETTINGS) {
    requestHandler.defaultSettings = JSON.parse(process.env.MJAX_SETTINGS);
}
const server = http.createServer(requestHandler.serve.bind(requestHandler));

server.on('listening', () => {
    requestHandler.log(`Server running at http://localhost:${server.address().port}/convert`);
});
server.listen(port);
