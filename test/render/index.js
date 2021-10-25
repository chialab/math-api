const { expect } = require('chai');
const { render } = require('../../src/render/index.js');

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

    return render({ input: 'latex', output: 'png', source: 'x^2' })
        .catch(console.error);
});

describe('index#render', function () {
    this.timeout(3000);
    this.slow(200);

    Object.keys(TEST_INPUTS).forEach((alias) => it(`should render ${alias} as MathML`, async function () {
        if (TEST_INPUTS[alias].input === 'mathml') {
            this.timeout(100);
            this.slow(5);
        }

        const event = Object.assign({ output: 'mathml' }, TEST_INPUTS[alias]);
        const actual = await render(event);

        expect(actual).to.be.an('object').with.keys('contentType', 'data');
        expect(actual.contentType).to.be.a('string').that.equals('application/mathml+xml');
        expect(actual.data).to.be.a('string').that.contains('</math>');
    }));

    Object.keys(TEST_INPUTS).forEach((alias) => it(`should render ${alias} as PNG`, async function () {
        this.slow(2000);

        const event = Object.assign({ output: 'png', width: 100 }, TEST_INPUTS[alias]);
        const actual = await render(event);

        expect(actual).to.be.an('object').with.keys('contentType', 'isBase64Encoded', 'data');
        expect(actual.contentType).to.be.a('string').that.equals('image/png');
        expect(actual.isBase64Encoded).to.be.a('boolean').that.equals(true);
        expect(actual.data).to.be.a('string').that.matches(/^[a-zA-Z0-9+/=]+$/);
        expect(Buffer.from(actual.data, 'base64').slice(0, PNG_SIGNATURE.byteLength)).to.be.an.instanceOf(Buffer)
            .that.deep.equals(PNG_SIGNATURE);
    }));

    Object.keys(TEST_INPUTS).forEach((alias) => it(`should render ${alias} as SVG`, async function () {
        const event = Object.assign({ output: 'svg' }, TEST_INPUTS[alias]);
        const actual = await render(event);

        expect(actual).to.be.an('object').with.keys('contentType', 'data');
        expect(actual.contentType).to.be.a('string').that.equals('image/svg+xml');
        expect(actual.data).to.be.a('string').that.match(/<svg .+<\/svg>/);
    }));

    Object.keys(TEST_INPUTS).forEach((alias) => it(`should render ${alias} as AssistiveSVG`, async function () {
        const event = Object.assign({ output: 'assistiveSVG' }, TEST_INPUTS[alias]);
        const actual = await render(event);

        expect(actual).to.be.an('object').with.keys('contentType', 'data');
        expect(actual.contentType).to.be.a('string').that.equals('application/json');

        const actualData = JSON.parse(actual.data);
        expect(actualData).to.be.an('object').with.keys('svg', 'assistiveML');
        expect(actualData.svg).to.be.a('string').that.match(/<svg .+<\/svg>/);
        expect(actualData.assistiveML).to.be.a('string').that.match(/<mjx-assistive-mml .+<\/mjx-assistive-mml>/);
    }));

    it('should throw with invalid input type', async function () {
        const event = { input: 'INVALID', output: 'svg', source: 'x^2' };

        try {
            await render(event);
            expect.fail('Did not throw');
        } catch (err) {
            expect(err).to.be.an.instanceOf(Error)
                .that.has.property('message', 'Invalid input: INVALID');
        }
    });

    it('should throw with invalid output type', async function () {
        const event = { input: 'latex', output: 'INVALID', source: 'x^2' };

        try {
            await render(event);
            expect.fail('Did not throw');
        } catch (err) {
            expect(err).to.be.an.instanceOf(Error)
                .that.has.property('message', 'Invalid output: INVALID');
        }
    });

    it('should throw with invalid source', async function () {
        const event = { input: 'mathml', output: 'svg', source: 'x^2' };

        try {
            await render(event);
            expect.fail('Did not throw');
        } catch (err) {
            expect(err).to.be.an.instanceOf(Error)
                .that.has.property('message')
                    .that.contains('MathML must be formed by a <math> element, not <#text>')
                    .and.that.does.not.contain('\n');
        }
    });
});
