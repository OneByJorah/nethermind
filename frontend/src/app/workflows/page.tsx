'use client'

import { useState, useEffect } from 'react'
import { workflowsApi, switchesApi, WorkflowData, SwitchData } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import { GitBranch, Plus, Play, CheckCircle, XCircle, ChevronRight, Loader2, Clock, User, Ticket, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

const STEP_LABELS: Record<string, string> = {
  discover: 'Discover',
  verify: 'Verify',
  propose: 'Propose',
  confirm: 'Confirm',
  execute: 'Execute',
  verify_done: 'Verify',
  document: 'Document',
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowData[]>([])
  const [switches, setSwitches] = useState<SwitchData[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = () => {
    Promise.all([workflowsApi.list(), switchesApi.list()])
      .then(([w, s]) => { setWorkflows(w); setSwitches(s) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleAdvance = async (wf: WorkflowData) => {
    try {
      const result = await workflowsApi.advance(wf.id, true)
      toast.success(`Advanced to: ${result.status}`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const handleExecute = async (wfId: number, stepId: number) => {
    try {
      await workflowsApi.executeStep(wfId, stepId)
      toast.success('Step executed')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Workflows</h1>
          <p className="text-sm text-slate-500 mt-1">IRIS-style change management with approval gates</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">
          <Plus className="w-3.5 h-3.5" /> New Workflow
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="card h-32"><div className="skeleton h-full w-full rounded-xl" /></div>)}
        </div>
      ) : workflows.length === 0 ? (
        <div className="card">
          <div className="empty-state py-12">
            <div className="empty-state-icon bg-amber-500/10">
              <GitBranch className="w-7 h-7 text-amber-400" />
            </div>
            <p className="text-sm text-slate-400 font-medium mb-1">No workflows yet</p>
            <p className="text-xs text-slate-600 mb-4">Create a workflow to manage network changes</p>
            <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">
              <Plus className="w-3.5 h-3.5" /> Create Workflow
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 stagger-children">
          {workflows.map(wf => {
            const totalSteps = wf.steps?.length || 7
            const completedSteps = wf.steps?.filter(s => s.status === 'completed').length || 0
            const progress = Math.round((completedSteps / totalSteps) * 100)
            const currentStep = wf.steps?.find(s => s.status === 'running')

            return (
              <div key={wf.id} className="card animate-fade-in-up group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-white group-hover:text-nm-400 transition-colors">{wf.title}</h3>
                      <span className={`badge text-[10px] ${
                        wf.status === 'completed' ? 'badge-green' :
                        wf.status === 'failed' ? 'badge-red' :
                        'badge-blue'
                      }`}>
                        {wf.status}
                      </span>
                    </div>
                    {wf.description && <p className="text-sm text-slate-500 mt-1">{wf.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500">
                      {wf.created_by && (
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{wf.created_by}</span>
                      )}
                      {wf.ticket_ref && (
                        <span className="flex items-center gap-1"><Ticket className="w-3 h-3" />{wf.ticket_ref}</span>
                      )}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(wf.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {wf.status !== 'completed' && wf.status !== 'failed' && (
                      <button onClick={() => handleAdvance(wf)} className="btn btn-primary btn-sm">
                        <Play className="w-3.5 h-3.5" /> Advance
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">Progress</span>
                    <span className="text-[11px] text-slate-400 font-semibold">{completedSteps}/{totalSteps} steps</span>
                  </div>
                  <div className="progress-bar">
                    <div className={`progress-bar-fill ${progress === 100 ? 'green' : ''}`} style={{ width: `${progress}%` }} />
                  </div>
                </div>

                {/* Workflow Pipeline */}
                {wf.steps && wf.steps.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {wf.steps.map((step, i) => {
                      const isCompleted = step.status === 'completed'
                      const isRunning = step.status === 'running'
                      const isFailed = step.status === 'failed'
                      return (
                        <div key={step.id} className="flex items-center">
                          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                            isCompleted ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                            isRunning ? 'bg-nm-500/10 border-nm-500/20 text-nm-400' :
                            isFailed ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                            'bg-white/[0.02] border-white/[0.06] text-slate-500'
                          }`}>
                            {isCompleted && <CheckCircle className="w-3 h-3" />}
                            {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
                            {isFailed && <XCircle className="w-3 h-3" />}
                            {STEP_LABELS[step.step_type] || step.step_type}
                          </div>
                          {i < wf.steps.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-slate-700 mx-1 flex-shrink-0" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreateWorkflowModal
          switches={switches}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
        />
      )}
    </div>
  )
}

function CreateWorkflowModal({ switches, onClose, onCreated }: {
  switches: SwitchData[]; onClose: () => void; onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedSwitches, setSelectedSwitches] = useState<number[]>([])
  const [ticketRef, setTicketRef] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      await workflowsApi.create({
        title,
        description,
        switch_ids: selectedSwitches.join(','),
        ticket_ref: ticketRef,
      })
      toast.success('Workflow created')
      onCreated()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-5">Create Workflow</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="input" required value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Update OSPF config on core switches" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="input" rows={2} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What change needs to be made?" />
          </div>
          <div className="form-group">
            <label className="form-label">Target Switches</label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              {switches.map(sw => (
                <label key={sw.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors">
                  <input type="checkbox" checked={selectedSwitches.includes(sw.id)}
                    onChange={() => setSelectedSwitches(prev =>
                      prev.includes(sw.id) ? prev.filter(id => id !== sw.id) : [...prev, sw.id]
                    )} className="rounded border-slate-600 bg-surface-3" />
                  <span className="text-sm text-slate-300">{sw.hostname}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Ticket Reference</label>
            <input className="input" value={ticketRef} onChange={e => setTicketRef(e.target.value)}
              placeholder="e.g., INC-12345" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Creating...' : 'Create Workflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
