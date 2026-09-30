// Public read-only projection for the approved GREMLINS LP catalog.
// ColorMe credentials and all unrelated product data remain server-side.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PRODUCT_IDS = ["193652117", "193528285", "193370666", "193370660", "193370656", "193253281", "193253264", "193119588", "193119580", "193119571", "193119556", "193119511", "193119499", "193119452", "193119446", "193119442", "193119430", "193119424", "192395370", "192395354", "192304080", "192261982", "192261623", "192261568", "192261095", "192260961", "192260841", "192260805", "192260617", "191811843", "191762860", "191474439", "191474431", "191474423", "191474154", "191113776", "190663090", "190663080", "190663020", "190662985", "190662814", "190662809", "190662807", "190662745", "190662716", "190662709", "190662702", "190039217", "189820323", "188975807", "188493332", "188234975", "188234973", "188234970", "188150365", "188150322", "188150047", "188150043", "188039275", "188039242", "188039203", "186278659", "186234562", "186234556", "186234533", "186234524", "185698478"]
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
