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
}

export default function StockWatchPage() {
  const [items, setItems] = useState<WatchItem[]>([])

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    const { data, error } = await supabase
      .from('stock_watch_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    setItems(data || [])
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
          fontWeight: 700,
          marginBottom: 24,
        }}
      >
        在庫注視アイテム
      </h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fill,minmax(260px,1fr))',
          gap: 20,
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 16,
              boxShadow:
                '0 2px 10px rgba(0,0,0,0.08)',
            }}
          >
            <div
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                background: '#ddd',
                borderRadius: 12,
                marginBottom: 12,
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                {item.parent_sku}
              </h2>

              {item.pinned && (
                <span
                  style={{
                    fontSize: 20,
                  }}
                >
                  📌
                </span>
              )}
            </div>

            <p
              style={{
                fontSize: 14,
                color: '#666',
                marginBottom: 8,
              }}
            >
              👤 {item.registered_by}
            </p>

            <div
              style={{
                display: 'inline-block',
                background: '#111',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: 999,
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              {item.comment}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
              }}
            >
              <button
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 10,
                  border: 'none',
                  background: '#111',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                詳細
              </button>

              <button
                style={{
                  width: 44,
                  borderRadius: 10,
                  border: '1px solid #ddd',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
