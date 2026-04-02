'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/auth';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/dashboard', label: 'DASHBOARD' },
  { href: '/approvals', label: 'APPROVALS' },
  { href: '/projects', label: 'PROJECTS' },
  { href: '/intake', label: 'INTAKE' },
  { href: '/inventory', label: 'INVENTORY' },
  { href: '/vendors', label: 'VENDORS' },
  { href: '/analytics', label: 'ANALYTICS' },
  { href: '/employees', label: 'EMPLOYEES' },
  { href: '/schedule', label: 'SCHEDULE' },
];

export default function Nav() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleSignOut = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav
      className="px-4 md:px-8"
      style={{ backgroundColor: '#0a0a0a', borderBottom: '1px solid #2a2a2a' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between h-14">
        <span className="text-sm font-semibold tracking-widest" style={{ color: '#c9a84c' }}>
          AURA HOME STAGING
        </span>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-white hover:text-yellow-400 transition-colors text-xs tracking-widest"
            >
              {label}
            </Link>
          ))}
          <button
            onClick={handleSignOut}
            className="text-xs tracking-widest transition-colors hover:text-red-400"
            style={{ color: '#999999' }}
          >
            SIGN OUT
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex items-center justify-center w-11 h-11 rounded"
          style={{ color: '#999999' }}
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div
          className="md:hidden fixed inset-0 top-14 z-50 flex flex-col py-8 px-6 gap-6"
          style={{ backgroundColor: '#0a0a0a', borderTop: '1px solid #2a2a2a' }}
        >
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="text-white text-sm font-semibold tracking-widest uppercase py-3 border-b transition-colors hover:text-yellow-400"
              style={{ borderColor: '#1a1a1a' }}
            >
              {label}
            </Link>
          ))}
          <button
            onClick={() => { setOpen(false); handleSignOut(); }}
            className="text-left text-sm font-semibold tracking-widest uppercase py-3 transition-colors hover:text-red-400"
            style={{ color: '#999999' }}
          >
            SIGN OUT
          </button>
        </div>
      )}
    </nav>
  );
}
