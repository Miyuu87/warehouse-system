import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { saveStockSnapshot } from '@/app/lib/stockSnapshot'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COLORME_API = 'https://api.shop-pro.jp/v1'
const LIMIT = 50
const MAX_PAGES_PER_RUN = 7
const STATE_KEY = 'colorme_next_offset'

type ProductRow = {
  sku: string
  product_id: string
  product_name: string
  option_name: string
  image_url: string
  colorme_stock: number
}

function normalizeSku(value: unknown): string {
  return String(value ?? '').trim()
}

export async function GET() {
  try {
    const accessToken = process.env.COLORME_ACCESS_TOKEN

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: 'COLORME_ACCESS_TOKEN is missing' },
        { status: 500 }
      )
    }

    const { data: state, error: stateError } = await supabase
      .from('sync_state')
      .select('value')
      .eq('key', STATE_KEY)
      .single()

    if (stateError && stateError.code !== 'PGRST116') {
      throw new Error(stateError.message)
    }

    let offset = Number(state?.value || 0)
    const startOffset = offset

    let totalFetchedProducts = 0
    let totalRawProductRows = 0
    let totalProductRows = 0
    let hasNext = true
    let snapshotCount: number | null = null

    const duplicateSkus = new Set<string>()

    for (let page = 0; page < MAX_PAGES_PER_RUN; page++) {
      const res = await fetch(
        `${COLORME_API}/products.json?limit=${LIMIT}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      const json = await res.json()

      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: json, offset },
          { status: 500 }
        )
      }

      const products = json.products || []
      const productRows: ProductRow[] = []

      for (const product of products) {
        const variants = product.variants || []

        if (variants.length > 0) {
          for (const variant of variants) {
            const sku = normalizeSku(variant.model_number)

            if (!sku) continue

            productRows.push({
              sku,
              product_id: String(product.id),
              product_name: product.name,
              option_name:
                variant.title || variant.option1_value || '',
              image_url:
                product.image_url ||
                product.thumbnail_image_url ||
                '',
              colorme_stock: Number(variant.stocks || 0),
            })
          }
        } else {
          const sku = normalizeSku(product.model_number)

          if (!sku) continue

          productRows.push({
            sku,
            product_id: String(product.id),
            product_name: product.name,
            option_name: '',
            image_url:
              product.image_url ||
              product.thumbnail_image_url ||
              '',
            colorme_stock: Number(product.stocks || 0),
          })
        }
      }

      /*
       * 同じupsert内に同一SKUが複数あるとPostgresが失敗するため、
       * SKUごとに1件へまとめる。
       * 同一SKUが複数ある場合は、最後に取得した行を採用する。
       */
      const uniqueRowsBySku = new Map<string, ProductRow>()

      for (const row of productRows) {
        if (uniqueRowsBySku.has(row.sku)) {
          duplicateSkus.add(row.sku)
        }

        uniqueRowsBySku.set(row.sku, row)
      }

      const deduplicatedProductRows = Array.from(
        uniqueRowsBySku.values()
      )

      if (deduplicatedProductRows.length > 0) {
        const { error: productUpsertError } = await supabase
          .from('products')
          .upsert(deduplicatedProductRows, {
            onConflict: 'sku',
          })

        if (productUpsertError) {
          throw new Error(productUpsertError.message)
        }
      }

      totalFetchedProducts += products.length
      totalRawProductRows += productRows.length
      totalProductRows += deduplicatedProductRows.length

      if (products.length < LIMIT) {
        hasNext = false
        offset = 0

        const snapshot = await saveStockSnapshot(supabase)
        snapshotCount = snapshot.count

        break
      }

      offset += LIMIT
    }

    const { error: stateUpsertError } = await supabase
      .from('sync_state')
      .upsert({
        key: STATE_KEY,
        value: String(offset),
        updated_at: new Date().toISOString(),
      })

    if (stateUpsertError) {
      throw new Error(stateUpsertError.message)
    }

    const duplicateSkuList = Array.from(duplicateSkus).sort()

    if (duplicateSkuList.length > 0) {
      console.warn('Duplicate ColorMe SKUs:', duplicateSkuList)
    }

    return NextResponse.json({
      ok: true,
      mode: 'cron_stateful',
      startOffset,
      nextOffset: offset,
      processedPages: Math.ceil(totalFetchedProducts / LIMIT),
      totalFetchedProducts,

      // 重複除去前
      totalRawProductRows,

      // 実際にSupabaseへ送った件数
      totalProductRows,

      duplicateSkuCount: duplicateSkuList.length,
      duplicateSkus: duplicateSkuList,
      hasNext,
      snapshotCount,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
