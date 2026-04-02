import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import HeatherChat from '@/components/HeatherChat'

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
        <Nav />
        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
        <HeatherChat />
      </body>
    </html>
  )
}
