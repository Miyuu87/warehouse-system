import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { saveStockSnapshot } from '@/app/lib/stockSnapshot'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COLORME_API = 'https://api.shop-pro.jp/v1'
const LOCATION_CODE = 'COLORME'

export async function GET(req: NextRequest) {
  try {
    const accessToken = process.env.COLORME_ACCESS_TOKEN
    const offset = Number(req.nextUrl.searchParams.get('offset') || 0)
    const limit = Number(req.nextUrl.searchParams.get('limit') || 20)

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: 'COLORME_ACCESS_TOKEN is missing' },
        { status: 500 }
      )
    }

    const res = await fetch(
      `${COLORME_API}/products.json?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const json = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: json },
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
            note: 'colorme_sync',
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
          note: 'colorme_sync',
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

    let snapshotCount: number | null = null

    if (products.length < limit) {
      const result = await saveStockSnapshot(supabase)
      snapshotCount = result.count
    }

    return NextResponse.json({
      ok: true,
      nextUrl:
        products.length === limit
          ? `${req.nextUrl.origin}/api/sync-colorme-stock?offset=${offset + limit}&limit=${limit}`
          : null,
      offset,
      limit,
      fetchedProducts: products.length,
      productRows: productRows.length,
      stockRows: stockRows.length,
      hasNext: products.length === limit,
      nextOffset: products.length === limit ? offset + limit : null,
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
