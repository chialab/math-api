const RequestHandler = require('./src/RequestHandler.js').RequestHandler;

const requestHandler = new RequestHandler();
if (!!process.env.MJAX_SETTINGS) {
    requestHandler.defaultSettings = JSON.parse(process.env.MJAX_SETTINGS);
}

exports.handler = (event, context, callback) => {
    console.time('render');
    const contentType = event.accept || 'image/svg+xml';
    requestHandler.render(event.body, contentType)
        .then(
            (data) => {
                console.timeEnd('render');
                callback(null, { data, contentType });
            },
            (error) => callback);
};
