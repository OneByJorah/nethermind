'use client'

import { useState, useRef, useEffect } from 'react'
import { chatStreamFetch, chatApi } from '@/lib/api'
import { generateSessionId } from '@/lib/utils'
import { MessageSquare, Send, Trash2, Zap, Loader2, Sparkles, Bot, User } from 'lucide-react'
import toast from 'react-hot-toast'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export default function ChatPage() {
  const [sessionId] = useState(() => generateSessionId())
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: "Hello! I'm **Nethermind**, your AI network engineer assistant. I can help you manage your network switches, pull configurations, check device health, and more.\n\nTry asking me:\n- \"Show me all my switches\"\n- \"Pull the latest config from switch 1\"\n- \"Check the health of all my devices\"\n- \"Run a security audit on switch 1\"\n- \"What's the network dashboard look like?\""
  }])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages])

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg || streaming) return
    setInput('')
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    let fullContent = ''
    await chatStreamFetch(
      sessionId,
      msg,
      (token) => {
        fullContent += token
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: fullContent }
          return updated
        })
      },
      () => setStreaming(false),
      (err) => {
        toast.error(`Error: ${err.message}`)
        setStreaming(false)
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: `Error: ${err.message}` }
          return updated
        })
      }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = async () => {
    try {
      await chatApi.clear(sessionId)
      setMessages([{
        role: 'assistant',
        content: "Chat cleared. How can I help you with your network?"
      }])
      toast.success('Chat cleared')
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nm-500/20 to-purple-500/20 flex items-center justify-center border border-nm-500/20">
              <Sparkles className="w-5 h-5 text-nm-400" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-surface-2 pulse-dot" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Nethermind AI</h1>
            <p className="text-sm text-slate-500">Network engineer assistant powered by GPT-4</p>
          </div>
        </div>
        <button onClick={handleClear} className="btn btn-ghost btn-sm">
          <Trash2 className="w-3.5 h-3.5" /> Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 px-1 pb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-nm-500/10 flex items-center justify-center mr-3 mt-1 flex-shrink-0 border border-nm-500/20">
                <Bot className="w-4 h-4 text-nm-400" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 ${
              msg.role === 'user'
                ? 'bg-gradient-to-br from-nm-500/15 to-nm-600/10 border border-nm-500/20 text-white'
                : 'bg-white/[0.04] border border-white/[0.06] text-slate-200'
            }`}>
              {msg.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              ) : (
                <div className="chat-message text-sm leading-relaxed">
                  <StreamingMessage content={msg.content} />
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center ml-3 mt-1 flex-shrink-0 border border-white/[0.08]">
                <User className="w-4 h-4 text-slate-400" />
              </div>
            )}
          </div>
        ))}
        {streaming && (
          <div className="flex justify-start animate-fade-in">
            <div className="w-8 h-8 rounded-lg bg-nm-500/10 flex items-center justify-center mr-3 flex-shrink-0 border border-nm-500/20">
              <Bot className="w-4 h-4 text-nm-400" />
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-5 py-3.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-nm-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-nm-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-nm-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="mt-auto pt-4 border-t border-white/[0.06]">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              className="input resize-none min-h-[48px] max-h-32 pr-12"
              rows={1}
              placeholder="Ask Nethermind about your network..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              style={{ height: 'auto', minHeight: '48px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 128) + 'px'
              }}
            />
          </div>
          <button onClick={handleSend} disabled={streaming || !input.trim()}
            className="btn btn-primary h-12 w-12 p-0 flex-shrink-0">
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[11px] text-slate-600 mt-2">Press Enter to send, Shift+Enter for new line</p>
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function StreamingMessage({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const code = part.replace(/```\w*\n?/, '').replace(/```$/, '')
          return <pre key={i} className="my-2 text-xs">{code}</pre>
        }
        let html = escapeHtml(part)
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-nm-400 font-semibold">$1</strong>')
        html = html.replace(/`([^`]+)`/g, '<code class="text-green-400 bg-white/[0.05] px-1.5 py-0.5 rounded text-[13px]">$1</code>')
        html = html.replace(/\n/g, '<br/>')
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
      })}
    </>
  )
}
