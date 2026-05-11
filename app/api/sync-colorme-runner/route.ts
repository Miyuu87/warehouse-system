import { NextResponse } from 'next/server'

export async function GET() {
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>ColorMe Sync Runner</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; background:#f5f5f5; }
    pre { background:#111; color:#0f0; padding:16px; border-radius:12px; white-space:pre-wrap; }
    button { padding:12px 20px; border-radius:10px; border:0; background:#111; color:#fff; font-weight:bold; }
  </style>
</head>
<body>
  <h1>ColorMe 在庫同期</h1>
  <button onclick="startSync()">同期開始</button>
  <pre id="log">待機中...</pre>

  <script>
    const log = document.getElementById('log')

    function write(text) {
      log.textContent += "\\n" + text
    }

    async function startSync() {
      log.textContent = '同期開始...'

      let url = '/api/sync-colorme-stock?offset=0&limit=20'
      let count = 0

      while (url) {
        count++

        write('実行中: ' + url)

        const res = await fetch(url)
        const json = await res.json()

        write(JSON.stringify(json, null, 2))

        if (!json.ok) {
          write('エラーで停止しました')
          return
        }

        url = json.nextUrl
          ? json.nextUrl.replace(location.origin, '')
          : null
      }

      write('完了しました')
    }
  </script>
</body>
</html>
`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
