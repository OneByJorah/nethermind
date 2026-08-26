'use client'

import { useState, useEffect } from 'react'
import { switchesApi, configsApi, configParserApi, SwitchData, ConfigBackupData } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import { FileText, Copy, Download, GitCompare, Upload, CloudDownload, Loader2, X, Server, Clock, Code, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ConfigsPage() {
  const [switches, setSwitches] = useState<SwitchData[]>([])
  const [selectedSwitch, setSelectedSwitch] = useState<number | null>(null)
  const [configs, setConfigs] = useState<ConfigBackupData[]>([])
  const [latestConfig, setLatestConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'view' | 'diff'>('view')
  const [backupA, setBackupA] = useState<number | null>(null)
  const [backupB, setBackupB] = useState<number | null>(null)
  const [diffResult, setDiffResult] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [showBackupModal, setShowBackupModal] = useState(false)
  const [backupForm, setBackupForm] = useState({
    host: '', port: 22, transport: 'ssh', username: 'admin', password: '',
  })
  const [backingUp, setBackingUp] = useState(false)

  useEffect(() => {
    switchesApi.list().then(setSwitches).catch(() => {})
    setLoading(false)
  }, [])

  const loadConfigs = async (switchId: number) => {
    setSelectedSwitch(switchId)
    setLatestConfig(null)
    setDiffResult(null)
    const [configList, latest] = await Promise.all([
      configsApi.list(switchId),
      configsApi.latest(switchId),
    ])
    setConfigs(configList)
    setLatestConfig(latest)
  }

  const handleDiff = async () => {
    if (!backupA || !backupB) { toast.error('Select two backups to compare'); return }
    try {
      const result = await configsApi.diff(backupA, backupB)
      setDiffResult(result)
    } catch (e: any) { toast.error(e.message) }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await configParserApi.upload(file, true)
      toast.success(`Uploaded ${result.hostname || file.name} — ${result.vlans} VLANs parsed`)
      const updated = await switchesApi.list()
      setSwitches(updated)
      if (result.switch_id) loadConfigs(result.switch_id)
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleBackup = async () => {
    if (!backupForm.host) { toast.error('Enter the switch IP/hostname'); return }
    setBackingUp(true)
    try {
      const result = await configParserApi.backup({
        transport: backupForm.transport,
        host: backupForm.host,
        port: backupForm.port,
        username: backupForm.username,
        password: backupForm.password,
        save_to_db: true,
      })
      toast.success(`Backed up ${result.hostname} — ${result.line_count} lines`)
      setShowBackupModal(false)
      const updated = await switchesApi.list()
      setSwitches(updated)
      if (result.switch_id) loadConfigs(result.switch_id)
    } catch (err: any) {
      toast.error(`Backup failed: ${err.message}`)
    } finally {
      setBackingUp(false)
    }
  }

  const handleBackupSwitch = async (sw: SwitchData) => {
    setBackingUp(true)
    try {
      const result = await configParserApi.backupById(sw.id, sw.connection_type)
      toast.success(`Backed up ${result.hostname} — ${result.line_count} lines`)
      loadConfigs(sw.id)
    } catch (err: any) {
      toast.error(`Backup failed: ${err.message}`)
    } finally {
      setBackingUp(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Configurations</h1>
          <p className="text-sm text-slate-500 mt-1">View, upload, backup, and compare device configurations</p>
        </div>
        <div className="flex gap-2">
          <label className="btn btn-primary cursor-pointer">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload Config
            <input type="file" className="hidden" accept=".txt,.cfg,.conf" onChange={handleUpload} disabled={uploading} />
          </label>
          <button onClick={() => setShowBackupModal(true)} className="btn btn-secondary">
            <CloudDownload className="w-3.5 h-3.5" /> Backup from Switch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Switch selector sidebar */}
        <div className="lg:col-span-1">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-semibold mb-3 px-1">Select Device</h2>
          <div className="space-y-1.5">
            {switches.map(sw => (
              <div key={sw.id}
                className={`flex items-center justify-between rounded-xl transition-all cursor-pointer ${
                  selectedSwitch === sw.id
                    ? 'bg-nm-500/10 border border-nm-500/20'
                    : 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]'
                }`}
                onClick={() => loadConfigs(sw.id)}>
                <div className="flex items-center gap-3 p-3 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    selectedSwitch === sw.id ? 'bg-nm-500/15 text-nm-400' : 'bg-white/[0.04] text-slate-400'
                  }`}>
                    <Server className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${selectedSwitch === sw.id ? 'text-nm-400' : 'text-white'}`}>
                      {sw.hostname}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">{sw.ip_address}</p>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleBackupSwitch(sw) }}
                  disabled={backingUp}
                  className="p-2 mr-1 rounded-lg hover:bg-white/[0.05] text-slate-600 hover:text-nm-400 transition-colors"
                  title="Backup config">
                  {backingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
            {switches.length === 0 && (
              <div className="card">
                <div className="empty-state py-8">
                  <p className="text-sm text-slate-400">No switches yet</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Config viewer */}
        <div className="lg:col-span-3">
          {!selectedSwitch ? (
            <div className="card h-full min-h-[400px] flex items-center justify-center">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <FileText className="w-7 h-7" />
                </div>
                <p className="text-sm text-slate-400 font-medium mb-1">Select a device to view its configuration</p>
                <p className="text-xs text-slate-600">Or upload a .txt config file / backup from a live switch</p>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex items-center justify-between mb-4">
                <div className="tabs">
                  <button className={`tab ${activeTab === 'view' ? 'active' : ''}`}
                    onClick={() => setActiveTab('view')}>View Config</button>
                  <button className={`tab ${activeTab === 'diff' ? 'active' : ''}`}
                    onClick={() => setActiveTab('diff')}>Compare Backups</button>
                </div>
                {latestConfig?.config && (
                  <button onClick={() => handleCopy(latestConfig.config)}
                    className="btn btn-ghost btn-sm">
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                )}
              </div>

              {/* View tab */}
              {activeTab === 'view' && (
                <div className="card">
                  {latestConfig?.config ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="badge badge-blue text-[10px]">Backup #{latestConfig.backup_id}</span>
                          <span className="badge bg-white/[0.04] text-slate-400 border-white/[0.08] text-[10px]">{latestConfig.config_type}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{latestConfig.timestamp}</span>
                        </div>
                      </div>
                      <pre className="text-xs leading-relaxed">{latestConfig.config}</pre>
                    </>
                  ) : (
                    <div className="empty-state py-12">
                      <Code className="w-8 h-8 text-slate-600 mb-3" />
                      <p className="text-sm text-slate-400">No config backup available</p>
                      <p className="text-xs text-slate-600">Upload a config or backup from the switch</p>
                    </div>
                  )}
                </div>
              )}

              {/* Diff tab */}
              {activeTab === 'diff' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label">Older Backup</label>
                      <select className="input select" value={backupA || ''}
                        onChange={e => setBackupA(parseInt(e.target.value))}>
                        <option value="">Select...</option>
                        {configs.map(c => (
                          <option key={c.id} value={c.id}>#{c.id} ({c.created_at})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Newer Backup</label>
                      <select className="input select" value={backupB || ''}
                        onChange={e => setBackupB(parseInt(e.target.value))}>
                        <option value="">Select...</option>
                        {configs.map(c => (
                          <option key={c.id} value={c.id}>#{c.id} ({c.created_at})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button onClick={handleDiff} className="btn btn-primary">
                    <GitCompare className="w-3.5 h-3.5" /> Compare
                  </button>

                  {diffResult && (
                    <div className="card">
                      <div className="flex items-center gap-4 mb-3 text-xs">
                        <span className="text-green-400 font-semibold">+{diffResult.additions} additions</span>
                        <span className="text-red-400 font-semibold">-{diffResult.deletions} deletions</span>
                      </div>
                      <pre className="text-xs">{diffResult.diff || 'No differences found'}</pre>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Backup Modal */}
      {showBackupModal && (
        <div className="modal-overlay" onClick={() => setShowBackupModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Backup from Live Switch</h2>
              <button onClick={() => setShowBackupModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="form-group">
                <label className="form-label">Transport</label>
                <select className="input select" value={backupForm.transport}
                  onChange={e => setBackupForm({ ...backupForm, transport: e.target.value })}>
                  <option value="ssh">SSH</option>
                  <option value="telnet">Telnet</option>
                  <option value="serial">Serial</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Switch IP / Hostname</label>
                <input className="input" placeholder="192.168.1.1"
                  value={backupForm.host}
                  onChange={e => setBackupForm({ ...backupForm, host: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Port</label>
                  <input className="input" type="number" placeholder="22"
                    value={backupForm.port}
                    onChange={e => setBackupForm({ ...backupForm, port: parseInt(e.target.value) || 22 })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input className="input" placeholder="admin"
                    value={backupForm.username}
                    onChange={e => setBackupForm({ ...backupForm, username: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="input" type="password" placeholder="***"
                  value={backupForm.password}
                  onChange={e => setBackupForm({ ...backupForm, password: e.target.value })} />
              </div>
              <button onClick={handleBackup} disabled={backingUp || !backupForm.host}
                className="btn btn-primary w-full">
                {backingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                {backingUp ? 'Backing up...' : 'Backup Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
