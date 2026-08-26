import type { Metadata } from 'next'
import './globals.css'
import { NavSidebar } from '@/components/NavSidebar'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Nethermind — Network Intelligence',
  description: 'AI-powered network switch configuration management — multi-vendor SSH + serial, Jinja2 templates, AI agent, and security auditing.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <div className="ambient-bg" />
        <div className="flex h-screen overflow-hidden relative z-10">
          <NavSidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
              {children}
            </div>
          </main>
        </div>
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'rgba(15, 20, 34, 0.95)',
              backdropFilter: 'blur(20px)',
              color: '#f1f5f9',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              padding: '0.75rem 1rem',
              boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
            },
            success: { iconTheme: { primary: '#10b981', secondary: 'rgba(15,20,34,0.95)' } },
            error: { iconTheme: { primary: '#ef4444', secondary: 'rgba(15,20,34,0.95)' } },
          }}
        />
      </body>
    </html>
  )
}
