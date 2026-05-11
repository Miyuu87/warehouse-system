'use client'

import { useEffect, useMemo, useState } from 'react'
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
  comment_updated_at?: string
}
type ProductData = {
  sku: string
  product_name: string
  option_name?: string
  image_url?: string
  product_id?: string
  stock: number
}
type StockChange = {
  sku: string
  sold_count: number
}

type SortType = 'pinned' | 'stock_asc' | 'stock_desc' | 'newest' | 'recent_sold'
type StockFilter = 'all' | 'zero_only' | 'hide_zero'

export default function StockWatchPage() {
  const [items, setItems] = useState<WatchItem[]>([])
  const [selectedItem, setSelectedItem] = useState<WatchItem | null>(null)
  const [productMap, setProductMap] = useState<Record<string, ProductData[]>>({})
  const [stockChanges, setStockChanges] = useState<Record<string, number>>({})
  const [lastSnapshotAt, setLastSnapshotAt] = useState('')
  const [sortType, setSortType] = useState<SortType>('pinned')
  const [searchText, setSearchText] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [bulkText, setBulkText] = useState('')
  const [showBulkForm, setShowBulkForm] = useState(false)

  const [parentSku, setParentSku] = useState('')
  const [registeredBy, setRegisteredBy] = useState('Miyuu')
  const [comment, setComment] = useState('')
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
  fetchItems()
  fetchStockChanges()
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

    for (const item of data || []) {
      fetchProductData(item.parent_sku)
    }
  }

  async function fetchProductData(parentSku: string) {
    const { data: products, error: productError } = await supabase
  .from('products')
  .select('*')
  .or(`sku.eq.${parentSku},sku.ilike.${parentSku}-%`)

    if (productError) {
      console.error(productError)
      return []
    }

    if (!products || products.length === 0) {
      setProductMap((prev) => ({
        ...prev,
        [parentSku]: [],
      }))
      return []
    }

    const skuList = products.map((p) => p.sku)

    const { data: stocks, error: stockError } = await supabase
      .from('stock_by_location')
      .select('*')
      .in('sku', skuList)

    if (stockError) {
      console.error(stockError)
    }

    const stockMap: Record<string, number> = {}

    for (const row of stocks || []) {
      stockMap[row.sku] = (stockMap[row.sku] || 0) + (row.qty || 0)
    }

    const merged: ProductData[] = products.map((p) => ({
      sku: p.sku,
      product_name: p.product_name,
      option_name: p.option_name,
      image_url: p.image_url,
      product_id: p.product_id,
      stock: stockMap[p.sku] || 0,
    }))

    setProductMap((prev) => ({
      ...prev,
      [parentSku]: merged,
    }))

    return merged
  }
  
  async function fetchStockChanges() {
  const { data, error } = await supabase
  .from('recent_stock_changes')
  .select('sku, sold_count, latest_recorded_at')

  if (error) {
    console.error(error)
    return
  }

    let latestDate = ''
  const map: Record<string, number> = {}

  for (const row of data || []) {
    if (
  row.latest_recorded_at &&
  (!latestDate ||
    new Date(row.latest_recorded_at) > new Date(latestDate))
) {
  latestDate = row.latest_recorded_at
}
    if (row.sold_count > 0) {
      map[row.sku] = row.sold_count
    }
  }

  setStockChanges(map)
    if (latestDate) {
  setLastSnapshotAt(
    new Date(latestDate).toLocaleString('ja-JP')
  )
}
}

  async function addItem() {
    const sku = parentSku.trim()

    if (!sku) {
      alert('SKUを入力してください')
      return
    }

    const exists = items.some(
      (item) => item.parent_sku.toLowerCase() === sku.toLowerCase()
    )

    if (exists) {
      alert(`このSKUは既に登録されています。\n\n${sku}`)
      return
    }

    const now = new Date().toISOString()

const { error } = await supabase.from('stock_watch_items').insert({
  parent_sku: sku,
  registered_by: registeredBy.trim() || '未入力',
  comment: comment.trim(),
  comment_updated_at: comment.trim() ? now : null,
  pinned,
  product_url: '',
  image_url: '',
})

    if (error) {
      alert('登録エラー: ' + error.message)
      return
    }

    setParentSku('')
    setComment('')
    setPinned(false)
    fetchItems()
  }

  async function addBulkItems() {
    const skus = bulkText
      .split('\n')
      .map((sku) => sku.trim())
      .filter(Boolean)

    if (skus.length === 0) {
      alert('SKUを入力してください')
      return
    }

    const existingSkus = items.map((item) => item.parent_sku.toLowerCase())

    const duplicateSkus = skus.filter((sku) =>
      existingSkus.includes(sku.toLowerCase())
    )

    const uniqueSkus = skus.filter(
      (sku) => !existingSkus.includes(sku.toLowerCase())
    )

    if (uniqueSkus.length === 0) {
      alert(`すべて登録済みSKUです。\n\n重複SKU:\n${duplicateSkus.join('\n')}`)
      return
    }

    const now = new Date().toISOString()

const rows = uniqueSkus.map((sku) => ({
  parent_sku: sku,
  registered_by: registeredBy.trim() || '未入力',
  comment: comment.trim(),
  comment_updated_at: comment.trim() ? now : null,
  pinned: false,
  product_url: '',
  image_url: '',
}))

    const { error } = await supabase.from('stock_watch_items').insert(rows)

    if (error) {
      alert('一括登録エラー: ' + error.message)
      return
    }

    setBulkText('')
    setShowBulkForm(false)
    fetchItems()

    if (duplicateSkus.length > 0) {
      alert(
        `一括登録しました。\n\n登録件数: ${uniqueSkus.length}件\n\n重複のため登録しませんでした:\n${duplicateSkus.join('\n')}`
      )
    } else {
      alert(`一括登録しました。\n\n登録件数: ${uniqueSkus.length}件`)
    }
  }

async function updateItem(item: WatchItem) {
  const currentItem = items.find((i) => i.id === item.id)
  const commentChanged =
    (currentItem?.comment || '') !== (item.comment || '')

  const updatedItem: WatchItem = {
    ...item,
    parent_sku: item.parent_sku.trim(),
    registered_by: item.registered_by.trim() || '未入力',
    comment: item.comment || '',
    comment_updated_at: commentChanged
      ? new Date().toISOString()
      : item.comment_updated_at || currentItem?.comment_updated_at,
  }

  const { error } = await supabase
    .from('stock_watch_items')
    .update({
      parent_sku: updatedItem.parent_sku,
      registered_by: updatedItem.registered_by,
      comment: updatedItem.comment,
      comment_updated_at: updatedItem.comment_updated_at || null,
      pinned: updatedItem.pinned,
    })
    .eq('id', item.id)

  if (error) {
    alert('保存エラー: ' + error.message)
    return
  }

  setItems((current) =>
    current.map((i) => (i.id === item.id ? updatedItem : i))
  )

  await fetchProductData(updatedItem.parent_sku)

  setSelectedItem(null)
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

  function getProductRows(item: WatchItem) {
    return productMap[item.parent_sku] || []
  }

  function getTotalStock(item: WatchItem) {
    return getProductRows(item).reduce((sum, row) => sum + row.stock, 0)
  }
  
  function getRecentSoldCount(item: WatchItem) {
  return getProductRows(item).reduce((sum, row) => {
    return sum + (stockChanges[row.sku] || 0)
  }, 0)
}

  function getMainImage(item: WatchItem) {
    return getProductRows(item)[0]?.image_url || ''
  }

  function getMainName(item: WatchItem) {
    return getProductRows(item)[0]?.product_name || item.parent_sku
  }

  function getProductUrl(item: WatchItem) {
    const rows = getProductRows(item)
    const productId = rows[0]?.product_id

    if (!productId) return ''

    return `https://noiseandkisses.com/?pid=${productId}`
  }
  function formatDate(value?: string) {
  if (!value) return ''

  return new Date(value).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

  async function snapshotStock() {
  const ok = confirm('現在の在庫を履歴として保存しますか？')
  if (!ok) return

  const res = await fetch('/api/snapshot-stock', {
    method: 'POST',
  })

  const json = await res.json()

  if (!res.ok) {
    alert('履歴保存エラー: ' + json.error)
    return
  }

  alert(`履歴を保存しました。\n保存件数: ${json.count}件`)

  fetchStockChanges()
}

  const sortedItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()

    const filtered = items.filter((item) => {
      const rows = getProductRows(item)
      const totalStock = getTotalStock(item)
      const name = getMainName(item).toLowerCase()
      const sku = item.parent_sku.toLowerCase()

      const matchesSearch =
        !keyword ||
        name.includes(keyword) ||
        sku.includes(keyword) ||
        rows.some((row) => row.sku.toLowerCase().includes(keyword))

      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'zero_only' && rows.length > 0 && totalStock === 0) ||
        (stockFilter === 'hide_zero' && !(rows.length > 0 && totalStock === 0))

      return matchesSearch && matchesStock
    })

    return filtered.sort((a, b) => {
      const stockA = getTotalStock(a)
      const stockB = getTotalStock(b)

      if (sortType === 'pinned') {
        if (Number(b.pinned) !== Number(a.pinned)) {
          return Number(b.pinned) - Number(a.pinned)
        }

        return (
          new Date(b.created_at || '').getTime() -
          new Date(a.created_at || '').getTime()
        )
      }

      if (sortType === 'stock_asc') return stockA - stockB
      if (sortType === 'stock_desc') return stockB - stockA
      if (sortType === 'recent_sold') {
  return getRecentSoldCount(b) - getRecentSoldCount(a)
}

      return (
        new Date(b.created_at || '').getTime() -
        new Date(a.created_at || '').getTime()
      )
    })
  }, [items, productMap, sortType, searchText, stockFilter])

  return (
    <main style={pageStyle}>
      <div style={headerRowStyle}>
        <div>
  <h1 style={titleStyle}>在庫チェックリスト</h1>
  <p style={descriptionStyle}>
    売れ行き・在庫切れ・再入荷確認が必要な商品をスタッフ間で共有するページです。
  </p>
</div>
        {lastSnapshotAt && (
  <div style={lastUpdateStyle}>
    最終在庫更新: {lastSnapshotAt}
  </div>
)}
<button onClick={snapshotStock} style={subButtonStyle}>
  履歴保存
</button>
        <label style={sortLabelStyle}>
          並び順
          <select
            value={sortType}
            onChange={(e) => setSortType(e.target.value as SortType)}
            style={sortSelectStyle}
          >
            <option value="recent_sold">最近売れた順</option>
            <option value="pinned">ピン留め優先</option>
            <option value="stock_asc">在庫少ない順</option>
            <option value="stock_desc">在庫多い順</option>
            <option value="newest">登録新しい順</option>
          </select>
        </label>
      </div>

      <div style={summaryRowStyle}>
  <div style={summaryCardStyle}>登録商品：{items.length}件</div>
  <div style={summaryCardStyle}>
    ピン留め：{items.filter((item) => item.pinned).length}件
  </div>
  <div style={summaryCardStyle}>
    在庫0：{items.filter((item) => {
      const rows = getProductRows(item)
      return rows.length > 0 && getTotalStock(item) === 0
    }).length}件
  </div>
</div>

      <section style={filterStyle}>
        <label style={labelStyle}>
          検索
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="商品名 / SKUで検索"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          在庫表示
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
            style={inputStyle}
          >
            <option value="all">すべて表示</option>
            <option value="zero_only">在庫0だけ表示</option>
            <option value="hide_zero">在庫0を非表示</option>
          </select>
        </label>
      </section>

      <section style={formStyle}>
        <label style={labelStyle}>
          親SKU
          <input
            value={parentSku}
            onChange={(e) => setParentSku(e.target.value)}
            placeholder="CT7000BK"
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
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="広告配信中 / 再入荷未定 / 今売れてる など"
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

        <button
          onClick={() => setShowBulkForm(!showBulkForm)}
          style={subButtonStyle}
        >
          一括登録
        </button>

        <button onClick={addItem} style={addButtonStyle}>
          追加
        </button>
      </section>

      {showBulkForm && (
        <section style={bulkStyle}>
          <label style={labelStyle}>
            SKU一括登録
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`CT7000BK\nCT7541BK\nCT7835`}
              style={textareaStyle}
            />
          </label>

          <div style={bulkButtonRowStyle}>
            <button onClick={addBulkItems} style={addButtonStyle}>
              一括登録する
            </button>

            <button onClick={() => setShowBulkForm(false)} style={subButtonStyle}>
              閉じる
            </button>
          </div>
        </section>
      )}

      <div style={gridStyle}>
        {sortedItems.map((item) => {
          const totalStock = getTotalStock(item)
          const rows = getProductRows(item)
          const isSoldOut = rows.length > 0 && totalStock === 0
          const isLowStock = totalStock === 1
          const mainImage = getMainImage(item)

          return (
            <div key={item.id} style={cardStyle}>
              <button
  onClick={() => deleteItem(item.id)}
  style={floatingDeleteButtonStyle}
>
  ×
</button>
              <div
                style={{ ...imageBoxStyle, cursor: 'pointer' }}
                onClick={() => setSelectedItem(item)}
              >
                {mainImage ? (
                  <img src={mainImage} alt={item.parent_sku} style={imageStyle} />
                ) : (
                  <div style={noImageStyle}>NO IMAGE</div>
                )}

                {isSoldOut && <div style={soldOutOverlayStyle}>完売</div>}
                {isLowStock && !isSoldOut && <div style={stockBadgeStyle}>残り1点</div>}
                {item.pinned && <div style={pinStyle}>📌</div>}
              </div>

              <div style={{ padding: 16 }}>
                {item.comment && (
  <div style={commentWrapStyle}>
    <span style={commentStyle}>{item.comment}</span>
    <span style={commentDateStyle}>
      {formatDate(item.comment_updated_at || item.created_at)}
    </span>
  </div>
)}

                <h2 style={cardTitleStyle}>{getMainName(item)}</h2>

                <p style={skuTextStyle}>SKU: {item.parent_sku}</p>
                <p style={subTextStyle}>👤 {item.registered_by}</p>

                <p style={subTextStyle}>
                  在庫合計：{rows.length > 0 ? totalStock : '未取得'}
                </p>
                {getRecentSoldCount(item) > 0 && (
  <p style={soldTextStyle}>
    🔥 最近{getRecentSoldCount(item)}点売れました
  </p>
)}

                <div style={buttonRowStyle}>
                  <button onClick={() => setSelectedItem(item)} style={detailButtonStyle}>
                    詳細
                  </button>

                  <button
                    onClick={() => {
                      const url = getProductUrl(item)
                      if (!url) {
                        alert('商品URLを取得できませんでした')
                        return
                      }
                      window.open(url, '_blank')
                    }}
                    style={miniButtonStyle}
                  >
                    🌐
                  </button>

                  <button
                    onClick={() => {
                      const url = getProductUrl(item)
                      if (!url) {
                        alert('商品URLを取得できませんでした')
                        return
                      }
                      navigator.clipboard.writeText(url)
                      alert('URLコピーしました')
                    }}
                    style={miniButtonStyle}
                  >
                    🔗
                  </button>

                </div>
              </div>
            </div>
          )
        })}
      </div>

      {items.length === 0 && (
        <p style={{ color: '#666', marginTop: 24 }}>
          まだ注視アイテムが登録されていません。
        </p>
      )}

      {selectedItem && (
        <div
  style={modalOverlayStyle}
  onClick={() => setSelectedItem(null)}
>
  <div
    style={modalStyle}
    onClick={(e) => e.stopPropagation()}
  >
            <div style={modalHeaderStyle}>
              <h2 style={modalTitleStyle}>{getMainName(selectedItem)}</h2>

              <button onClick={() => setSelectedItem(null)} style={modalCloseStyle}>
                ×
              </button>
            </div>

            <div style={modalImageBoxStyle}>
              {getMainImage(selectedItem) ? (
                <img
                  src={getMainImage(selectedItem)}
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

              <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
                コメント
                <input
                  value={selectedItem.comment || ''}
                  onChange={(e) =>
                    setSelectedItem({
                      ...selectedItem,
                      comment: e.target.value,
                    })
                  }
                  placeholder="広告配信中 / 再入荷未定 / 今売れてる など"
                  style={inputStyle}
                />
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
            </div>

            <div style={stockListWrapStyle}>
              {selectedItem && getRecentSoldCount(selectedItem) > 0 && (
  <div style={recentSoldBoxStyle}>
    🔥 最近{getRecentSoldCount(selectedItem)}点売れました
  </div>
)}
              <h3 style={stockListTitleStyle}>オプション別在庫</h3>

              {(productMap[selectedItem.parent_sku] || []).length === 0 ? (
                <p style={{ color: '#666' }}>
                  この親SKUに一致する商品データがまだ見つかっていません。
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {(productMap[selectedItem.parent_sku] || []).map((row) => (
                    <div
                      key={row.sku}
                      style={{
                        ...stockRowStyle,
                        background: row.stock === 0 ? '#f1f1f1' : '#fff',
                        opacity: row.stock === 0 ? 0.55 : 1,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800 }}>
                          {row.option_name || row.sku}
                        </div>

                        <div style={skuTextStyle}>{row.sku}</div>
                        {stockChanges[row.sku] > 0 && (
  <div style={recentSoldSkuStyle}>
    🔥 最近{stockChanges[row.sku]}点売れました
  </div>
)}

                        {row.product_id && (
                          <div style={skuTextStyle}>商品番号: {row.product_id}</div>
                        )}
                      </div>

                      <div
                        style={{
                          ...stockNumberStyle,
                          color: row.stock <= 1 ? '#ff3b30' : '#111',
                        }}
                      >
                        {row.stock}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={modalButtonRowStyle}>
              <button onClick={() => updateItem(selectedItem)} style={detailButtonStyle}>
                保存
              </button>

              <button
                onClick={() => {
                  const url = getProductUrl(selectedItem)
                  if (!url) {
                    alert('商品URLを取得できませんでした')
                    return
                  }
                  window.open(url, '_blank')
                }}
                style={detailButtonStyle}
              >
                商品ページを開く
              </button>

              <button
                onClick={() => {
                  const url = getProductUrl(selectedItem)
                  if (!url) {
                    alert('商品URLを取得できませんでした')
                    return
                  }
                  navigator.clipboard.writeText(url)
                  alert('URLコピーしました')
                }}
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
  padding: 16,
  background: '#f5f5f5',
  minHeight: '100vh',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
}

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  marginBottom: 20,
  flexWrap: 'wrap',
}

const titleStyle: React.CSSProperties = {
  fontSize: 'clamp(24px, 5vw, 32px)',
  fontWeight: 800,
  margin: 0,
}

const sortLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontWeight: 700,
  flexWrap: 'wrap',
}

const sortSelectStyle: React.CSSProperties = {
  height: 44,
  borderRadius: 12,
  border: '1px solid #ddd',
  padding: '0 12px',
  background: '#fff',
  fontWeight: 700,
}

const formStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 18,
  padding: 18,
  marginBottom: 24,
  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
  alignItems: 'end',
}

const filterStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 18,
  padding: 18,
  marginBottom: 16,
  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
  padding: '0 20px',
  cursor: 'pointer',
}

const subButtonStyle: React.CSSProperties = {
  height: 48,
  borderRadius: 12,
  border: '1px solid #ddd',
  background: '#fff',
  color: '#111',
  fontWeight: 800,
  padding: '0 20px',
  cursor: 'pointer',
}

const bulkStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 18,
  padding: 18,
  marginBottom: 24,
  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
  display: 'grid',
  gap: 12,
}

const bulkButtonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 160,
  borderRadius: 12,
  border: '1px solid #ddd',
  padding: 12,
  fontSize: 16,
  background: '#fff',
  boxSizing: 'border-box',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 20,
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 20,
  overflow: 'hidden',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  position: 'relative',
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

const soldOutOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(80,80,80,0.65)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 28,
  fontWeight: 900,
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
  fontSize: 20,
  fontWeight: 800,
  marginBottom: 8,
}

const subTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#666',
  marginBottom: 8,
}

const skuTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#777',
  marginBottom: 8,
}

const commentStyle: React.CSSProperties = {
  display: 'inline-block',
  background: '#ffe45c',
  color: '#111',
  padding: '7px 11px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 10,
}

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
}

const detailButtonStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 92,
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

const miniButtonStyle: React.CSSProperties = {
  width: 48,
  minWidth: 48,
  borderRadius: 12,
  border: '1px solid #ddd',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 800,
}

const deleteButtonStyle: React.CSSProperties = {
  width: 48,
  minWidth: 48,
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
  padding: 12,
  zIndex: 1000,
}

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 820,
  maxHeight: '90vh',
  overflow: 'auto',
  background: '#fff',
  borderRadius: 24,
  padding: 20,
}

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginBottom: 16,
}

const modalTitleStyle: React.CSSProperties = {
  fontSize: 'clamp(20px, 5vw, 28px)',
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
}

const stockListWrapStyle: React.CSSProperties = {
  marginTop: 24,
  borderTop: '1px solid #eee',
  paddingTop: 20,
}

const stockListTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  marginBottom: 12,
}

const stockRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: 12,
  border: '1px solid #eee',
  borderRadius: 12,
}

const stockNumberStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
}

const modalButtonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 20,
  flexWrap: 'wrap',
}

const modalDeleteButtonStyle: React.CSSProperties = {
  minWidth: 120,
  padding: 12,
  borderRadius: 12,
  border: '1px solid #ddd',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 800,
}
const floatingDeleteButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 10,
  width: 34,
  height: 34,
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(0,0,0,0.75)',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 900,
  fontSize: 18,
  zIndex: 5,
}
const soldTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#d93025',
  fontWeight: 800,
  marginBottom: 8,
}
const recentSoldBoxStyle: React.CSSProperties = {
  background: '#fff1f0',
  color: '#d93025',
  border: '1px solid #ffd6d3',
  borderRadius: 14,
  padding: 12,
  fontWeight: 900,
  marginBottom: 16,
}

const recentSoldSkuStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#d93025',
  fontWeight: 800,
  marginTop: 4,
}
const lastUpdateStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#666',
  marginTop: 4,
  fontWeight: 600,
}
const commentWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
  marginBottom: 10,
}

const commentDateStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#777',
  fontWeight: 700,
}
const descriptionStyle: React.CSSProperties = {
  margin: '6px 0 0',
  color: '#666',
  fontSize: 14,
  fontWeight: 600,
}

const summaryRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 12,
  marginBottom: 16,
}

const summaryCardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  padding: '12px 14px',
  fontSize: 14,
  fontWeight: 800,
  boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
}
