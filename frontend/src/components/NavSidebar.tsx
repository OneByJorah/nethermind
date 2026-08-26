'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { classNames } from '@/lib/utils'
import { useState } from 'react'
import {
  LayoutDashboard,
  Network,
  FileText,
  MessageSquare,
  GitBranch,
  GitCompare,
  Shield,
  Map,
  Activity,
  Zap,
  ChevronDown,
  ChevronRight,
  Settings,
  HelpCircle,
  LogOut,
  Terminal,
  Search,
  Bell,
} from 'lucide-react'

interface NavGroup {
  label: string
  items: NavItem[]
}

interface NavItem {
  label: string
  href: string
  icon: any
  badge?: number
  badgeColor?: string
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Switches', href: '/switches', icon: Network },
      { label: 'Metrics', href: '/metrics', icon: Activity },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { label: 'Configs', href: '/configs', icon: FileText },
      { label: 'Config Diff', href: '/config-diff', icon: GitCompare },
      { label: 'Templates', href: '/templates', icon: Terminal },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Nethermind Chat', href: '/chat', icon: MessageSquare },
      { label: 'Workflows', href: '/workflows', icon: GitBranch },
      { label: 'Security', href: '/security', icon: Shield },
      { label: 'Topology', href: '/topology', icon: Map },
    ],
  },
]

export function NavSidebar() {
  const pathname = usePathname()
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <aside className="w-[260px] h-screen flex flex-col bg-surface-1 border-r border-white/[0.06] relative z-20">
      {/* Brand */}
      <div className="p-5 border-b border-white/[0.06]">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nm-500 to-nm-700 flex items-center justify-center shadow-glow-blue group-hover:shadow-[0_0_24px_rgba(51,102,255,0.3)] transition-shadow duration-300">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-surface-1 pulse-dot" />
          </div>
          <div>
            <h1 className="font-bold text-[15px] text-white tracking-tight">Nethermind</h1>
            <p className="text-[11px] text-slate-500 font-medium">Network Intelligence</p>
          </div>
        </Link>
      </div>

      {/* Search */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-9 pr-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-slate-400 placeholder-slate-600 focus:outline-none focus:border-nm-500/50 focus:ring-1 focus:ring-nm-500/20 transition-all"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.06]">⌘K</kbd>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {navGroups.map((group) => {
          const isCollapsed = collapsedGroups[group.label]
          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className="flex items-center justify-between w-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 hover:text-slate-400 transition-colors"
              >
                {group.label}
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
              {!isCollapsed && (
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={classNames(
                          'sidebar-item',
                          isActive && 'active'
                        )}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {item.badge !== undefined && (
                          <span className={classNames(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                            item.badgeColor || 'bg-nm-500/20 text-nm-400'
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.06] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-500 hover:text-slate-300 transition-colors">
            <Bell className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-500 hover:text-slate-300 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-500 hover:text-slate-300 transition-colors">
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nm-500/20 to-purple-500/20 flex items-center justify-center text-xs font-bold text-nm-400 border border-nm-500/20">
            NJ
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">Admin</p>
            <p className="text-[10px] text-slate-500 truncate">admin@nethermind</p>
          </div>
          <button className="p-1 rounded hover:bg-white/[0.05] text-slate-500 hover:text-slate-300 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-slate-600 text-center">v1.0.0 · Nethermind AI</p>
      </div>
    </aside>
  )
}
