import { NextResponse } from 'next/server'
import { isShopifySyncAdmin } from '@/app/lib/shopifySyncAdminAuth'
import { createServerSupabase } from '@/app/lib/serverSupabase'

const ALLOWED_ACTIONS = new Set([
  'reset_auto',
  'force_draft',
  'force_archive',
  'force_active',
  'reserve_manual',
  'unreserve_manual',
])

type ExistingRule = {
  colorme_product_id: number
  shopify_mode: string | null
  is_reserved: boolean | null
  note: string | null
}

export async function PUT(request: Request) {
  if (!(await isShopifySyncAdmin())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const action = String(body?.action || '')
  const suppliedIds: unknown[] = Array.isArray(body?.productIds) ? body.productIds : []
  const productIds = Array.from(
    new Set<number>(
      suppliedIds
        .map((value) => Number(value))
        .filter((value): value is number => Number.isSafeInteger(value) && value > 0)
    )
  )

  if (!ALLOWED_ACTIONS.has(action) || productIds.length === 0 || productIds.length > 1000) {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const { data: existingData, error: existingError } = await supabase
    .from('shopify_sync_rules')
    .select('colorme_product_id,shopify_mode,is_reserved,note')
    .in('colorme_product_id', productIds)

  if (existingError) {
    return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 })
  }

  const existing = new Map(
    ((existingData || []) as ExistingRule[]).map((row) => [Number(row.colorme_product_id), row])
  )

  const rows = productIds.map((productId) => {
    const current = existing.get(productId)
    let shopifyMode = current?.shopify_mode || 'auto'
    let isReserved = Boolean(current?.is_reserved)

    if (action === 'reset_auto') {
      shopifyMode = 'auto'
      isReserved = false
    } else if (action === 'reserve_manual') {
      isReserved = true
    } else if (action === 'unreserve_manual') {
      isReserved = false
    } else {
      shopifyMode = action
    }

    return {
      colorme_product_id: productId,
      shopify_mode: shopifyMode,
      is_reserved: isReserved,
      allow_variant_delete: true,
      note: current?.note || '',
    }
  })

  const { error } = await supabase
    .from('shopify_sync_rules')
    .upsert(rows, { onConflict: 'colorme_product_id' })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, updated: rows.length })
}
