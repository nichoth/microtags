import type TypeScript from 'typescript'

declare const require:(id:string) => unknown

let ts:typeof TypeScript
try {
    ts = require('typescript') as typeof TypeScript
} catch (err) {
    // Only a failure to resolve the bare name means typescript is
    // missing. Anything else is a context that cannot `require` it:
    // an ESM bundle without `require`, or a Vite config bundle, which
    // hands `require` a file URL.
    const { code, message } = err as { code?:string, message?:string }
    if (
        code === 'MODULE_NOT_FOUND' &&
        message?.includes("'typescript'")
    ) {
        throw new Error(
            'microtags/build requires "typescript" as a peer dependency. ' +
            'Install it with: npm install --save-dev typescript'
        )
    }
    throw new Error(
        'microtags/build could not load "typescript" because `require` ' +
        'is unavailable or unusable here. Load the entry from its ' +
        'built form (microtags/build, or dist/ in this repo) instead ' +
        'of from source.',
        { cause: err }
    )
}

export interface TransformWarning {
    kind:'outside-chain'|'stripped-static'|'non-literal-tag'
    file?:string
    line:number
    message:string
}

export interface TransformOptions {
    cascade?:boolean
    keep?:string[]
    filename?:string
}

export interface TransformResult {
    code:string
    warnings:TransformWarning[]
}

export function transform (
    code:string,
    options?:TransformOptions
):TransformResult {
    const keep = options?.keep ?? []
    const filename = options?.filename

    const sf = ts.createSourceFile(
        filename ?? 'input.ts',
        code,
        ts.ScriptTarget.Latest,
        true
    )

    const defineAliases = findDefineAliases(sf)
    const spans:{ start:number, end:number }[] = []
    const strippedBindings:Set<string> = new Set()
    const warnings:TransformWarning[] = []
    let keptLink = false

    function visit (node:TypeScript.Node) {
        if (!ts.isCallExpression(node)) {
            ts.forEachChild(node, visit)
            return
        }

        if (
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text === 'render'
        ) {
            const receiver = node.expression.expression
            const chainRoot = findChainRoot(receiver)

            if (
                chainRoot &&
                isDefineCall(chainRoot, defineAliases)
            ) {
                const tagName = getDefineLiteralTag(chainRoot)

                if (tagName === null && keep.length > 0) {
                    const line = sf.getLineAndCharacterOfPosition(
                        chainRoot.getStart()
                    ).line + 1
                    warnings.push({
                        kind: 'non-literal-tag',
                        file: filename,
                        line,
                        message:
                            'define() call with non-literal ' +
                            'tag name cannot be matched ' +
                            'by --keep',
                    })
                }

                if (shouldKeep(node, tagName, keep)) {
                    keptLink = true
                    ts.forEachChild(node, visit)
                    return
                }

                const binding = findBindingName(node)
                if (binding) strippedBindings.add(binding)

                spans.push({
                    start: dotPosition(node),
                    end: node.getEnd(),
                })
                return
            }

            const line = sf.getLineAndCharacterOfPosition(
                node.getStart()
            ).line + 1
            warnings.push({
                kind: 'outside-chain',
                file: filename,
                line,
                message:
                    '.render() call outside a define chain',
            })
        }

        ts.forEachChild(node, visit)
    }

    ts.forEachChild(sf, visit)

    spans.sort((a, b) => b.start - a.start)

    let result = code
    for (const span of spans) {
        const removed = result.slice(span.start, span.end)
        const newlines = removed.split('\n').length - 1
        result = result.slice(0, span.start) +
            '\n'.repeat(newlines) +
            result.slice(span.end)
    }

    if (options?.cascade) {
        result = cascadeRemove(result, filename)
    }

    if (strippedBindings.size > 0) {
        const resultSf = ts.createSourceFile(
            filename ?? 'input.ts',
            result,
            ts.ScriptTarget.Latest,
            true
        )
        findStrippedStaticCalls(
            resultSf, strippedBindings, warnings, filename
        )
    }

    // A kept render link needs the server render support module at
    // runtime (ADR-009). Appended so no existing line moves; imports
    // are hoisted, so its position does not matter.
    if (keptLink && !importsSupport(sf)) {
        result += `\nimport '${SUPPORT}'\n`
    }

    return { code: result, warnings }
}

const SUPPORT = 'microtags/render-support'

function importsSupport (sf:TypeScript.SourceFile):boolean {
    return sf.statements.some(node =>
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === SUPPORT
    )
}

function findDefineAliases (
    sf:TypeScript.SourceFile
):Set<string> {
    const aliases = new Set<string>()
    ts.forEachChild(sf, node => {
        if (
            ts.isImportDeclaration(node) &&
            ts.isStringLiteral(node.moduleSpecifier) &&
            node.moduleSpecifier.text === 'microtags' &&
            node.importClause?.namedBindings &&
            ts.isNamedImports(
                node.importClause.namedBindings
            )
        ) {
            for (const spec of
                node.importClause.namedBindings.elements
            ) {
                const origName =
                    spec.propertyName?.text ??
                    spec.name.text
                if (origName === 'define') {
                    aliases.add(spec.name.text)
                }
            }
        }
    })
    return aliases
}

function findChainRoot (
    node:TypeScript.Node
):TypeScript.CallExpression | null {
    if (ts.isCallExpression(node)) {
        if (ts.isIdentifier(node.expression)) {
            return node
        }
        if (
            ts.isPropertyAccessExpression(node.expression)
        ) {
            return findChainRoot(
                node.expression.expression
            )
        }
    }
    return null
}

function isDefineCall (
    node:TypeScript.CallExpression,
    aliases:Set<string>
):boolean {
    return ts.isIdentifier(node.expression) &&
        aliases.has(node.expression.text)
}

function getDefineLiteralTag (
    node:TypeScript.CallExpression
):string | null {
    if (
        node.arguments.length > 0 &&
        ts.isStringLiteral(node.arguments[0])
    ) {
        return node.arguments[0].text
    }
    return null
}

function shouldKeep (
    renderCall:TypeScript.CallExpression,
    tagName:string | null,
    keep:string[]
):boolean {
    if (renderCall.arguments.length >= 2) {
        const opts = renderCall.arguments[1]
        if (ts.isObjectLiteralExpression(opts)) {
            for (const prop of opts.properties) {
                if (
                    ts.isPropertyAssignment(prop) &&
                    ts.isIdentifier(prop.name) &&
                    prop.name.text === 'client' &&
                    prop.initializer.kind ===
                        ts.SyntaxKind.TrueKeyword
                ) {
                    return true
                }
            }
        }
    }

    if (tagName !== null && keep.includes(tagName)) {
        return true
    }

    return false
}

function dotPosition (
    renderCall:TypeScript.CallExpression
):number {
    const pa = renderCall
        .expression as TypeScript.PropertyAccessExpression
    return pa.expression.getEnd()
}

function findBindingName (
    node:TypeScript.Node
):string | null {
    let current:TypeScript.Node = node
    while (current.parent) {
        current = current.parent
        if (
            ts.isVariableDeclaration(current) &&
            ts.isIdentifier(current.name)
        ) {
            return current.name.text
        }
    }
    return null
}

function cascadeRemove (
    code:string,
    filename?:string
):string {
    let changed = true
    let result = code
    while (changed) {
        changed = false
        const sf = ts.createSourceFile(
            filename ?? 'input.ts',
            result,
            ts.ScriptTarget.Latest,
            true
        )

        const refs = collectReferences(sf)
        const removeSpans:{
            start:number, end:number
        }[] = []

        ts.forEachChild(sf, node => {
            if (
                ts.isImportDeclaration(node) &&
                node.importClause
            ) {
                if (isExportedNode(node)) return
                const nb = node.importClause.namedBindings
                if (!nb) return
                if (!ts.isNamedImports(nb)) {
                    const name = node.importClause.name
                    if (
                        name &&
                        !refs.has(name.text)
                    ) {
                        removeSpans.push({
                            start: node.getStart(),
                            end: node.getEnd(),
                        })
                    }
                    return
                }
                const dead:TypeScript.ImportSpecifier[] = []
                const live:TypeScript.ImportSpecifier[] = []
                for (const el of nb.elements) {
                    if (refs.has(el.name.text)) {
                        live.push(el)
                    } else {
                        dead.push(el)
                    }
                }
                if (dead.length === 0) return
                if (live.length === 0) {
                    removeSpans.push({
                        start: node.getStart(),
                        end: node.getEnd(),
                    })
                } else {
                    for (const d of dead) {
                        let start = d.getStart()
                        let end = d.getEnd()
                        const text = result
                        const after = text.slice(end)
                        const before = text.slice(0, start)
                        if (/^\s*,/.test(after)) {
                            end += after.match(
                                /^\s*,/
                            )![0].length
                        } else if (/,\s*$/.test(before)) {
                            start = before.lastIndexOf(',')
                        }
                        removeSpans.push({ start, end })
                    }
                }
                return
            }

            if (ts.isVariableStatement(node)) {
                if (isExportedNode(node)) return
                const allDead = node
                    .declarationList
                    .declarations
                    .every(d =>
                        ts.isIdentifier(d.name) &&
                        !refs.has(d.name.text)
                    )
                if (allDead) {
                    removeSpans.push({
                        start: node.getStart(),
                        end: node.getEnd(),
                    })
                }
                return
            }

            if (ts.isFunctionDeclaration(node)) {
                if (isExportedNode(node)) return
                if (
                    node.name &&
                    !refs.has(node.name.text)
                ) {
                    removeSpans.push({
                        start: node.getStart(),
                        end: node.getEnd(),
                    })
                }
                return
            }

            if (ts.isClassDeclaration(node)) {
                if (isExportedNode(node)) return
                if (
                    node.name &&
                    !refs.has(node.name.text)
                ) {
                    removeSpans.push({
                        start: node.getStart(),
                        end: node.getEnd(),
                    })
                }
            }
        })

        if (removeSpans.length === 0) break

        changed = true
        removeSpans.sort((a, b) => b.start - a.start)
        for (const span of removeSpans) {
            const removed = result.slice(
                span.start, span.end
            )
            const newlines =
                removed.split('\n').length - 1
            result = result.slice(0, span.start) +
                '\n'.repeat(newlines) +
                result.slice(span.end)
        }
    }

    return result
}

function collectReferences (
    sf:TypeScript.SourceFile
):Set<string> {
    const refs = new Set<string>()
    const declared = new Set<string>()

    ts.forEachChild(sf, node => {
        if (ts.isImportDeclaration(node)) {
            if (
                node.importClause?.namedBindings &&
                ts.isNamedImports(
                    node.importClause.namedBindings
                )
            ) {
                for (const el of
                    node.importClause
                        .namedBindings.elements
                ) {
                    declared.add(el.name.text)
                }
            }
            return
        }
        if (ts.isVariableStatement(node)) {
            for (const d of
                node.declarationList.declarations
            ) {
                if (ts.isIdentifier(d.name)) {
                    declared.add(d.name.text)
                }
            }
        }
        if (
            ts.isFunctionDeclaration(node) && node.name
        ) {
            declared.add(node.name.text)
        }
        if (
            ts.isClassDeclaration(node) && node.name
        ) {
            declared.add(node.name.text)
        }
    })

    function visitRefs (node:TypeScript.Node) {
        if (
            ts.isIdentifier(node) &&
            declared.has(node.text)
        ) {
            const parent = node.parent
            if (
                ts.isImportSpecifier(parent) ||
                (
                    ts.isVariableDeclaration(parent) &&
                    parent.name === node
                ) ||
                (
                    ts.isFunctionDeclaration(parent) &&
                    parent.name === node
                ) ||
                (
                    ts.isClassDeclaration(parent) &&
                    parent.name === node
                )
            ) {
                return
            }
            refs.add(node.text)
        }
        ts.forEachChild(node, visitRefs)
    }

    ts.forEachChild(sf, node => {
        if (ts.isImportDeclaration(node)) return
        visitRefs(node)
    })

    return refs
}

function isExportedNode (
    node:TypeScript.Node
):boolean {
    if (!ts.canHaveModifiers(node)) return false
    const mods = ts.getModifiers(node)
    if (!mods) return false
    return mods.some(
        m => m.kind === ts.SyntaxKind.ExportKeyword
    )
}

function findStrippedStaticCalls (
    sf:TypeScript.SourceFile,
    bindings:Set<string>,
    warnings:TransformWarning[],
    filename?:string
) {
    function visit (node:TypeScript.Node) {
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(
                node.expression
            ) &&
            node.expression.name.text === 'render' &&
            ts.isIdentifier(
                node.expression.expression
            ) &&
            bindings.has(
                node.expression.expression.text
            )
        ) {
            const line = sf.getLineAndCharacterOfPosition(
                node.getStart()
            ).line + 1
            warnings.push({
                kind: 'stripped-static',
                file: filename,
                line,
                message:
                    `${node.expression.expression.text}` +
                    '.render() called but render ' +
                    'was stripped',
            })
        }
        ts.forEachChild(node, visit)
    }
    ts.forEachChild(sf, visit)
}
