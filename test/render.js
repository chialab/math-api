const expect = require('chai').expect;
const { handler } = require('../lambda/render/index');
const { RESPONSE_TYPES } = require('../lambda/render/config');
const { parseDataUrl } = require('../lambda/render/utils');

const TEST_INPUTS = {
    'TeX': { type: 'latex', source: 'e^{i \\pi} + 1 = 0' },
    'inline-TeX': { type: 'latex', inline: true, source: 'e^{i \\pi} + 1 = 0' },
    'MathML': { type: 'mathml', source: '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><msup><mi>x</mi><mn>2</mn></msup></math>' },
    'inline-MathML': { type: 'mathml', source: '<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline"><msup><mi>x</mi><mn>2</mn></msup></math>' },
};

describe('index#handler', function () {
    this.timeout(5000);
    this.slow(200);

    before('warm up', async function () {
        // First conversion is always slower. Warm up before tests start to avoid first test always being slow.
        try {
            await handler({
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': RESPONSE_TYPES.png,
                },
                body: JSON.stringify({ type: 'latex', source: 'x^2' }),
            });
        } catch (err) {
            console.log(err);
        }
    });

    Object.keys(TEST_INPUTS).forEach((alias) => it(`should convert ${alias} to MathML`, async function () {
        if (TEST_INPUTS[alias].type === 'mathml') {
            this.timeout(100);
            this.slow(5);
        }

        const event = {
            headers: {
                'content-type': 'application/json',
                'accept': RESPONSE_TYPES.mml,
            },
            body: JSON.stringify(TEST_INPUTS[alias]),
        };

        const actual = await handler(event);

        expect(actual).to.be.an('object').with.keys('statusCode', 'headers', 'body', 'isBase64Encoded');
        expect(actual.statusCode).to.be.a('number').that.equals(200);
        expect(actual.headers).to.be.an('object').that.deep.equals({ 'Content-Type': RESPONSE_TYPES.mml });
        expect(actual.body).to.be.a('string').that.contains('</math>');
        expect(actual.isBase64Encoded).to.be.a('boolean').that.equals(false);
    }));

    Object.keys(TEST_INPUTS).forEach((alias) => it(`should convert ${alias} to PNG`, async function () {
        this.slow(2000);

        const event = {
            headers: {
                'content-type': 'application/json',
                'accept': RESPONSE_TYPES.png,
            },
            body: JSON.stringify(TEST_INPUTS[alias]),
        };

        const actual = await handler(event);

        expect(actual).to.be.an('object').with.keys('statusCode', 'headers', 'body', 'isBase64Encoded');
        expect(actual.statusCode).to.be.a('number').that.equals(200);
        expect(actual.headers).to.be.an('object').that.deep.equals({ 'Content-Type': RESPONSE_TYPES.png });
        expect(actual.body).to.be.a('string');
        expect(actual.isBase64Encoded).to.be.a('boolean').that.equals(true);
    }));

    Object.keys(TEST_INPUTS).forEach((alias) => it(`should convert ${alias} to SVG`, async function () {
        const event = {
            headers: {
                'content-type': 'application/json',
                'accept': RESPONSE_TYPES.svg,
            },
            body: JSON.stringify(TEST_INPUTS[alias]),
        };

        const actual = await handler(event);

        expect(actual).to.be.an('object').with.keys('statusCode', 'headers', 'body', 'isBase64Encoded');
        expect(actual.statusCode).to.be.a('number').that.equals(200);
        expect(actual.headers).to.be.an('object').that.deep.equals({ 'Content-Type': RESPONSE_TYPES.svg });
        expect(actual.body).to.be.a('string').that.contains('</svg>');
        expect(actual.isBase64Encoded).to.be.a('boolean').that.equals(false);
    }));
});

describe('utils#parseDataUrl', function () {
    this.timeout(100);
    this.slow(5);

    const INVALID = [
        123,
        true,
        undefined,
        [ 'data:', ',' ],
        'abc',
        'data:hello',
        ',',
    ];
    const VALID = [
        ['data:,hello+world', { contentType: null, data: 'hello+world', isBase64Encoded: false }],
        ['data:text/html,<b>hello</b>', { contentType: 'text/html', data: '<b>hello</b>', isBase64Encoded: false }],
        ['data:application/json;base64,eyJoZWxsbyI6ICJ3b3JsZCJ9Cg==', { contentType: 'application/json', data: 'eyJoZWxsbyI6ICJ3b3JsZCJ9Cg==', isBase64Encoded: true }],
        ['data:;base64,aGVsbG8gd29ybGQK', { contentType: null, data: 'aGVsbG8gd29ybGQK', isBase64Encoded: true }],
    ];

    INVALID.map((url) => it(`should detect invalid data URL: ${url}`, function () {
        let res, err;
        try {
            res = parseDataUrl(url);
        } catch (error) {
            err = error;
        }

        expect(res).to.be.undefined;
        expect(err).to.be.an.instanceOf(Error).that.has.property('message', 'Invalid data URL');
    }));

    VALID.map(([ url, expected ]) => it(`should parse data URL: ${url}`, function () {
        const actual = parseDataUrl(url);

        expect(actual).to.be.an('object').that.deep.equals(expected);
    }));
});
