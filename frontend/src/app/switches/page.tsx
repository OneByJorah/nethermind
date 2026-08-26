'use client'

import { useState, useEffect } from 'react'
import { switchesApi, SwitchData, SwitchCreateData } from '@/lib/api'
import { timeAgo, statusColor, vendorColor } from '@/lib/utils'
import { Network, Plus, RefreshCw, Activity, Trash2, Search, Wifi, WifiOff, Server, MapPin, Clock, Loader2, Terminal, Power } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SwitchesPage() {
  const [switches, setSwitches] = useState<SwitchData[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

  const load = () => {
    setLoading(true)
    switchesApi.list().then(setSwitches).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = switches.filter(s =>
    s.hostname.toLowerCase().includes(search.toLowerCase()) ||
    s.ip_address.includes(search) ||
    (s.location || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id: number, hostname: string) => {
    if (!confirm(`Delete switch ${hostname}?`)) return
    try {
      await switchesApi.delete(id)
      toast.success(`Deleted ${hostname}`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const handleSync = async (id: number) => {
    try {
      await switchesApi.sync(id)
      toast.success('Config sync started')
      setTimeout(load, 2000)
    } catch (e: any) { toast.error(e.message) }
  }

  const handleHealth = async (id: number) => {
    try {
      const result = await switchesApi.health(id)
      toast.success(`Health: CPU ${result.cpu}% | ${result.interfaces_up}/${result.interfaces_up + result.interfaces_down} up`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const onlineCount = switches.filter(s => s.status === 'online').length
  const offlineCount = switches.filter(s => s.status === 'offline').length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Switches</h1>
          <p className="text-sm text-slate-500 mt-1">
            {switches.length} device{switches.length !== 1 ? 's' : ''} registered
            <span className="mx-2 text-slate-700">·</span>
            <span className="text-green-400">{onlineCount} online</span>
            <span className="mx-1 text-slate-700">·</span>
            <span className="text-red-400">{offlineCount} offline</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => switchesApi.bulkBackup().then(() => toast.success('Bulk backup started')).catch(e => toast.error(e.message))}
            className="btn btn-secondary btn-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Backup All
          </button>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Add Switch
          </button>
        </div>
      </div>

      {/* Search + View Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-11" placeholder="Search by hostname, IP, or location..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
          <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'table' ? 'bg-nm-500/20 text-nm-400' : 'text-slate-500 hover:text-slate-300'}`}>
            Table
          </button>
          <button onClick={() => setViewMode('grid')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'grid' ? 'bg-nm-500/20 text-nm-400' : 'text-slate-500 hover:text-slate-300'}`}>
            Grid
          </button>
        </div>
      </div>

      {loading ? <LoadingSkeleton /> : (
        viewMode === 'table' ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Vendor</th>
                  <th>Connection</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-16">
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <Network className="w-7 h-7" />
                      </div>
                      <p className="text-sm text-slate-400 font-medium mb-1">No switches found</p>
                      <p className="text-xs text-slate-600 mb-4">
                        {search ? 'Try a different search term' : 'Add your first switch to get started'}
                      </p>
                      {!search && (
                        <button onClick={() => setShowAdd(true)} className="btn btn-primary btn-sm">
                          <Plus className="w-3.5 h-3.5" /> Add Switch
                        </button>
                      )}
                    </div>
                  </td></tr>
                ) : filtered.map(sw => (
                  <tr key={sw.id} className="group">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center border border-white/[0.06]">
                          <Server className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm group-hover:text-nm-400 transition-colors">{sw.hostname}</p>
                          <p className="text-xs text-slate-500 font-mono">{sw.ip_address}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge text-[10px] ${vendorColor(sw.vendor)}`}>
                        {sw.vendor.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg ${
                        sw.connection_type === 'serial' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {sw.connection_type === 'serial' ? <Terminal className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                        {sw.connection_type === 'serial' ? 'Serial' : 'SSH'}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                        sw.status === 'online' ? 'text-green-400' : sw.status === 'offline' ? 'text-red-400' : 'text-yellow-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sw.status === 'online' ? 'bg-green-400 pulse-dot' : sw.status === 'offline' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                        {sw.status.charAt(0).toUpperCase() + sw.status.slice(1)}
                      </span>
                    </td>
                    <td className="text-slate-400 text-xs">
                      {sw.location ? (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{sw.location}</span>
                      ) : '—'}
                    </td>
                    <td className="text-slate-500 text-xs">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(sw.updated_at || sw.created_at)}</span>
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleSync(sw.id)} className="btn btn-ghost btn-xs" title="Sync Config">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleHealth(sw.id)} className="btn btn-ghost btn-xs" title="Health Check">
                          <Activity className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(sw.id, sw.hostname)} className="btn btn-ghost btn-xs text-red-400 hover:text-red-300" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {filtered.length === 0 ? (
              <div className="col-span-full empty-state py-16">
                <div className="empty-state-icon">
                  <Network className="w-7 h-7" />
                </div>
                <p className="text-sm text-slate-400 font-medium">No switches found</p>
              </div>
            ) : filtered.map(sw => (
              <div key={sw.id} className="card group animate-fade-in-up">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center border border-white/[0.06]">
                      <Server className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold text-white group-hover:text-nm-400 transition-colors">{sw.hostname}</p>
                      <p className="text-xs text-slate-500 font-mono">{sw.ip_address}</p>
                    </div>
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${sw.status === 'online' ? 'bg-green-400 pulse-dot' : 'bg-red-400'}`} />
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`badge text-[10px] ${vendorColor(sw.vendor)}`}>
                    {sw.vendor.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className={`badge text-[10px] ${sw.connection_type === 'serial' ? 'badge-amber' : 'badge-blue'}`}>
                    {sw.connection_type === 'serial' ? 'Serial' : 'SSH'}
                  </span>
                  {sw.location && (
                    <span className="badge text-[10px] bg-white/[0.04] text-slate-400 border-white/[0.08]">
                      <MapPin className="w-2.5 h-2.5" /> {sw.location}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 pt-2 border-t border-white/[0.04]">
                  <button onClick={() => handleSync(sw.id)} className="btn btn-ghost btn-xs flex-1" title="Sync">
                    <RefreshCw className="w-3.5 h-3.5" /> Sync
                  </button>
                  <button onClick={() => handleHealth(sw.id)} className="btn btn-ghost btn-xs flex-1" title="Health">
                    <Activity className="w-3.5 h-3.5" /> Health
                  </button>
                  <button onClick={() => handleDelete(sw.id, sw.hostname)} className="btn btn-ghost btn-xs text-red-400 hover:text-red-300" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {showAdd && <AddSwitchModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

function AddSwitchModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState<SwitchCreateData>({
    hostname: '', ip_address: '', vendor: 'cisco_ios', ssh_port: 22,
    connection_type: 'ssh', serial_baud: 9600, serial_databits: 8,
    serial_parity: 'N', serial_stopbits: 1, serial_timeout: 10,
  })
  const [saving, setSaving] = useState(false)
  const [serialPorts, setSerialPorts] = useState<any[]>([])

  const loadSerialPorts = async () => {
    try {
      const ports = await switchesApi.serialPorts()
      setSerialPorts(ports)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (form.connection_type === 'serial') loadSerialPorts()
  }, [form.connection_type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await switchesApi.create(form)
      toast.success('Switch added successfully')
      onAdded()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-5">Add Switch</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Hostname *</label>
              <input className="input" required value={form.hostname}
                onChange={e => setForm({...form, hostname: e.target.value})} placeholder="Core-SW-01" />
            </div>
            <div className="form-group">
              <label className="form-label">IP Address *</label>
              <input className="input" required value={form.ip_address}
                onChange={e => setForm({...form, ip_address: e.target.value})} placeholder="192.168.1.1" />
            </div>
          </div>

          {/* Connection Type */}
          <div className="form-group">
            <label className="form-label">Connection Type</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'ssh', label: 'SSH', desc: 'Network connection', icon: '🔌', activeColor: 'blue' },
                { value: 'serial', label: 'Serial', desc: 'Console cable', icon: '🔧', activeColor: 'amber' },
              ].map(opt => (
                <label key={opt.value} className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  form.connection_type === opt.value
                    ? `bg-${opt.activeColor}-500/10 border-${opt.activeColor}-500/30`
                    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                }`}>
                  <input type="radio" name="conn_type" value={opt.value} className="sr-only"
                    checked={form.connection_type === opt.value}
                    onChange={() => setForm({...form, connection_type: opt.value as any})} />
                  <span className="text-lg">{opt.icon}</span>
                  <div>
                    <p className={`text-sm font-semibold ${form.connection_type === opt.value ? 'text-white' : 'text-slate-300'}`}>{opt.label}</p>
                    <p className="text-[11px] text-slate-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* SSH Fields */}
          {form.connection_type === 'ssh' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">SSH Port</label>
                <input className="input" type="number" value={form.ssh_port}
                  onChange={e => setForm({...form, ssh_port: parseInt(e.target.value) || 22})} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor</label>
                <select className="input select" value={form.vendor}
                  onChange={e => setForm({...form, vendor: e.target.value})}>
                  <option value="cisco_ios">Cisco IOS</option>
                  <option value="cisco_xr">Cisco XR</option>
                  <option value="cisco_nxos">Cisco NX-OS</option>
                  <option value="juniper_junos">Juniper JunOS</option>
                  <option value="arista_eos">Arista EOS</option>
                  <option value="aruba_os">HP Aruba (OS-Switch)</option>
                  <option value="linux">Linux</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">SSH Username</label>
                <input className="input" value={form.ssh_username || ''}
                  onChange={e => setForm({...form, ssh_username: e.target.value})} placeholder="admin" />
              </div>
              <div className="form-group">
                <label className="form-label">SSH Password</label>
                <input className="input" type="password" value={form.ssh_password || ''}
                  onChange={e => setForm({...form, ssh_password: e.target.value})} />
              </div>
            </div>
          )}

          {/* Serial Fields */}
          {form.connection_type === 'serial' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Serial Port *</label>
                  <div className="flex gap-2">
                    <input className="input flex-1" placeholder="/dev/ttyUSB0" value={form.serial_port || ''}
                      onChange={e => setForm({...form, serial_port: e.target.value})} />
                    {serialPorts.length > 0 && (
                      <select className="input select w-40" value={form.serial_port || ''}
                        onChange={e => setForm({...form, serial_port: e.target.value})}>
                        <option value="">Auto-detect</option>
                        {serialPorts.map(p => (
                          <option key={p.device} value={p.device}>{p.device}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Baud Rate</label>
                  <select className="input select" value={form.serial_baud}
                    onChange={e => setForm({...form, serial_baud: parseInt(e.target.value) || 9600})}>
                    <option value="9600">9600</option>
                    <option value="19200">19200</option>
                    <option value="38400">38400</option>
                    <option value="57600">57600</option>
                    <option value="115200">115200</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="form-group">
                  <label className="form-label">Data Bits</label>
                  <select className="input select" value={form.serial_databits}
                    onChange={e => setForm({...form, serial_databits: parseInt(e.target.value) || 8})}>
                    {[5,6,7,8].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Parity</label>
                  <select className="input select" value={form.serial_parity}
                    onChange={e => setForm({...form, serial_parity: e.target.value})}>
                    <option value="N">None</option>
                    <option value="E">Even</option>
                    <option value="O">Odd</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Stop Bits</label>
                  <select className="input select" value={form.serial_stopbits}
                    onChange={e => setForm({...form, serial_stopbits: parseInt(e.target.value) || 1})}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Location</label>
            <input className="input" value={form.location || ''}
              onChange={e => setForm({...form, location: e.target.value})} placeholder="Building A, Floor 2" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Adding...' : 'Add Switch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="card h-16 flex items-center px-4 gap-4">
          <div className="skeleton w-9 h-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-3 w-24" />
          </div>
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}
