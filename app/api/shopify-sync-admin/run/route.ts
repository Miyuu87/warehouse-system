import { NextResponse } from 'next/server'
import { isShopifySyncAdmin } from '@/app/lib/shopifySyncAdminAuth'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST() {
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

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'X-Sync-Secret': secret },
    cache: 'no-store',
  })

  const text = await response.text()
  if (!response.ok) {
    return NextResponse.json(
      { ok: false, error: `Sakura sync trigger failed: ${response.status} ${text.slice(0, 300)}` },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, message: '同期を開始しました' })
}

