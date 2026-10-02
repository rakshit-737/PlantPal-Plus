/**
 * Build the deployable artefact for the Supabase Edge Functions API.
 *
 *   node 06_deployment/build.mjs
 *     → 06_deployment/api/index.js     the API, bundled (03_implementation/api/edge/build.mjs)
 *
 * The bundle is committed: the deployed `plantpal-api` function is a one-line
 * loader that imports it from this repository over jsDelivr, pinned to a
 * commit. See 06_deployment/README.md for why, and for how the function is
 * deployed once the bundle exists.
 *
 * The web app is not built here. It is served by Vercel (03_implementation/
 * vercel.json, with the Vercel project's Root Directory set to
 * 03_implementation) and mirrored to GitHub Pages
 * (.github/workflows/deploy-web.yml); both build it themselves from source.
 */

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
// The npm workspace root: npm and the bundler run from here.
const workspaceRoot = join(repoRoot, '03_implementation')

function run(command, args, options = {}) {
  execFileSync(command, args, { cwd: workspaceRoot, stdio: 'inherit', ...options })
}

console.log('· shared package')
run('npm', ['run', 'build', '--workspace', '@plantpal/shared'])

console.log('· api bundle')
run('node', ['api/edge/build.mjs'])

console.log('\ncommit 06_deployment/api/index.js, push, then deploy plantpal-api at that commit.')
