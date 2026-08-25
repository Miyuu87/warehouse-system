'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from '../shopify-sync.module.css'

export default function ShopifySyncLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const response = await fetch('/api/shopify-sync-admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const json = await response.json().catch(() => ({}))
    setLoading(false)

    if (!response.ok) {
      setError(json.error || 'ログインできませんでした')
      return
    }

    router.replace('/shopify-sync')
    router.refresh()
  }

  return (
    <main className={styles.loginPage}>
      <form className={styles.loginCard} onSubmit={submit}>
        <div className={styles.eyebrow}>WAREHOUSE SYSTEM</div>
        <h1>Shopify同期管理</h1>
        <p>専用パスワードを入力してください。</p>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          autoFocus
          required
        />
        {error && <div className={styles.errorBox}>{error}</div>}
        <button className={styles.primaryButton} disabled={loading}>
          {loading ? '確認中…' : 'ログイン'}
        </button>
      </form>
    </main>
  )
}

