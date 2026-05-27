import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizeSku(value: unknown) {
  return String(value ?? '').trim().toUpperCase()
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        product_id,
        option_id,
        sku,
        product_name,
        option_name,
        colorme_stock,
        has_option
      `)
      .order('product_id', { ascending: true })

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message
        },
        { status: 500 }
      )
    }

    const rows = (data || []).map((item) => ({
      商品ID: item.product_id || '',
      型番: normalizeSku(item.sku),
      name: item.product_name || '',
      オプション名１: item.option_name || '',
      在庫数: item.colorme_stock ?? 0
    }))

    return NextResponse.json({
      ok: true,
      count: rows.length,
      rows
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'unknown error'
      },
      { status: 500 }
    )
  }
}
