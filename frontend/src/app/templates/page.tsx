'use client'

import { useState, useEffect } from 'react'
import { templatesApi, TemplateData, TemplateCreateData } from '@/lib/api'
import { FileText, Plus, Trash2, Eye, Play, Search, Code, X, Loader2, Tag, Server } from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORIES = ['general', 'vlan', 'security', 'interface', 'stp', 'ospf', 'bgp']
const VENDORS = ['cisco_ios', 'cisco_xr', 'cisco_nxos', 'juniper_junos', 'arista_eos', 'aruba_os', 'linux']

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterVendor, setFilterVendor] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<TemplateData | null>(null)
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({})
  const [previewResult, setPreviewResult] = useState<any>(null)

  const load = () => {
    setLoading(true)
    templatesApi.list(filterVendor || undefined, filterCategory || undefined)
      .then(setTemplates)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filterVendor, filterCategory])

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return
    try {
      await templatesApi.delete(id)
      toast.success(`Deleted ${name}`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const handlePreview = async (tmpl: TemplateData) => {
    setPreviewTemplate(tmpl)
    setPreviewVars({})
    setPreviewResult(null)
  }

  const runPreview = async () => {
    if (!previewTemplate) return
    try {
      const result = await templatesApi.render(previewTemplate.id, previewVars)
      setPreviewResult(result)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Config Templates</h1>
          <p className="text-sm text-slate-500 mt-1">{templates.length} template{templates.length !== 1 ? 's' : ''} available</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => templatesApi.seed().then(() => { toast.success('Built-in templates seeded'); load() }).catch(e => toast.error(e.message))}
            className="btn btn-secondary btn-sm">
            <Code className="w-3.5 h-3.5" /> Seed Built-ins
          </button>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Create Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-11" placeholder="Search templates..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input select w-40" value={filterVendor}
          onChange={e => setFilterVendor(e.target.value)}>
          <option value="">All Vendors</option>
          {VENDORS.map(v => (
            <option key={v} value={v}>{v.replace('_', ' ').toUpperCase()}</option>
          ))}
        </select>
        <select className="input select w-40" value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="card h-40"><div className="skeleton h-full w-full rounded-xl" /></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filtered.length === 0 ? (
            <div className="col-span-full">
              <div className="card">
                <div className="empty-state py-12">
                  <div className="empty-state-icon bg-purple-500/10">
                    <FileText className="w-7 h-7 text-purple-400" />
                  </div>
                  <p className="text-sm text-slate-400 font-medium mb-1">No templates found</p>
                  <p className="text-xs text-slate-600 mb-4">Click "Seed Built-ins" to load default templates</p>
                  <button onClick={() => templatesApi.seed().then(() => { toast.success('Seeded'); load() }).catch(e => toast.error(e.message))}
                    className="btn btn-primary btn-sm">
                    <Code className="w-3.5 h-3.5" /> Seed Built-ins
                  </button>
                </div>
              </div>
            </div>
          ) : filtered.map(tmpl => (
            <div key={tmpl.id} className="card group animate-fade-in-up">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate group-hover:text-nm-400 transition-colors">{tmpl.name}</h3>
                  {tmpl.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{tmpl.description}</p>
                  )}
                </div>
                {tmpl.is_builtin && (
                  <span className="badge badge-blue text-[10px] ml-2 shrink-0">
                    Built-in
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="badge bg-white/[0.04] text-slate-400 border-white/[0.08] text-[10px]">
                  <Server className="w-2.5 h-2.5" /> {tmpl.vendor.replace('_', ' ').toUpperCase()}
                </span>
                <span className="badge bg-white/[0.04] text-slate-400 border-white/[0.08] text-[10px]">
                  <Tag className="w-2.5 h-2.5" /> {tmpl.category}
                </span>
              </div>
              <div className="flex gap-2 pt-3 border-t border-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handlePreview(tmpl)} className="btn btn-ghost btn-xs flex-1">
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
                {!tmpl.is_builtin && (
                  <button onClick={() => handleDelete(tmpl.id, tmpl.name)} className="btn btn-ghost btn-xs text-red-400 hover:text-red-300">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="modal-overlay" onClick={() => setPreviewTemplate(null)}>
          <div className="modal-content max-w-3xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">{previewTemplate.name}</h2>
              <button onClick={() => setPreviewTemplate(null)} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Template Body */}
            <div className="mb-4">
              <label className="form-label mb-2 block">Template (Jinja2)</label>
              <pre className="text-xs font-mono text-slate-300 max-h-48">{previewTemplate.template_body}</pre>
            </div>

            {/* Variables */}
            {previewTemplate.variables && (
              <div className="mb-4">
                <label className="form-label mb-2 block">Variables</label>
                <div className="space-y-2">
                  {Object.entries(
                    previewTemplate.variables.properties || {}
                  ).map(([key, val]: [string, any]) => (
                    <div key={key} className="grid grid-cols-3 gap-2 items-center">
                      <label className="text-xs text-slate-400 font-mono">{key}</label>
                      <input
                        className="input col-span-2 text-sm"
                        placeholder={val.description || key}
                        value={previewVars[key] || ''}
                        onChange={e => setPreviewVars({...previewVars, [key]: e.target.value})}
                      />
                    </div>
                  ))}
                </div>
                <button onClick={runPreview} className="btn btn-primary btn-sm mt-3">
                  <Play className="w-3.5 h-3.5" /> Render
                </button>
              </div>
            )}

            {/* Rendered Output */}
            {previewResult && (
              <div>
                <label className="form-label mb-2 block">
                  Rendered Config ({previewResult.command_count} commands)
                </label>
                <pre className="text-xs font-mono text-green-400 max-h-64">{previewResult.rendered_config}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <CreateTemplateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
        />
      )}
    </div>
  )
}

function CreateTemplateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<TemplateCreateData>({
    name: '', description: '', vendor: 'cisco_ios', category: 'general',
    template_body: '', tags: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await templatesApi.create(form)
      toast.success('Template created')
      onCreated()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-5">Create Template</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="input" required value={form.name}
                onChange={e => setForm({...form, name: e.target.value})} placeholder="My Custom Template" />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="input select" value={form.category}
                onChange={e => setForm({...form, category: e.target.value})}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="input" value={form.description || ''}
              onChange={e => setForm({...form, description: e.target.value})} placeholder="What does this template do?" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Vendor</label>
              <select className="input select" value={form.vendor}
                onChange={e => setForm({...form, vendor: e.target.value})}>
                {VENDORS.map(v => (
                  <option key={v} value={v}>{v.replace('_', ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tags</label>
              <input className="input" placeholder="vlan,l2,access" value={form.tags || ''}
                onChange={e => setForm({...form, tags: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              Template Body (Jinja2) *
              <span className="text-xs text-slate-500 ml-2 font-normal">Use {'{{ variable_name }}'} for variables</span>
            </label>
            <textarea className="input font-mono text-sm min-h-[200px]" required
              placeholder={`interface {{ interface }}\n switchport mode access\n switchport access vlan {{ vlan_id }}\n description {{ description }}\n exit`}
              value={form.template_body}
              onChange={e => setForm({...form, template_body: e.target.value})} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
