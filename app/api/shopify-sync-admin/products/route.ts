import { NextRequest, NextResponse } from 'next/server'
import { isShopifySyncAdmin } from '@/app/lib/shopifySyncAdminAuth'
import { createServerSupabase } from '@/app/lib/serverSupabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_FILTERS = new Set(['all', 'excluded', 'manual', 'automatic'])
type ExclusionType = 'manual' | 'automatic' | 'none'

type ProductRow = {
  product_id: string | null
  sku: string
  product_name: string | null
  option_name: string | null
  image_url: string | null
  colorme_stock: number | null
}

export async function GET(request: NextRequest) {
  if (!(await isShopifySyncAdmin())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerSupabase()
  const search = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
  const requestedFilter = request.nextUrl.searchParams.get('filter') || 'all'
  const filter = ALLOWED_FILTERS.has(requestedFilter) ? requestedFilter : 'all'
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1))
  const pageSize = 1000
  let from = 0
  let allProducts: ProductRow[] = []

  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('product_id,sku,product_name,option_name,image_url,colorme_stock')
      .order('product_id', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    allProducts = allProducts.concat((data || []) as ProductRow[])
    if (!data || data.length < pageSize) break
    from += pageSize
  }

  const [rulesResult, mappingsResult, errorsResult, runsResult] = await Promise.all([
    supabase.from('shopify_sync_rules').select('*'),
    supabase.from('shopify_sync_mappings').select('*'),
    supabase
      .from('shopify_sync_errors')
      .select('*')
      .eq('active', true)
      .order('last_occurred_at', { ascending: false })
      .limit(500),
    supabase
      .from('shopify_sync_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10),
  ])

  for (const result of [rulesResult, mappingsResult, errorsResult, runsResult]) {
    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 })
    }
  }

  const rules = new Map((rulesResult.data || []).map((row) => [String(row.colorme_product_id), row]))
  const mappings = new Map(
    (mappingsResult.data || []).map((row) => [String(row.colorme_product_id), row])
  )
  const errorsByProduct = new Map<string, typeof errorsResult.data>()

  for (const error of errorsResult.data || []) {
    const key = String(error.colorme_product_id || '')
    if (!key) continue
    errorsByProduct.set(key, [...(errorsByProduct.get(key) || []), error])
  }

  const grouped = new Map<string, ProductRow[]>()
  for (const row of allProducts) {
    const key = String(row.product_id || '')
    if (!key) continue
    grouped.set(key, [...(grouped.get(key) || []), row])
  }

  let products = Array.from(grouped.entries()).map(([productId, variants]) => {
    const first = variants[0]
    const rule = rules.get(productId)
    const mapping = mappings.get(productId)
    const shopifyMode = rule?.shopify_mode || 'auto'
    const isReserved = Boolean(rule?.is_reserved)
    const statusReason = mapping?.status_reason || ''
    const manualExcluded =
      shopifyMode === 'force_draft' || shopifyMode === 'force_archive' || isReserved
    const automaticExcluded =
      !manualExcluded && ['zero_price', 'colorme_hidden'].includes(statusReason)
    const exclusionType: ExclusionType = manualExcluded
      ? 'manual'
      : automaticExcluded
        ? 'automatic'
        : 'none'

    return {
      productId,
      productName: first?.product_name || '',
      imageUrl: first?.image_url || '',
      totalStock: variants.reduce((sum, row) => sum + Number(row.colorme_stock || 0), 0),
      skus: variants.map((row) => row.sku).filter(Boolean),
      variantCount: variants.length,
      shopifyMode,
      isReserved,
      note: rule?.note || '',
      shopifyProductId: mapping?.shopify_product_id || '',
      lastStatus: mapping?.last_status || '',
      statusReason,
      exclusionType,
      lastSyncedAt: mapping?.last_synced_at || null,
      errors: errorsByProduct.get(productId) || [],
    }
  })

  if (search) {
    products = products.filter((product) =>
      [product.productId, product.productName, product.note, ...product.skus]
        .join(' ')
        .toLowerCase()
        .includes(search)
    )
  }

  const exclusionCounts = {
    all: products.length,
    excluded: products.filter((product) => product.exclusionType !== 'none').length,
    manual: products.filter((product) => product.exclusionType === 'manual').length,
    automatic: products.filter((product) => product.exclusionType === 'automatic').length,
  }

  if (filter === 'excluded') {
    products = products.filter((product) => product.exclusionType !== 'none')
  } else if (filter === 'manual' || filter === 'automatic') {
    products = products.filter((product) => product.exclusionType === filter)
  }

  products.sort((a, b) => {
    if (a.errors.length !== b.errors.length) return b.errors.length - a.errors.length
    if (a.exclusionType !== b.exclusionType) {
      const order: Record<ExclusionType, number> = { manual: 0, automatic: 1, none: 2 }
      return order[a.exclusionType] - order[b.exclusionType]
    }
    if (a.isReserved !== b.isReserved) return Number(b.isReserved) - Number(a.isReserved)
    return b.productId.localeCompare(a.productId, 'ja', { numeric: true })
  })

  const perPage = 100
  const total = products.length
  const pageRows = products.slice((page - 1) * perPage, page * perPage)
  const globalErrors = (errorsResult.data || []).filter((error) => !error.colorme_product_id)

  return NextResponse.json({
    ok: true,
    products: pageRows,
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    filter,
    exclusionCounts,
    activeErrorCount: (errorsResult.data || []).length,
    globalErrors,
    runs: runsResult.data || [],
  })
}
