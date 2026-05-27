import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { saveStockSnapshot } from '@/app/lib/stockSnapshot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COLORME_API = 'https://api.shop-pro.jp/v1'
const LIMIT = 50

function normalizeSku(value: unknown) {
  return String(value ?? '').trim().toUpperCase()
}

export async function GET() {
  const startedAt = new Date().toISOString()

  try {
    const accessToken = process.env.COLORME_ACCESS_TOKEN

    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          error: 'COLORME_ACCESS_TOKEN is missing',
        },
        { status: 500 }
      )
    }

    const syncRunId = crypto.randomUUID()

    let offset = 0
    let totalFetchedProducts = 0
    let totalProductRows = 0
    let totalPages = 0
    let snapshotCount: number | null = null

    while (true) {
      const url =
        `${COLORME_API}/products.json` +
        `?limit=${LIMIT}` +
        `&offset=${offset}`

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      })

      const json = await res.json()

      if (!res.ok) {
        return NextResponse.json(
          {
            ok: false,
            offset,
            error: json,
          },
          { status: 500 }
        )
      }

      const products = json.products || []

      // 0件で終了
      if (products.length === 0) {
        break
      }

      const productRows: any[] = []

      for (const product of products) {
        const variants = product.variants || []

        // バリエーションあり
        if (variants.length > 0) {
          for (const variant of variants) {
            const sku = normalizeSku(variant.model_number)

            if (!sku) continue

            productRows.push({
              sku,
              product_id: String(product.id),
              product_name: product.name,
              option_name:
                variant.title ||
                variant.option1_value ||
                '',
              image_url:
                product.image_url ||
                product.thumbnail_image_url ||
                '',
              colorme_stock: Number(variant.stocks || 0),
              has_option: true,
              is_active: true,
              full_sync_run_id: syncRunId,
              full_synced_at: startedAt,
              updated_at: startedAt,
            })
          }
        }

        // 単品商品
        else {
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
            has_option: false,
            is_active: true,
            full_sync_run_id: syncRunId,
            full_synced_at: startedAt,
            updated_at: startedAt,
          })
        }
      }

      // upsert
      if (productRows.length > 0) {
        const { error: upsertError } = await supabase
          .from('products')
          .upsert(productRows, {
            onConflict: 'sku',
          })

        if (upsertError) {
          throw new Error(upsertError.message)
        }
      }

      totalFetchedProducts += products.length
      totalProductRows += productRows.length
      totalPages += 1

      // 次ページ
      offset += LIMIT
    }

    // 今回syncされなかったSKUを0にする
    const { error: zeroError } = await supabase
      .from('products')
      .update({
        colorme_stock: 0,
        full_synced_at: startedAt,
        updated_at: startedAt,
      })
      .neq('full_sync_run_id', syncRunId)
      .eq('is_active', true)

    if (zeroError) {
      throw new Error(
        `Zero missing products error: ${zeroError.message}`
      )
    }

    // snapshot
    const snapshot = await saveStockSnapshot(supabase)
    snapshotCount = snapshot.count

    return NextResponse.json({
      ok: true,
      mode: 'full',
      startedAt,
      finishedAt: new Date().toISOString(),
      syncRunId,
      totalPages,
      totalFetchedProducts,
      totalProductRows,
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
