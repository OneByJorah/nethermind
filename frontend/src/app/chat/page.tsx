'use client'

import { useState, useRef, useEffect } from 'react'
import { chatStreamFetch, chatApi } from '@/lib/api'
import { generateSessionId } from '@/lib/utils'
import { MessageSquare, Send, Trash2, Zap, Loader2 } from 'lucide-react'
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
          updated[updated.length - 1] = { role: 'assistant', content: `❌ Error: ${err.message}` }
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
    <div className="flex flex-col h-[calc(100vh-6rem)] fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Nethermind AI</h1>
            <p className="text-sm text-slate-400">Network engineer assistant</p>
          </div>
        </div>
        <button onClick={handleClear} className="btn btn-secondary btn-sm">
          <Trash2 className="w-3.5 h-3.5" /> Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 px-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} fade-in`}>
            <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${
              msg.role === 'user'
                ? 'bg-blue-500/10 border border-blue-500/20 text-white'
                : 'bg-slate-800/80 border border-slate-700/50 text-slate-200'
            }`}>
              {msg.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="chat-message text-sm">
                  <StreamingMessage content={msg.content} />
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2">
        <textarea
          className="input flex-1 resize-none"
          rows={2}
          placeholder="Ask Nethermind about your network..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
        />
        <button onClick={handleSend} disabled={streaming || !input.trim()}
          className="btn btn-primary self-end">
          {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-1">Press Enter to send, Shift+Enter for new line</p>
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
  // Simple markdown-like rendering (input is HTML-escaped first to prevent XSS)
  const parts = content.split(/(```[\s\S]*?```)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const code = part.replace(/```\w*\n?/, '').replace(/```$/, '')
          return <pre key={i} className="my-2">{code}</pre>
        }
        let html = escapeHtml(part)
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-300">$1</strong>')
        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code class="text-green-300 bg-slate-900 px-1 rounded">$1</code>')
        // Line breaks
        html = html.replace(/\n/g, '<br/>')
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
      })}
    </>
  )
}
