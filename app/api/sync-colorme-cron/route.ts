import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { saveStockSnapshot } from '@/app/lib/stockSnapshot'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COLORME_API = 'https://api.shop-pro.jp/v1'
const LOCATION_CODE = 'COLORME'
const LIMIT = 20
const MAX_PAGES_PER_RUN = 10

export async function GET(req: NextRequest) {
  try {
    const accessToken = process.env.COLORME_ACCESS_TOKEN

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: 'COLORME_ACCESS_TOKEN is missing' },
        { status: 500 }
      )
    }

    const urlOffset = Number(req.nextUrl.searchParams.get('offset') || 0)
    let offset = urlOffset

    let totalFetchedProducts = 0
    let totalProductRows = 0
    let totalStockRows = 0
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
      const stockRows: any[] = []

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
              image_url: product.image_url || product.thumbnail_image_url || '',
            })

            stockRows.push({
              sku,
              location_code: LOCATION_CODE,
              qty: Number(variant.stocks || 0),
              product_id: String(product.id),
              option_id: variant.id ? String(variant.id) : null,
              note: 'colorme_cron_sync',
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
            image_url: product.image_url || product.thumbnail_image_url || '',
          })

          stockRows.push({
            sku,
            location_code: LOCATION_CODE,
            qty: Number(product.stocks || 0),
            product_id: String(product.id),
            option_id: null,
            note: 'colorme_cron_sync',
          })
        }
      }

      if (productRows.length > 0) {
        const { error: productUpsertError } = await supabase
          .from('products')
          .upsert(productRows, {
            onConflict: 'sku',
          })

        if (productUpsertError) {
          throw new Error(productUpsertError.message)
        }
      }

      if (stockRows.length > 0) {
        const { error: stockUpsertError } = await supabase
          .from('stock_by_location')
          .upsert(stockRows, {
            onConflict: 'sku,location_code',
          })

        if (stockUpsertError) {
          throw new Error(stockUpsertError.message)
        }
      }

      totalFetchedProducts += products.length
      totalProductRows += productRows.length
      totalStockRows += stockRows.length

      if (products.length < LIMIT) {
        hasNext = false
        offset = 0

        const snapshot = await saveStockSnapshot(supabase)
        snapshotCount = snapshot.count

        break
      }

      offset += LIMIT
    }

    return NextResponse.json({
      ok: true,
      mode: 'cron_chunk',
      processedPages: Math.ceil(totalFetchedProducts / LIMIT),
      totalFetchedProducts,
      totalProductRows,
      totalStockRows,
      hasNext,
      nextOffset: hasNext ? offset : 0,
      nextUrl: hasNext
        ? `${req.nextUrl.origin}/api/sync-colorme-cron?offset=${offset}`
        : `${req.nextUrl.origin}/api/sync-colorme-cron?offset=0`,
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
