/**
 * Bundle the API for Supabase Edge Functions, into `deploy/api/index.js`.
 *
 * Two things about the output are unusual, and both follow from how the
 * function is deployed (see `deploy/README.md`): the deployed function is a
 * one-line loader that imports this bundle from the repository over jsDelivr,
 * so the bundle has to stand alone with no import map behind it.
 *
 *  - **Everything ships as one file.** Uploading 57 loose modules would make
 *    the deployed artefact something to keep in step with the repository by
 *    hand.
 *  - **npm dependencies keep `npm:` specifiers.** An import map applies to the
 *    module doing the importing, not to a module fetched from a URL, so a bare
 *    `import "express"` inside a remote bundle has nothing to resolve against.
 *    Writing the specifier out in full makes the bundle self-describing.
 *    Bundling those packages instead is the alternative, and a worse one:
 *    flattening Express, pg and pino — CommonJS with conditional and dynamic
 *    requires — into one ES module is exactly the transformation that silently
 *    drops a lazy require.
 *
 * `@plantpal/shared` is inlined rather than externalised: it is this
 * repository's own source with no published version to resolve against, and
 * inlining it is what guarantees the deployed watering algorithm is the one the
 * tests just ran against.
 *
 * Usage: node apps/api/edge/build.mjs   →   deploy/api/index.js
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..')
const outDir = join(repoRoot, 'deploy', 'api')
const require = createRequire(import.meta.url)

/**
 * Runtime dependencies, pinned to the exact versions this workspace installs.
 *
 * Read from package.json rather than restated, because a version restated in
 * two places is a version that will disagree in one of them — and the
 * disagreement would not surface here, it would surface as a deployed function
 * running a different Express than the tests did.
 */
const { dependencies, optionalDependencies } = require('../package.json')
const RUNTIME_DEPS = { ...dependencies, ...optionalDependencies }
const EXTERNAL = Object.keys(RUNTIME_DEPS).filter((name) => !name.startsWith('@plantpal/'))

/** `^8.13.1` → `8.13.1`; a specifier Deno can pin rather than a range. */
function exactVersion(range) {
  const exact = /\d.*/.exec(range)?.[0]
  if (!exact) throw new Error(`Cannot pin a version from "${range}"`)
  return exact
}

const result = await build({
  entryPoints: [join(here, 'index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  external: [...EXTERNAL, 'node:*'],
  write: false,
  // Minified because this is an upload, not something anyone reads: the source
  // of record is apps/api/edge/index.ts. `keepNames` is what makes that
  // affordable — an edge log's stack trace still names the function it threw
  // in, which is the only part of a readable bundle worth having.
  minify: true,
  keepNames: true,
  // Bounded lines, so every tool that has to move this file — a diff, an
  // editor, a code review — handles it. Nothing at runtime cares.
  lineLimit: 200,
  legalComments: 'none',
})

const output = result.outputFiles[0]
if (!output) throw new Error('esbuild produced no output')

/*
 * Rewrite the bare specifiers esbuild left behind into pinned `npm:` ones.
 * Anchored on the `from` / `import(` that precedes them so the replacement
 * cannot reach into a string literal that happens to equal a package name —
 * there is a lot of SQL in this bundle, and "pg" is two characters.
 */
let code = output.text
for (const name of EXTERNAL) {
  const version = exactVersion(RUNTIME_DEPS[name])
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const before = code
  code = code.replace(
    new RegExp(`(\\bfrom\\s*|\\bimport\\s*\\(\\s*)"${escaped}"`, 'g'),
    `$1"npm:${name}@${version}"`,
  )
  if (before === code) {
    throw new Error(`"${name}" is declared external but never imported — the list has drifted.`)
  }
}

/*
 * Nothing may be left that Deno cannot resolve on its own. This is the check
 * that turns "the deployed function crashed on boot" into a build failure.
 */
const remainingBare = code.match(/\bfrom\s*"(?!npm:|node:|https:)[^"]*"/g)
if (remainingBare) {
  throw new Error(`Unresolvable bare imports left in the bundle: ${remainingBare.join(', ')}`)
}

const banner = [
  '// GENERATED FILE — do not edit, and do not review as source.',
  '// Built from apps/api/edge/index.ts by apps/api/edge/build.mjs.',
  '// Committed deliberately: the deployed edge function loads it from this',
  '// repository over a CDN. See deploy/README.md.',
  '',
].join('\n')

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'index.js'), banner + code)

console.log(`bundled ${(code.length / 1024).toFixed(0)} kB → deploy/api/index.js`)
