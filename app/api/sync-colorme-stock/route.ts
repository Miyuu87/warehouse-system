import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')

    // -----------------------------
    // code がある場合
    // → access_token取得
    // -----------------------------
    if (code) {
      const tokenResponse = await fetch(
        'https://api.shop-pro.jp/oauth/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: process.env.COLORME_CLIENT_ID!,
            client_secret: process.env.COLORME_CLIENT_SECRET!,
            redirect_uri:
              'https://warehouse-system-pi.vercel.app/api/colorme/callback',
          }),
        }
      )

      const tokenData = await tokenResponse.json()

      return NextResponse.json({
        ok: true,
        tokenData,
      })
    }

    // -----------------------------
    // token存在確認
    // -----------------------------
    return NextResponse.json({
      ok: true,
      message: 'Colorme sync route ready',
    })
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e.message,
    })
  }
}
