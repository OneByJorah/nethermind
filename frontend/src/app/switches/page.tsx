'use client'

import { useState, useEffect } from 'react'
import { switchesApi, SwitchData, SwitchCreateData } from '@/lib/api'
import { timeAgo, statusColor, vendorColor } from '@/lib/utils'
import { Network, Plus, RefreshCw, Activity, Trash2, Search } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SwitchesPage() {
  const [switches, setSwitches] = useState<SwitchData[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    switchesApi.list().then(setSwitches).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = switches.filter(s =>
    s.hostname.toLowerCase().includes(search.toLowerCase()) ||
    s.ip_address.includes(search)
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

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Switches</h1>
          <p className="text-slate-400 mt-1">{switches.length} device{switches.length !== 1 ? 's' : ''} registered</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => switchesApi.bulkBackup().then(() => toast.success('Bulk backup started')).catch(e => toast.error(e.message))}
            className="btn btn-secondary btn-sm">
            <RefreshCw className="w-4 h-4" /> Backup All
          </button>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary btn-sm">
            <Plus className="w-4 h-4" /> Add Switch
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input className="input pl-10" placeholder="Search by hostname or IP..." value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <LoadingSkeleton /> : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Hostname</th>
                <th>IP Address</th>
                <th>Vendor</th>
                <th>Connection</th>
                <th>Status</th>
                <th>Location</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">No switches found</td></tr>
              ) : filtered.map(sw => (
                <tr key={sw.id}>
                  <td className="font-medium text-white">{sw.hostname}</td>
                  <td className="font-mono text-sm">{sw.ip_address}</td>
                  <td>
                    <span className={`badge bg-slate-800 border-slate-700 ${vendorColor(sw.vendor)}`}>
                      {sw.vendor.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 text-sm ${
                      sw.connection_type === 'serial' ? 'text-amber-400' : 'text-blue-400'
                    }`}>
                      {sw.connection_type === 'serial' ? '🔧 Serial' : '🔌 SSH'}
                    </span>
                  </td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 text-sm ${statusColor(sw.status)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusColor(sw.status).replace('text-', 'bg-')}`} />
                      {sw.status}
                    </span>
                  </td>
                  <td className="text-slate-400 text-sm">{sw.location || '—'}</td>
                  <td className="text-slate-400 text-sm">{timeAgo(sw.updated_at || sw.created_at)}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => handleSync(sw.id)} className="btn btn-secondary btn-sm" title="Sync Config">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleHealth(sw.id)} className="btn btn-secondary btn-sm" title="Health Check">
                        <Activity className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(sw.id, sw.hostname)} className="btn btn-danger btn-sm" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      toast.success('Switch added')
      onAdded()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card w-full max-w-2xl mx-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-4">Add Switch</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Hostname *</label>
              <input className="input" required value={form.hostname}
                onChange={e => setForm({...form, hostname: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">IP Address *</label>
              <input className="input" required value={form.ip_address}
                onChange={e => setForm({...form, ip_address: e.target.value})} />
            </div>
          </div>

          {/* Connection Type */}
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Connection Type</label>
            <div className="flex gap-3">
              <label className={`flex-1 p-3 rounded-lg border cursor-pointer transition-all ${
                form.connection_type === 'ssh'
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600'
              }`}>
                <input type="radio" name="conn_type" value="ssh" className="sr-only"
                  checked={form.connection_type === 'ssh'}
                  onChange={() => setForm({...form, connection_type: 'ssh'})} />
                <div className="text-center">
                  <p className="font-medium">🔌 SSH</p>
                  <p className="text-xs mt-1">Network connection</p>
                </div>
              </label>
              <label className={`flex-1 p-3 rounded-lg border cursor-pointer transition-all ${
                form.connection_type === 'serial'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600'
              }`}>
                <input type="radio" name="conn_type" value="serial" className="sr-only"
                  checked={form.connection_type === 'serial'}
                  onChange={() => setForm({...form, connection_type: 'serial'})} />
                <div className="text-center">
                  <p className="font-medium">🔧 Serial (COM)</p>
                  <p className="text-xs mt-1">Console cable</p>
                </div>
              </label>
            </div>
          </div>

          {/* SSH Fields */}
          {form.connection_type === 'ssh' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">SSH Port</label>
                <input className="input" type="number" value={form.ssh_port}
                  onChange={e => setForm({...form, ssh_port: parseInt(e.target.value) || 22})} />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Vendor</label>
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
              <div>
                <label className="text-sm text-slate-400 mb-1 block">SSH Username</label>
                <input className="input" value={form.ssh_username || ''}
                  onChange={e => setForm({...form, ssh_username: e.target.value})} />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">SSH Password</label>
                <input className="input" type="password" value={form.ssh_password || ''}
                  onChange={e => setForm({...form, ssh_password: e.target.value})} />
              </div>
            </div>
          )}

          {/* Serial Fields */}
          {form.connection_type === 'serial' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Serial Port *</label>
                  <div className="flex gap-2">
                    <input className="input flex-1" placeholder="/dev/ttyUSB0" value={form.serial_port || ''}
                      onChange={e => setForm({...form, serial_port: e.target.value})} />
                    {serialPorts.length > 0 && (
                      <select className="input select w-40" value={form.serial_port || ''}
                        onChange={e => setForm({...form, serial_port: e.target.value})}>
                        <option value="">Detected ports</option>
                        {serialPorts.map(p => (
                          <option key={p.device} value={p.device}>{p.device}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Baud Rate</label>
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
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Data Bits</label>
                  <select className="input select" value={form.serial_databits}
                    onChange={e => setForm({...form, serial_databits: parseInt(e.target.value) || 8})}>
                    <option value="5">5</option>
                    <option value="6">6</option>
                    <option value="7">7</option>
                    <option value="8">8</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Parity</label>
                  <select className="input select" value={form.serial_parity}
                    onChange={e => setForm({...form, serial_parity: e.target.value})}>
                    <option value="N">None</option>
                    <option value="E">Even</option>
                    <option value="O">Odd</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Stop Bits</label>
                  <select className="input select" value={form.serial_stopbits}
                    onChange={e => setForm({...form, serial_stopbits: parseInt(e.target.value) || 1})}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Enable Password</label>
                  <input className="input" type="password" value={form.serial_password || ''}
                    onChange={e => setForm({...form, serial_password: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Timeout (seconds)</label>
                  <input className="input" type="number" value={form.serial_timeout}
                    onChange={e => setForm({...form, serial_timeout: parseInt(e.target.value) || 10})} />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-sm text-slate-400 mb-1 block">Location</label>
            <input className="input" value={form.location || ''}
              onChange={e => setForm({...form, location: e.target.value})} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Adding...' : 'Add Switch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return <div className="card p-8"><div className="skeleton h-64 w-full" /></div>
}
