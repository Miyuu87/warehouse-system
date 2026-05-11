import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.COLORME_ACCESS_TOKEN

  if (!token) {
    return NextResponse.json(
      { error: 'COLORME_ACCESS_TOKEN is missing' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    message: 'Colorme token exists',
  })
}
