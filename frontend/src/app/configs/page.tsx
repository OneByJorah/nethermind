'use client'

import { useState, useEffect } from 'react'
import { switchesApi, configsApi, configParserApi, SwitchData, ConfigBackupData } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import { FileText, Copy, Download, GitCompare, Upload, CloudDownload, Loader2, X } from 'lucide-react'
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

  // Upload state
  const [uploading, setUploading] = useState(false)

  // Backup modal state
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

  // ─── Upload Config ──────────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await configParserApi.upload(file, true)
      toast.success(`Uploaded ${result.hostname || file.name} — ${result.vlans} VLANs parsed`)
      // Refresh switch list
      const updated = await switchesApi.list()
      setSwitches(updated)
      // Auto-select the new switch
      if (result.switch_id) {
        loadConfigs(result.switch_id)
      }
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // ─── Backup from Live Switch ────────────────────────────────────────

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
      // Refresh and select
      const updated = await switchesApi.list()
      setSwitches(updated)
      if (result.switch_id) {
        loadConfigs(result.switch_id)
      }
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
    <div className="space-y-6 fade-in">
      {/* Header with Upload & Backup buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Configurations</h1>
          <p className="text-slate-400 mt-1">View, upload, backup, and compare device configurations</p>
        </div>
        <div className="flex gap-2">
          <label className="btn btn-primary cursor-pointer">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Config
            <input type="file" className="hidden" accept=".txt,.cfg,.conf"
              onChange={handleUpload} disabled={uploading} />
          </label>
          <button onClick={() => setShowBackupModal(true)} className="btn btn-primary">
            <CloudDownload className="w-4 h-4" /> Backup from Switch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Switch selector sidebar */}
        <div className="lg:col-span-1 card">
          <h2 className="font-semibold text-white mb-3 text-sm">Select Device</h2>
          <div className="space-y-1">
            {switches.map(sw => (
              <div key={sw.id} className={`flex items-center justify-between rounded-lg transition-colors ${
                selectedSwitch === sw.id ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-slate-800 border border-transparent'
              }`}>
                <button onClick={() => loadConfigs(sw.id)}
                  className="flex-1 text-left px-3 py-2">
                  <span className={`text-sm ${selectedSwitch === sw.id ? 'text-blue-400' : 'text-slate-400'}`}>
                    {sw.hostname}
                  </span>
                  <span className="block text-xs text-slate-500">{sw.ip_address}</span>
                </button>
                <button onClick={() => handleBackupSwitch(sw)}
                  disabled={backingUp}
                  className="px-2 py-1 text-slate-500 hover:text-blue-400 transition-colors"
                  title="Backup config from this switch">
                  {backingUp ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudDownload className="w-3 h-3" />}
                </button>
              </div>
            ))}
            {switches.length === 0 && <p className="text-slate-500 text-sm py-4 text-center">No switches yet</p>}
          </div>
        </div>

        {/* Config viewer */}
        <div className="lg:col-span-3 space-y-4">
          {!selectedSwitch ? (
            <div className="card flex items-center justify-center py-16 text-slate-500">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Select a device to view its configuration</p>
                <p className="text-sm mt-2 text-slate-600">Or upload a .txt config file / backup from a live switch</p>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex items-center justify-between">
                <div className="tabs">
                  <button className={`tab ${activeTab === 'view' ? 'active' : ''}`}
                    onClick={() => setActiveTab('view')}>View</button>
                  <button className={`tab ${activeTab === 'diff' ? 'active' : ''}`}
                    onClick={() => setActiveTab('diff')}>Diff</button>
                </div>
                {latestConfig?.config && (
                  <button onClick={() => handleCopy(latestConfig.config)}
                    className="btn btn-secondary btn-sm">
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                )}
              </div>

              {/* View tab */}
              {activeTab === 'view' && (
                <div className="card">
                  {latestConfig?.config ? (
                    <>
                      <div className="flex items-center justify-between mb-3 text-sm text-slate-400">
                        <span>Backup #{latestConfig.backup_id} · {latestConfig.config_type}</span>
                        <span>{latestConfig.timestamp}</span>
                      </div>
                      <pre className="text-sm leading-relaxed">{latestConfig.config}</pre>
                    </>
                  ) : (
                    <p className="text-slate-500 text-center py-8">No config backup available. Upload a config or backup from the switch.</p>
                  )}
                </div>
              )}

              {/* Diff tab */}
              {activeTab === 'diff' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-400 mb-1 block">Older Backup</label>
                      <select className="input select" value={backupA || ''}
                        onChange={e => setBackupA(parseInt(e.target.value))}>
                        <option value="">Select...</option>
                        {configs.map(c => (
                          <option key={c.id} value={c.id}>#{c.id} ({c.created_at})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400 mb-1 block">Newer Backup</label>
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
                    <GitCompare className="w-4 h-4" /> Compare
                  </button>

                  {diffResult && (
                    <div className="card">
                      <div className="flex items-center justify-between mb-3 text-sm">
                        <span className="text-slate-400">
                          +{diffResult.additions} additions · -{diffResult.deletions} deletions
                        </span>
                      </div>
                      <pre className="text-sm">{diffResult.diff || 'No differences found'}</pre>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowBackupModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Backup from Live Switch</h2>
              <button onClick={() => setShowBackupModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Transport</label>
                <select className="input select w-full" value={backupForm.transport}
                  onChange={e => setBackupForm({ ...backupForm, transport: e.target.value })}>
                  <option value="ssh">SSH</option>
                  <option value="telnet">Telnet</option>
                  <option value="serial">Serial</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Switch IP / Hostname</label>
                <input className="input w-full" placeholder="192.168.1.1"
                  value={backupForm.host}
                  onChange={e => setBackupForm({ ...backupForm, host: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Port</label>
                  <input className="input w-full" type="number" placeholder="22"
                    value={backupForm.port}
                    onChange={e => setBackupForm({ ...backupForm, port: parseInt(e.target.value) || 22 })} />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Username</label>
                  <input className="input w-full" placeholder="admin"
                    value={backupForm.username}
                    onChange={e => setBackupForm({ ...backupForm, username: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Password</label>
                <input className="input w-full" type="password" placeholder="***"
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
