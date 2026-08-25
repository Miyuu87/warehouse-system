import { NextResponse } from 'next/server'
import {
  expectedAdminToken,
  SHOPIFY_SYNC_ADMIN_COOKIE,
  verifyAdminPassword,
} from '@/app/lib/shopifySyncAdminAuth'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const candidate = String(body?.password || '')

  if (!verifyAdminPassword(candidate)) {
    return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(SHOPIFY_SYNC_ADMIN_COOKIE, expectedAdminToken(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  })
  return response
}

