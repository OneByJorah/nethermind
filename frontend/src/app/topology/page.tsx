'use client'

import { useState, useEffect } from 'react'
import { containerlabApi, switchesApi, SwitchData } from '@/lib/api'
import { Map, RefreshCw, Plus, Server, Link as LinkIcon, Network, Trash2, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function TopologyPage() {
  const [topologies, setTopologies] = useState<any[]>([])
  const [switches, setSwitches] = useState<SwitchData[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)

  const load = () => {
    Promise.all([containerlabApi.list(), switchesApi.list()])
      .then(([t, s]) => { setTopologies(t); setSwitches(s) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleScan = async () => {
    try {
      const result = await containerlabApi.scan()
      toast.success(`Found ${result.topologies_found} topology/topologies`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this topology?')) return
    try {
      await containerlabApi.delete(id)
      toast.success('Topology deleted')
      if (selected?.id === id) setSelected(null)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Topology</h1>
          <p className="text-sm text-slate-500 mt-1">Containerlab network topology visualization</p>
        </div>
        <button onClick={handleScan} className="btn btn-primary btn-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Scan Topologies
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card h-64"><div className="skeleton h-full w-full rounded-xl" /></div>
          <div className="lg:col-span-2 card h-64"><div className="skeleton h-full w-full rounded-xl" /></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Topology list */}
          <div className="space-y-3">
            <h2 className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold px-1">
              Topologies ({topologies.length})
            </h2>
            {topologies.length === 0 ? (
              <div className="card">
                <div className="empty-state py-8">
                  <div className="empty-state-icon bg-purple-500/10">
                    <Map className="w-6 h-6 text-purple-400" />
                  </div>
                  <p className="text-sm text-slate-400 font-medium">No topologies found</p>
                  <p className="text-[11px] text-slate-600">Scan for Containerlab topologies</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 stagger-children">
                {topologies.map(t => (
                  <div key={t.id}
                    className={`card cursor-pointer transition-all animate-fade-in-up ${
                      selected?.id === t.id
                        ? 'border-nm-500/30 bg-nm-500/5'
                        : 'hover:border-white/[0.12]'
                    }`}
                    onClick={() => setSelected(t)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          selected?.id === t.id ? 'bg-nm-500/15 text-nm-400' : 'bg-white/[0.04] text-slate-400'
                        }`}>
                          <Network className="w-4 h-4" />
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${selected?.id === t.id ? 'text-nm-400' : 'text-white'}`}>
                            {t.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {t.node_count} nodes · {t.link_count} links
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <ChevronRight className={`w-4 h-4 transition-colors ${
                          selected?.id === t.id ? 'text-nm-400' : 'text-slate-600'
                        }`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Topology detail */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="card animate-fade-in">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-white text-lg">{selected.name}</h2>
                  <span className="badge badge-blue text-[10px]">
                    {selected.node_count} nodes · {selected.link_count} links
                  </span>
                </div>

                {/* Nodes */}
                <div className="mb-6">
                  <h3 className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-semibold mb-3 flex items-center gap-2">
                    <Server className="w-3.5 h-3.5" /> Nodes
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 stagger-children">
                    {(selected.topology_data?.nodes || []).map((node: any, i: number) => (
                      <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors animate-fade-in-up">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                          <p className="text-sm font-semibold text-white truncate">{node.name}</p>
                        </div>
                        <p className="text-[11px] text-slate-500 ml-4">{node.kind}</p>
                        {node.mgmt_ip && (
                          <p className="text-[11px] font-mono text-nm-400 mt-1 ml-4">{node.mgmt_ip}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Links */}
                {selected.topology_data?.links?.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-semibold mb-3 flex items-center gap-2">
                      <LinkIcon className="w-3.5 h-3.5" /> Links
                    </h3>
                    <div className="space-y-1.5">
                      {(selected.topology_data?.links || []).map((link: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs py-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.06] font-mono">
                          <span className="text-blue-400">{link.endpoints?.[0] || '?'}</span>
                          <span className="text-slate-600">{'<-->'}</span>
                          <span className="text-green-400">{link.endpoints?.[1] || '?'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ASCII Topology */}
                <div>
                  <h3 className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-semibold mb-3">Visualization</h3>
                  <pre className="text-xs text-slate-400 leading-relaxed p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] font-mono overflow-x-auto">
                    {generateAsciiTopology(selected.topology_data)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="card h-full min-h-[400px] flex items-center justify-center">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Map className="w-7 h-7" />
                  </div>
                  <p className="text-sm text-slate-400 font-medium">Select a topology to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function generateAsciiTopology(data: any): string {
  if (!data?.nodes) return 'No topology data'
  let viz = `+== ${data.name || 'Topology'} ==+\n\n`
  viz += `  Nodes: ${data.nodes.length}\n`
  viz += `  Links: ${data.links.length}\n\n`
  viz += `  +-- Devices ----------------+\n`
  for (const node of data.nodes) {
    const mgmt = node.mgmt_ip ? ` [${node.mgmt_ip}]` : ''
    viz += `  |  * ${node.name.padEnd(20)} ${node.kind}${mgmt}\n`
  }
  viz += `  +---------------------------+\n`
  if (data.links?.length > 0) {
    viz += `\n  +-- Connections ------------+\n`
    for (const link of data.links) {
      const endpoints = link.endpoints?.join(' <--> ') || 'unknown'
      viz += `  |  ${endpoints}\n`
    }
    viz += `  +---------------------------+\n`
  }
  return viz
}
