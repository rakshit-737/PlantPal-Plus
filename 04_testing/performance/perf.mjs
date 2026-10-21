// PlantPal+ API latency check against the NFR-PERF thresholds.
// Usage: node perf.mjs [baseUrl] [samples]   (default http://localhost:4000, 150)
// Run against a LOCAL API and a disposable database only. Never the live site.
const BASE = process.argv[2] ?? 'http://localhost:4000'
const N = Number(process.argv[3] ?? 150)
const H = { 'content-type': 'application/json', 'x-plantpal-client': 'ANDROID' }
const email = `perf-${Date.now()}@verify.plantpal.example`
const pw = 'Correct-Horse-Battery-9!'
const today = new Date().toISOString().slice(0, 10)
const call = async (method, path, body, token) => {
  const t0 = performance.now()
  const res = await fetch(BASE + path, { method, headers: { ...H, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const ms = performance.now() - t0
  const json = await res.json().catch(() => ({}))
  return { ms, status: res.status, json }
}
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] }

await call('POST', '/api/auth/register', { email, password: pw, confirmed_age: true })
const login = await call('POST', '/api/auth/login', { email, password: pw })
const token = login.json.access_token
if (!token) { console.error('login failed', login.status, login.json); process.exit(1) }
// seed realistic data: 20 plants, 40 workouts, 40 meals
const sp = (await call('GET', '/api/v1/plants/species?q=a', null, token)).json
const s0 = (Array.isArray(sp) ? sp : sp.species)[0]
for (let i = 0; i < 20; i++) await call('POST', '/api/v1/plants', { nickname: `perf ${i}`, species_id: s0.id, base_interval_days: s0.base_interval_days, min_interval_days: s0.min_interval_days, max_interval_days: s0.max_interval_days, light_exposure: 'MEDIUM', placement: 'INDOOR' }, token)
for (let i = 0; i < 40; i++) {
  await call('POST', '/api/v1/fitness', { activity_type: 'RUN', local_date_str: today, duration_mins: 30 }, token)
  await call('POST', '/api/v1/nutrition/meals', { meal_type: 'LUNCH', local_date_str: today, items: [{ food_name_at_log: 'Rice', quantity: 1, serving_unit: 'CUP', grams: 150, kcal: 200, protein_g: 4, carbs_g: 44, fat_g: 0.4 }] }, token)
}
const scenarios = [
  ['read  GET /plants (20 rows)', 'read', () => call('GET', '/api/v1/plants', null, token)],
  ['read  GET /fitness (page)', 'read', () => call('GET', '/api/v1/fitness?limit=50', null, token)],
  ['read  GET /plants/species search', 'read', () => call('GET', '/api/v1/plants/species?q=a', null, token)],
  ['read  GET /achievements', 'read', () => call('GET', '/api/v1/achievements', null, token)],
  ['dash  GET /dashboard', 'dash', () => call('GET', `/api/v1/dashboard?date=${today}`, null, token)],
  ['write POST /nutrition/water', 'write', () => call('POST', '/api/v1/nutrition/water', { amount_ml: 250, local_date_str: today }, token)],
  ['write POST /fitness', 'write', () => call('POST', '/api/v1/fitness', { activity_type: 'WALK', local_date_str: today, duration_mins: 10 }, token)],
]
const limits = { read: [400, 900], write: [600, 1200], dash: [800, null] }
const out = []
let failed = 0
for (const [name, kind, fn] of scenarios) {
  for (let i = 0; i < 10; i++) await fn() // warm-up, discarded
  const times = []; let bad = 0
  for (let i = 0; i < N; i++) { const r = await fn(); if (r.status >= 400) bad++; times.push(r.ms) }
  const p95 = pct(times, 95), p99 = pct(times, 99), [l95, l99] = limits[kind]
  const ok = bad === 0 && p95 <= l95 && (l99 === null || p99 <= l99)
  if (!ok) failed++
  out.push({ scenario: name, samples: N, errors: bad, p50: +pct(times, 50).toFixed(1), p95: +p95.toFixed(1), p99: +p99.toFixed(1), limit_p95: l95, limit_p99: l99, result: ok ? 'PASS' : 'FAIL' })
}
console.table(out)
import { writeFileSync } from 'node:fs'
writeFileSync(new URL('./perf-result.json', import.meta.url), JSON.stringify({ base: BASE, node: process.version, date: new Date().toISOString(), results: out }, null, 2))
process.exit(failed ? 1 : 0)
