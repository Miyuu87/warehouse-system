import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { saveStockSnapshot } from '@/app/lib/stockSnapshot'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COLORME_API = 'https://api.shop-pro.jp/v1'
const LIMIT = 100
const MAX_PAGES_PER_RUN = 7
const STATE_KEY = 'colorme_next_offset'

export async function GET() {
  try {
    const accessToken = process.env.COLORME_ACCESS_TOKEN

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: 'COLORME_ACCESS_TOKEN is missing' },
        { status: 500 }
      )
    }

    const { data: state } = await supabase
      .from('sync_state')
      .select('value')
      .eq('key', STATE_KEY)
      .single()

    let offset = Number(state?.value || 0)
    const startOffset = offset

    let totalFetchedProducts = 0
    let totalProductRows = 0
    let hasNext = true
    let snapshotCount: number | null = null

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
      const productRows: any[] = []

      for (const product of products) {
        const variants = product.variants || []

        if (variants.length > 0) {
          for (const variant of variants) {
            const sku = variant.model_number
            if (!sku) continue

            productRows.push({
              sku,
              product_id: String(product.id),
              product_name: product.name,
              option_name: variant.title || variant.option1_value || '',
              image_url:
                product.image_url || product.thumbnail_image_url || '',
              colorme_stock: Number(variant.stocks || 0),
            })
          }
        } else {
          const sku = product.model_number
          if (!sku) continue

          productRows.push({
            sku,
            product_id: String(product.id),
            product_name: product.name,
            option_name: '',
            image_url:
              product.image_url || product.thumbnail_image_url || '',
            colorme_stock: Number(product.stocks || 0),
          })
        }
      }

      if (productRows.length > 0) {
        const { error: productUpsertError } = await supabase
          .from('products')
          .upsert(productRows, { onConflict: 'sku' })

        if (productUpsertError) {
          throw new Error(productUpsertError.message)
        }
      }

      totalFetchedProducts += products.length
      totalProductRows += productRows.length

      if (products.length < LIMIT) {
        hasNext = false
        offset = 0

        const snapshot = await saveStockSnapshot(supabase)
        snapshotCount = snapshot.count

        break
      }

      offset += LIMIT
    }

    await supabase
      .from('sync_state')
      .upsert({
        key: STATE_KEY,
        value: String(offset),
        updated_at: new Date().toISOString(),
      })

    return NextResponse.json({
      ok: true,
      mode: 'cron_stateful',
      startOffset,
      nextOffset: offset,
      processedPages: Math.ceil(totalFetchedProducts / LIMIT),
      totalFetchedProducts,
      totalProductRows,
      hasNext,
      snapshotCount,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
