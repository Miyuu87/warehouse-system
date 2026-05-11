import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { saveStockSnapshot } from '@/app/lib/stockSnapshot'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COLORME_API = 'https://api.shop-pro.jp/v1'
const LOCATION_CODE = 'COLORME'

export async function GET() {
  try {
    const accessToken = process.env.COLORME_ACCESS_TOKEN

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: 'COLORME_ACCESS_TOKEN is missing' },
        { status: 500 }
      )
    }

    const allProducts: any[] = []
    const limit = 50
    let offset = 0

    while (true) {
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
      allProducts.push(...products)

      if (products.length < limit) break
      offset += limit
    }

    const productRows: any[] = []
    const stockRows: any[] = []

    for (const product of allProducts) {
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
        })
      }
    }

    const skus = productRows.map((row) => row.sku)

    if (skus.length > 0) {
      await supabase.from('products').delete().in('sku', skus)

      const { error: productInsertError } = await supabase
        .from('products')
        .insert(productRows)

      if (productInsertError) {
        throw new Error(productInsertError.message)
      }
    }

    await supabase
      .from('stock_by_location')
      .delete()
      .eq('location_code', LOCATION_CODE)

    if (stockRows.length > 0) {
      const { error: stockInsertError } = await supabase
        .from('stock_by_location')
        .insert(stockRows)

      if (stockInsertError) {
        throw new Error(stockInsertError.message)
      }
    }

    const snapshot = await saveStockSnapshot(supabase)

    return NextResponse.json({
      ok: true,
      products: allProducts.length,
      productRows: productRows.length,
      stockRows: stockRows.length,
      snapshotCount: snapshot.count,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
