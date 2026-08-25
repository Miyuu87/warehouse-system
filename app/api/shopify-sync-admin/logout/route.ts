import { NextResponse } from 'next/server'
import { SHOPIFY_SYNC_ADMIN_COOKIE } from '@/app/lib/shopifySyncAdminAuth'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SHOPIFY_SYNC_ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return response
}

