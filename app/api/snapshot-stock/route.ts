import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  const { data: stocks, error: stockError } = await supabase
    .from('stock_by_location')
    .select('sku, qty')

  if (stockError) {
    return NextResponse.json({ error: stockError.message }, { status: 500 })
  }

  const stockMap: Record<string, number> = {}

  for (const row of stocks || []) {
    stockMap[row.sku] = (stockMap[row.sku] || 0) + (row.qty || 0)
  }

  const rows = Object.entries(stockMap).map(([sku, stock]) => ({
    sku,
    stock,
  }))

  const { error: insertError } = await supabase
    .from('stock_history')
    .insert(rows)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    count: rows.length,
  })
}
