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
  product_url?: string
  image_url?: string
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
  const [selectedItem, setSelectedItem] = useState<WatchItem | null>(null)

  const [parentSku, setParentSku] = useState('')
  const [registeredBy, setRegisteredBy] = useState('Miyuu')
  const [comment, setComment] = useState('広告配信中')
  const [pinned, setPinned] = useState(false)
  const [productUrl, setProductUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')

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

    const { error } = await supabase
      .from('stock_watch_items')
      .insert({
        parent_sku: sku,
        registered_by: registeredBy.trim() || '未入力',
        comment,
        pinned,
        product_url: productUrl.trim(),
        image_url: imageUrl.trim(),
      })

    if (error) {
      alert('登録エラー: ' + error.message)
      return
    }

    setParentSku('')
    setProductUrl('')
    setImageUrl('')
    setPinned(false)
    setComment('広告配信中')
    fetchItems()
  }

  async function updateItem(item: WatchItem) {
    const { error } = await supabase
      .from('stock_watch_items')
      .update({
        parent_sku: item.parent_sku,
        registered_by: item.registered_by,
        comment: item.comment,
        pinned: item.pinned,
        product_url: item.product_url || '',
        image_url: item.image_url || '',
      })
      .eq('id', item.id)

    if (error) {
      alert('保存エラー: ' + error.message)
      return
    }

    alert('保存しました')
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

    setSelectedItem(null)
    setItems((current) => current.filter((item) => item.id !== id))
  }

  async function copyUrl(url?: string) {
    if (!url) {
      alert('URLが未入力です')
      return
    }

    await navigator.clipboard.writeText(url)
    alert('URLをコピーしました')
  }

  return (
    <main style={pageStyle}>
      <h1 style={titleStyle}>在庫注視アイテム</h1>

      <section style={formStyle}>
        <label style={labelStyle}>
          親SKU
          <input
            value={parentSku}
            onChange={(e) => setParentSku(e.target.value)}
            placeholder="GREMLINS"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          登録者
          <input
            value={registeredBy}
            onChange={(e) => setRegisteredBy(e.target.value)}
            placeholder="Miyuu"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
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

        <label style={labelStyle}>
          商品URL
          <input
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            placeholder="https://..."
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          画像URL
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            style={inputStyle}
          />
        </label>

        <label style={checkStyle}>
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
          />
          ピン留め
        </label>

        <button onClick={addItem} style={addButtonStyle}>
          追加
        </button>
      </section>

      <div style={gridStyle}>
        {items.map((item) => (
          <div key={item.id} style={cardStyle}>
            <div style={imageBoxStyle}>
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.parent_sku}
                  style={imageStyle}
                />
              ) : (
                <div style={noImageStyle}>NO IMAGE</div>
              )}

              {item.comment === '残り1点' && (
                <div style={stockBadgeStyle}>残り1点</div>
              )}

              {item.pinned && <div style={pinStyle}>📌</div>}
            </div>

            <div style={{ padding: 16 }}>
              <h2 style={cardTitleStyle}>{item.parent_sku}</h2>

              <p style={subTextStyle}>👤 {item.registered_by}</p>

              <div style={commentStyle}>{item.comment}</div>

              <div style={buttonRowStyle}>
                <button
                  onClick={() => setSelectedItem(item)}
                  style={detailButtonStyle}
                >
                  詳細
                </button>

                <button
                  onClick={() => deleteItem(item.id)}
                  style={deleteButtonStyle}
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

      {selectedItem && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <h2 style={modalTitleStyle}>{selectedItem.parent_sku}</h2>

              <button
                onClick={() => setSelectedItem(null)}
                style={modalCloseStyle}
              >
                ×
              </button>
            </div>

            <div style={modalImageBoxStyle}>
              {selectedItem.image_url ? (
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.parent_sku}
                  style={imageStyle}
                />
              ) : (
                <div style={noImageStyle}>NO IMAGE</div>
              )}
            </div>

            <div style={modalGridStyle}>
              <label style={labelStyle}>
                親SKU
                <input
                  value={selectedItem.parent_sku || ''}
                  onChange={(e) =>
                    setSelectedItem({
                      ...selectedItem,
                      parent_sku: e.target.value,
                    })
                  }
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                登録者
                <input
                  value={selectedItem.registered_by || ''}
                  onChange={(e) =>
                    setSelectedItem({
                      ...selectedItem,
                      registered_by: e.target.value,
                    })
                  }
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                コメント
                <select
                  value={selectedItem.comment || '広告配信中'}
                  onChange={(e) =>
                    setSelectedItem({
                      ...selectedItem,
                      comment: e.target.value,
                    })
                  }
                  style={inputStyle}
                >
                  {comments.map((text) => (
                    <option key={text} value={text}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>

              <label style={checkStyle}>
                <input
                  type="checkbox"
                  checked={!!selectedItem.pinned}
                  onChange={(e) =>
                    setSelectedItem({
                      ...selectedItem,
                      pinned: e.target.checked,
                    })
                  }
                />
                ピン留め
              </label>

              <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
                商品URL
                <input
                  value={selectedItem.product_url || ''}
                  onChange={(e) =>
                    setSelectedItem({
                      ...selectedItem,
                      product_url: e.target.value,
                    })
                  }
                  placeholder="https://..."
                  style={inputStyle}
                />
              </label>

              <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
                画像URL
                <input
                  value={selectedItem.image_url || ''}
                  onChange={(e) =>
                    setSelectedItem({
                      ...selectedItem,
                      image_url: e.target.value,
                    })
                  }
                  placeholder="https://..."
                  style={inputStyle}
                />
              </label>
            </div>

            <div style={modalButtonRowStyle}>
              <button
                onClick={() => updateItem(selectedItem)}
                style={detailButtonStyle}
              >
                保存
              </button>

              <a
                href={selectedItem.product_url || '#'}
                target="_blank"
                rel="noreferrer"
                style={detailButtonStyle}
                onClick={(e) => {
                  if (!selectedItem.product_url) {
                    e.preventDefault()
                    alert('商品URLが未入力です')
                  }
                }}
              >
                開く
              </a>

              <button
                onClick={() => copyUrl(selectedItem.product_url)}
                style={detailButtonStyle}
              >
                URLコピー
              </button>

              <button
                onClick={() => deleteItem(selectedItem.id)}
                style={modalDeleteButtonStyle}
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

const pageStyle: React.CSSProperties = {
  padding: 24,
  background: '#f5f5f5',
  minHeight: '100vh',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
}

const titleStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  marginBottom: 20,
}

const formStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 18,
  padding: 18,
  marginBottom: 24,
  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto auto',
  gap: 12,
  alignItems: 'end',
}

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  fontWeight: 700,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 48,
  borderRadius: 12,
  border: '1px solid #ddd',
  padding: '0 12px',
  fontSize: 16,
  background: '#fff',
  boxSizing: 'border-box',
}

const checkStyle: React.CSSProperties = {
  height: 48,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

const addButtonStyle: React.CSSProperties = {
  height: 48,
  borderRadius: 12,
  border: 'none',
  background: '#111',
  color: '#fff',
  fontWeight: 800,
  padding: '0 24px',
  cursor: 'pointer',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
  gap: 20,
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 20,
  overflow: 'hidden',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
}

const imageBoxStyle: React.CSSProperties = {
  width: '100%',
  aspectRatio: '1 / 1',
  background: '#ddd',
  position: 'relative',
  overflow: 'hidden',
}

const imageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}

const noImageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#999',
  fontWeight: 800,
  letterSpacing: 1,
}

const stockBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  left: 12,
  background: '#ff3b30',
  color: '#fff',
  padding: '6px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
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

const cardTitleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  marginBottom: 8,
}

const subTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#666',
  marginBottom: 12,
}

const commentStyle: React.CSSProperties = {
  display: 'inline-block',
  background: '#111',
  color: '#fff',
  padding: '8px 12px',
  borderRadius: 999,
  fontSize: 12,
  marginBottom: 16,
}

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
}

const detailButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: 12,
  borderRadius: 12,
  border: 'none',
  background: '#111',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 800,
  textAlign: 'center',
  textDecoration: 'none',
}

const deleteButtonStyle: React.CSSProperties = {
  width: 48,
  borderRadius: 12,
  border: '1px solid #ddd',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 18,
}

const modalOverlayStyle: React.CSSProperties = {
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
  maxWidth: 760,
  maxHeight: '90vh',
  overflow: 'auto',
  background: '#fff',
  borderRadius: 24,
  padding: 24,
}

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16,
}

const modalTitleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
}

const modalCloseStyle: React.CSSProperties = {
  border: 'none',
  background: 'none',
  fontSize: 28,
  cursor: 'pointer',
}

const modalImageBoxStyle: React.CSSProperties = {
  width: '100%',
  maxHeight: 320,
  aspectRatio: '16 / 9',
  background: '#ddd',
  borderRadius: 16,
  overflow: 'hidden',
  marginBottom: 18,
}

const modalGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
}

const modalButtonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 20,
}

const modalDeleteButtonStyle: React.CSSProperties = {
  width: 120,
  padding: 12,
  borderRadius: 12,
  border: '1px solid #ddd',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 800,
}
