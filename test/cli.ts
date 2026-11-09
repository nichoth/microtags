import { test } from '@substrate-system/tapzero'
import { spawnSync, execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

import ts from 'typescript'

const CLI = resolve(process.cwd(), 'dist', 'cli.cjs')

function run (
    args:string[],
    input?:string
):{ stdout:string, stderr:string, status:number } {
    try {
        const result = spawnSync(
            'node', [CLI, ...args],
            {
                input,
                encoding: 'utf-8',
                timeout: 10_000,
                stdio: ['pipe', 'pipe', 'pipe'],
            }
        )
        return {
            stdout: result.stdout ?? '',
            stderr: result.stderr ?? '',
            status: result.status ?? 1,
        }
    } catch (err:any) {
        return {
            stdout: err.stdout ?? '',
            stderr: err.stderr ?? '',
            status: err.status ?? 1,
        }
    }
}

function hasRenderInDefineChain (code:string):boolean {
    const sf = ts.createSourceFile(
        'test.ts', code, ts.ScriptTarget.Latest, true
    )
    let found = false
    function visit (node:ts.Node) {
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(
                node.expression
            ) &&
            node.expression.name.text === 'render'
        ) {
            if (isDefineChainRoot(
                node.expression.expression
            )) {
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
        return node.expression.text === 'define'
    }
    if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
    ) {
        return isDefineChainRoot(
            node.expression.expression
        )
    }
    return false
}

const FIXTURE = `import { define } from 'microtags'
const El = define('my-el')
    .render(() => '<p>hi</p>')
    .setup(() => {})
`

const FIXTURE_WARNING = `import { define } from 'microtags'
const other = { render: (x:any) => x }
other.render(123)
`

test('stdin: transformed code has no .render()', t => {
    const { stdout, status } = run([], FIXTURE)
    t.equal(status, 0, 'exits 0')
    t.ok(
        !hasRenderInDefineChain(stdout),
        'no .render() in define chain in output'
    )
    t.ok(
        stdout.includes('.setup('),
        'setup call preserved'
    )
})

test('stdin: warnings go to stderr, code to stdout', t => {
    const { stdout, stderr, status } = run(
        [],
        FIXTURE_WARNING
    )
    t.equal(status, 0, 'exits 0 despite warning')
    t.ok(
        stdout.includes('other.render('),
        'code written to stdout'
    )
    t.ok(
        stderr.length > 0,
        'warning written to stderr'
    )
})

test('glob: writes files under outdir at relative path', t => {
    const tmp = mkdtempSync(join(tmpdir(), 'cli-test-'))
    const srcDir = join(tmp, 'src')
    const outDir = join(tmp, 'out')
    execSync(`mkdir -p "${srcDir}/sub"`)

    const filePath = join(srcDir, 'sub', 'comp.ts')
    writeFileSync(filePath, FIXTURE)

    const { status } = run([
        join(srcDir, '**/*.ts'),
        '--outdir', outDir,
        '--root', srcDir,
    ])

    t.equal(status, 0, 'exits 0')

    const outFile = join(outDir, 'sub', 'comp.ts')
    t.ok(existsSync(outFile), 'output file exists')

    const outCode = readFileSync(outFile, 'utf-8')
    t.ok(
        !hasRenderInDefineChain(outCode),
        '.render() stripped in output file'
    )

    const srcCode = readFileSync(filePath, 'utf-8')
    t.equal(
        srcCode, FIXTURE,
        'input file unchanged'
    )
})

test('glob: non-matching files not copied', t => {
    const tmp = mkdtempSync(join(tmpdir(), 'cli-test-'))
    const outDir = join(tmp, 'out')
    execSync(`mkdir -p "${tmp}/src"`)

    writeFileSync(
        join(tmp, 'src', 'readme.md'),
        '# hello'
    )
    writeFileSync(
        join(tmp, 'src', 'comp.ts'),
        FIXTURE
    )

    const { status } = run([
        join(tmp, 'src', '*.ts'),
        '--outdir', outDir,
        '--root', join(tmp, 'src'),
    ])

    t.equal(status, 0, 'exits 0')
    t.ok(
        !existsSync(join(outDir, 'readme.md')),
        'non-matching file not copied'
    )
})

test('--keep with comma-separated and repeated flags', t => {
    const input = `import { define } from 'microtags'
const A = define('a-tag')
    .render(() => '<p>a</p>')
    .setup(() => {})
const B = define('b-tag')
    .render(() => '<p>b</p>')
    .setup(() => {})
const C = define('c-tag')
    .render(() => '<p>c</p>')
    .setup(() => {})
const D = define('d-tag')
    .render(() => '<p>d</p>')
    .setup(() => {})
`

    const { stdout, status } = run(
        ['--keep', 'a-tag,b-tag', '--keep', 'c-tag'],
        input
    )
    t.equal(status, 0, 'exits 0')

    const sf = ts.createSourceFile(
        'test.ts', stdout, ts.ScriptTarget.Latest, true
    )

    const renderCalls:string[] = []
    function visit (node:ts.Node) {
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(
                node.expression
            ) &&
            node.expression.name.text === 'render'
        ) {
            const root = findTagName(
                node.expression.expression
            )
            if (root) renderCalls.push(root)
        }
        ts.forEachChild(node, visit)
    }
    ts.forEachChild(sf, visit)

    t.ok(
        renderCalls.includes('a-tag'),
        'a-tag render kept'
    )
    t.ok(
        renderCalls.includes('b-tag'),
        'b-tag render kept'
    )
    t.ok(
        renderCalls.includes('c-tag'),
        'c-tag render kept'
    )
    t.ok(
        !renderCalls.includes('d-tag'),
        'd-tag render stripped'
    )
})

function findTagName (node:ts.Node):string | null {
    if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.arguments.length > 0 &&
        ts.isStringLiteral(node.arguments[0])
    ) {
        return node.arguments[0].text
    }
    if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
    ) {
        return findTagName(node.expression.expression)
    }
    return null
}

test('glob without --outdir exits 1', t => {
    const tmp = mkdtempSync(join(tmpdir(), 'cli-test-'))
    writeFileSync(join(tmp, 'a.ts'), FIXTURE)

    const { status, stderr } = run([
        join(tmp, '*.ts'),
    ])

    t.equal(status, 1, 'exits 1')
    t.ok(
        stderr.length > 0,
        'error message on stderr'
    )
})

test('invalid input exits 1', t => {
    const { status } = run([], 'const x:= broken {{{')
    t.equal(status, 1, 'exits 1 on parse error')
})

test('--help prints usage and exits 0', t => {
    const { stdout, status } = run(['--help'])
    t.equal(status, 0, 'exits 0')
    t.ok(
        stdout.includes('microbuild'),
        'usage mentions microbuild'
    )
    t.ok(
        stdout.includes('--outdir'),
        'usage mentions --outdir'
    )
})
