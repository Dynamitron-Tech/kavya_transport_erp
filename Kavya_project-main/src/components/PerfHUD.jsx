import { useEffect, useMemo, useState } from 'react'

function tierPillClass(tier) {
  if (tier === 'high') return 'bg-green-600 text-white'
  if (tier === 'balanced') return 'bg-yellow-500 text-black'
  return 'bg-red-600 text-white'
}

function fpsClass(fps) {
  if (fps > 50) return 'text-green-400'
  if (fps >= 35) return 'text-yellow-300'
  return 'text-red-400'
}

function formatTris(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return `${value}`
}

export default function PerfHUD({ metrics: incomingMetrics, tier: incomingTier }) {
  const [visible, setVisible] = useState(true)
  const [metrics, setMetrics] = useState(incomingMetrics || null)
  const [tier, setTier] = useState(incomingTier || window.__kavyaDeviceTier || 'balanced')
  const [expanded, setExpanded] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (incomingMetrics) setMetrics(incomingMetrics)
  }, [incomingMetrics])

  useEffect(() => {
    if (incomingTier) setTier(incomingTier)
  }, [incomingTier])

  useEffect(() => {
    const onMetrics = (e) => setMetrics(e.detail)
    const onTierChange = (e) => {
      const next = e?.detail?.to
      if (next) setTier(next)
      setHistory((prev) => {
        const nextHistory = [e.detail, ...prev]
        return nextHistory.slice(0, 10)
      })
    }

    window.addEventListener('kavya:perf-metrics', onMetrics)
    window.addEventListener('kavya:tier-changed', onTierChange)
    return () => {
      window.removeEventListener('kavya:perf-metrics', onMetrics)
      window.removeEventListener('kavya:tier-changed', onTierChange)
    }
  }, [])

  const gpuBar = useMemo(() => {
    const ms = metrics?.gpuFrameTime || 0
    return Math.max(0, Math.min(100, (ms / 16) * 100))
  }, [metrics])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 z-[9999] w-80 rounded-lg border border-white/15 bg-black/70 p-3 text-xs text-white backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm">Performance HUD</span>
        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${tierPillClass(tier)}`}>
          {tier}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-y-1">
        <div className={`font-semibold ${fpsClass(metrics?.avgFPS || 0)}`}>FPS: {(metrics?.avgFPS || 0).toFixed(0)}</div>
        <div>Frame: {(metrics?.avgFrameMs || 0).toFixed(1)}ms</div>
        <div>Draw: {metrics?.drawCalls || 0}</div>
        <div>Meshes: {metrics?.activeMeshes || 0}</div>
        <div>Tris: {formatTris(metrics?.trianglesDrawn || 0)}</div>
        <div>Min FPS: {(metrics?.minFPS || 0).toFixed(0)}</div>
      </div>

      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between text-[10px] text-white/80">
          <span>GPU</span>
          <span>{(metrics?.gpuFrameTime || 0).toFixed(1)}ms</span>
        </div>
        <div className="h-2 w-full rounded bg-white/15">
          <div className="h-2 rounded bg-cyan-400" style={{ width: `${gpuBar}%` }} />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          className="rounded bg-yellow-600 px-2 py-1 text-[10px] font-semibold text-black"
          onClick={() => window.dispatchEvent(new CustomEvent('kavya:tier-command', { detail: { action: 'downgrade' } }))}
        >
          Downgrade
        </button>
        <button
          className="rounded bg-green-600 px-2 py-1 text-[10px] font-semibold text-white"
          onClick={() => window.dispatchEvent(new CustomEvent('kavya:tier-command', { detail: { action: 'upgrade' } }))}
        >
          Upgrade
        </button>
        <button
          className="rounded bg-white/15 px-2 py-1 text-[10px]"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Hide' : 'History'}
        </button>
        <button
          className="ml-auto rounded bg-red-700 px-2 py-1 text-[10px]"
          onClick={() => {
            localStorage.setItem('kavya_perf', 'false')
            setVisible(false)
          }}
        >
          Close
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-1 border-t border-white/15 pt-2 text-[10px] text-white/80">
          {history.slice(0, 3).map((item, idx) => (
            <div key={`${item?.at || idx}_${idx}`}>
              {item?.from} → {item?.to} ({item?.reason})
            </div>
          ))}
          {history.length === 0 && <div>No tier changes yet.</div>}
        </div>
      )}
    </div>
  )
}
