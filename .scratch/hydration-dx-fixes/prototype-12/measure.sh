#!/usr/bin/env bash
# Measure one registration variant against a scratch copy of the repo.
#
#   .scratch/hydration-dx-fixes/prototype-12/measure.sh <variant>
#
# <variant> is a directory next to this script: baseline, a-subpath,
# b-setter or c-global. The script copies the repo (without .git,
# node_modules, dist and .scratch) to a temp dir, overlays the variant,
# builds the minified browser entries and the fixtures, and prints
# brotli sizes from size-limit (the review's method), whether the
# all-stripped fixture contains server-render code, the SSR suite
# result, and two smoke checks. KEEP=1 keeps the temp dir.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
V="${1:?variant}"
WORK="$(mktemp -d)/repo"

rsync -a --exclude node_modules --exclude .git --exclude dist \
    --exclude .scratch --exclude example-hydration/build \
    "$ROOT/" "$WORK/"
ln -s "$ROOT/node_modules" "$WORK/node_modules"

if [ "$V" = baseline ]; then
    cp "$HERE/baseline/register.ts" "$WORK/src/"
else
    cp "$HERE/common/"*.ts "$WORK/src/"
    cp "$HERE/$V/"*.ts "$WORK/src/"
    REG=register
    [ -f "$HERE/$V/templater-register.ts" ] && REG=templater-register
    for f in htm.ts htm.browser.ts; do
        { echo "import './$REG.js'"; cat "$WORK/src/$f"; } \
            > "$WORK/src/$f.tmp"
        mv "$WORK/src/$f.tmp" "$WORK/src/$f"
    done
fi

cd "$WORK"
mkdir -p dist
npx esbuild src/index.ts src/htm.ts src/htm.browser.ts --format=esm \
    --keep-names --bundle --tsconfig=tsconfig.build.json --minify \
    --out-extension:.js=.min.js --outdir=dist --log-level=warning

for fx in all-stripped kept; do
    npx esbuild "$HERE/fixtures/$fx.ts" --bundle --minify --format=esm \
        --alias:microtags="$WORK/src" --metafile="dist/$fx.meta.json" \
        --outfile="dist/$fx.min.js" --log-level=warning
done

cat > .size-limit.js <<'EOF'
export default [
    { name: 'core', path: 'dist/index.min.js' },
    { name: 'htm (server)', path: 'dist/htm.min.js' },
    { name: 'htm (browser)', path: 'dist/htm.browser.min.js' },
    { name: 'all-stripped fixture', path: 'dist/all-stripped.min.js' },
    { name: 'kept fixture', path: 'dist/kept.min.js' },
]
EOF

echo "== $V"
npx size-limit --json | node -e '
    let s = ""
    process.stdin.on("data", d => { s += d })
    process.stdin.on("end", () => {
        for (const r of JSON.parse(s)) {
            console.log(r.name.padEnd(24), (r.size / 1000).toFixed(2), "kB")
        }
    })'

# Server-render code in the all-stripped bundle: the attribute escape
# table is the observable marker, and the metafile shows which modules
# were bundled.
echo "all-stripped: escape table occurrences:" \
    "$(grep -o '&quot;' dist/all-stripped.min.js | wc -l | tr -d ' ')"
node -e '
    const m = require("./dist/all-stripped.meta.json")
    const ins = Object.keys(m.inputs).map(p => p.split("/").pop())
    console.log("all-stripped: inputs:", ins.join(" "))
'

echo "ssr suite: $(npm run --silent test:ssr 2>&1 | grep -E '^# (pass|fail)' \
    | tr '\n' ' ')"

npx esbuild "$HERE/fixtures/throws.ts" --bundle --platform=node \
    --alias:microtags="$WORK/src" --log-level=warning | node -

cp -R src src2
npx esbuild "$HERE/fixtures/cross-copy.ts" --bundle --platform=node \
    --alias:microtags="$WORK/src" --alias:copy2="$WORK/src2" \
    --log-level=warning | node -

if [ -n "${KEEP:-}" ]; then
    echo "kept: $WORK"
else
    rm -rf "$(dirname "$WORK")"
fi
