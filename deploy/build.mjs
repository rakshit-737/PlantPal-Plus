/**
 * Build both deployable artefacts for the Supabase Edge Functions deployment.
 *
 *   node deploy/build.mjs
 *     → deploy/api/index.js     the API, bundled (apps/api/edge/build.mjs)
 *     → deploy/web/assets/…     the web app, built for this host
 *
 * Both are committed. See deploy/README.md for why, and for how the two
 * functions are deployed once these exist.
 *
 * The two URLs the web build is compiled against are the whole reason this
 * script exists rather than a line in the README: `VITE_BASE` has to match the
 * path the browser sees, and `VITE_API_URL` has to match the sibling function's
 * path exactly. Both are derived here from one project reference, so they
 * cannot drift apart.
 */

import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Supabase project reference. Override to deploy this repository elsewhere. */
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'mmqqijfgtcjviogqporc'
const WEB_SLUG = process.env.PLANTPAL_WEB_SLUG ?? 'plantpal'
const API_SLUG = process.env.PLANTPAL_API_SLUG ?? 'plantpal-api'

const origin = `https://${PROJECT_REF}.supabase.co`

function run(command, args, options = {}) {
  execFileSync(command, args, { cwd: repoRoot, stdio: 'inherit', ...options })
}

console.log('· shared package')
run('npm', ['run', 'build', '--workspace', '@plantpal/shared'])

console.log('· api bundle')
run('node', ['apps/api/edge/build.mjs'])

console.log('· web app')
run('npx', ['vite', 'build'], {
  cwd: join(repoRoot, 'apps', 'web'),
  env: {
    ...process.env,
    /*
     * The path the browser requests, not the path the function handler sees:
     * the runtime strips /functions/v1 before routing, but the <script> tags in
     * index.html are resolved by the browser against the full URL.
     */
    VITE_BASE: `/functions/v1/${WEB_SLUG}/`,
    /*
     * Same origin as the page, different function. Same-origin is what keeps
     * the refresh cookie first-party; see deploy/web/server.ts.
     */
    VITE_API_URL: `${origin}/functions/v1/${API_SLUG}`,
  },
})

console.log('· staging web bundle')
const webOut = join(repoRoot, 'deploy', 'web')
// Only the built output is replaced. server.ts lives in the same directory and
// is source, not a build product.
rmSync(join(webOut, 'assets'), { recursive: true, force: true })
rmSync(join(webOut, 'index.html'), { force: true })
mkdirSync(webOut, { recursive: true })
cpSync(join(repoRoot, 'apps', 'web', 'dist'), webOut, { recursive: true })

console.log(`\nbuilt for ${origin}/functions/v1/${WEB_SLUG}/`)
console.log('commit deploy/, push, then deploy both functions at that commit.')
