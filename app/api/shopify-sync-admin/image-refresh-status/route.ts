import { NextResponse } from 'next/server'
import { isShopifySyncAdmin } from '@/app/lib/shopifySyncAdminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

export async function GET() {
  if (!(await isShopifySyncAdmin())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.SHOPIFY_SYNC_TRIGGER_URL?.trim()
  const secret = process.env.SHOPIFY_SYNC_TRIGGER_SECRET?.trim()
  if (!url || !secret) {
    return NextResponse.json(
      { ok: false, error: '同期実行URLまたはシークレットが未設定です' },
      { status: 500 }
    )
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Sync-Secret': secret,
        'X-Sync-Mode': 'main_image_refresh_status',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    const text = await response.text()
    let payload: Record<string, unknown> = {}
    try {
      payload = text ? JSON.parse(text) as Record<string, unknown> : {}
    } catch {
      return NextResponse.json(
        { ok: false, error: `さくら側からJSON以外の応答が返りました: ${text.slice(0, 200)}` },
        { status: 502 }
      )
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `さくら側の進捗取得が失敗しました（HTTP ${response.status}）: ${String(payload.error || text).slice(0, 300)}`,
        },
        { status: 502 }
      )
    }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: `さくら側から進捗を取得できませんでした: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 502 }
    )
  }
}
