const svg2png = require('svg2png');

/** @typedef {{ input: 'latex', inline?: boolean } | { input: 'mathml' }} InputDefinition */
/** @typedef {{ output: 'mathml' | 'svg' } | { output: 'png', width?: number, height?: number }} OutputDefinition */
/** @typedef {InputDefinition & OutputDefinition & { source: string }} Input */
/** @typedef {'application/mathml+xml' | 'image/png' | 'image/svg+xml'} ContentType */
/** @typedef {{ contentType: ContentType, isBase64Encoded?: boolean, data: string }} Output */

/** @typedef {{ httpMethod: 'GET' | 'POST', headers: { [x: string]: string }, queryStringParameters: { [x: string]: string }, body: string }} ApiGatewayProxyEvent */
/** @typedef {{ statusCode: number, headers?: { [x: string]: string }, body?: string | Buffer, isBase64Encoded?: boolean }} ApiGatewayProxyResponse */

/**
 * Response types.
 *
 * @var {{ [x: OutputType]: ContentType }}
 */
const RESPONSE_TYPES = {
    mathml: 'application/mathml+xml',
    png: 'image/png',
    svg: 'image/svg+xml',
    json: 'application/json',
};

/**
 * MathJax settings.
 *
 * @var {{}}
 */
const defaultConfiguration = {
    loader: {
        paths: {mathjax: 'mathjax/es5'},
        require: require,
        load: ['adaptors/liteDOM', 'input/mml', 'input/tex-full', 'output/svg']
    },
}
const MJAX_SETTINGS = process.env.MJAX_SETTINGS ? JSON.parse(process.env.MJAX_SETTINGS) : defaultConfiguration;
MathJax = MJAX_SETTINGS;

require('mathjax/es5/tex-mml-svg.js');


/**
 * Detect format.
 *
 * @param {InputDefinition} input Input.
 * @returns {'TeX' | 'inline-TeX' | 'MathML'}
 */
const getFormat = (input) => {
    switch (input.input) {
        case 'mathml':
            return 'MathML';

        case 'latex':
            if (input.inline) {
                return 'inline-TeX';
            }

            return 'TeX';

        default:
            throw new Error(`Invalid input: ${input.input || ''}`);
    }
};

/**
 * Typeset math.
 *
 * @param {{ math: string, format: 'TeX' | 'inline-TeX' | 'MathML', mml?: boolean, svg?: boolean }} data Data.
 * @returns {Promise<{ mml?: string, svg?: string }>}
 */
const typeset = async (data) => {
    try {
        await MathJax.startup.promise;
        switch (data.format) {
            case 'TeX':
            case 'inline-TeX':
                if (data.mml) {
                    return MathJax.tex2mmlPromise(data.math);
                }
                if (data.svg) {
                    return MathJax.tex2svgPromise(data.math);
                }
                throw new Error(`Supported output formats for ${data.format} input are: MathML, SVG, AssistiveSVG`);
            case 'MathML':
                if (data.svg) {
                    return MathJax.mathml2svgPromise(data.math);
                }
                throw new Error(`Supported output formats for ${data.format} input are: SVG, AssistiveSVG`);
            default:
                throw new Error(`Unsupported input format: ${data.format}`);
        }
    } catch (err) {
        console.error('MathJax error', err);

        if (err instanceof Error) {
            throw err;
        }
        if (typeof err === 'string') {
            throw new Error(`MathJax error: ${err}`);
        }

        // Syntax error.
        if (Array.isArray(err) && typeof err[0] === 'string') {
            throw new Error(`Invalid source: ${err[0].replace(/[\n\r]+/g, ' ')}`);
        }
        throw new Error('Invalid source');
    }
};

/**
 * Render math.
 *
 * @param {Typesetted} Result of a typesetted input.
 * @returns {svg: string, assistiveML: string}
 */
const getSvgAndAssistiveML = (typesetted) => {
    const svgAndAssistiveML = /(<svg .+<\/svg>)(<mjx-assistive-mml .+)/;
    const groups = MathJax.startup.adaptor.innerHTML(typesetted).match(svgAndAssistiveML);
    return {
        svg: groups[1],
        assistiveML: groups[2]
    }
}

/**
 * Render math.
 *
 * @param {Input} event Input event.
 * @returns {Promise<Output>}
 */
exports.render = async (event) => {
    if (event.input === 'mathml' && event.output === 'mathml') {
        // No-op conversion MathML-to-MathML.
        return { contentType: RESPONSE_TYPES.mathml, data: event.source };
    }

    const format = getFormat(event);
    const math = event.source;
    switch (event.output) {
        case 'mathml':
        {
            const res = await typeset({ math, format, mml: true });

            return { contentType: RESPONSE_TYPES.mathml, data: res };
        }

        case 'png':
        {
            const res = await typeset({ math, format, svg: true });

            const { svg } = getSvgAndAssistiveML(res);
            const { width, height } = event;
            const data = await svg2png(svg, { width, height });

            return { contentType: RESPONSE_TYPES.png, isBase64Encoded: true, data: data.toString('base64') };
        }

        case 'svg':
        {
            const res = await typeset({ math, format, svg: true });

            const { svg } = getSvgAndAssistiveML(res);

            return { contentType: RESPONSE_TYPES.svg, data: svg };
        }

        case 'assistiveSVG':
        {
            const res = await typeset({ math, format, svg: true });

            const { svg, assistiveML } = getSvgAndAssistiveML(res);

            return { contentType: RESPONSE_TYPES.json, data: JSON.stringify({svg, assistiveML}) };
        }

        default:
            throw new Error(`Invalid output: ${event.output || ''}`);
    }
};

/**
 * Render math for AWS API Gateway.
 *
 * @param {ApiGatewayProxyEvent} event Incoming event.
 * @returns {Promise<ApiGatewayProxyResponse>}
 */
exports.handler = async (event) => {
    try {
        let input;
        if (event.httpMethod === 'GET') {
            input = event.queryStringParameters;
            if (typeof input.inline !== 'undefined') {
                input.inline = input.inline === '1';
            }
            if (typeof input.width !== 'undefined') {
                input.width = parseInt(input.width, 10);
            }
            if (typeof input.height !== 'undefined') {
                input.height = parseInt(input.height, 10);
            }
        } else {
            input = JSON.parse(event.body);
        }

        const { contentType, isBase64Encoded = false, data } = await this.render(input);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': contentType,
            },
            body: data,
            isBase64Encoded,
        };
    } catch (err) {
        if (!(err instanceof Error)) {
            throw new Error(err);
        }
        if (!(err instanceof SyntaxError) && !err.message.startsWith('Invalid ')) {
            throw err;
        }

        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: err.message }),
        };
    }
};
