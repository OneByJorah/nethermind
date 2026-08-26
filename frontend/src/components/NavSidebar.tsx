'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { classNames } from '@/lib/utils'
import {
  LayoutDashboard,
  Network,
  FileText,
  MessageSquare,
  GitBranch, GitCompare,
  Shield,
  Map,
  Activity,
  Zap,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Switches', href: '/switches', icon: Network },
  { label: 'Configs', href: '/configs', icon: FileText },
  { label: 'Config Diff', href: '/config-diff', icon: GitCompare },
  { label: 'Templates', href: '/templates', icon: FileText },
  { label: 'Nethermind Chat', href: '/chat', icon: MessageSquare },
  { label: 'Workflows', href: '/workflows', icon: GitBranch },
  { label: 'Security', href: '/security', icon: Shield },
  { label: 'Topology', href: '/topology', icon: Map },
  { label: 'Metrics', href: '/metrics', icon: Activity },
]

export function NavSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base text-white">Nethermind</h1>
            <p className="text-xs text-slate-400">Switch Manager</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={classNames(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
              )}
            >
              <Icon className="w-4.5 h-4.5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <p className="text-xs text-slate-500">
          v1.0.0 &middot; Nethermind AI
        </p>
      </div>
    </aside>
  )
}
