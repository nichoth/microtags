import { define } from '../src/index.js'

// The server/browser attribute parity contract. Each case renders the
// same markup input with a templater and expects the same HTML. The SSR
// suite runs it against the server `html`; the browser suite runs it
// against the browser `html` and compares the two outputs.

export type Templater = (
    strings:TemplateStringsArray,
    ...values:unknown[]
) => { toString():string }

export interface ParityCase {
    name:string;
    input:(html:Templater) => { toString():string };
    expected:string;
}

// A host with one declared prop that renders its children as is, so it
// behaves the same under either templater.
export const ParityHost = define('parity-host')
    .withProps(p => ({ label: p.string() }))
    .render(({ children }) => children)
    .setup(() => {})

const Host = ParityHost

/**
 * Remove region and children markers. Only the server emits them.
 */
export function stripMarkers (s:string):string {
    return s.replace(/<!--\[c?-->|<!--\]-->/g, '')
}

export const parityCases:ParityCase[] = [
    {
        name: 'plain attribute with &',
        input: html => html`<a href=${'/x?a=1&b=2'}>x</a>`,
        expected: '<a href="/x?a=1&amp;b=2">x</a>',
    },
    {
        name: 'plain attribute with quotes',
        input: html => html`<p title=${'say "hi" \'yo\''}></p>`,
        expected: '<p title="say &quot;hi&quot; &#39;yo&#39;"></p>',
    },
    {
        name: 'plain attribute with <',
        input: html => html`<p title=${'a<b>c'}></p>`,
        expected: '<p title="a&lt;b&gt;c"></p>',
    },
    {
        name: 'plain attribute from a function',
        input: html => html`<p title=${() => 'a&b'}></p>`,
        expected: '<p title="a&amp;b"></p>',
    },
    {
        name: 'plain attribute with a number',
        input: html => html`<p data-n=${0}></p>`,
        expected: '<p data-n="0"></p>',
    },
    {
        name: 'plain attributes true, false, null, undefined',
        input: html => html`<p
            a=${true} b=${false} c=${null} d=${undefined}
        ></p>`,
        expected: '<p a></p>',
    },
    {
        name: 'host attribute with &',
        input: html => html`<${Host} data-x=${'/x?a=1&b=2'} />`,
        expected: '<parity-host data-x="/x?a=1&amp;b=2"></parity-host>',
    },
    {
        name: 'host attribute with quotes',
        input: html => html`<${Host} data-x=${'say "hi" \'yo\''} />`,
        expected: '<parity-host data-x="say &quot;hi&quot; ' +
            '&#39;yo&#39;"></parity-host>',
    },
    {
        name: 'host attribute with <',
        input: html => html`<${Host} data-x=${'a<b>c'} />`,
        expected: '<parity-host data-x="a&lt;b&gt;c"></parity-host>',
    },
    {
        name: 'host attribute from a function',
        input: html => html`<${Host} data-x=${() => 'a&b'} />`,
        expected: '<parity-host data-x="a&amp;b"></parity-host>',
    },
    {
        name: 'host attribute with a number',
        input: html => html`<${Host} data-n=${0} />`,
        expected: '<parity-host data-n="0"></parity-host>',
    },
    {
        name: 'host attributes true, false, null, undefined',
        input: html => html`<${Host}
            a=${true} b=${false} c=${null} d=${undefined}
        />`,
        expected: '<parity-host a></parity-host>',
    },
    {
        name: 'host declared prop with & and <',
        input: html => html`<${Host} label=${'a&b<c'} />`,
        expected: '<parity-host label="a&amp;b&lt;c"></parity-host>',
    },
    {
        name: 'nested markup',
        input: html => html`<p>${
            html`<em title=${'a&b'}>${'x<y'}</em>`
        }</p>`,
        expected: '<p><em title="a&amp;b">x&lt;y</em></p>',
    },
    {
        name: 'nested markup as host children',
        input: html => html`<${Host} data-x=${'"'}>${
            html`<b title=${'a&b'}>${'&'}</b>`
        }</${Host}>`,
        expected: '<parity-host data-x="&quot;">' +
            '<b title="a&amp;b">&amp;</b></parity-host>',
    },
]
