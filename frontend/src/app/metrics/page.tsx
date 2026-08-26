'use client'

import { useState, useEffect } from 'react'
import { dashboardApi, switchesApi, SwitchData } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import { Activity, RefreshCw, Cpu, MemoryStick, Wifi, AlertTriangle, Server, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MetricsPage() {
  const [switches, setSwitches] = useState<SwitchData[]>([])
  const [healthSummary, setHealthSummary] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([switchesApi.list(), dashboardApi.healthSummary()])
      .then(([s, h]) => { setSwitches(s); setHealthSummary(h) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Metrics & Health</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time device health monitoring</p>
        </div>
        <button onClick={() => { toast.success('Refreshing...'); load() }} className="btn btn-secondary btn-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 stagger-children">
        <MetricStatCard
          icon={<Cpu className="w-5 h-5" />}
          label="Avg CPU"
          value={avgMetric(healthSummary, 'cpu_usage')}
          unit="%"
          color="blue"
        />
        <MetricStatCard
          icon={<MemoryStick className="w-5 h-5" />}
          label="Avg Memory"
          value={avgMetric(healthSummary, 'memory_usage')}
          unit="%"
          color="purple"
        />
        <MetricStatCard
          icon={<Wifi className="w-5 h-5" />}
          label="Interfaces Up"
          value={sumMetric(healthSummary, 'interfaces_up')}
          unit={`/ ${sumMetric(healthSummary, 'interfaces_up') + sumMetric(healthSummary, 'interfaces_down')}`}
          color="green"
        />
        <MetricStatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Total Findings"
          value={sumMetric(healthSummary, 'open_findings')}
          unit="open"
          color="red"
        />
      </div>

      {/* Device Health Table */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="card h-16"><div className="skeleton h-full w-full rounded-xl" /></div>)}
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-nm-400" />
              Device Health Details
            </h2>
          </div>
          {healthSummary.length === 0 ? (
            <div className="empty-state py-12">
              <div className="empty-state-icon">
                <Server className="w-7 h-7" />
              </div>
              <p className="text-sm text-slate-400 font-medium">No devices registered</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Status</th>
                    <th>CPU</th>
                    <th>Memory</th>
                    <th>Interfaces</th>
                    <th>Findings</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {healthSummary.map((d, i) => (
                    <tr key={d.switch_id} className="animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center border border-white/[0.06]">
                            <Server className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-white text-sm">{d.hostname}</p>
                            <p className="text-[11px] text-slate-500">{d.ip_address}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          d.status === 'online' ? 'text-green-400' :
                          d.status === 'offline' ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            d.status === 'online' ? 'bg-green-400 pulse-dot' :
                            d.status === 'offline' ? 'bg-red-400' : 'bg-yellow-400'
                          }`} />
                          {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                        </span>
                      </td>
                      <td><MetricBar value={d.cpu_usage} /></td>
                      <td><MetricBar value={d.memory_usage} /></td>
                      <td>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-green-400 font-semibold">{d.interfaces_up || 0}</span>
                          <span className="text-slate-600">/</span>
                          <span className="text-red-400 font-semibold">{d.interfaces_down || 0}</span>
                          <span className="text-slate-600">down</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge text-[10px] ${
                          d.open_findings > 0 ? 'badge-red' : 'badge-green'
                        }`}>
                          {d.open_findings || 0}
                        </span>
                      </td>
                      <td className="text-xs text-slate-500">
                        {d.last_updated ? timeAgo(d.last_updated) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetricStatCard({ icon, label, value, unit, color }: {
  icon: React.ReactNode; label: string; value: number | null; unit: string; color: string
}) {
  const colors: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
    blue: { bg: 'from-blue-500/8 to-blue-600/3', text: 'text-blue-400', border: 'border-blue-500/15', iconBg: 'bg-blue-500/10' },
    purple: { bg: 'from-purple-500/8 to-purple-600/3', text: 'text-purple-400', border: 'border-purple-500/15', iconBg: 'bg-purple-500/10' },
    green: { bg: 'from-green-500/8 to-green-600/3', text: 'text-green-400', border: 'border-green-500/15', iconBg: 'bg-green-500/10' },
    red: { bg: 'from-red-500/8 to-red-600/3', text: 'text-red-400', border: 'border-red-500/15', iconBg: 'bg-red-500/10' },
  }
  const c = colors[color] || colors.blue

  return (
    <div className={`card bg-gradient-to-br ${c.bg} border ${c.border} animate-fade-in-up`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${c.iconBg} ${c.text}`}>
          {icon}
        </div>
        <div>
          <p className="text-[11px] text-slate-500 uppercase tracking-[0.06em] font-semibold">{label}</p>
          <p className="text-xl font-bold text-white">
            {value !== null ? value : '—'}
            <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function MetricBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-500 text-xs">—</span>
  const barColor = value > 80 ? 'bg-red-500' : value > 50 ? 'bg-amber-500' : 'bg-green-500'
  const textColor = value > 80 ? 'text-red-400' : value > 50 ? 'text-amber-400' : 'text-green-400'

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className={`text-xs font-semibold ${textColor}`}>{value}%</span>
    </div>
  )
}

function avgMetric(data: any[], key: string): number | null {
  const vals = data.filter(d => d[key] !== null).map(d => d[key])
  if (vals.length === 0) return null
  return Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10
}

function sumMetric(data: any[], key: string): number {
  return data.reduce((a: number, d: any) => a + (d[key] || 0), 0)
}
