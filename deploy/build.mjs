/**
 * Build the deployable artefact for the Supabase Edge Functions API.
 *
 *   node deploy/build.mjs
 *     → deploy/api/index.js     the API, bundled (apps/api/edge/build.mjs)
 *
 * The bundle is committed: the deployed `plantpal-api` function is a one-line
 * loader that imports it from this repository over jsDelivr, pinned to a
 * commit. See deploy/README.md for why, and for how the function is deployed
 * once the bundle exists.
 *
 * The web app is no longer built here. It is served by Vercel (vercel.json at
 * the repository root) and mirrored to GitHub Pages
 * (.github/workflows/deploy-web.yml); both build it themselves from source.
 */

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function run(command, args, options = {}) {
  execFileSync(command, args, { cwd: repoRoot, stdio: 'inherit', ...options })
}

console.log('· shared package')
run('npm', ['run', 'build', '--workspace', '@plantpal/shared'])

console.log('· api bundle')
run('node', ['apps/api/edge/build.mjs'])

console.log('\ncommit deploy/api/index.js, push, then deploy plantpal-api at that commit.')
