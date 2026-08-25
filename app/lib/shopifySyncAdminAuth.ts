import 'server-only'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'

export const SHOPIFY_SYNC_ADMIN_COOKIE = 'shopify_sync_admin'

function password() {
  const value = process.env.SHOPIFY_SYNC_ADMIN_PASSWORD
  if (!value) throw new Error('SHOPIFY_SYNC_ADMIN_PASSWORD is missing')
  return value
}

export function expectedAdminToken() {
  return crypto
    .createHmac('sha256', password())
    .update('warehouse-system:shopify-sync-admin:v1')
    .digest('hex')
}

export function verifyAdminPassword(candidate: string) {
  const expected = Buffer.from(password())
  const actual = Buffer.from(candidate)
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

export async function isShopifySyncAdmin() {
  const token = (await cookies()).get(SHOPIFY_SYNC_ADMIN_COOKIE)?.value || ''
  const expected = expectedAdminToken()
  const tokenBuffer = Buffer.from(token)
  const expectedBuffer = Buffer.from(expected)
  return (
    tokenBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(tokenBuffer, expectedBuffer)
  )
}

