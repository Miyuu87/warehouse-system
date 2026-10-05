// Public read-only projection for the approved HALLOWEEN LP and styling catalog.
// ColorMe credentials and all unrelated product data remain server-side.
export const dynamic = 'force-dynamic'
export const maxDuration = 20

const PRODUCT_IDS = ["189607053", "187804449", "187804432", "187804428", "189607239", "186395505", "189849141", "189849122", "189849100", "190663340", "183205461", "191900100", "189084439", "193161220", "193161372", "193161434", "193138740", "193138773", "193763303", "193763304", "193763305", "193763306", "193763299", "193763300", "193763302", "193763301", "193763296", "193763297", "193763298", "193763328", "193763327", "193763326", "193138750", "193161378", "191900116", "183205439", "190614138", "190661766", "193119452", "193119571", "193370656", "182821208", "168861993", "166108621", "181191940", "192938218", "190661887", "115477704", "179923791", "188731324", "106059500", "181055177", "166529151", "190629318", "156648949", "155750331", "183879115", "163019537"]
const STATES = new Set(['showing', 'hidden', 'showing_for_members', 'sale_for_members'])
const TTL_MS = 60_000
const headers = {
  'Access-Control-Allow-Origin': 'https://noiseandkisses.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=30, s-maxage=60',
  'X-Content-Type-Options': 'nosniff',
}
type Publication = { id: string; display_state: string }
type Payload = { ok: true; checkedAt: string; products: Publication[] }
let cached: { until: number; payload: Payload } | null = null
let inFlight: Promise<Payload> | null = null
let retryAfter = 0

async function readPublication(): Promise<Payload> {
  const token = process.env.COLORME_ACCESS_TOKEN
  if (!token) throw new Error('configuration')
  const chunks = [PRODUCT_IDS.slice(0, 50), PRODUCT_IDS.slice(50)].filter(ids => ids.length)
  const groups = await Promise.all(chunks.map(async ids => {
    const url = new URL('https://api.shop-pro.jp/v1/products.json')
    url.searchParams.set('ids', ids.join(','))
    url.searchParams.set('limit', '50')
    url.searchParams.set('fields', 'id,display_state')
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store', signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) throw new Error('upstream')
    const data: unknown = await response.json()
    if (!data || typeof data !== 'object' || !('products' in data) || !Array.isArray(data.products)) throw new Error('format')
    const allowed = new Set(ids)
    const found = new Map<string, Publication>()
    for (const item of data.products) {
      if (!item || typeof item !== 'object') continue
      const id = String(item.id)
      if (allowed.has(id) && typeof item.display_state === 'string' && STATES.has(item.display_state)) {
        found.set(id, { id, display_state: item.display_state })
      }
    }
    // Missing rows, zero stock, soldout_display and expiry never imply hidden.
    return [...found.values()]
  }))
  return { ok: true, checkedAt: new Date().toISOString(), products: groups.flat() }
}

export async function GET() {
  try {
    if (cached && Date.now() < cached.until) return Response.json(cached.payload, { headers })
    if (Date.now() < retryAfter) throw new Error('cooldown')
    if (!inFlight) inFlight = readPublication().then(payload => {
      cached = { until: Date.now() + TTL_MS, payload }
      retryAfter = 0
      return payload
    }).catch(error => {
      retryAfter = Date.now() + 5_000
      throw error
    }).finally(() => { inFlight = null })
    return Response.json(await inFlight, { headers })
  } catch {
    // Do not expose upstream response bodies or turn errors into SOLD OUT.
    return Response.json({ ok: false, products: [] }, {
      status: 503, headers: { ...headers, 'Cache-Control': 'no-store' },
    })
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers })
}

