'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './shopify-sync.module.css'

type SyncError = {
  id: number
  error_type: string
  sku?: string
  message: string
  last_occurred_at: string
}

type SyncProduct = {
  productId: string
  productName: string
  imageUrl: string
  totalStock: number
  skus: string[]
  variantCount: number
  shopifyMode: 'auto' | 'force_draft' | 'force_active' | 'force_archive'
  isReserved: boolean
  note: string
  shopifyProductId: string
  lastStatus: string
  statusReason: string
  exclusionType: 'manual' | 'automatic' | 'none'
  lastSyncedAt: string | null
  errors: SyncError[]
}

type ProductsResponse = {
  ok: boolean
  products: SyncProduct[]
  page: number
  total: number
  totalPages: number
  activeErrorCount: number
  filter: ExclusionFilter
  exclusionCounts: Record<ExclusionFilter, number>
  globalErrors: SyncError[]
  runs: Array<Record<string, unknown>>
  error?: string
}

type ExclusionFilter = 'all' | 'excluded' | 'manual' | 'automatic'
type BulkAction =
  | 'reset_auto'
  | 'force_draft'
  | 'force_archive'
  | 'force_active'
  | 'reserve_manual'
  | 'unreserve_manual'

type ImageRefreshError = {
  product_id?: string
  product_name?: string
  type?: string
  message: string
  occurred_at?: string
}

type ImageRefreshProgress = {
  ok: boolean
  active: boolean
  status: string
  total: number
  completed: number
  remaining: number
  percent: number
  batch_size: number
  interval_minutes: number
  estimated_remaining_seconds: number | null
  estimated_remaining_hours: number | null
  started_at: string | null
  updated_at: string | null
  finished_at: string | null
  last_batch_count: number
  error_count: number
  last_error: string | null
  errors: ImageRefreshError[]
  error?: string
}

const MODE_LABELS = {
  auto: '自動',
  force_draft: '常に下書き',
  force_active: '強制公開',
  force_archive: '常にアーカイブ',
}

const STATUS_REASON_LABELS: Record<string, string> = {
  auto: '通常公開',
  manual_reserved: '手動予約のため下書き',
  zero_price: '0円のため下書き',
  colorme_hidden: 'カラーミー非掲載のためアーカイブ',
  manual_publish: '手動で公開',
  manual_draft: '手動で下書き',
  manual_archive: '手動でアーカイブ',
}

const FILTER_LABELS: Record<ExclusionFilter, string> = {
  all: 'すべての商品',
  excluded: '除外中すべて',
  manual: '手動で除外中',
  automatic: '自動で除外中',
}

const BULK_ACTION_LABELS: Record<BulkAction, string> = {
  reset_auto: '自動に戻す',
  force_draft: '常に下書き',
  force_archive: '常にアーカイブ',
  force_active: '強制公開',
  reserve_manual: '手動予約にする',
  unreserve_manual: '手動予約を解除',
}

export default function ShopifySyncDashboard() {
  const router = useRouter()
  const [data, setData] = useState<ProductsResponse | null>(null)
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<ExclusionFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<BulkAction>('reset_auto')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [running, setRunning] = useState(false)
  const [imageRunning, setImageRunning] = useState(false)
  const [imageProgress, setImageProgress] = useState<ImageRefreshProgress | null>(null)
  const [imageProgressError, setImageProgressError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const response = await fetch(
      `/api/shopify-sync-admin/products?page=${page}&q=${encodeURIComponent(submittedQuery)}&filter=${filter}`,
      { cache: 'no-store' }
    )
    if (response.status === 401) {
      router.replace('/shopify-sync/login')
      return
    }
    const json = (await response.json()) as ProductsResponse
    setData(json)
    setLoading(false)
  }, [filter, page, router, submittedQuery])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [load])

  const loadImageProgress = useCallback(async () => {
    try {
      const response = await fetch('/api/shopify-sync-admin/image-refresh-status', { cache: 'no-store' })
      if (response.status === 401) {
        router.replace('/shopify-sync/login')
        return
      }
      const json = (await response.json().catch(() => ({}))) as ImageRefreshProgress
      if (!response.ok || !json.ok) {
        setImageProgressError(json.error || '画像更新の進捗を取得できませんでした。')
        return
      }
      setImageProgress(json)
      setImageProgressError('')
    } catch (error) {
      setImageProgressError(
        `画像更新の進捗を取得できませんでした: ${error instanceof Error ? error.message : '通信エラー'}`
      )
    }
  }, [router])

  useEffect(() => {
    void loadImageProgress()
    const interval = window.setInterval(
      () => void loadImageProgress(),
      imageProgress?.active ? 15_000 : 60_000
    )
    return () => window.clearInterval(interval)
  }, [imageProgress?.active, loadImageProgress])

  const latestRun = useMemo(() => data?.runs?.[0] || null, [data])
  const pageProductIds = useMemo(() => data?.products.map((product) => product.productId) || [], [data])
  const allPageSelected = pageProductIds.length > 0 && pageProductIds.every((id) => selectedIds.has(id))

  function updateLocal(productId: string, changes: Partial<SyncProduct>) {
    setData((current) =>
      current
        ? {
            ...current,
            products: current.products.map((product) =>
              product.productId === productId ? { ...product, ...changes } : product
            ),
          }
        : current
    )
  }

  async function saveRule(product: SyncProduct, changes: Partial<SyncProduct>) {
    const next = { ...product, ...changes }
    updateLocal(product.productId, changes)
    setSavingId(product.productId)
    setMessage('')

    const response = await fetch('/api/shopify-sync-admin/rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.productId,
        shopifyMode: next.shopifyMode,
        isReserved: next.isReserved,
        note: next.note,
      }),
    })
    const json = await response.json().catch(() => ({}))
    setSavingId('')
    setMessage(response.ok ? '保存しました。次回同期で反映されます。' : json.error || '保存失敗')
  }

  function toggleProduct(productId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(productId)
      else next.delete(productId)
      return next
    })
  }

  function togglePageSelection() {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allPageSelected) pageProductIds.forEach((id) => next.delete(id))
      else pageProductIds.forEach((id) => next.add(id))
      return next
    })
  }

  async function runBulkAction() {
    const productIds = Array.from(selectedIds)
    if (!productIds.length) return
    const label = BULK_ACTION_LABELS[bulkAction]
    if (!confirm(`${productIds.length}商品を「${label}」に変更しますか？`)) return

    setBulkSaving(true)
    setMessage('')
    const response = await fetch('/api/shopify-sync-admin/rules/bulk', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds, action: bulkAction }),
    })
    const json = await response.json().catch(() => ({}))
    setBulkSaving(false)
    if (response.ok) {
      setSelectedIds(new Set())
      setMessage(`${Number(json.updated || productIds.length)}商品を一括変更しました。次回同期で反映されます。`)
      await load()
    } else {
      setMessage(json.error || '一括変更に失敗しました。')
    }
  }

  async function runSync() {
    if (!confirm('Shopify同期を今すぐ開始しますか？')) return
    setRunning(true)
    setMessage('')
    const response = await fetch('/api/shopify-sync-admin/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'catalog' }),
    })
    const json = await response.json().catch(() => ({}))
    setRunning(false)
    setMessage(response.ok ? '同期を開始しました。数分後に再読み込みしてください。' : json.error)
  }

  async function runImageRefresh() {
    if (!confirm('既存商品のメイン画像をカラーミーの最新版へ一括更新しますか？\n商品数が多いため、複数回に分けて処理します。')) return
    setImageRunning(true)
    setMessage('')
    try {
      const response = await fetch('/api/shopify-sync-admin/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'main_image_refresh_start' }),
      })
      const text = await response.text()
      let json: { error?: string } = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        // HTMLエラーなど、JSON以外の応答も画面に表示する。
      }

      if (response.ok) {
        setMessage('画像一括更新を開始しました。CRONが残りの商品を順次処理します。')
        await loadImageProgress()
      } else {
        const detail = json.error || text.slice(0, 300) || '応答内容なし'
        setMessage(`画像一括更新を開始できませんでした（HTTP ${response.status}）: ${detail}`)
      }
    } catch (error) {
      setMessage(`画像一括更新を開始できませんでした: ${error instanceof Error ? error.message : '通信エラー'}`)
    } finally {
      setImageRunning(false)
    }
  }

  async function logout() {
    await fetch('/api/shopify-sync-admin/logout', { method: 'POST' })
    router.replace('/shopify-sync/login')
    router.refresh()
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>WAREHOUSE SYSTEM</div>
          <h1>Shopify同期管理</h1>
          <p>カラーミーを基準に、公開状態・予約・同期エラーを管理します。</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.primaryButton} onClick={runSync} disabled={running}>
            {running ? '開始中…' : '今すぐ同期'}
          </button>
          <button
            className={styles.secondaryButton}
            onClick={runImageRefresh}
            disabled={imageRunning || running || Boolean(imageProgress?.active)}
          >
            {imageRunning ? '開始中…' : imageProgress?.active ? '画像更新中…' : 'メイン画像を一括更新'}
          </button>
          <button className={styles.secondaryButton} onClick={logout}>ログアウト</button>
        </div>
      </header>

      <section className={styles.stats}>
        <div><span>対象商品</span><strong>{data?.exclusionCounts?.all ?? '—'}</strong></div>
        <div><span>有効なエラー</span><strong className={data?.activeErrorCount ? styles.danger : ''}>{data?.activeErrorCount ?? '—'}</strong></div>
        <div><span>最終同期</span><strong>{formatDate(latestRun?.started_at)}</strong></div>
        <div><span>最終結果</span><strong>{String(latestRun?.status || '—')}</strong></div>
      </section>

      {message && <div className={styles.notice}>{message}</div>}
      <ImageRefreshProgressPanel
        progress={imageProgress}
        error={imageProgressError}
        onRefresh={() => void loadImageProgress()}
      />
      {data?.globalErrors?.map((error) => (
        <div className={styles.errorBox} key={error.id}>{error.message}</div>
      ))}

      <form
        className={styles.toolbar}
        onSubmit={(event) => {
          event.preventDefault()
          setPage(1)
          setSubmittedQuery(query)
        }}
      >
        <select
          className={styles.filterSelect}
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value as ExclusionFilter)
            setPage(1)
            setSelectedIds(new Set())
          }}
          aria-label="除外状態で絞り込み"
        >
          {(Object.keys(FILTER_LABELS) as ExclusionFilter[]).map((value) => (
            <option value={value} key={value}>
              {FILTER_LABELS[value]} ({data?.exclusionCounts?.[value] ?? 0})
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="商品名・SKU・商品IDで検索"
        />
        <button className={styles.secondaryButton}>検索</button>
        <button type="button" className={styles.textButton} onClick={() => { setQuery(''); setSubmittedQuery(''); setPage(1) }}>
          クリア
        </button>
        <button type="button" className={styles.textButton} onClick={load}>再読み込み</button>
      </form>

      <section className={styles.bulkBar}>
        <label className={styles.bulkSelectAll}>
          <input type="checkbox" checked={allPageSelected} onChange={togglePageSelection} />
          表示中を一括選択
        </label>
        <strong>{selectedIds.size}商品を選択中</strong>
        <select
          value={bulkAction}
          onChange={(event) => setBulkAction(event.target.value as BulkAction)}
          disabled={!selectedIds.size || bulkSaving}
        >
          {(Object.keys(BULK_ACTION_LABELS) as BulkAction[]).map((value) => (
            <option value={value} key={value}>{BULK_ACTION_LABELS[value]}</option>
          ))}
        </select>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={!selectedIds.size || bulkSaving}
          onClick={runBulkAction}
        >
          {bulkSaving ? '処理中…' : '一括処理'}
        </button>
        {selectedIds.size > 0 && (
          <button type="button" className={styles.textButton} onClick={() => setSelectedIds(new Set())}>
            選択解除
          </button>
        )}
      </section>

      {loading ? (
        <div className={styles.loading}>読み込み中…</div>
      ) : !data?.ok ? (
        <div className={styles.errorBox}>{data?.error || '読み込みエラー'}</div>
      ) : (
        <div className={styles.productGrid}>
          {data.products.map((product) => (
            <article
              className={`${styles.productCard} ${product.errors.length ? styles.hasError : ''} ${selectedIds.has(product.productId) ? styles.isSelected : ''}`}
              key={product.productId}
            >
              <label className={styles.cardSelector}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(product.productId)}
                  onChange={(event) => toggleProduct(product.productId, event.target.checked)}
                />
                選択
              </label>
              <div className={styles.productTop}>
                <div className={styles.imageWrap}>
                  {/* External ColorMe images use many hosts, so keep a plain img here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span>NO IMAGE</span>}
                </div>
                <div className={styles.productInfo}>
                  <div className={styles.productMeta}>ColorMe #{product.productId}</div>
                  <h2>{product.productName || '商品名なし'}</h2>
                  <div className={styles.skus}>{product.skus.slice(0, 6).join(' / ')}{product.skus.length > 6 ? ` ほか${product.skus.length - 6}件` : ''}</div>
                  <div className={styles.badges}>
                    <span>在庫 {product.totalStock}</span>
                    <span>{product.variantCount} SKU</span>
                    {product.isReserved && <span className={styles.reservedBadge}>手動予約</span>}
                    {product.exclusionType === 'manual' && <span className={styles.manualExcludedBadge}>手動除外中</span>}
                    {product.exclusionType === 'automatic' && <span className={styles.autoExcludedBadge}>自動除外中</span>}
                    {product.statusReason && (
                      <span>{STATUS_REASON_LABELS[product.statusReason] || product.statusReason}</span>
                    )}
                  </div>
                </div>
              </div>

              {product.errors.map((error) => (
                <div className={styles.inlineError} key={error.id}>
                  <strong>{error.error_type}</strong> {error.message}
                </div>
              ))}

              <div className={styles.controls}>
                <label>
                  Shopifyの状態
                  <select
                    value={product.shopifyMode}
                    disabled={savingId === product.productId}
                    onChange={(event) =>
                      saveRule(product, { shopifyMode: event.target.value as SyncProduct['shopifyMode'] })
                    }
                  >
                    {Object.entries(MODE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select>
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={product.isReserved}
                    disabled={savingId === product.productId}
                    onChange={(event) => saveRule(product, { isReserved: event.target.checked })}
                  />
                  手動で予約扱い（下書き）
                </label>
                <label>
                  メモ
                  <input
                    value={product.note}
                    onChange={(event) => updateLocal(product.productId, { note: event.target.value })}
                    onBlur={() => saveRule(product, { note: product.note })}
                    placeholder="非公開理由・特殊処理など"
                  />
                </label>
              </div>

              <footer>
                <span>最終同期: {formatDate(product.lastSyncedAt)}</span>
                <span>{savingId === product.productId ? '保存中…' : ''}</span>
              </footer>
            </article>
          ))}
        </div>
      )}

      <nav className={styles.pagination}>
        <button className={styles.secondaryButton} disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>前へ</button>
        <span>{page} / {data?.totalPages || 1}</span>
        <button className={styles.secondaryButton} disabled={page >= (data?.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>次へ</button>
      </nav>
    </main>
  )
}

function ImageRefreshProgressPanel({
  progress,
  error,
  onRefresh,
}: {
  progress: ImageRefreshProgress | null
  error: string
  onRefresh: () => void
}) {
  if (!progress && !error) {
    return (
      <section className={styles.imageProgressCard}>
        <div className={styles.progressHeader}>
          <div>
            <div className={styles.progressTitle}>メイン画像一括更新</div>
            <p>進捗を読み込んでいます…</p>
          </div>
        </div>
      </section>
    )
  }

  const active = Boolean(progress?.active)
  const failed = progress?.status === 'failed'
  const hasErrors = Number(progress?.error_count || 0) > 0
  const isCounting = active && Number(progress?.total || 0) === 0
  const statusClass = failed || hasErrors
    ? styles.statusError
    : active
      ? styles.statusActive
      : styles.statusComplete

  return (
    <section className={styles.imageProgressCard}>
      <div className={styles.progressHeader}>
        <div>
          <div className={styles.progressTitle}>メイン画像一括更新</div>
          <p>
            {isCounting
              ? '対象件数を集計中です。最初のCRON実行後に件数と残り時間が表示されます。'
              : imageStatusDescription(progress)}
          </p>
        </div>
        <div className={styles.progressHeaderActions}>
          {progress && (
            <span className={`${styles.statusBadge} ${statusClass}`}>
              {imageStatusLabel(progress.status)}
            </span>
          )}
          <button type="button" className={styles.progressRefresh} onClick={onRefresh}>
            進捗を更新
          </button>
        </div>
      </div>

      {error && <div className={styles.progressFetchError}>{error}</div>}

      {progress && (
        <>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.percent || 0)}
            aria-label="メイン画像更新の進捗"
          >
            <div className={styles.progressFill} style={{ width: `${Math.max(0, Math.min(100, progress.percent || 0))}%` }} />
          </div>

          <div className={styles.progressMetrics}>
            <div className={styles.progressMetric}>
              <span>完了</span>
              <strong>{numberFormat(progress.completed)} / {progress.total ? numberFormat(progress.total) : '集計中'}</strong>
            </div>
            <div className={styles.progressMetric}>
              <span>残り</span>
              <strong>{progress.total ? `${numberFormat(progress.remaining)}件` : '—'}</strong>
            </div>
            <div className={styles.progressMetric}>
              <span>推定残り時間</span>
              <strong>{formatDuration(progress.estimated_remaining_seconds)}</strong>
            </div>
            <div className={styles.progressMetric}>
              <span>最終完了</span>
              <strong>{formatDate(progress.finished_at)}</strong>
            </div>
          </div>

          <div className={styles.progressMeta}>
            <span>進捗 {Number(progress.percent || 0).toFixed(1)}%</span>
            <span>開始 {formatDate(progress.started_at)}</span>
            <span>最終更新 {formatDate(progress.updated_at)}</span>
            <span>1回 {numberFormat(progress.batch_size)}件・約{numberFormat(progress.interval_minutes)}分間隔</span>
          </div>

          {(hasErrors || progress.last_error) && (
            <div className={styles.progressErrors}>
              <strong>エラー {numberFormat(progress.error_count)}件</strong>
              {progress.last_error && <p>最新: {progress.last_error}</p>}
              {progress.errors.slice(-10).reverse().map((item, index) => (
                <div className={styles.progressErrorItem} key={`${item.occurred_at || ''}-${item.product_id || ''}-${index}`}>
                  <span>{formatDate(item.occurred_at)}</span>
                  <b>{item.product_name || (item.product_id ? `商品ID ${item.product_id}` : item.type || 'エラー')}</b>
                  <span>{item.message}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function imageStatusLabel(status: string) {
  const labels: Record<string, string> = {
    idle: '未実行',
    queued: '開始待ち',
    running: '処理中',
    completed: '完了',
    completed_with_errors: 'エラーあり完了',
    failed: '失敗',
  }
  return labels[status] || status || '未実行'
}

function imageStatusDescription(progress: ImageRefreshProgress | null) {
  if (!progress) return '進捗情報はまだありません。'
  if (progress.status === 'queued') return '更新要求を受け付けました。次のCRON実行を待っています。'
  if (progress.status === 'running') return 'CRONが100件ずつ順番に更新しています。画面は15秒ごとに自動更新されます。'
  if (progress.status === 'completed') return 'すべてのメイン画像の更新が完了しました。'
  if (progress.status === 'completed_with_errors') return '更新は完了しましたが、一部の商品でエラーがありました。'
  if (progress.status === 'failed') return '処理が停止しました。下のエラー内容を確認してください。'
  return '「メイン画像を一括更新」を押すと、進捗がここに表示されます。'
}

function formatDuration(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  const totalMinutes = Math.max(0, Math.ceil(value / 60))
  if (totalMinutes === 0) return 'まもなく完了'
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `約${days}日${hours ? `${hours}時間` : ''}`
  if (hours > 0) return `約${hours}時間${minutes ? `${minutes}分` : ''}`
  return `約${minutes}分`
}

function numberFormat(value: number | null | undefined) {
  return new Intl.NumberFormat('ja-JP').format(Number(value || 0))
}

function formatDate(value: unknown) {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ja-JP')
}
