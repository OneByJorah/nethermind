'use client'

import { useState, useEffect } from 'react'
import { dashboardApi, systemApi, DashboardStats, DiscoveryData } from '@/lib/api'
import {
  Network,
  FileText,
  Shield,
  GitBranch,
  Activity,
  Map,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  HardDrive,
  Radio,
  RefreshCw,
} from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [healthSummary, setHealthSummary] = useState<any[]>([])
  const [discovery, setDiscovery] = useState<DiscoveryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      dashboardApi.stats(),
      dashboardApi.healthSummary(),
      systemApi.discovery(),
    ]).then(([s, h, d]) => {
      setStats(s)
      setHealthSummary(h)
      setDiscovery(d)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Network overview and health summary</p>
        </div>
        <div className="flex gap-2">
          <span className="badge bg-green-500/10 text-green-400 border-green-500/20">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full pulse-dot mr-2" />
            System Online
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Network className="w-5 h-5" />} label="Total Switches" value={stats?.total_switches ?? 0}
          sub={`${stats?.online_switches ?? 0} online · ${stats?.offline_switches ?? 0} offline`}
          color="blue" />
        <StatCard icon={<FileText className="w-5 h-5" />} label="Config Backups" value={stats?.total_configs ?? 0}
          sub="All time backups" color="purple" />
        <StatCard icon={<Shield className="w-5 h-5" />} label="Open Findings" value={stats?.open_security_findings ?? 0}
          sub="Security issues" color={stats && stats.open_security_findings > 0 ? 'red' : 'green'} />
        <StatCard icon={<GitBranch className="w-5 h-5" />} label="Active Workflows" value={stats?.active_workflows ?? 0}
          sub={`${stats?.total_topologies ?? 0} topologies`} color="amber" />
      </div>

      {/* Hardware Discovery */}
      {discovery && (discovery.serial_ports.length > 0 || discovery.usb_devices.length > 0) && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-green-400" />
              Detected Hardware
            </h2>
            <button onClick={async () => {
              const d = await systemApi.discovery();
              setDiscovery(d);
            }} className="btn btn-secondary btn-sm">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {discovery.serial_ports.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Serial / COM Ports</h3>
                <div className="space-y-1.5">
                  {discovery.serial_ports.map(p => (
                    <div key={p.device} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm">
                      <span className="font-mono text-green-400">{p.device}</span>
                      <span className="text-slate-400">{p.description || p.manufacturer || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {discovery.usb_devices.filter(d => d.description !== 'Linux Foundation 2.0 root hub' && d.description !== 'Linux Foundation 3.0 root hub').length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-2">USB Devices</h3>
                <div className="space-y-1.5">
                  {discovery.usb_devices.filter(d =>
                    d.description !== 'Linux Foundation 2.0 root hub' && d.description !== 'Linux Foundation 3.0 root hub'
                  ).map(d => (
                    <div key={`${d.bus}-${d.device}`} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-slate-300">{d.description}</span>
                      </div>
                      <span className="font-mono text-xs text-slate-500">{d.vendor_id}:{d.product_id}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Health Summary & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Summary */}
        <div className="lg:col-span-2 card">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            Device Health
          </h2>
          <div className="space-y-2">
            {healthSummary.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">No devices registered yet</p>
            ) : (
              healthSummary.map((device) => (
                <DeviceHealthRow key={device.switch_id} device={device} />
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Quick Actions
          </h2>
          <QuickAction href="/switches" label="Add Switch" description="Register a new network device" icon={<Network className="w-4 h-4" />} />
          <QuickAction href="/chat" label="Chat with Hermes" description="Ask AI about your network" icon={<Activity className="w-4 h-4" />} />
          <QuickAction href="/security" label="Run Audit" description="Scan for security issues" icon={<Shield className="w-4 h-4" />} />
          <QuickAction href="/workflows" label="New Workflow" description="Start a change workflow" icon={<GitBranch className="w-4 h-4" />} />
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: number; sub: string; color: string
}) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20',
    red: 'from-red-500/10 to-red-500/5 border-red-500/20',
    green: 'from-green-500/10 to-green-500/5 border-green-500/20',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20',
  }
  const iconColors: Record<string, string> = {
    blue: 'text-blue-400', purple: 'text-purple-400', red: 'text-red-400',
    green: 'text-green-400', amber: 'text-amber-400',
  }
  return (
    <div className={`card bg-gradient-to-br ${colors[color]} border`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className={`p-2 rounded-lg bg-black/20 ${iconColors[color]}`}>{icon}</div>
      </div>
      <p className="text-xs text-slate-500 mt-3">{sub}</p>
    </div>
  )
}

function DeviceHealthRow({ device }: { device: any }) {
  const statusDot = device.status === 'online' ? 'bg-green-400 pulse-dot' :
    device.status === 'offline' ? 'bg-red-400' : 'bg-yellow-400'
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 transition-colors">
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${statusDot}`} />
        <div>
          <p className="text-sm font-medium text-white">{device.hostname}</p>
          <p className="text-xs text-slate-500">{device.ip_address}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-400">
        {device.cpu_usage !== null && <span>CPU: {device.cpu_usage}%</span>}
        {device.memory_usage !== null && <span>MEM: {device.memory_usage}%</span>}
        {device.interfaces_up !== null && <span>{device.interfaces_up}/{device.interfaces_up + device.interfaces_down} up</span>}
        {device.open_findings > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <AlertTriangle className="w-3 h-3" /> {device.open_findings}
          </span>
        )}
      </div>
    </div>
  )
}

function QuickAction({ href, label, description, icon }: {
  href: string; label: string; description: string; icon: React.ReactNode
}) {
  return (
    <a href={href} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-all">
      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">{icon}</div>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </a>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="card h-28"><div className="skeleton h-full w-full" /></div>)}
      </div>
    </div>
  )
}
