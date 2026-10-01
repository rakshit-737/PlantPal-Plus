/**
 * Legacy entry point for the PlantPal+ web app — now a permanent redirect.
 *
 * SOURCE OF RECORD for the `plantpal` Edge Function: the deployed function is
 * this file, unchanged. See deploy/README.md.
 *
 * The web app was once served from this function, so that the page and the API
 * (`plantpal-api`) shared an origin. Supabase, however, rewrites `text/html`
 * responses from *.supabase.co to `text/plain` — a guard against functions
 * being used as web hosts — so browsers showed the raw HTML source instead of
 * the app. The web app now lives on Vercel, whose `/api/*` rewrite to
 * `plantpal-api` keeps the refresh cookie first-party just as this function
 * did. This function keeps every old link, deep links such as
 * /functions/v1/plantpal/plants included, working.
 *
 * verify_jwt is off: this is a public redirect and carries no data.
 */

const TARGET = 'https://plant-pal-plus.vercel.app'
const SLUG = Deno.env.get('SUPABASE_FUNCTION_SLUG') ?? 'plantpal'
const PREFIX = new RegExp(`^(?:/functions/v1)?/${SLUG}(?=/|$)`)

Deno.serve((req: Request) => {
  const url = new URL(req.url)
  const path = url.pathname.replace(PREFIX, '') || '/'
  return new Response(null, {
    status: 308,
    headers: {
      location: `${TARGET}${path}${url.search}`,
      'cache-control': 'public, max-age=3600',
    },
  })
})
