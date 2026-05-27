'use client'

import { useMemo, useState } from 'react'

type Row = {
  商品ID: string
  型番: string
  name: string
  オプション名１: string
  在庫数: number | string
}

type SourceMode = 'supabase' | 'csv'

const HEADER = ['商品ID', '型番', 'name', 'オプション名１', '在庫数']

export default function Page() {
  const [mode, setMode] = useState<SourceMode>('supabase')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('Supabaseから取得、またはCSVを選択してください')
  const [productFile, setProductFile] = useState<File | null>(null)
  const [optionsFile, setOptionsFile] = useState<File | null>(null)

  const previewRows = useMemo(() => rows.slice(0, 50), [rows])

  async function fetchSupabaseData() {
    try {
      setLoading(true)
      setStatus('Supabaseから取得中…')

      const res = await fetch('/api/sagefuda-stock', { cache: 'no-store' })
      const json = await res.json()

      if (!json.ok) {
        setStatus(`エラー: ${json.error || '取得失敗'}`)
        return
      }

      setRows(json.rows || [])
      setStatus(`OK: Supabaseから ${json.count || 0} 件読み込みました`)
    } catch (err: any) {
      setStatus(`エラー: ${err.message || '取得失敗'}`)
    } finally {
      setLoading(false)
    }
  }

  async function buildFromCsv(onlyPreview = true) {
    try {
      if (!productFile || !optionsFile) {
        setStatus('product.csv と options.csv を両方選択してください')
        return
      }

      setLoading(true)
      setStatus('CSV読み込み中…')

      const pText = await readFileAsText(productFile)
      const oText = await readFileAsText(optionsFile)

      const pRows = parseCSV(pText)
      const oRows = parseCSV(oText)

      if (!pRows.length) throw new Error('product.csv が空です')
      if (!oRows.length) throw new Error('options.csv が空です')

      const p = rowsToObjects(pRows)
      const o = rowsToObjects(oRows)

      const productMap = makeProductMap(p.out)
      const tagRows = buildTagRows(productMap, o.out)

      setRows(tagRows)
      setStatus(
        [
          'OK: CSVから生成しました',
          `- product 行数: ${p.out.length}`,
          `- options 行数: ${o.out.length}`,
          `- 下げ札 行数: ${tagRows.length}`,
          '',
          'プレビューは先頭50件のみ表示しています'
        ].join('\n')
      )

      if (!onlyPreview) downloadCSV(tagRows)
    } catch (err: any) {
      setStatus(`エラー: ${err.message || 'CSV生成失敗'}`)
    } finally {
      setLoading(false)
    }
  }

  function downloadCSV(targetRows = rows) {
    if (!targetRows.length) {
      setStatus('データがありません')
      return
    }

    const lines = [HEADER.join(',')]

    for (const row of targetRows) {
      lines.push(
        HEADER.map((h) => escapeCell((row as any)[h])).join(',')
      )
    }

    const csv = '\uFEFF' + lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `${yyyymmdd()}_下げ札.csv`

    document.body.appendChild(a)
    a.click()
    a.remove()

    URL.revokeObjectURL(url)
  }

  return (
    <main className="wrap">
      <header className="head">
        <h1>カラーミー 下げ札CSVジェネレーター</h1>
        <p className="muted">
          Supabaseの在庫データ、または product.csv / options.csv から
          下げ札用CSVを生成します。
        </p>
      </header>

      <section className="card">
        <h2>1) データ取得方法を選択</h2>

        <div className="modeGrid">
          <button
            className={`modeBtn ${mode === 'supabase' ? 'active' : ''}`}
            onClick={() => setMode('supabase')}
          >
            Supabaseから取得
          </button>

          <button
            className={`modeBtn ${mode === 'csv' ? 'active' : ''}`}
            onClick={() => setMode('csv')}
          >
            CSVアップロード
          </button>
        </div>

        {mode === 'supabase' && (
          <div className="panel">
            <p className="muted small">
              products テーブルから全件取得します。1000件制限を回避するため、API側で分割取得します。
            </p>

            <button
              className="btn"
              onClick={fetchSupabaseData}
              disabled={loading}
            >
              {loading ? '取得中…' : 'Supabaseから取得'}
            </button>
          </div>
        )}

        {mode === 'csv' && (
          <div className="panel">
            <div className="grid">
              <label className="file">
                <span>product.csv（商品CSV）</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setProductFile(e.target.files?.[0] || null)}
                />
                <small className="muted">
                  {productFile ? productFile.name : '未選択'}
                </small>
              </label>

              <label className="file">
                <span>options.csv（オプションCSV）</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setOptionsFile(e.target.files?.[0] || null)}
                />
                <small className="muted">
                  {optionsFile ? optionsFile.name : '未選択'}
                </small>
              </label>
            </div>

            <div className="actions">
              <button
                className="btn"
                onClick={() => buildFromCsv(true)}
                disabled={loading || !productFile || !optionsFile}
              >
                プレビュー生成
              </button>
            </div>
          </div>
        )}

        <div className="actions">
          <button
            className="btn ghost"
            onClick={() => downloadCSV()}
            disabled={!rows.length}
          >
            下げ札CSVをダウンロード
          </button>
        </div>

        <div className="status">{status}</div>
      </section>

      <section className="card">
        <h2>プレビュー</h2>

        <p className="muted small">
          読み込み確認用に先頭50件のみ表示しています。CSVダウンロードには全件反映されます。
        </p>

        <div className="count">
          読み込み件数: <strong>{rows.length.toLocaleString()}</strong> 件
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                {HEADER.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {previewRows.map((row, i) => (
                <tr key={`${row.商品ID}-${row.型番}-${i}`}>
                  <td>{row.商品ID}</td>
                  <td>{row.型番}</td>
                  <td>{row.name}</td>
                  <td>{row.オプション名１}</td>
                  <td>{row.在庫数}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        :global(body) {
          margin: 0;
          background:
            radial-gradient(900px 420px at 20% 0%, rgba(37,99,235,.18), transparent 60%),
            radial-gradient(900px 420px at 80% 0%, rgba(99,102,241,.14), transparent 60%),
            #f6f8ff;
          color: #111827;
        }

        .wrap {
          max-width: 980px;
          margin: 0 auto;
          padding: 28px 16px 56px;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
            "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", Meiryo, sans-serif;
        }

        .head h1 {
          margin: 0 0 8px;
          font-size: 22px;
          letter-spacing: .02em;
        }

        .muted {
          color: #6b7280;
        }

        .small {
          font-size: 12px;
        }

        .card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 18px;
          margin-top: 14px;
          box-shadow: 0 14px 40px rgba(17,24,39,.10);
        }

        .card h2 {
          margin: 0 0 12px;
          font-size: 15px;
          letter-spacing: .02em;
        }

        .modeGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .modeBtn {
          padding: 14px;
          border-radius: 16px;
          border: 1.5px solid rgba(37,99,235,.25);
          background: #fff;
          color: #1d4ed8;
          font-weight: 800;
          cursor: pointer;
        }

        .modeBtn.active {
          background: linear-gradient(180deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 10px 20px rgba(37,99,235,.18);
        }

        .panel {
          margin-top: 14px;
          padding: 14px;
          border-radius: 16px;
          border: 1px solid #e5e7eb;
          background: rgba(37,99,235,.04);
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .file {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 14px;
          border: 1.5px dashed rgba(37,99,235,.35);
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(37,99,235,.06), rgba(37,99,235,.02));
        }

        .file span {
          font-weight: 700;
        }

        .file input {
          width: 100%;
        }

        .actions {
          display: flex;
          gap: 10px;
          margin-top: 14px;
          flex-wrap: wrap;
        }

        .btn {
          appearance: none;
          border: 1px solid rgba(37,99,235,.25);
          border-radius: 14px;
          padding: 11px 14px;
          background: linear-gradient(180deg, #2563eb, #1d4ed8);
          color: #fff;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 10px 20px rgba(37,99,235,.18);
        }

        .btn.ghost {
          background: #fff;
          color: #1d4ed8;
          border: 1px solid rgba(37,99,235,.30);
          box-shadow: none;
        }

        .btn:disabled,
        .modeBtn:disabled {
          opacity: .45;
          cursor: not-allowed;
          box-shadow: none;
        }

        .status {
          margin-top: 12px;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          background: #fff;
          min-height: 44px;
          white-space: pre-wrap;
          color: #374151;
        }

        .count {
          margin: 10px 0;
          color: #374151;
        }

        .tableWrap {
          overflow: auto;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
        }

        thead th {
          position: sticky;
          top: 0;
          background: #f3f6ff;
          z-index: 1;
          border-bottom: 1px solid #e5e7eb;
        }

        th,
        td {
          border-bottom: 1px solid #e5e7eb;
          padding: 9px 10px;
          font-size: 13px;
          vertical-align: top;
          text-align: left;
        }

        tbody tr:hover {
          background: rgba(37,99,235,.04);
        }

        @media (max-width: 760px) {
          .grid,
          .modeGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}

function yyyymmdd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function escapeCell(value: any) {
  const s = String(value ?? '')
  const escaped = s.replace(/"/g, '""')
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
}

function decodeWith(enc: string, buf: ArrayBuffer) {
  try {
    return new TextDecoder(enc, { fatal: false }).decode(buf)
  } catch {
    return null
  }
}

function looksLikeColormeCSV(text: string | null) {
  if (!text) return false
  return /商品ID|登録種別|オプション名/.test(text)
}

async function readFileAsText(file: File) {
  const buf = await file.arrayBuffer()
  const tries = ['shift_jis', 'cp932', 'utf-8']

  let fallback = ''

  for (const enc of tries) {
    const txt = decodeWith(enc, buf)
    if (!txt) continue
    if (!fallback) fallback = txt
    if (looksLikeColormeCSV(txt)) return txt
  }

  return fallback
}

function parseCSV(text: string) {
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }

    if (ch === ',') {
      row.push(cell)
      cell = ''
      continue
    }

    if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += ch
  }

  row.push(cell)
  rows.push(row)

  while (rows.length && rows[rows.length - 1].every((v) => v === '')) {
    rows.pop()
  }

  return rows
}

function normalizeHeader(s: any) {
  if (s == null) return ''

  let v = String(s)
    .replace(/^\uFEFF/, '')
    .replace(/[\s\u3000]+/g, '')

  v = v.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  )

  try {
    v = v.normalize('NFKC')
  } catch {}

  return v
}

function normalizeCell(v: any) {
  return String(v ?? '').trim()
}

function toNumberLike(v: any) {
  const s = normalizeCell(v)
  if (s === '') return '0'
  return s.replace(/,/g, '')
}

function rowsToObjects(rows: string[][]) {
  const rawHeader = rows[0] ?? []
  const header = rawHeader.map((h) => normalizeHeader(h))

  const out: Record<string, string>[] = []

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const obj: Record<string, string> = {}

    for (let j = 0; j < header.length; j++) {
      const key = header[j]
      if (!key) continue
      obj[key] = normalizeCell(r[j] ?? '')
    }

    out.push(obj)
  }

  return { header, out }
}

function findCol(obj: Record<string, any>, candidates: string[]) {
  const keys = Object.keys(obj)
  const normKeys = new Map(keys.map((k) => [normalizeHeader(k), k]))

  for (const c of candidates) {
    const nc = normalizeHeader(c)
    if (normKeys.has(nc)) return normKeys.get(nc)!
  }

  return null
}

const COL = {
  product: {
    id: ['商品ID', 'product_id', 'id'],
    sku: ['型番', 'SKU', '品番', 'model'],
    name: ['商品名', 'name', '商品名(商品名)', 'product_name'],
    stock: ['在庫数', '在庫', 'stock', '現在庫', 'inventory']
  },
  option: {
    pid: ['商品ID', 'product_id', 'id'],
    kind: ['登録種別', 'type', 'register_type'],
    opt1: ['オプション名１', 'option_name_1'],
    sku: ['型番', 'SKU', '品番', 'model'],
    stock: ['在庫数', '在庫', 'stock', 'inventory']
  }
}

function makeProductMap(productObjs: Record<string, string>[]) {
  const map = new Map<string, any>()

  for (const p of productObjs) {
    const idKey = findCol(p, COL.product.id)
    if (!idKey) continue

    const id = normalizeCell(p[idKey])
    if (!id) continue

    const skuKey = findCol(p, COL.product.sku)
    const nameKey = findCol(p, COL.product.name)
    const stockKey = findCol(p, COL.product.stock)

    map.set(id, {
      商品ID: id,
      型番: normalizeCell(skuKey ? p[skuKey] : ''),
      商品名: normalizeCell(nameKey ? p[nameKey] : ''),
      在庫数: toNumberLike(stockKey ? p[stockKey] : '')
    })
  }

  return map
}

function buildTagRows(productMap: Map<string, any>, optionObjs: Record<string, string>[]) {
  const rows: Row[] = []
  const hasOptionItem = new Set<string>()

  for (const o of optionObjs) {
    const pidKey = findCol(o, COL.option.pid)
    const kindKey = findCol(o, COL.option.kind)
    const opt1Key = findCol(o, COL.option.opt1)
    const skuKey = findCol(o, COL.option.sku)
    const stockKey = findCol(o, COL.option.stock)

    if (!pidKey || !kindKey) continue

    const kind = normalizeCell(o[kindKey]).toLowerCase()
    if (kind !== 'item') continue

    const pid = normalizeCell(o[pidKey])
    if (!pid) continue

    hasOptionItem.add(pid)

    const p = productMap.get(pid)

    rows.push({
      商品ID: pid,
      型番: normalizeCell(skuKey ? o[skuKey] : ''),
      name: p ? p.商品名 : '',
      オプション名１: normalizeCell(opt1Key ? o[opt1Key] : ''),
      在庫数: toNumberLike(stockKey ? o[stockKey] : '')
    })
  }

  for (const [pid, p] of productMap.entries()) {
    if (hasOptionItem.has(pid)) continue

    rows.push({
      商品ID: pid,
      型番: p.型番,
      name: p.商品名,
      オプション名１: '',
      在庫数: toNumberLike(p.在庫数)
    })
  }

  return rows
}
