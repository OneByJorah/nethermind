'use client'

import { useState } from 'react'
import { GitCompare, Upload, ArrowLeftRight, Copy, Trash2, Download } from 'lucide-react'
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
    toast.success('Diff copied')
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
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Config Diff</h1>
          <p className="text-slate-400 mt-1">Compare two configurations side-by-side</p>
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
              <h2 className="text-sm font-semibold text-slate-300">Older Config</h2>
              <label className="btn btn-secondary btn-sm cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Upload
                <input type="file" className="hidden" accept=".txt,.cfg,.conf"
                  onChange={e => e.target.files?.[0] && handleFileUpload('old', e.target.files[0])} />
              </label>
            </div>
            <textarea value={oldConfig} onChange={e => setOldConfig(e.target.value)}
              placeholder="Paste the older config here, or upload a .txt file..."
              className="w-full h-96 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm font-mono text-slate-300 resize-none focus:outline-none focus:border-blue-500" />
          </div>
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-300">Newer Config</h2>
              <label className="btn btn-secondary btn-sm cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Upload
                <input type="file" className="hidden" accept=".txt,.cfg,.conf"
                  onChange={e => e.target.files?.[0] && handleFileUpload('new', e.target.files[0])} />
              </label>
            </div>
            <textarea value={newConfig} onChange={e => setNewConfig(e.target.value)}
              placeholder="Paste the newer config here, or upload a .txt file..."
              className="w-full h-96 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm font-mono text-slate-300 resize-none focus:outline-none focus:border-blue-500" />
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-400">+{additions} additions</span>
              <span className="text-red-400">-{deletions} deletions</span>
              <span className="text-slate-500">{unchanged} unchanged</span>
            </div>
            <button onClick={() => setShowDiff(false)} className="btn btn-secondary btn-sm">
              <ArrowLeftRight className="w-3.5 h-3.5" /> Edit
            </button>
          </div>
          <div className="overflow-auto max-h-[600px]">
            <pre className="text-sm font-mono leading-relaxed">
              {diffLines.map((line, i) => (
                <div key={i} className={`px-3 ${
                  line.type === 'added' ? 'bg-green-500/10 text-green-400' :
                  line.type === 'removed' ? 'bg-red-500/10 text-red-400' :
                  'text-slate-400'
                }`}>
                  <span className="inline-block w-8 text-right text-slate-600 mr-3 select-none">
                    {line.oldLineNum || ''}
                  </span>
                  <span className="inline-block w-8 text-right text-slate-600 mr-3 select-none">
                    {line.newLineNum || ''}
                  </span>
                  <span className="mr-2 select-none">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  {line.content}
                </div>
              ))}
            </pre>
          </div>
        </div>
      )}

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
