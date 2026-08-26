'use client'

import { useState } from 'react'
import { GitCompare, Upload, ArrowLeftRight, Copy, Trash2, Download, Plus, Minus, Equal } from 'lucide-react'
import toast from 'react-hot-toast'

interface DiffLine {
  type: 'same' | 'added' | 'removed'
  content: string
  oldLineNum: number | null
  newLineNum: number | null
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  let i = m, j = n
  const temp: DiffLine[] = []
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      temp.unshift({ type: 'same', content: oldLines[i - 1], oldLineNum: i, newLineNum: j })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.unshift({ type: 'added', content: newLines[j - 1], oldLineNum: null, newLineNum: j })
      j--
    } else {
      temp.unshift({ type: 'removed', content: oldLines[i - 1], oldLineNum: i, newLineNum: null })
      i--
    }
  }
  return temp
}

export default function ConfigDiffPage() {
  const [oldConfig, setOldConfig] = useState('')
  const [newConfig, setNewConfig] = useState('')
  const [diffLines, setDiffLines] = useState<DiffLine[]>([])
  const [showDiff, setShowDiff] = useState(false)

  const handleCompare = () => {
    if (!oldConfig.trim() && !newConfig.trim()) {
      toast.error('Paste configs on both sides to compare')
      return
    }
    setDiffLines(computeDiff(oldConfig, newConfig))
    setShowDiff(true)
  }

  const handleSwap = () => {
    setOldConfig(newConfig)
    setNewConfig(oldConfig)
    setShowDiff(false)
  }

  const handleClear = () => {
    setOldConfig('')
    setNewConfig('')
    setDiffLines([])
    setShowDiff(false)
  }

  const handleCopyDiff = () => {
    const text = diffLines.map(l =>
      (l.type === 'added' ? '+ ' : l.type === 'removed' ? '- ' : '  ') + l.content
    ).join('\n')
    navigator.clipboard.writeText(text)
    toast.success('Diff copied to clipboard')
  }

  const handleDownloadDiff = () => {
    const text = diffLines.map(l =>
      (l.type === 'added' ? '+ ' : l.type === 'removed' ? '- ' : '  ') + l.content
    ).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'config-diff.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = (side: 'old' | 'new', file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (side === 'old') setOldConfig(text)
      else setNewConfig(text)
      setShowDiff(false)
    }
    reader.readAsText(file)
  }

  const additions = diffLines.filter(l => l.type === 'added').length
  const deletions = diffLines.filter(l => l.type === 'removed').length
  const unchanged = diffLines.filter(l => l.type === 'same').length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Config Diff</h1>
          <p className="text-sm text-slate-500 mt-1">Compare two configurations side-by-side</p>
        </div>
        {showDiff && (
          <div className="flex gap-2">
            <button onClick={handleCopyDiff} className="btn btn-secondary btn-sm">
              <Copy className="w-3.5 h-3.5" /> Copy Diff
            </button>
            <button onClick={handleDownloadDiff} className="btn btn-secondary btn-sm">
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          </div>
        )}
      </div>

      {!showDiff ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center">
                  <Minus className="w-3 h-3 text-red-400" />
                </div>
                Older Config
              </h2>
              <label className="btn btn-ghost btn-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Upload
                <input type="file" className="hidden" accept=".txt,.cfg,.conf"
                  onChange={e => e.target.files?.[0] && handleFileUpload('old', e.target.files[0])} />
              </label>
            </div>
            <textarea value={oldConfig} onChange={e => { setOldConfig(e.target.value); setShowDiff(false) }}
              placeholder="Paste the older config here, or upload a .txt file..."
              className="w-full h-96 bg-surface-0 border border-white/[0.06] rounded-xl p-4 text-sm font-mono text-slate-300 resize-none focus:outline-none focus:border-nm-500/50 focus:ring-1 focus:ring-nm-500/20 transition-all placeholder:text-slate-600" />
          </div>
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-green-500/10 flex items-center justify-center">
                  <Plus className="w-3 h-3 text-green-400" />
                </div>
                Newer Config
              </h2>
              <label className="btn btn-ghost btn-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Upload
                <input type="file" className="hidden" accept=".txt,.cfg,.conf"
                  onChange={e => e.target.files?.[0] && handleFileUpload('new', e.target.files[0])} />
              </label>
            </div>
            <textarea value={newConfig} onChange={e => { setNewConfig(e.target.value); setShowDiff(false) }}
              placeholder="Paste the newer config here, or upload a .txt file..."
              className="w-full h-96 bg-surface-0 border border-white/[0.06] rounded-xl p-4 text-sm font-mono text-slate-300 resize-none focus:outline-none focus:border-nm-500/50 focus:ring-1 focus:ring-nm-500/20 transition-all placeholder:text-slate-600" />
          </div>
        </div>
      ) : (
        <div className="card">
          {/* Diff Stats */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/20">
                <Plus className="w-3 h-3" /> {additions} additions
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20">
                <Minus className="w-3 h-3" /> {deletions} deletions
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06]">
                <Equal className="w-3 h-3" /> {unchanged} unchanged
              </span>
            </div>
            <button onClick={() => setShowDiff(false)} className="btn btn-ghost btn-sm">
              <ArrowLeftRight className="w-3.5 h-3.5" /> Edit
            </button>
          </div>

          {/* Diff Content */}
          <div className="overflow-auto max-h-[600px] rounded-xl border border-white/[0.06]">
            <pre className="text-sm font-mono leading-relaxed">
              {diffLines.map((line, i) => (
                <div key={i} className={`px-4 py-0.5 ${
                  line.type === 'added' ? 'bg-green-500/[0.08] text-green-400' :
                  line.type === 'removed' ? 'bg-red-500/[0.08] text-red-400' :
                  'text-slate-500'
                }`}>
                  <span className="inline-block w-10 text-right text-slate-700 mr-3 select-none text-[11px]">
                    {line.oldLineNum || ''}
                  </span>
                  <span className="inline-block w-10 text-right text-slate-700 mr-3 select-none text-[11px]">
                    {line.newLineNum || ''}
                  </span>
                  <span className="inline-block w-4 text-center mr-2 select-none text-[11px] font-bold">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  {line.content}
                </div>
              ))}
            </pre>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-3">
        {!showDiff && (
          <button onClick={handleCompare} className="btn btn-primary">
            <GitCompare className="w-4 h-4" /> Compare Configs
          </button>
        )}
        <button onClick={handleSwap} className="btn btn-secondary">
          <ArrowLeftRight className="w-4 h-4" /> Swap Sides
        </button>
        <button onClick={handleClear} className="btn btn-secondary">
          <Trash2 className="w-4 h-4" /> Clear
        </button>
      </div>
    </div>
  )
}
