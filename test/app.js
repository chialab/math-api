const querystring = require('querystring');
const { expect } = require('chai');
const request = require('supertest');
const app = require('../src/app.js');

/**
 * PNG file signature (first 8 bytes).
 *
 * @see http://www.libpng.org/pub/png/spec/1.2/PNG-Structure.html#PNG-file-signature
 *
 * @var {Buffer}
 */
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const TEST_INPUTS = {
    'TeX': { input: 'latex', source: 'e^{i \\pi} + 1 = 0' },
    'inline-TeX': { input: 'latex', inline: true, source: 'e^{i \\pi} + 1 = 0' },
    'MathML': { input: 'mathml', source: '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><msup><mi>x</mi><mn>2</mn></msup></math>' },
    'inline-MathML': { input: 'mathml', source: '<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline"><msup><mi>x</mi><mn>2</mn></msup></math>' },
};

// First PNG conversion is always slower. Warm up before tests start to avoid first test always being slow.
before('warm up', function () {
    this.timeout(5000);

    return request(app).get('/render?input=latex&output=png&source=x')
        .catch(console.error);
});

describe('GET /render', function () {
    this.timeout(3000);
    this.slow(200);

    Object.keys(TEST_INPUTS).forEach((alias) => it(`should render ${alias} as MathML`, function () {
        const search = Object.assign({ output: 'mathml' }, TEST_INPUTS[alias]);
        const url = `/render?${querystring.stringify(search)}`;

        return request(app)
            .get(url)
            .expect(200)
            .expect('Content-Type', 'application/mathml+xml')
            .expect((response) => {
                const data = response.text;

                expect(data).to.be.a('string').that.contains('</math>');
            });
    }));

    Object.keys(TEST_INPUTS).forEach((alias) => it(`should render ${alias} as PNG`, function () {
        this.slow(2000);

        const search = Object.assign({ output: 'png' }, TEST_INPUTS[alias]);
        const url = `/render?${querystring.stringify(search)}`;

        return request(app)
            .get(url)
            .expect(200)
            .expect('Content-Type', 'image/png')
            .expect((response) => {
                const data = response.body;

                expect(data.slice(0, PNG_SIGNATURE.byteLength)).to.be.an.instanceOf(Buffer)
                    .that.deep.equals(PNG_SIGNATURE);
            });
    }));

    Object.keys(TEST_INPUTS).forEach((alias) => it(`should render ${alias} as SVG`, function () {
        const search = Object.assign({ output: 'svg' }, TEST_INPUTS[alias]);
        const url = `/render?${querystring.stringify(search)}`;

        return request(app)
            .get(url)
            .expect(200)
            .expect('Content-Type', 'image/svg+xml')
            .expect((response) => {
                const data = response.body.toString();

                expect(data).to.be.a('string').that.contains('</svg>');
            });
    }));

    it('should return "400 Bad Request" with invalid parameters', function () {
        const search = { input: 'latex', output: 'INVALID', source: 'x^2' };
        const url = `/render?${querystring.stringify(search)}`;

        return request(app)
            .get(url)
            .expect(400, { message: 'Invalid output: INVALID' })
            .expect('Content-Type', /^application\/json(?:;|$)/);
    });
});

describe('POST /render', function () {
    this.timeout(3000);
    this.slow(200);

    Object.keys(TEST_INPUTS).forEach((alias) => it(`should render ${alias} as MathML`, function () {
        const search = Object.assign({ output: 'mathml' }, TEST_INPUTS[alias]);

        return request(app)
            .post('/render')
            .set('Content-Type', 'application/json')
            .send(search)
            .expect(200)
            .expect('Content-Type', 'application/mathml+xml')
            .expect((response) => {
                const data = response.text;

                expect(data).to.be.a('string').that.contains('</math>');
            });
    }));

    Object.keys(TEST_INPUTS).forEach((alias) => it(`should render ${alias} as PNG`, function () {
        this.slow(2000);

        const search = Object.assign({ output: 'png' }, TEST_INPUTS[alias]);

        return request(app)
            .post('/render')
            .set('Content-Type', 'application/json')
            .send(search)
            .expect(200)
            .expect('Content-Type', 'image/png')
            .expect((response) => {
                const data = response.body;

                expect(data.slice(0, PNG_SIGNATURE.byteLength)).to.be.an.instanceOf(Buffer)
                    .that.deep.equals(PNG_SIGNATURE);
            });
    }));

    Object.keys(TEST_INPUTS).forEach((alias) => it(`should render ${alias} as SVG`, function () {
        const search = Object.assign({ output: 'svg' }, TEST_INPUTS[alias]);

        return request(app)
            .post('/render')
            .set('Content-Type', 'application/json')
            .send(search)
            .expect(200)
            .expect('Content-Type', 'image/svg+xml')
            .expect((response) => {
                const data = response.body.toString();

                expect(data).to.be.a('string').that.contains('</svg>');
            });
    }));

    it('should return "400 Bad Request" with invalid parameters', function () {
        const search = { input: 'latex', output: 'INVALID', source: 'x^2' };

        return request(app)
            .post('/render')
            .set('Content-Type', 'application/json')
            .send(search)
            .expect(400, { message: 'Invalid output: INVALID' })
            .expect('Content-Type', /^application\/json(?:;|$)/);
    });
});
