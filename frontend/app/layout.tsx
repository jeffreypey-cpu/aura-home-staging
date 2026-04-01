import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Aura Home Staging',
  description: 'AI Operations Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <nav style={{ backgroundColor: '#0f1f3d' }} className="py-4 px-6 flex items-center justify-between shadow-md">
          <span style={{ color: '#c9a84c' }} className="text-xl font-bold tracking-wide">
            Aura Home Staging
          </span>
          <div className="flex gap-6">
            {[
              { href: '/dashboard', label: 'Dashboard' },
              { href: '/approvals', label: 'Approvals' },
              { href: '/projects', label: 'Projects' },
              { href: '/intake', label: 'Intake' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-white hover:text-yellow-300 transition-colors text-sm font-medium"
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
