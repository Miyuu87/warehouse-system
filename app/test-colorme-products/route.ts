import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const accessToken = process.env.COLORME_ACCESS_TOKEN

    const response = await fetch(
      'https://api.shop-pro.jp/v1/products.json',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const data = await response.json()

    return NextResponse.json({
      ok: true,
      total: data.products?.length || 0,
      first: data.products?.[0] || null,
    })
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e.message,
    })
  }
}
