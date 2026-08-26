import { NextRequest, NextResponse } from 'next/server'
import { isShopifySyncAdmin } from '@/app/lib/shopifySyncAdminAuth'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  if (!(await isShopifySyncAdmin())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.SHOPIFY_SYNC_TRIGGER_URL
  const secret = process.env.SHOPIFY_SYNC_TRIGGER_SECRET
  if (!url || !secret) {
    return NextResponse.json(
      { ok: false, error: '同期実行URLまたはシークレットが未設定です' },
      { status: 500 }
    )
  }

  const body = await request.json().catch(() => ({})) as { mode?: string }
  const mode = body.mode === 'main_image_refresh_start' ? body.mode : 'catalog'

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Sync-Secret': secret,
        'X-Sync-Mode': mode,
      },
      cache: 'no-store',
    })

    const text = await response.text()
    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `さくら側の開始要求が失敗しました（HTTP ${response.status}）: ${text.slice(0, 300)}`,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      mode,
      message: mode === 'main_image_refresh_start'
        ? 'メイン画像の一括更新を開始しました'
        : '商品差分同期を開始しました',
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: `さくら側へ接続できませんでした: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 502 }
    )
  }
}
