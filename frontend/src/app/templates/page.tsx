'use client'

import { useState, useEffect } from 'react'
import { templatesApi, TemplateData, TemplateCreateData } from '@/lib/api'
import { FileText, Plus, Trash2, Eye, Play, Search, Code, X } from 'lucide-react'
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
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Config Templates</h1>
          <p className="text-slate-400 mt-1">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => templatesApi.seed().then(() => { toast.success('Built-in templates seeded'); load() }).catch(e => toast.error(e.message))}
            className="btn btn-secondary btn-sm">
            <Code className="w-4 h-4" /> Seed Built-ins
          </button>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">
            <Plus className="w-4 h-4" /> Create Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-10" placeholder="Search templates..." value={search}
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

      {loading ? <LoadingSkeleton /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              No templates found. Click "Seed Built-ins" to load default templates.
            </div>
          ) : filtered.map(tmpl => (
            <div key={tmpl.id} className="card hover:border-slate-600/50 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white truncate">{tmpl.name}</h3>
                  {tmpl.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{tmpl.description}</p>
                  )}
                </div>
                {tmpl.is_builtin && (
                  <span className="badge bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs ml-2 shrink-0">
                    Built-in
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="badge bg-slate-800 border-slate-700 text-xs">
                  {tmpl.vendor.replace('_', ' ').toUpperCase()}
                </span>
                <span className="badge bg-slate-800 border-slate-700 text-xs">
                  {tmpl.category}
                </span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handlePreview(tmpl)} className="btn btn-secondary btn-sm flex-1">
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
                {!tmpl.is_builtin && (
                  <button onClick={() => handleDelete(tmpl.id, tmpl.name)} className="btn btn-danger btn-sm">
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
          <div className="card w-full max-w-3xl mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{previewTemplate.name}</h2>
              <button onClick={() => setPreviewTemplate(null)} className="btn btn-secondary btn-sm">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Template Body */}
            <div className="mb-4">
              <label className="text-sm text-slate-400 mb-1 block">Template (Jinja2)</label>
              <pre className="bg-slate-900 rounded-lg p-3 text-xs font-mono text-slate-300 overflow-x-auto max-h-48 border border-slate-700">
                {previewTemplate.template_body}
              </pre>
            </div>

            {/* Variables */}
            {previewTemplate.variables && (
              <div className="mb-4">
                <label className="text-sm text-slate-400 mb-2 block">Variables</label>
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
                <label className="text-sm text-slate-400 mb-1 block">
                  Rendered Config ({previewResult.command_count} commands)
                </label>
                <pre className="bg-slate-900 rounded-lg p-3 text-xs font-mono text-green-400 overflow-x-auto max-h-64 border border-slate-700">
                  {previewResult.rendered_config}
                </pre>
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
      <div className="card w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-4">Create Template</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Name *</label>
              <input className="input" required value={form.name}
                onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Category</label>
              <select className="input select" value={form.category}
                onChange={e => setForm({...form, category: e.target.value})}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Description</label>
            <input className="input" value={form.description || ''}
              onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Vendor</label>
              <select className="input select" value={form.vendor}
                onChange={e => setForm({...form, vendor: e.target.value})}>
                {VENDORS.map(v => (
                  <option key={v} value={v}>{v.replace('_', ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Tags</label>
              <input className="input" placeholder="vlan,l2,access" value={form.tags || ''}
                onChange={e => setForm({...form, tags: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">
              Template Body (Jinja2) *
              <span className="text-xs text-slate-500 ml-2">Use {'{{ variable_name }}'} for variables</span>
            </label>
            <textarea className="input font-mono text-sm min-h-[200px]" required
              placeholder={`interface {{ interface }}\n switchport mode access\n switchport access vlan {{ vlan_id }}\n description {{ description }}\n exit`}
              value={form.template_body}
              onChange={e => setForm({...form, template_body: e.target.value})} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1,2,3,4,5,6].map(i => (
        <div key={i} className="card h-32"><div className="skeleton h-full w-full" /></div>
      ))}
    </div>
  )
}
