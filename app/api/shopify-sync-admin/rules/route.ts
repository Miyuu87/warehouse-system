import { NextResponse } from 'next/server'
import { isShopifySyncAdmin } from '@/app/lib/shopifySyncAdminAuth'
import { createServerSupabase } from '@/app/lib/serverSupabase'

const ALLOWED_MODES = new Set(['auto', 'force_draft', 'force_active', 'force_archive'])

export async function PUT(request: Request) {
  if (!(await isShopifySyncAdmin())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const productId = Number(body?.productId)
  const shopifyMode = String(body?.shopifyMode || 'auto')
  const isReserved = Boolean(body?.isReserved)
  const allowVariantDelete = Boolean(body?.allowVariantDelete)
  const note = String(body?.note || '').slice(0, 1000)

  if (!Number.isSafeInteger(productId) || productId <= 0 || !ALLOWED_MODES.has(shopifyMode)) {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('shopify_sync_rules')
    .upsert(
      {
        colorme_product_id: productId,
        shopify_mode: shopifyMode,
        is_reserved: isReserved,
        allow_variant_delete: allowVariantDelete,
        note,
      },
      { onConflict: 'colorme_product_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, rule: data })
}
