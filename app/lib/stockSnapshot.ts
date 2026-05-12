import { SupabaseClient } from '@supabase/supabase-js'

export async function saveStockSnapshot(supabase: SupabaseClient) {
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('sku, colorme_stock')
    .eq('is_active', true)
    .not('sku', 'is', null)

  if (productError) {
    throw new Error(productError.message)
  }

  const rows = (products || [])
    .filter((row) => row.sku)
    .map((row) => ({
      sku: row.sku,
      stock: Number(row.colorme_stock || 0),
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
