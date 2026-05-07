'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(
  supabaseUrl || '',
  supabaseKey || ''
)

export default function StockWatchPage() {
  const [items, setItems] = useState<any[]>([])
  const [errorText, setErrorText] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setLoading(true)

    if (!supabaseUrl || !supabaseKey) {
      setErrorText('環境変数が読み込めていません')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('stock_watch_items')
      .select('*')

    if (error) {
      setErrorText(error.message)
    } else {
      setItems(data || [])
    }

    setLoading(false)
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>在庫注視アイテム</h1>

      <p>読み込み状態: {loading ? '読み込み中' : '完了'}</p>
      <p>取得件数: {items.length}</p>

      {errorText && (
        <div style={{ color: 'red', marginTop: 16 }}>
          エラー: {errorText}
        </div>
      )}

      <pre style={{ marginTop: 24, background: '#eee', padding: 16 }}>
        {JSON.stringify(items, null, 2)}
      </pre>
    </main>
  )
}
