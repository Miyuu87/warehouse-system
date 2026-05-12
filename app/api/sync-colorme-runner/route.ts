import { NextResponse } from 'next/server'

export async function GET() {
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>ColorMe Sync Runner</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      padding: 24px;
      background: #f5f5f5;
    }
    pre {
      background: #111;
      color: #0f0;
      padding: 16px;
      border-radius: 12px;
      white-space: pre-wrap;
      line-height: 1.5;
    }
    button {
      padding: 12px 20px;
      border-radius: 10px;
      border: 0;
      background: #111;
      color: #fff;
      font-weight: bold;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  </style>
</head>
<body>
  <h1>ColorMe 在庫同期</h1>
  <p>
    このページは <code>/api/sync-colorme-stock</code> を順番に実行します。<br>
    同期先は <strong>products.colorme_stock</strong> です。
  </p>

  <button id="syncButton" onclick="startSync()">同期開始</button>
  <pre id="log">待機中...</pre>

  <script>
    const log = document.getElementById('log')
    const button = document.getElementById('syncButton')

    function write(text) {
      log.textContent += "\\n" + text
    }

    async function startSync() {
      button.disabled = true
      log.textContent = '同期開始...'

      let url = '/api/sync-colorme-stock?offset=0&limit=20'
      let count = 0
      let totalFetchedProducts = 0
      let totalProductRows = 0

      try {
        while (url) {
          count++

          write('')
          write('[' + count + '] 実行中: ' + url)

          const res = await fetch(url)
          const json = await res.json()

          write(JSON.stringify(json, null, 2))

          if (!json.ok) {
            write('')
            write('エラーで停止しました')
            write('sync-colorme-stock 側に古い stock_by_location 書き込み処理が残っている可能性があります。')
            return
          }

          totalFetchedProducts += Number(json.fetchedProducts || 0)
          totalProductRows += Number(json.productRows || 0)

          url = json.nextUrl
            ? json.nextUrl.replace(location.origin, '')
            : null
        }

        write('')
        write('完了しました')
        write('取得商品数: ' + totalFetchedProducts)
        write('更新行数: ' + totalProductRows)
        write('更新先: products.colorme_stock')
      } catch (error) {
        write('')
        write('予期しないエラーで停止しました')
        write(String(error))
      } finally {
        button.disabled = false
      }
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
