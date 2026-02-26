import type { Metadata } from 'next'
import './globals.css'
import Nav, { NavLinks } from './components/Nav'
import Providers from './components/Providers'
import UserMenu from './components/UserMenu'
import { Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'GitHub Oversight - SnickerSec',
  description: 'Repository oversight dashboard for SnickerSec',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <header className="border-b border-border bg-card sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 py-3 lg:py-4 flex items-center justify-between relative">
              <div className="flex items-center gap-2 lg:gap-6">
                <div className="flex items-center gap-2 lg:gap-3">
                  <Github className="w-7 h-7 lg:w-8 lg:h-8 text-[var(--foreground)]" />
                  <h1 className="text-lg lg:text-xl font-semibold hidden sm:block">Oversight</h1>
                </div>
                <NavLinks />
              </div>
              <div className="flex items-center gap-2 lg:gap-4">
                <Nav />
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
