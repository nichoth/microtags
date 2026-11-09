import { test } from '@substrate-system/tapzero'
import ts from 'typescript'
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

// Will import from src once it exists
import { transform } from '../src/build.js'

/**
 * Parse source and return whether any `.render(` call exists
 * in a define chain (a call chain rooted at a `define(...)` call).
 */
function hasRenderInDefineChain (code:string):boolean {
    const sf = ts.createSourceFile(
        'test.ts', code, ts.ScriptTarget.Latest, true
    )
    let found = false
    function visit (node:ts.Node) {
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text === 'render'
        ) {
            if (isDefineChainRoot(node.expression.expression)) {
                found = true
            }
        }
        ts.forEachChild(node, visit)
    }
    ts.forEachChild(sf, visit)
    return found
}

function isDefineChainRoot (node:ts.Node):boolean {
    if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression)
    ) {
        return node.expression.text === 'define' ||
            node.expression.text === 'd'
    }
    if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
    ) {
        return isDefineChainRoot(node.expression.expression)
    }
    return false
}

test('strip: define chain .render() is removed', t => {
    const input = `
import { define } from 'microtags'
const El = define('my-el')
    .render(() => '<p>hi</p>')
    .setup(() => {})
`
    const result = transform(input)
    t.ok(!hasRenderInDefineChain(result.code),
        'no .render() call in define chain after transform')
    t.ok(result.code.includes('.setup('),
        'setup call is preserved')
})

test('strip: works with aliased import', t => {
    const input = `
import { define as d } from 'microtags'
const El = d('my-el')
    .render(() => '<p>hi</p>')
    .setup(() => {})
`
    const result = transform(input)
    t.ok(!hasRenderInDefineChain(result.code),
        'no .render() call with aliased define')
})

test('keep: client:true preserves .render()', t => {
    const input = `
import { define } from 'microtags'
const El = define('my-el')
    .render(() => '<p>hi</p>', { client: true })
    .setup(() => {})
`
    const result = transform(input)
    t.ok(hasRenderInDefineChain(result.code),
        '.render() with client:true is kept')
})

test('keep: keep option preserves .render() by tag name', t => {
    const input = `
import { define } from 'microtags'
const El = define('my-tag')
    .render(() => '<p>hi</p>')
    .setup(() => {})
`
    const result = transform(input, { keep: ['my-tag'] })
    t.ok(hasRenderInDefineChain(result.code),
        '.render() kept when tag in keep list')
})

test('keep: different tag name still strips', t => {
    const input = `
import { define } from 'microtags'
const El = define('my-tag')
    .render(() => '<p>hi</p>')
    .setup(() => {})
`
    const result = transform(input, { keep: ['other-tag'] })
    t.ok(!hasRenderInDefineChain(result.code),
        '.render() stripped when tag not in keep list')
})

test('warning: .render() outside define chain', t => {
    const input = `
import { define } from 'microtags'
const other = { render: (x:any) => x }
other.render(123)
`
    const result = transform(input)
    t.ok(result.code.includes('other.render('),
        'non-define .render() call is unchanged')
    const w = result.warnings.find(
        w => w.kind === 'outside-chain'
    )
    t.ok(w, 'warning of outside-chain kind is emitted')
    t.ok(typeof w!.line === 'number', 'warning has a line number')
})

test('warning: stripped static still referenced', t => {
    const input = `
import { define } from 'microtags'
const Foo = define('my-foo')
    .render(() => '<p>hi</p>')
    .setup(() => {})

Foo.render('test')
`
    const result = transform(input)
    const w = result.warnings.find(
        w => w.kind === 'stripped-static'
    )
    t.ok(w, 'stripped-static warning is emitted')
})

test('warning: non-literal tag with keep set', t => {
    const input = `
import { define } from 'microtags'
const tagVar = 'my-el'
const El = define(tagVar)
    .render(() => '<p>hi</p>')
    .setup(() => {})
`
    const result = transform(input, { keep: ['my-el'] })
    const w = result.warnings.find(
        w => w.kind === 'non-literal-tag'
    )
    t.ok(w, 'non-literal-tag warning when keep is set')
})

test('no warning: non-literal tag without keep', t => {
    const input = `
import { define } from 'microtags'
const tagVar = 'my-el'
const El = define(tagVar)
    .render(() => '<p>hi</p>')
    .setup(() => {})
`
    const result = transform(input)
    const w = result.warnings.find(
        w => w.kind === 'non-literal-tag'
    )
    t.ok(!w, 'no non-literal-tag warning without keep')
})

test('line count preserved', t => {
    const input = `import { define } from 'microtags'
const El = define('my-el')
    .render(() => {
        return '<p>hello</p>'
    })
    .setup(() => {})
`
    const result = transform(input)
    const inputLines = input.split('\n').length
    const outputLines = result.code.split('\n').length
    t.equal(outputLines, inputLines,
        'output line count equals input line count')
})

test('untouched lines are byte-identical', t => {
    const input = `import { define } from 'microtags'
const x = 42
const El = define('my-el')
    .render(() => '<p>hi</p>')
    .setup(() => {})
const y = 'hello'
`
    const result = transform(input)
    const inputLines = input.split('\n')
    const outputLines = result.code.split('\n')
    // Lines 1 (import), 2 (const x), and last (const y) should
    // be preserved. We check non-blank output lines match input.
    t.equal(outputLines[0], inputLines[0], 'import line preserved')
    t.equal(outputLines[1], inputLines[1], 'const x line preserved')
    t.equal(
        outputLines[outputLines.length - 1],
        inputLines[inputLines.length - 1],
        'last line preserved'
    )
})

test('non-chained define is left unchanged', t => {
    const input = `
import { define } from 'microtags'
const b = define('x')
b.render(() => '<p>hi</p>')
`
    const result = transform(input)
    t.ok(result.code.includes('b.render('),
        'non-chained .render() is left untouched')
})

function hasImportSpecifier (
    code:string, specifier:string
):boolean {
    const sf = ts.createSourceFile(
        'test.ts', code, ts.ScriptTarget.Latest, true
    )
    let found = false
    ts.forEachChild(sf, node => {
        if (
            ts.isImportDeclaration(node) &&
            node.importClause?.namedBindings &&
            ts.isNamedImports(
                node.importClause.namedBindings
            )
        ) {
            for (const el of
                node.importClause.namedBindings.elements
            ) {
                if (el.name.text === specifier) found = true
            }
        }
    })
    return found
}

function hasImportFrom (
    code:string, moduleSpecifier:string
):boolean {
    const sf = ts.createSourceFile(
        'test.ts', code, ts.ScriptTarget.Latest, true
    )
    let found = false
    ts.forEachChild(sf, node => {
        if (
            ts.isImportDeclaration(node) &&
            ts.isStringLiteral(node.moduleSpecifier) &&
            node.moduleSpecifier.text === moduleSpecifier
        ) {
            found = true
        }
    })
    return found
}

function hasTopLevelDeclaration (
    code:string, name:string
):boolean {
    const sf = ts.createSourceFile(
        'test.ts', code, ts.ScriptTarget.Latest, true
    )
    let found = false
    ts.forEachChild(sf, node => {
        if (
            ts.isVariableStatement(node)
        ) {
            for (const decl of
                node.declarationList.declarations
            ) {
                if (
                    ts.isIdentifier(decl.name) &&
                    decl.name.text === name
                ) {
                    found = true
                }
            }
        }
        if (
            ts.isFunctionDeclaration(node) &&
            node.name?.text === name
        ) {
            found = true
        }
        if (
            ts.isClassDeclaration(node) &&
            node.name?.text === name
        ) {
            found = true
        }
    })
    return found
}

test('cascade: import used only in render is removed', t => {
    const input = `
import { define } from 'microtags'
import { html } from 'microtags/htm'
const El = define('my-el')
    .render(() => html\`<p>hi</p>\`)
    .setup(() => {})
console.log(El)
`
    const result = transform(input, { cascade: true })
    t.ok(!hasImportFrom(result.code, 'microtags/htm'),
        'import from microtags/htm is removed')
    t.ok(hasImportFrom(result.code, 'microtags'),
        'import from microtags remains')
})

test('cascade: mixed import keeps live specifier', t => {
    const input = `
import { define } from 'microtags'
import { html, raw } from 'microtags/htm'
const El = define('my-el')
    .render(() => html\`<p>hi</p>\`)
    .setup(() => {})
console.log(El, raw('x'))
`
    const result = transform(input, { cascade: true })
    t.ok(!hasImportSpecifier(result.code, 'html'),
        'dead specifier html is removed')
    t.ok(hasImportSpecifier(result.code, 'raw'),
        'live specifier raw remains')
})

test('cascade: top-level const removed', t => {
    const input = `
import { define } from 'microtags'
const tpl = '<p>hi</p>'
const El = define('my-el')
    .render(() => tpl)
    .setup(() => {})
console.log(El)
`
    const result = transform(input, { cascade: true })
    t.ok(!hasTopLevelDeclaration(result.code, 'tpl'),
        'const used only in render is removed')
    t.ok(hasTopLevelDeclaration(result.code, 'El'),
        'El remains (still referenced)')
})

test('cascade: top-level let removed', t => {
    const input = `
import { define } from 'microtags'
let tpl = '<p>hi</p>'
const El = define('my-el')
    .render(() => tpl)
    .setup(() => {})
console.log(El)
`
    const result = transform(input, { cascade: true })
    t.ok(!hasTopLevelDeclaration(result.code, 'tpl'),
        'let used only in render is removed')
})

test('cascade: top-level function removed', t => {
    const input = `
import { define } from 'microtags'
function renderEl () { return '<p>hi</p>' }
const El = define('my-el')
    .render(() => renderEl())
    .setup(() => {})
console.log(El)
`
    const result = transform(input, { cascade: true })
    t.ok(!hasTopLevelDeclaration(result.code, 'renderEl'),
        'function used only in render is removed')
})

test('cascade: top-level class removed', t => {
    const input = `
import { define } from 'microtags'
class Tpl { run () { return '<p>hi</p>' } }
const El = define('my-el')
    .render(() => new Tpl().run())
    .setup(() => {})
console.log(El)
`
    const result = transform(input, { cascade: true })
    t.ok(!hasTopLevelDeclaration(result.code, 'Tpl'),
        'class used only in render is removed')
})

test('cascade: transitive dead declaration removed', t => {
    const input = `
import { define } from 'microtags'
const helper = () => 'hi'
const tpl = helper()
const El = define('my-el')
    .render(() => tpl)
    .setup(() => {})
console.log(El)
`
    const result = transform(input, { cascade: true })
    t.ok(!hasTopLevelDeclaration(result.code, 'tpl'),
        'tpl removed on first pass')
    t.ok(!hasTopLevelDeclaration(result.code, 'helper'),
        'helper removed on second pass (cascade)')
})

test('cascade: side-effect import preserved', t => {
    const input = `
import { define } from 'microtags'
import './side-effect.js'
const tpl = '<p>hi</p>'
const El = define('my-el')
    .render(() => tpl)
    .setup(() => {})
console.log(El)
`
    const result = transform(input, { cascade: true })
    t.ok(hasImportFrom(result.code, './side-effect.js'),
        'side-effect import remains')
})

test('cascade: exported declaration preserved', t => {
    const input = `
import { define } from 'microtags'
export const tpl = '<p>hi</p>'
const El = define('my-el')
    .render(() => tpl)
    .setup(() => {})
console.log(El)
`
    const result = transform(input, { cascade: true })
    t.ok(hasTopLevelDeclaration(result.code, 'tpl'),
        'exported const remains even with no refs')
})

test('cascade: declaration used by setup remains', t => {
    const input = `
import { define } from 'microtags'
const shared = 'hello'
const El = define('my-el')
    .render(() => shared)
    .setup(() => { console.log(shared) })
console.log(El)
`
    const result = transform(input, { cascade: true })
    t.ok(hasTopLevelDeclaration(result.code, 'shared'),
        'declaration used in setup remains')
})

test('cascade: line count preserved', t => {
    const input = `import { define } from 'microtags'
import { html } from 'microtags/htm'
const helper = () => 'hi'
const tpl = helper()
const El = define('my-el')
    .render(() => {
        return html\`<p>\${tpl}</p>\`
    })
    .setup(() => {})
console.log(El)
`
    const result = transform(input, { cascade: true })
    const inputLines = input.split('\n').length
    const outputLines = result.code.split('\n').length
    t.equal(outputLines, inputLines,
        'line count preserved after cascade')
})

test('cascade off: dead imports remain', t => {
    const input = `
import { define } from 'microtags'
import { html } from 'microtags/htm'
const El = define('my-el')
    .render(() => html\`<p>hi</p>\`)
    .setup(() => {})
console.log(El)
`
    const result = transform(input)
    t.ok(hasImportFrom(result.code, 'microtags/htm'),
        'import remains without cascade')
})

const SUPPORT = 'microtags/render-support'

function countImportsFrom (code:string, moduleSpecifier:string):number {
    const sf = ts.createSourceFile(
        'test.ts', code, ts.ScriptTarget.Latest, true
    )
    return sf.statements.filter(node =>
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === moduleSpecifier
    ).length
}

const keptInput = `import { define } from 'microtags'
import { html } from 'microtags/htm'
const tpl = '<p>hi</p>'
const El = define('my-el')
    .render(() => html\`\${tpl}\`, { client: true })
    .setup(() => {})
console.log(El)
`

const strippedInput = `import { define } from 'microtags'
import { html } from 'microtags/htm'
const tpl = '<p>hi</p>'
const El = define('my-el')
    .render(() => html\`\${tpl}\`)
    .setup(() => {})
console.log(El)
`

test('support: a kept render link adds one support import', t => {
    const once = transform(keptInput).code
    t.equal(countImportsFrom(once, SUPPORT), 1,
        'one support import after the first transform')
    const twice = transform(once).code
    t.equal(countImportsFrom(twice, SUPPORT), 1,
        'still one support import after a second transform')
})

test('support: a link kept by tag name adds the import', t => {
    const code = transform(strippedInput, { keep: ['my-el'] }).code
    t.equal(countImportsFrom(code, SUPPORT), 1, 'support import added')
})

test('support: kept link under cascade keeps the import', t => {
    const code = transform(keptInput, { cascade: true }).code
    t.equal(countImportsFrom(code, SUPPORT), 1, 'support import added')
    const again = transform(code, { cascade: true }).code
    t.equal(countImportsFrom(again, SUPPORT), 1, 'no second import')
})

test('support: the import does not shift existing lines', t => {
    const code = transform(keptInput).code
    const inLines = keptInput.split('\n')
    const outLines = code.split('\n')
    t.deepEqual(outLines.slice(0, inLines.length - 1),
        inLines.slice(0, -1), 'original lines are unchanged')
})

test('support: all links stripped adds no support import', t => {
    const code = transform(strippedInput).code
    t.equal(countImportsFrom(code, SUPPORT), 0, 'no support import')
    const cascaded = transform(strippedInput, { cascade: true }).code
    t.equal(countImportsFrom(cascaded, SUPPORT), 0,
        'no support import after cascade')
})

test('support: a module with no define adds no import', t => {
    const code = transform('export const x = 1\n').code
    t.equal(countImportsFrom(code, SUPPORT), 0, 'no support import')
})

/**
 * Bundle the build entry from source in the given format, with
 * typescript left external, and run it with node in `cwd`.
 * Returns stderr.
 */
function loadEntry (format:'esm'|'cjs', cwd:string):string {
    const code = spawnSync('npx', [
        'esbuild', 'src/build.ts', '--bundle', '--platform=node',
        '--packages=external', `--format=${format}`,
    ], { encoding: 'utf8' }).stdout
    const args = format === 'esm' ? ['--input-type=module'] : []
    const result = spawnSync('node', args, {
        input: code,
        cwd,
        encoding: 'utf8',
    })
    return result.stderr
}

test('loading without require explains the built form', t => {
    const stderr = loadEntry('esm', process.cwd())
    t.ok(/require/.test(stderr) && /built/.test(stderr),
        'error mentions require and the built form')
    t.ok(!/peer dependency/.test(stderr),
        'error does not claim typescript is missing')
})

test('typescript that does not resolve gives the peer message', t => {
    const stderr = loadEntry('cjs', mkdtempSync(resolve(tmpdir(), 'mt-')))
    t.ok(/peer dependency/.test(stderr),
        'error says typescript is a missing peer dependency')
})

test('a vite config importing source does not blame typescript', t => {
    const result = spawnSync('npx', [
        'vite', 'build', '--config',
        'test/fixtures/vite-config-src/vite.config.ts',
    ], { encoding: 'utf8' })
    const output = result.stdout + result.stderr
    t.ok(result.status !== 0, 'the config fails to load')
    t.ok(/built form/.test(output), 'error points at the built form')
    t.ok(!/peer dependency/.test(output),
        'error does not claim typescript is missing')
})
