'use client'

import { useState } from 'react'

type Row = {
  商品ID: string
  型番: string
  name: string
  オプション名１: string
  在庫数: number | string
}

export default function Page() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)

  async function fetchSupabaseData() {
    try {
      setLoading(true)

      const res = await fetch('/api/sagefuda-stock')

      const json = await res.json()

      if (!json.ok) {
        alert(json.error || 'error')
        return
      }

      setRows(json.rows || [])
    } catch (err) {
      console.error(err)
      alert('取得失敗')
    } finally {
      setLoading(false)
    }
  }

  function downloadCSV() {
    if (!rows.length) {
      alert('データがありません')
      return
    }

    const header = [
      '商品ID',
      '型番',
      'name',
      'オプション名１',
      '在庫数'
    ]

    const escapeCell = (value: any) => {
      const s = String(value ?? '')

      if (s.includes('"')) {
        return `"${s.replace(/"/g, '""')}"`
      }

      if (s.includes(',') || s.includes('\n')) {
        return `"${s}"`
      }

      return s
    }

    const lines = [
      header.join(',')
    ]

    for (const row of rows) {
      lines.push(
        header
          .map((h) => escapeCell((row as any)[h]))
          .join(',')
      )
    }

    const csv = '\uFEFF' + lines.join('\n')

    const blob = new Blob(
      [csv],
      { type: 'text/csv;charset=utf-8;' }
    )

    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')

    const now = new Date()

    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')

    a.href = url
    a.download = `${y}${m}${d}_下げ札.csv`

    document.body.appendChild(a)
    a.click()
    a.remove()

    URL.revokeObjectURL(url)
  }

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: 24
      }}
    >
      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          marginBottom: 24
        }}
      >
        下げ札CSVジェネレーター
      </h1>

      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 24
        }}
      >
        <button
          onClick={fetchSupabaseData}
          disabled={loading}
          style={{
            padding: '12px 18px',
            borderRadius: 12,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          {loading
            ? '取得中...'
            : 'Supabaseから取得'}
        </button>

        <button
          onClick={downloadCSV}
          style={{
            padding: '12px 18px',
            borderRadius: 12,
            border: '1px solid #ddd',
            background: '#fff',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          CSVダウンロード
        </button>
      </div>

      <div
        style={{
          marginBottom: 12,
          color: '#666'
        }}
      >
        件数: {rows.length}
      </div>

      <div
        style={{
          overflow: 'auto',
          border: '1px solid #ddd',
          borderRadius: 12
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}
        >
          <thead>
            <tr
              style={{
                background: '#f3f4f6'
              }}
            >
              {[
                '商品ID',
                '型番',
                'name',
                'オプション名１',
                '在庫数'
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: 12,
                    borderBottom: '1px solid #ddd',
                    textAlign: 'left'
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={td}>{row.商品ID}</td>
                <td style={td}>{row.型番}</td>
                <td style={td}>{row.name}</td>
                <td style={td}>{row.オプション名１}</td>
                <td style={td}>{row.在庫数}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

const td: React.CSSProperties = {
  padding: 12,
  borderBottom: '1px solid #eee',
  fontSize: 14
}
