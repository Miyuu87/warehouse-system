'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type WatchItem = {
  id: number
  parent_sku: string
  registered_by: string
  comment: string
  pinned: boolean
  created_at?: string
}

const comments = [
  '広告配信中',
  '再入荷未定',
  '今売れてる',
  '残り1点',
]

export default function StockWatchPage() {
  const [items, setItems] = useState<WatchItem[]>([])
  const [parentSku, setParentSku] = useState('')
  const [registeredBy, setRegisteredBy] = useState('Miyuu')
  const [comment, setComment] = useState('広告配信中')
  const [pinned, setPinned] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    const { data, error } = await supabase
      .from('stock_watch_items')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      alert('読み込みエラー: ' + error.message)
      return
    }

    setItems(data || [])
  }

  async function addItem() {
    const sku = parentSku.trim()

    if (!sku) {
      alert('SKUを入力してください')
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('stock_watch_items')
      .insert({
        parent_sku: sku,
        registered_by: registeredBy.trim() || '未入力',
        comment,
        pinned,
      })

    setLoading(false)

    if (error) {
      alert('登録エラー: ' + error.message)
      return
    }

    setParentSku('')
    setComment('広告配信中')
    setPinned(false)
    fetchItems()
  }

  async function deleteItem(id: number) {
    const ok = confirm('この注視アイテムを削除しますか？')
    if (!ok) return

    const { error } = await supabase
      .from('stock_watch_items')
      .delete()
      .eq('id', id)

    if (error) {
      alert('削除エラー: ' + error.message)
      return
    }

    setItems((current) => current.filter((item) => item.id !== id))
  }

  return (
    <main
      style={{
        padding: 24,
        background: '#f5f5f5',
        minHeight: '100vh',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
      }}
    >
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 20 }}>
        在庫注視アイテム
      </h1>

      <section
        style={{
          background: '#fff',
          borderRadius: 18,
          padding: 18,
          marginBottom: 24,
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr 1fr auto auto',
          gap: 12,
          alignItems: 'end',
        }}
      >
        <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>
          親SKU
          <input
            value={parentSku}
            onChange={(e) => setParentSku(e.target.value)}
            placeholder="例：GREMLINS"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>
          登録者
          <input
            value={registeredBy}
            onChange={(e) => setRegisteredBy(e.target.value)}
            placeholder="Miyuu"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>
          コメント
          <select
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={inputStyle}
          >
            {comments.map((text) => (
              <option key={text} value={text}>
                {text}
              </option>
            ))}
          </select>
        </label>

        <label
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
          />
          ピン留め
        </label>

        <button
          onClick={addItem}
          disabled={loading}
          style={{
            height: 48,
            padding: '0 20px',
            borderRadius: 12,
            border: 'none',
            background: '#111',
            color: '#fff',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {loading ? '登録中...' : '追加'}
        </button>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
          gap: 20,
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              background: '#fff',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            <div
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                background: '#ddd',
                position: 'relative',
              }}
            >
              {item.comment === '残り1点' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    background: '#ff3b30',
                    color: '#fff',
                    padding: '6px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  残り1点
                </div>
              )}

              {item.pinned && (
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: '#111',
                    color: '#fff',
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                  }}
                >
                  📌
                </div>
              )}
            </div>

            <div style={{ padding: 16 }}>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  marginBottom: 8,
                }}
              >
                {item.parent_sku}
              </h2>

              <p style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
                👤 {item.registered_by}
              </p>

              <div
                style={{
                  display: 'inline-block',
                  background: '#111',
                  color: '#fff',
                  padding: '8px 12px',
                  borderRadius: 999,
                  fontSize: 12,
                  marginBottom: 16,
                }}
              >
                {item.comment}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    border: 'none',
                    background: '#111',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 800,
                  }}
                >
                  詳細
                </button>

                <button
                  onClick={() => deleteItem(item.id)}
                  style={{
                    width: 48,
                    borderRadius: 12,
                    border: '1px solid #ddd',
                    background: '#fff',
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: 18,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p style={{ color: '#666', marginTop: 24 }}>
          まだ注視アイテムが登録されていません。
        </p>
      )}
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  height: 48,
  borderRadius: 12,
  border: '1px solid #ddd',
  padding: '0 12px',
  fontSize: 16,
  background: '#fff',
}
