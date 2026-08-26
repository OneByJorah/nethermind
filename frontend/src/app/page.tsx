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
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Server,
  Wifi,
  WifiOff,
  Zap,
  Cpu,
  MemoryStick,
  ChevronRight,
  Plus,
  Play,
  ShieldCheck,
  Terminal,
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full pulse-dot" />
              <span className="text-[11px] font-semibold text-green-400">System Online</span>
            </div>
          </div>
          <p className="text-sm text-slate-500">Network overview and health summary</p>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => {
            const [s, h, d] = await Promise.all([dashboardApi.stats(), dashboardApi.healthSummary(), systemApi.discovery()])
            setStats(s); setHealthSummary(h); setDiscovery(d)
          }} className="btn btn-secondary btn-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <StatCard
          icon={<Network className="w-5 h-5" />}
          label="Total Switches"
          value={stats?.total_switches ?? 0}
          sub={`${stats?.online_switches ?? 0} online · ${stats?.offline_switches ?? 0} offline`}
          trend={stats && stats.total_switches > 0 ? 'up' : undefined}
          trendValue="+2 this month"
          color="blue"
        />
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="Config Backups"
          value={stats?.total_configs ?? 0}
          sub="All time backups"
          trend="up"
          trendValue="+12 this week"
          color="purple"
        />
        <StatCard
          icon={<Shield className="w-5 h-5" />}
          label="Security Findings"
          value={stats?.open_security_findings ?? 0}
          sub="Open issues requiring attention"
          color={stats && stats.open_security_findings > 0 ? 'red' : 'green'}
          trend={stats && stats.open_security_findings > 0 ? 'down' : undefined}
          trendValue={stats && stats.open_security_findings > 0 ? 'Needs review' : 'All clear'}
        />
        <StatCard
          icon={<GitBranch className="w-5 h-5" />}
          label="Active Workflows"
          value={stats?.active_workflows ?? 0}
          sub={`${stats?.total_topologies ?? 0} topologies managed`}
          color="amber"
        />
      </div>

      {/* Hardware Discovery */}
      {discovery && (discovery.serial_ports.length > 0 || discovery.usb_devices.length > 0) && (
        <div className="card animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-green-400" />
              Detected Hardware
              <span className="text-xs font-normal text-slate-500 ml-1">
                ({discovery.serial_ports.length + discovery.usb_devices.length} devices)
              </span>
            </h2>
            <button onClick={async () => {
              const d = await systemApi.discovery();
              setDiscovery(d);
            }} className="btn btn-secondary btn-xs">
              <RefreshCw className="w-3 h-3" /> Scan
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {discovery.serial_ports.length > 0 && (
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-semibold mb-2">Serial / COM Ports</h3>
                <div className="space-y-1.5">
                  {discovery.serial_ports.map(p => (
                    <div key={p.device} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-sm group hover:border-white/[0.12] transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        <span className="font-mono text-green-400 text-xs">{p.device}</span>
                      </div>
                      <span className="text-slate-500 text-xs">{p.description || p.manufacturer || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {discovery.usb_devices.filter(d => d.description !== 'Linux Foundation 2.0 root hub' && d.description !== 'Linux Foundation 3.0 root hub').length > 0 && (
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-semibold mb-2">USB Devices</h3>
                <div className="space-y-1.5">
                  {discovery.usb_devices.filter(d =>
                    d.description !== 'Linux Foundation 2.0 root hub' && d.description !== 'Linux Foundation 3.0 root hub'
                  ).map(d => (
                    <div key={`${d.bus}-${d.device}`} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-sm group hover:border-white/[0.12] transition-colors">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-slate-300 text-xs">{d.description}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-600">{d.vendor_id}:{d.product_id}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Summary - takes 2 cols */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-nm-400" />
              Device Health
            </h2>
            <a href="/metrics" className="text-xs text-nm-400 hover:text-nm-300 font-medium flex items-center gap-1 transition-colors">
              View all <ChevronRight className="w-3 h-3" />
            </a>
          </div>
          <div className="space-y-2">
            {healthSummary.length === 0 ? (
              <div className="empty-state py-12">
                <div className="empty-state-icon">
                  <Server className="w-7 h-7" />
                </div>
                <p className="text-sm text-slate-400 font-medium mb-1">No devices registered yet</p>
                <p className="text-xs text-slate-600 mb-4">Add your first switch to get started</p>
                <a href="/switches" className="btn btn-primary btn-sm">
                  <Plus className="w-3.5 h-3.5" /> Add Switch
                </a>
              </div>
            ) : (
              healthSummary.map((device, i) => (
                <DeviceHealthRow key={device.switch_id} device={device} index={i} />
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Quick Actions
          </h2>
          <div className="space-y-2">
            <QuickAction
              href="/switches"
              label="Add Switch"
              description="Register a new network device"
              icon={<Network className="w-4 h-4" />}
              color="blue"
            />
            <QuickAction
              href="/chat"
              label="AI Assistant"
              description="Ask Nethermind about your network"
              icon={<MessageSquare className="w-4 h-4" />}
              color="purple"
            />
            <QuickAction
              href="/security"
              label="Run Audit"
              description="Scan for security vulnerabilities"
              icon={<ShieldCheck className="w-4 h-4" />}
              color="green"
            />
            <QuickAction
              href="/workflows"
              label="New Workflow"
              description="Start a change management workflow"
              icon={<GitBranch className="w-4 h-4" />}
              color="amber"
            />
            <QuickAction
              href="/templates"
              label="Config Templates"
              description="Browse 50+ network templates"
              icon={<Terminal className="w-4 h-4" />}
              color="cyan"
            />
          </div>

          {/* System Status */}
          <div className="divider" />
          <div className="space-y-3">
            <h3 className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-semibold">System Status</h3>
            <div className="space-y-2">
              <StatusRow label="API Server" status="online" />
              <StatusRow label="Database" status="online" />
              <StatusRow label="AI Agent" status={stats && stats.active_workflows !== undefined ? 'online' : 'offline'} />
            </div>
          </div>
        </div>
      </div>

      {/* Activity Feed / Recent Actions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-nm-400" />
            Recent Activity
          </h2>
        </div>
        <div className="space-y-1">
          {[
            { icon: <Network className="w-3.5 h-3.5" />, text: 'Switch added', detail: 'Core-SW-01 registered', time: '2 min ago', color: 'blue' },
            { icon: <FileText className="w-3.5 h-3.5" />, text: 'Config backed up', detail: 'Access-SW-03 running-config', time: '15 min ago', color: 'purple' },
            { icon: <Shield className="w-3.5 h-3.5" />, text: 'Security audit completed', detail: '3 findings resolved', time: '1 hr ago', color: 'green' },
            { icon: <GitBranch className="w-3.5 h-3.5" />, text: 'Workflow advanced', detail: 'Config change approved', time: '2 hr ago', color: 'amber' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/[0.02] transition-colors group">
              <div className={`p-1.5 rounded-lg bg-${item.color}-500/10 text-${item.color}-400`}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 font-medium">{item.text}</p>
                <p className="text-xs text-slate-600 truncate">{item.detail}</p>
              </div>
              <span className="text-[11px] text-slate-600 whitespace-nowrap">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, color, trend, trendValue }: {
  icon: React.ReactNode
  label: string
  value: number
  sub: string
  color: string
  trend?: 'up' | 'down'
  trendValue?: string
}) {
  const colors: Record<string, { bg: string; glow: string; border: string; iconBg: string }> = {
    blue: { bg: 'from-blue-500/8 to-blue-600/3', glow: 'var(--card-glow, rgba(51,102,255,0.1))', border: 'border-blue-500/15', iconBg: 'bg-blue-500/10 text-blue-400' },
    purple: { bg: 'from-purple-500/8 to-purple-600/3', glow: 'var(--card-glow, rgba(168,85,247,0.1))', border: 'border-purple-500/15', iconBg: 'bg-purple-500/10 text-purple-400' },
    red: { bg: 'from-red-500/8 to-red-600/3', glow: 'var(--card-glow, rgba(239,68,68,0.1))', border: 'border-red-500/15', iconBg: 'bg-red-500/10 text-red-400' },
    green: { bg: 'from-green-500/8 to-green-600/3', glow: 'var(--card-glow, rgba(16,185,129,0.1))', border: 'border-green-500/15', iconBg: 'bg-green-500/10 text-green-400' },
    amber: { bg: 'from-amber-500/8 to-amber-600/3', glow: 'var(--card-glow, rgba(245,158,11,0.1))', border: 'border-amber-500/15', iconBg: 'bg-amber-500/10 text-amber-400' },
  }
  const c = colors[color] || colors.blue

  return (
    <div className={`card bg-gradient-to-br ${c.bg} border ${c.border} stat-card animate-fade-in-up`}
      style={{ '--card-glow': c.glow } as any}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${c.iconBg}`}>
          {icon}
        </div>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trendValue}
          </div>
        )}
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-semibold mb-1">{label}</p>
        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      </div>
      <p className="text-xs text-slate-500 mt-2">{sub}</p>
    </div>
  )
}

function DeviceHealthRow({ device, index }: { device: any; index: number }) {
  const statusConfig = {
    online: { dot: 'bg-green-400 pulse-dot', label: 'Online', textColor: 'text-green-400' },
    offline: { dot: 'bg-red-400', label: 'Offline', textColor: 'text-red-400' },
    unknown: { dot: 'bg-yellow-400', label: 'Unknown', textColor: 'text-yellow-400' },
  }
  const status = statusConfig[device.status as keyof typeof statusConfig] || statusConfig.unknown

  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.03] transition-all group animate-fade-in-up"
      style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center">
            <Network className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-2 ${status.dot}`} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white group-hover:text-nm-400 transition-colors">{device.hostname}</p>
          <p className="text-xs text-slate-500 font-mono">{device.ip_address}</p>
        </div>
      </div>
      <div className="flex items-center gap-5 text-xs">
        {device.cpu_usage !== null && (
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3 text-slate-500" />
            <span className={`font-semibold ${device.cpu_usage > 80 ? 'text-red-400' : device.cpu_usage > 50 ? 'text-amber-400' : 'text-green-400'}`}>
              {device.cpu_usage}%
            </span>
          </div>
        )}
        {device.memory_usage !== null && (
          <div className="flex items-center gap-1.5">
            <MemoryStick className="w-3 h-3 text-slate-500" />
            <span className={`font-semibold ${device.memory_usage > 80 ? 'text-red-400' : device.memory_usage > 50 ? 'text-amber-400' : 'text-green-400'}`}>
              {device.memory_usage}%
            </span>
          </div>
        )}
        {device.interfaces_up !== null && (
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-slate-500" />
            <span className="font-semibold text-slate-300">{device.interfaces_up}/{device.interfaces_up + device.interfaces_down}</span>
            <span className="text-slate-600">up</span>
          </div>
        )}
        {device.open_findings > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="font-semibold text-red-400">{device.open_findings}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function QuickAction({ href, label, description, icon, color }: {
  href: string; label: string; description: string; icon: React.ReactNode; color: string
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/15',
    purple: 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/15',
    green: 'bg-green-500/10 text-green-400 group-hover:bg-green-500/15',
    amber: 'bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/15',
    cyan: 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/15',
    red: 'bg-red-500/10 text-red-400 group-hover:bg-red-500/15',
  }

  return (
    <a href={href} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all group">
      <div className={`p-2 rounded-lg ${colorClasses[color] || colorClasses.blue} transition-colors`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white group-hover:text-nm-400 transition-colors">{label}</p>
        <p className="text-[11px] text-slate-500">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
    </a>
  )
}

function StatusRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className={`text-xs font-medium ${status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
          {status === 'online' ? 'Operational' : 'Down'}
        </span>
      </div>
    </div>
  )
}

function MessageSquare(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton h-8 w-40" />
          <div className="skeleton h-4 w-64" />
        </div>
        <div className="skeleton h-9 w-24 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card h-36">
            <div className="skeleton h-full w-full rounded-xl" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card h-64">
          <div className="skeleton h-full w-full rounded-xl" />
        </div>
        <div className="card h-64">
          <div className="skeleton h-full w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
