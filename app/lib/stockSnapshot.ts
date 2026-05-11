import { SupabaseClient } from '@supabase/supabase-js'

export async function saveStockSnapshot(supabase: SupabaseClient) {
  const { data: stocks, error: stockError } = await supabase
    .from('stock_by_location')
    .select('sku, qty')

  if (stockError) {
    throw new Error(stockError.message)
  }

  const stockMap: Record<string, number> = {}

  for (const row of stocks || []) {
    stockMap[row.sku] = (stockMap[row.sku] || 0) + (row.qty || 0)
  }

  const rows = Object.entries(stockMap).map(([sku, stock]) => ({
    sku,
    stock,
  }))

  if (rows.length === 0) {
    return { count: 0 }
  }

  const { error: insertError } = await supabase
    .from('stock_history')
    .insert(rows)

  if (insertError) {
    throw new Error(insertError.message)
  }

  return { count: rows.length }
}
