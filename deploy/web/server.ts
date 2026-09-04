/**
 * Static host for the PlantPal+ web app, as a Supabase Edge Function.
 *
 * SOURCE OF RECORD. The deployed function is this file with `__COMMIT__`
 * replaced by the commit the build came from; nothing else is edited on the
 * way out. See deploy/README.md.
 *
 * Why a function rather than a static host: the web app and the API have to
 * share an origin. The refresh token is an httpOnly cookie, and a cookie sent
 * from a different origin to the API is a third-party cookie — which Safari
 * blocks outright and Chrome is phasing out. Served from here, the page at
 * /functions/v1/plantpal and the API at /functions/v1/plantpal-api are the same
 * origin, so the cookie is first-party and sign-in survives on every browser.
 *
 * Why the assets come from a CDN rather than from inside this file: the built
 * bundle is half a megabyte across ten hashed files, and inlining that would
 * make every redeploy of this 60-line server carry it. They are fetched once
 * per instance and held in memory, so a warm instance serves them without
 * leaving the process, and the browser only ever talks to this origin.
 */

const COMMIT = '__COMMIT__'
const SLUG = Deno.env.get('SUPABASE_FUNCTION_SLUG') ?? 'plantpal'
const BASE = `/${SLUG}`
const CDN = `https://cdn.jsdelivr.net/gh/rakshit-737/PlantPal-Plus@${COMMIT}/deploy/web`

/**
 * Asset bodies, keyed by path. Immutable by construction: every filename Vite
 * emits carries a content hash, and the commit is pinned above, so a cached
 * entry can never be stale — a new build is a new URL and a new deployment.
 */
const cache = new Map<string, { body: Uint8Array; type: string }>()

const CONTENT_TYPES: Record<string, string> = {
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  html: 'text/html; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  woff2: 'font/woff2',
  json: 'application/json; charset=utf-8',
}

function contentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

async function load(path: string): Promise<{ body: Uint8Array; type: string } | null> {
  const hit = cache.get(path)
  if (hit) return hit
  const res = await fetch(`${CDN}${path}`)
  if (!res.ok) return null
  const entry = { body: new Uint8Array(await res.arrayBuffer()), type: contentType(path) }
  cache.set(path, entry)
  return entry
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  // The runtime routes /functions/v1/<slug>/* here and hands the handler the
  // path from the slug onwards.
  const path = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) : url.pathname

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } })
  }

  // A hashed asset can be cached forever; index.html cannot, because it is what
  // points at the current build's hashes.
  const isAsset = path.startsWith('/assets/')
  const asset = await load(isAsset ? path : '/index.html')

  if (!asset) {
    // Only an asset can 404: every other path is a client-side route, and
    // answering those with index.html is what makes a deep link work on reload.
    return isAsset
      ? new Response('Not found', { status: 404 })
      : new Response('The web bundle is not published at this commit.', { status: 502 })
  }

  return new Response(asset.body, {
    headers: {
      'content-type': asset.type,
      'cache-control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
      // The page is same-origin with the API and loads nothing cross-origin;
      // say so, rather than leaving the default open.
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'same-origin',
    },
  })
})
