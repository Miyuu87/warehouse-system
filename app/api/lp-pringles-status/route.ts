// Public read-only projection for the approved PRINGLES LP catalog.
// ColorMe credentials and all unrelated product data remain server-side.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PRODUCT_IDS = ["193763294","193763293","193763292","193763291","193763290","193763289","193763288","193763286","193763285","193763284","193763283","193763282","193763281","193763280","193763279","193763278","193763276","192660366","192660289","192660145","192660113","192653348","192653240","191955294","191955287","191955279","191955253","191955248","191955240","191955227","191955223","191955201","191955181","191955163","191955157","191955080","191955068","191955057","191955047","191954926"]
const STATES = new Set(['showing', 'hidden', 'showing_for_members', 'sale_for_members'])
const TTL_MS = 60_000
const headers = {
  'Access-Control-Allow-Origin': 'https://noiseandkisses.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=15, s-maxage=30',
  'X-Content-Type-Options': 'nosniff',
}
type Publication = { id: string; display_state: string }
type Payload = { ok: true; checkedAt: string; products: Publication[] }
let cached: { until: number; payload: Payload } | null = null
let inFlight: Promise<Payload> | null = null

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
    if (!inFlight) inFlight = readPublication().then(payload => {
      cached = { until: Date.now() + TTL_MS, payload }
      return payload
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
