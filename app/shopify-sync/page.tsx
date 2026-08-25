import { redirect } from 'next/navigation'
import { isShopifySyncAdmin } from '@/app/lib/shopifySyncAdminAuth'
import ShopifySyncDashboard from './ShopifySyncDashboard'

export const dynamic = 'force-dynamic'

export default async function ShopifySyncPage() {
  if (!(await isShopifySyncAdmin())) redirect('/shopify-sync/login')
  return <ShopifySyncDashboard />
}

