'use client'

import { useState, useEffect } from 'react'
import { securityApi, SecurityFindingData } from '@/lib/api'
import { timeAgo, severityColor } from '@/lib/utils'
import { Shield, AlertTriangle, CheckCircle, RefreshCw, Search, ShieldCheck, ShieldAlert, Bug, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SecurityPage() {
  const [findings, setFindings] = useState<SecurityFindingData[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      securityApi.list({ severity: severityFilter || undefined, status: statusFilter || undefined }),
      securityApi.stats(),
    ]).then(([f, s]) => {
      setFindings(f)
      setStats(s)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [severityFilter, statusFilter])

  const handleAuditAll = async () => {
    try {
      const result = await securityApi.auditAll()
      toast.success(`Audited ${result.audited} device(s)`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const handleResolve = async (id: number) => {
    try {
      await securityApi.resolve(id, 'resolved')
      toast.success('Finding resolved')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const filtered = findings.filter(f =>
    f.title.toLowerCase().includes(search.toLowerCase())
  )

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
  const sorted = [...filtered].sort((a, b) =>
    (severityOrder[a.severity as keyof typeof severityOrder] ?? 99) -
    (severityOrder[b.severity as keyof typeof severityOrder] ?? 99)
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Security</h1>
          <p className="text-sm text-slate-500 mt-1">CVE scanning, AAA checks, and compliance auditing</p>
        </div>
        <button onClick={handleAuditAll} className="btn btn-primary btn-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Audit All Devices
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 stagger-children">
          <StatCard icon={<Shield className="w-4 h-4" />} label="Total" value={stats.total} color="slate" />
          <StatCard icon={<ShieldAlert className="w-4 h-4" />} label="Critical" value={stats.by_severity?.critical || 0} color="red" />
          <StatCard icon={<Bug className="w-4 h-4" />} label="High" value={stats.by_severity?.high || 0} color="orange" />
          <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Medium" value={stats.by_severity?.medium || 0} color="amber" />
          <StatCard icon={<Eye className="w-4 h-4" />} label="Open" value={stats.by_status?.open || 0} color="blue" />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-11" placeholder="Search findings..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input select w-36" value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}>
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="input select w-32" value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Findings */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="card h-28"><div className="skeleton h-full w-full rounded-xl" /></div>)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="card">
          <div className="empty-state py-12">
            <div className="empty-state-icon bg-green-500/10">
              <ShieldCheck className="w-7 h-7 text-green-400" />
            </div>
            <p className="text-sm text-slate-400 font-medium mb-1">No findings found</p>
            <p className="text-xs text-slate-600 mb-4">Run an audit to check for security issues</p>
            <button onClick={handleAuditAll} className="btn btn-primary btn-sm">
              <RefreshCw className="w-3.5 h-3.5" /> Run Audit
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {sorted.map(f => (
            <div key={f.id} className="card animate-fade-in-up group">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`badge text-[10px] ${severityColor(f.severity)}`}>{f.severity}</span>
                    {f.cve_id && <span className="badge badge-red text-[10px]">{f.cve_id}</span>}
                    <span className="badge bg-white/[0.04] text-slate-400 border-white/[0.08] text-[10px]">{f.finding_type}</span>
                    <span className="text-[11px] text-slate-600">{timeAgo(f.created_at)}</span>
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-nm-400 transition-colors">{f.title}</h3>
                  {f.description && <p className="text-sm text-slate-500 mt-1">{f.description}</p>}
                  {f.remediation && (
                    <div className="mt-3 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                      <p className="text-[11px] text-green-400 font-semibold uppercase tracking-wider mb-1">Remediation</p>
                      <p className="text-sm text-green-300/80">{f.remediation}</p>
                    </div>
                  )}
                </div>
                {f.status === 'open' && (
                  <button onClick={() => handleResolve(f.id)} className="btn btn-success btn-sm ml-3 flex-shrink-0">
                    <CheckCircle className="w-3.5 h-3.5" /> Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color: string
}) {
  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    slate: { bg: 'bg-white/[0.03]', text: 'text-white', border: 'border-white/[0.06]' },
    red: { bg: 'bg-red-500/5', text: 'text-red-400', border: 'border-red-500/15' },
    orange: { bg: 'bg-orange-500/5', text: 'text-orange-400', border: 'border-orange-500/15' },
    amber: { bg: 'bg-amber-500/5', text: 'text-amber-400', border: 'border-amber-500/15' },
    blue: { bg: 'bg-blue-500/5', text: 'text-blue-400', border: 'border-blue-500/15' },
  }
  const c = colorClasses[color] || colorClasses.slate

  return (
    <div className={`card ${c.bg} border ${c.border} py-3 animate-fade-in-up`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={c.text}>{icon}</span>
        <p className="text-[11px] text-slate-500 uppercase tracking-[0.06em] font-semibold">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
    </div>
  )
}
