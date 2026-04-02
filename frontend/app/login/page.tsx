'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/auth';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      router.push('/dashboard');
    } else {
      setError('Incorrect password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a0a' }}>
      <div
        className="rounded-xl p-10 w-full max-w-sm"
        style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}
      >
        <h1
          className="text-sm font-semibold text-center mb-1 tracking-widest"
          style={{ color: '#c9a84c' }}
        >
          AURA HOME STAGING
        </h1>
        <p className="text-center mb-8 text-xs tracking-widest" style={{ color: '#999999' }}>
          ADMIN ACCESS
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Password"
            className="w-full rounded-lg p-3 text-sm focus:outline-none"
            style={{
              backgroundColor: '#0a0a0a',
              border: '1px solid #2a2a2a',
              color: '#ffffff',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#c9a84c')}
            onBlur={(e) => (e.target.style.borderColor = '#2a2a2a')}
            required
          />
          {error && (
            <p className="text-xs tracking-wide" style={{ color: '#ef4444' }}>{error}</p>
          )}
          <button
            type="submit"
            className="w-full rounded p-3 text-black text-xs font-semibold tracking-widest uppercase hover:opacity-80 transition-opacity"
            style={{ backgroundColor: '#c9a84c' }}
          >
            SIGN IN
          </button>
        </form>
      </div>
    </div>
  );
}
