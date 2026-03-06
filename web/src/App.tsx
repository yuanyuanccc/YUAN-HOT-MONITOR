import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type PlatformHotspotItem = {
  id: string
  platform: string
  platformLabel: string
  title: string
  url: string
  snippet: string
  heatLevel: 'low' | 'medium' | 'high'
  heatScore: number
  fetchedAt: string
}

type PlatformBatch = {
  platform: string
  platformLabel: string
  needApiKey: boolean
  success: boolean
  error: string
  items: PlatformHotspotItem[]
}

type PlatformSchedule = {
  enabled: boolean
  intervalMinutes: number
  keywords: string[]
  selectedPlatforms: string[]
  lastFetchedAt: string | null
  nextRunAt: string | null
  isRunning: boolean
}

type PlatformOption = {
  id: string
  label: string
  needApiKey: boolean
}

type PlatformSnapshot = {
  options: PlatformOption[]
  items: PlatformHotspotItem[]
  batches: PlatformBatch[]
  schedule: PlatformSchedule
}

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'keywords' | 'search'>('dashboard')
  const [loadingFetchPlatforms, setLoadingFetchPlatforms] = useState(false)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [platformSnapshot, setPlatformSnapshot] = useState<PlatformSnapshot | null>(null)
  const [intervalMinutesInput, setIntervalMinutesInput] = useState(15)
  const [scheduleEnabled, setScheduleEnabled] = useState(true)
  const [platformKeywords, setPlatformKeywords] = useState<string[]>(['科技热点'])
  const [keywordDraft, setKeywordDraft] = useState('')
  const [searchKeywordInput, setSearchKeywordInput] = useState('科技热点')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [readHotspotIds, setReadHotspotIds] = useState<string[]>([])
  const [hasSeededRead, setHasSeededRead] = useState(false)
  const [showNoticePanel, setShowNoticePanel] = useState(false)
  const [error, setError] = useState('')
  const noticeWrapRef = useRef<HTMLDivElement | null>(null)

  const loadPlatformHotspots = useCallback(async () => {
    const response = await fetch(`${apiBase}/api/platform-hotspots`)
    if (!response.ok) {
      throw new Error('平台热点加载失败')
    }
    const data = (await response.json()) as PlatformSnapshot
    setPlatformSnapshot(data)
    setIntervalMinutesInput(data.schedule.intervalMinutes)
    setScheduleEnabled(data.schedule.enabled)
    setPlatformKeywords(data.schedule.keywords)
    setSearchKeywordInput((current) => current || data.schedule.keywords[0] || '科技热点')
    setSelectedPlatforms(data.schedule.selectedPlatforms)
  }, [])

  useEffect(() => {
    loadPlatformHotspots().catch(() => {
      setError('平台热点加载失败，请检查网络后重试。')
    })
  }, [loadPlatformHotspots])

  useEffect(() => {
    const ids = (platformSnapshot?.items ?? []).map((item) => item.id)
    if (ids.length === 0) {
      return
    }
    if (!hasSeededRead) {
      setReadHotspotIds(ids)
      setHasSeededRead(true)
      return
    }
    setReadHotspotIds((prev) => {
      const prevSet = new Set(prev)
      return ids.filter((id) => prevSet.has(id))
    })
  }, [hasSeededRead, platformSnapshot])

  useEffect(() => {
    if (!showNoticePanel) {
      return
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!noticeWrapRef.current?.contains(event.target as Node)) {
        setShowNoticePanel(false)
      }
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
    }
  }, [showNoticePanel])

  async function handleManualFetchPlatforms(keywordInput?: string) {
    if (selectedPlatforms.length === 0) {
      setError('请至少选择一个平台。')
      return
    }
    const keyword = keywordInput?.trim()
    if (keywordInput !== undefined && !keyword) {
      setError('请输入关键词。')
      return
    }
    if (keywordInput === undefined && platformKeywords.length === 0) {
      setError('请先添加监控关键词。')
      return
    }
    setError('')
    setLoadingFetchPlatforms(true)
    try {
      const response = await fetch(`${apiBase}/api/platform-hotspots/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keyword ? { keyword, selectedPlatforms } : { selectedPlatforms })
      })
      if (!response.ok) {
        throw new Error('抓取失败')
      }
      const data = (await response.json()) as PlatformSnapshot
      setPlatformSnapshot(data)
    } catch {
      setError('平台热点抓取失败，请稍后重试。')
    } finally {
      setLoadingFetchPlatforms(false)
    }
  }

  async function handleSaveSchedule() {
    if (selectedPlatforms.length === 0) {
      setError('请至少选择一个平台。')
      return
    }
    if (platformKeywords.length === 0) {
      setError('请至少添加一个监控关键词。')
      return
    }
    setError('')
    setLoadingSchedule(true)
    try {
      const response = await fetch(`${apiBase}/api/platform-hotspots/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: scheduleEnabled,
          intervalMinutes: intervalMinutesInput,
          keywords: platformKeywords,
          selectedPlatforms
        })
      })
      if (!response.ok) {
        throw new Error('调度保存失败')
      }
      const data = (await response.json()) as PlatformSnapshot
      setPlatformSnapshot(data)
    } catch {
      setError('自动抓取配置保存失败，请检查分钟数后重试。')
    } finally {
      setLoadingSchedule(false)
    }
  }

  function handleTogglePlatform(platformId: string) {
    setSelectedPlatforms((prev) => {
      if (prev.includes(platformId)) {
        return prev.filter((item) => item !== platformId)
      }
      return [...prev, platformId]
    })
  }

  function handleAddKeyword() {
    const next = keywordDraft.trim()
    if (!next) {
      return
    }
    setPlatformKeywords((prev) => {
      if (prev.includes(next)) {
        return prev
      }
      return [...prev, next]
    })
    setKeywordDraft('')
  }

  function handleRemoveKeyword(keyword: string) {
    setPlatformKeywords((prev) => prev.filter((item) => item !== keyword))
  }

  function handleOpenUnreadHotspots() {
    setShowNoticePanel((prev) => !prev)
  }

  function handleOpenUnreadItem(item: PlatformHotspotItem) {
    setReadHotspotIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))
    setShowNoticePanel(false)
    window.open(item.url, '_blank', 'noopener,noreferrer')
  }

  function handleMarkAllUnread() {
    setReadHotspotIds(latestItems.map((item) => item.id))
  }

  const metrics = useMemo(() => {
    const items = platformSnapshot?.items ?? []
    const today = new Date().toDateString()
    const todayCount = items.filter((item) => new Date(item.fetchedAt).toDateString() === today).length
    const urgentCount = items.filter((item) => /(突发|紧急|预警|暴跌|爆|事故|危机|下架|封禁|裁员)/i.test(item.title)).length
    const keywordCount = platformKeywords.length
    return {
      total: items.length,
      today: todayCount,
      urgent: urgentCount,
      keywords: keywordCount
    }
  }, [platformKeywords, platformSnapshot])

  const latestItems = useMemo(() => {
    const items = [...(platformSnapshot?.items ?? [])]
    return items.sort((a, b) => (a.fetchedAt < b.fetchedAt ? 1 : -1))
  }, [platformSnapshot])

  const tabTitle = useMemo(() => {
    if (activeTab === 'keywords') {
      return '关键词设置'
    }
    if (activeTab === 'search') {
      return '搜索抓取'
    }
    return '仪表盘'
  }, [activeTab])

  const unreadHotspotCount = useMemo(() => {
    if (latestItems.length === 0) {
      return 0
    }
    const readSet = new Set(readHotspotIds)
    return latestItems.filter((item) => !readSet.has(item.id)).length
  }, [latestItems, readHotspotIds])

  const unreadHotspotItems = useMemo(() => {
    const readSet = new Set(readHotspotIds)
    return latestItems.filter((item) => !readSet.has(item.id))
  }, [latestItems, readHotspotIds])

  function getHeatLabel(level: 'low' | 'medium' | 'high') {
    if (level === 'high') {
      return '高热'
    }
    if (level === 'medium') {
      return '中热'
    }
    return '低热'
  }

  return (
    <div className="dashboard-screen">
      <header className="top-header">
        <div className="brand-wrap">
          <div className="brand-logo">≈</div>
          <div>
            <p className="brand-title">热点监控</p>
            <p className="brand-subtitle">AI 实时热点追踪</p>
          </div>
        </div>
        <div className="header-actions" ref={noticeWrapRef}>
          <button className="scan-action" onClick={() => handleManualFetchPlatforms()} disabled={loadingFetchPlatforms}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12a8 8 0 0 1 13.7-5.66V4.5h1.8v6h-6V8.7h2.84A6.2 6.2 0 1 0 18.2 12h1.8A8 8 0 1 1 4 12Z" />
            </svg>
            <span>{loadingFetchPlatforms ? '扫描中...' : '立即扫描'}</span>
          </button>
          <button className="notice-action" type="button" aria-label="未读热点通知" onClick={handleOpenUnreadHotspots}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a6.2 6.2 0 0 0-6.2 6.2v3.4L4.2 15v1.8h15.6V15l-1.6-2.4V9.2A6.2 6.2 0 0 0 12 3Zm0 18a2.7 2.7 0 0 0 2.64-2.16H9.36A2.7 2.7 0 0 0 12 21Z" />
            </svg>
            {unreadHotspotCount > 0 ? <span className="notice-badge">{unreadHotspotCount > 99 ? '99+' : unreadHotspotCount}</span> : null}
          </button>
          {showNoticePanel ? (
            <div className="notice-panel">
              <div className="notice-head">
                <p className="notice-title">未读热点</p>
                <button className="notice-mark-all" type="button" onClick={handleMarkAllUnread} disabled={unreadHotspotItems.length === 0}>
                  一键已读
                </button>
              </div>
              {unreadHotspotItems.length === 0 ? (
                <p className="notice-empty">暂无未读热点</p>
              ) : (
                <div className="notice-list">
                  {unreadHotspotItems.map((item) => (
                    <button key={item.id} className="notice-item" type="button" onClick={() => handleOpenUnreadItem(item)}>
                      <span className="notice-item-title">{item.title.length > 22 ? `${item.title.slice(0, 22)}...` : item.title}</span>
                      <span className="notice-item-meta">{item.platformLabel}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </header>

      <nav className="dashboard-tabs">
        <button className={activeTab === 'dashboard' ? 'tab active' : 'tab'} onClick={() => setActiveTab('dashboard')}>仪表盘</button>
        <button className={activeTab === 'keywords' ? 'tab active' : 'tab'} onClick={() => setActiveTab('keywords')}>关键词</button>
        <button className={activeTab === 'search' ? 'tab active' : 'tab'} onClick={() => setActiveTab('search')}>搜索</button>
      </nav>

      <main className="dashboard-main">
        <h2 className="section-title">{tabTitle}</h2>

        {activeTab === 'dashboard' ? (
          <>
            <section className="metrics-grid">
              <article className="metric-card">
                <p>总热点</p>
                <strong>{metrics.total}</strong>
              </article>
              <article className="metric-card">
                <p>今日新增</p>
                <strong className="cyan">{metrics.today}</strong>
              </article>
              <article className="metric-card">
                <p>紧急热点</p>
                <strong className="orange">{metrics.urgent}</strong>
              </article>
              <article className="metric-card">
                <p>监控关键词</p>
                <strong className="green">{metrics.keywords}</strong>
              </article>
            </section>

            <section className="latest-card">
              <h3>最新热点</h3>
              <div className="platform-summary">
                {platformSnapshot?.batches.map((batch) => (
                  <span key={batch.platform} className={batch.success ? 'status-ok' : 'status-fail'}>
                    {batch.platformLabel}：{batch.success ? `成功 ${batch.items.length}` : `失败 ${batch.error}`}
                  </span>
                ))}
              </div>
              <div className="platform-list">
                {latestItems.length === 0 ? (
                  <p>暂无平台热点，请切到“搜索”页执行抓取。</p>
                ) : (
                  latestItems.map((item) => (
                    <article key={item.id} className="platform-card">
                      <p className="platform-title">{item.title}</p>
                      <p className="platform-meta">{item.platformLabel} · {new Date(item.fetchedAt).toLocaleString()}</p>
                      <p className="platform-heat-row">
                        <span className={`heat-badge heat-${item.heatLevel}`}>AI热度：{getHeatLabel(item.heatLevel)}</span>
                        <span className="heat-score">{item.heatScore}分</span>
                      </p>
                      <p className="platform-snippet">{item.snippet || '暂无摘要'}</p>
                      <a href={item.url} target="_blank" rel="noreferrer">查看原文</a>
                    </article>
                  ))
                )}
              </div>
            </section>
          </>
        ) : null}

        {activeTab === 'keywords' ? (
          <section className="config-card">
            <h3>关键词与调度配置</h3>
            <div className="config-grid">
              <label>
                自动抓取
                <select value={scheduleEnabled ? 'on' : 'off'} onChange={(event) => setScheduleEnabled(event.target.value === 'on')}>
                  <option value="on">开启</option>
                  <option value="off">关闭</option>
                </select>
              </label>
              <label>
                监控关键词
                <div className="keyword-input-row">
                  <input value={keywordDraft} onChange={(event) => setKeywordDraft(event.target.value)} placeholder="输入关键词后点击添加" />
                  <button type="button" onClick={handleAddKeyword}>添加</button>
                </div>
                <div className="keyword-list">
                  {platformKeywords.map((keyword) => (
                    <span key={keyword} className="keyword-chip">
                      {keyword}
                      <button type="button" onClick={() => handleRemoveKeyword(keyword)}>删除</button>
                    </span>
                  ))}
                </div>
              </label>
              <label>
                每隔多少分钟抓取一批
                <input type="number" min={1} max={720} value={intervalMinutesInput} onChange={(event) => setIntervalMinutesInput(Number(event.target.value || 1))} />
              </label>
              <div className="platform-options">
                {(platformSnapshot?.options ?? []).map((option) => (
                  <label key={option.id} className="platform-option-item">
                    <input type="checkbox" checked={selectedPlatforms.includes(option.id)} onChange={() => handleTogglePlatform(option.id)} />
                    <span>{option.label}{option.needApiKey ? '（可能需API）' : ''}</span>
                  </label>
                ))}
              </div>
              <div className="config-actions">
                <button onClick={handleSaveSchedule} disabled={loadingSchedule}>
                  {loadingSchedule ? '保存中...' : '保存配置'}
                </button>
              </div>
              <p className="schedule-meta">
                上次抓取：{platformSnapshot?.schedule.lastFetchedAt ? new Date(platformSnapshot.schedule.lastFetchedAt).toLocaleString() : '暂无'}
              </p>
              <p className="schedule-meta">
                下次执行：{platformSnapshot?.schedule.nextRunAt ? new Date(platformSnapshot.schedule.nextRunAt).toLocaleString() : '未启用'}
              </p>
            </div>
          </section>
        ) : null}

        {activeTab === 'search' ? (
          <>
            <section className="config-card">
              <h3>手动搜索抓取</h3>
              <div className="config-grid">
                <label>
                  搜索关键词
                  <input value={searchKeywordInput} onChange={(event) => setSearchKeywordInput(event.target.value)} placeholder="输入要抓取的热点词" />
                </label>
                <div className="platform-options">
                  {(platformSnapshot?.options ?? []).map((option) => (
                    <label key={option.id} className="platform-option-item">
                      <input type="checkbox" checked={selectedPlatforms.includes(option.id)} onChange={() => handleTogglePlatform(option.id)} />
                      <span>{option.label}{option.needApiKey ? '（可能需API）' : ''}</span>
                    </label>
                  ))}
                </div>
                <div className="config-actions">
                  <button onClick={() => handleManualFetchPlatforms(searchKeywordInput)} disabled={loadingFetchPlatforms}>
                    {loadingFetchPlatforms ? '抓取中...' : '开始抓取'}
                  </button>
                </div>
              </div>
            </section>

            <section className="latest-card">
              <h3>搜索结果</h3>
              <div className="platform-summary">
                {platformSnapshot?.batches.map((batch) => (
                  <span key={batch.platform} className={batch.success ? 'status-ok' : 'status-fail'}>
                    {batch.platformLabel}：{batch.success ? `成功 ${batch.items.length}` : `失败 ${batch.error}`}
                  </span>
                ))}
              </div>
              <div className="platform-list">
                {latestItems.length === 0 ? (
                  <p>暂无抓取结果。</p>
                ) : (
                  latestItems.map((item) => (
                    <article key={item.id} className="platform-card">
                      <p className="platform-title">{item.title}</p>
                      <p className="platform-meta">{item.platformLabel} · {new Date(item.fetchedAt).toLocaleString()}</p>
                      <p className="platform-heat-row">
                        <span className={`heat-badge heat-${item.heatLevel}`}>AI热度：{getHeatLabel(item.heatLevel)}</span>
                        <span className="heat-score">{item.heatScore}分</span>
                      </p>
                      <p className="platform-snippet">{item.snippet || '暂无摘要'}</p>
                      <a href={item.url} target="_blank" rel="noreferrer">查看原文</a>
                    </article>
                  ))
                )}
              </div>
            </section>
          </>
        ) : null}
      </main>

      {error ? (
        <div className="error-banner">
          {error}
        </div>
      ) : null}
    </div>
  )
}

export default App
