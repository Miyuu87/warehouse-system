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
  product_url: string
}

const comments = [
  '広告配信中',
  '再入荷未定',
  '今売れてる',
  '残り1点',
]

export default function StockWatchPage() {
  const [items, setItems] = useState<WatchItem[]>([])
  const [selectedItem, setSelectedItem] =
    useState<WatchItem | null>(null)

  const [parentSku, setParentSku] = useState('')
  const [registeredBy, setRegisteredBy] =
    useState('Miyuu')
  const [comment, setComment] =
    useState('広告配信中')
  const [pinned, setPinned] = useState(false)
  const [productUrl, setProductUrl] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    const { data } = await supabase
      .from('stock_watch_items')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

    setItems(data || [])
  }

  async function addItem() {
    if (!parentSku.trim()) {
      alert('SKUを入力してください')
      return
    }

    const { error } = await supabase
      .from('stock_watch_items')
      .insert({
        parent_sku: parentSku,
        registered_by: registeredBy,
        comment,
        pinned,
        product_url: productUrl,
      })

    if (error) {
      alert(error.message)
      return
    }

    setParentSku('')
    setProductUrl('')
    fetchItems()
  }

  async function deleteItem(id: number) {
    const ok = confirm('削除しますか？')

    if (!ok) return

    await supabase
      .from('stock_watch_items')
      .delete()
      .eq('id', id)

    setSelectedItem(null)

    fetchItems()
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url)
    alert('URLをコピーしました')
  }

  return (
    <main
      style={{
        padding: 24,
        background: '#f5f5f5',
        minHeight: '100vh',
      }}
    >
      <h1
        style={{
          fontSize: 32,
          fontWeight: 800,
          marginBottom: 24,
        }}
      >
        在庫注視アイテム
      </h1>

      <div
        style={{
          background: '#fff',
          padding: 20,
          borderRadius: 20,
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns:
            '1fr 1fr 1fr 1fr auto auto',
          gap: 12,
          alignItems: 'end',
        }}
      >
        <div>
          <label>親SKU</label>

          <input
            value={parentSku}
            onChange={(e) =>
              setParentSku(e.target.value)
            }
            placeholder='GREMLINS'
            style={inputStyle}
          />
        </div>

        <div>
          <label>登録者</label>

          <input
            value={registeredBy}
            onChange={(e) =>
              setRegisteredBy(e.target.value)
            }
            style={inputStyle}
          />
        </div>

        <div>
          <label>コメント</label>

          <select
            value={comment}
            onChange={(e) =>
              setComment(e.target.value)
            }
            style={inputStyle}
          >
            {comments.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label>商品URL</label>

          <input
            value={productUrl}
            onChange={(e) =>
              setProductUrl(e.target.value)
            }
            placeholder='https://...'
            style={inputStyle}
          />
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 48,
          }}
        >
          <input
            type='checkbox'
            checked={pinned}
            onChange={(e) =>
              setPinned(e.target.checked)
            }
          />

          ピン留め
        </label>

        <button
          onClick={addItem}
          style={addButtonStyle}
        >
          追加
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fill,minmax(280px,1fr))',
          gap: 20,
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={cardStyle}
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
                <div style={stockBadgeStyle}>
                  残り1点
                </div>
              )}

              {item.pinned && (
                <div style={pinStyle}>📌</div>
              )}
            </div>

            <div style={{ padding: 16 }}>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                {item.parent_sku}
              </h2>

              <p
                style={{
                  color: '#666',
                  marginTop: 8,
                }}
              >
                👤 {item.registered_by}
              </p>

              <div style={commentStyle}>
                {item.comment}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 16,
                }}
              >
                <button
                  onClick={() =>
                    setSelectedItem(item)
                  }
                  style={detailButtonStyle}
                >
                  詳細
                </button>

                <button
                  onClick={() =>
                    deleteItem(item.id)
                  }
                  style={deleteButtonStyle}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedItem && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                marginBottom: 20,
              }}
            >
              <h2
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                }}
              >
                {selectedItem.parent_sku}
              </h2>

              <button
                onClick={() =>
                  setSelectedItem(null)
                }
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: 28,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gap: 12,
              }}
            >
              <div>
                👤 {selectedItem.registered_by}
              </div>

              <div>
                💬 {selectedItem.comment}
              </div>

              <div>
                📌{' '}
                {selectedItem.pinned
                  ? 'ピン留め'
                  : 'なし'}
              </div>

              <div>
                🔗 商品URL
              </div>

              <input
                value={
                  selectedItem.product_url || ''
                }
                readOnly
                style={inputStyle}
              />

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  marginTop: 12,
                }}
              >
                <a
                  href={
                    selectedItem.product_url
                  }
                  target='_blank'
                  style={detailButtonStyle}
                >
                  開く
                </a>

                <button
                  onClick={() =>
                    copyUrl(
                      selectedItem.product_url
                    )
                  }
                  style={detailButtonStyle}
                >
                  URLコピー
                </button>

                <button
                  onClick={() =>
                    deleteItem(
                      selectedItem.id
                    )
                  }
                  style={{
                    ...deleteButtonStyle,
                    width: 120,
                  }}
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 48,
  borderRadius: 12,
  border: '1px solid #ddd',
  padding: '0 12px',
  marginTop: 6,
}

const addButtonStyle: React.CSSProperties = {
  height: 48,
  borderRadius: 12,
  border: 'none',
  background: '#111',
  color: '#fff',
  fontWeight: 700,
  padding: '0 24px',
  cursor: 'pointer',
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 20,
  overflow: 'hidden',
  boxShadow:
    '0 4px 16px rgba(0,0,0,0.08)',
}

const stockBadgeStyle: React.CSSProperties =
  {
    position: 'absolute',
    top: 12,
    left: 12,
    background: '#ff3b30',
    color: '#fff',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  }

const pinStyle: React.CSSProperties = {
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
}

const commentStyle: React.CSSProperties = {
  display: 'inline-block',
  background: '#111',
  color: '#fff',
  padding: '8px 12px',
  borderRadius: 999,
  fontSize: 12,
  marginTop: 12,
}

const detailButtonStyle: React.CSSProperties =
  {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    border: 'none',
    background: '#111',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    textAlign: 'center',
    textDecoration: 'none',
  }

const deleteButtonStyle: React.CSSProperties =
  {
    width: 48,
    borderRadius: 12,
    border: '1px solid #ddd',
    background: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  }

const modalOverlayStyle: React.CSSProperties =
  {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 1000,
  }

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 700,
  background: '#fff',
  borderRadius: 24,
  padding: 24,
}
