import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizeSku(value: unknown) {
  return String(value ?? '').trim().toUpperCase()
}

export async function GET() {
  try {
    const pageSize = 1000
    let from = 0
    let allRows: any[] = []

    while (true) {
      const to = from + pageSize - 1

      const { data, error } = await supabase
        .from('products')
        .select(`
          product_id,
          option_id,
          sku,
          product_name,
          option_name,
          colorme_stock,
          has_option,
          is_active
        `)
        .order('product_id', { ascending: true })
        .range(from, to)

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      }

      allRows = allRows.concat(data || [])

      if (!data || data.length < pageSize) break
      from += pageSize
    }

    const rows = allRows
      .filter((item) => item.is_active !== false)
      .map((item) => ({
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
      { ok: false, error: err.message || 'unknown error' },
      { status: 500 }
    )
  }
}
