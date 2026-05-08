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
      .order('pinned', { ascending: false })
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
            'repeat(auto-fill,minmax(280px,1fr))',
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
              boxShadow:
                '0 4px 16px rgba(0,0,0,0.08)',
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
                  fontWeight: 700,
                }}
              >
                残り1点
              </div>

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

            <div
              style={{
                padding: 16,
              }}
            >
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                {item.parent_sku}
              </h2>

              <p
                style={{
                  fontSize: 14,
                  color: '#666',
                  marginBottom: 12,
                }}
              >
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

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                }}
              >
                <button
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    border: 'none',
                    background: '#111',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  詳細
                </button>

                <button
                  style={{
                    width: 48,
                    borderRadius: 12,
                    border: '1px solid #ddd',
                    background: '#fff',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
