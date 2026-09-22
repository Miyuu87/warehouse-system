import { SupabaseClient } from '@supabase/supabase-js'

type StockRow = {
  sku: string
  stock: number
}

const PAGE_SIZE = 1000
const LOOKUP_CHUNK_SIZE = 200

export async function saveStockSnapshot(supabase: SupabaseClient) {
  let offset = 0
  let changedCount = 0
  let scannedCount = 0

  while (true) {
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('sku, colorme_stock')
      .eq('is_active', true)
      .not('sku', 'is', null)
      .order('sku', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (productError) throw new Error(productError.message)

    const rows: StockRow[] = (products || [])
      .filter((row) => row.sku)
      .map((row) => ({
        sku: String(row.sku),
        stock: Number(row.colorme_stock || 0),
      }))

    if (rows.length === 0) break
    scannedCount += rows.length

    for (let i = 0; i < rows.length; i += LOOKUP_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + LOOKUP_CHUNK_SIZE)
      const skus = chunk.map((row) => row.sku)

      const { data: states, error: stateError } = await supabase
        .from('stock_snapshot_state')
        .select('sku, stock')
        .in('sku', skus)

      if (stateError) throw new Error(stateError.message)

      const stateMap = new Map(
        (states || []).map((row) => [String(row.sku), Number(row.stock || 0)])
      )

      const changedRows = chunk
        .filter((row) => !stateMap.has(row.sku) || stateMap.get(row.sku) !== row.stock)
        .map((row) => ({
          sku: row.sku,
          previous_stock: stateMap.has(row.sku) ? stateMap.get(row.sku)! : null,
          stock: row.stock,
        }))

      if (changedRows.length === 0) continue

      // Keep the legacy history intact. New changes go to the compact event table.
      const { error: historyError } = await supabase
        .from('stock_change_history')
        .insert(changedRows)

      if (historyError) throw new Error(historyError.message)

      const now = new Date().toISOString()
      const { error: stateUpsertError } = await supabase
        .from('stock_snapshot_state')
        .upsert(
          changedRows.map((row) => ({
            sku: row.sku,
            stock: row.stock,
            updated_at: now,
          })),
          { onConflict: 'sku' }
        )

      if (stateUpsertError) throw new Error(stateUpsertError.message)
      changedCount += changedRows.length
    }

    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return { count: changedCount, scannedCount }
}
