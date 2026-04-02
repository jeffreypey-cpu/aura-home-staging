'use client';
import { useState } from 'react';
import { createProject, parseIntakeMessage } from '@/lib/api';
import AuthGuard from '@/components/AuthGuard';

const emptyForm = {
  client_name: '',
  client_phone: '',
  client_email: '',
  property_address: '',
  contract_price: '',
  staging_date: '',
  notes: '',
};

export default function IntakePage() {
  const [tab, setTab] = useState<'manual' | 'parse'>('manual');
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [rawMessage, setRawMessage] = useState('');
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessId(null);
    try {
      const result = await createProject({
        ...form,
        contract_price: Number(form.contract_price),
      });
      setSuccessId(result.id);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    setParsing(true);
    setParseError(null);
    setParsed(null);
    try {
      const result = await parseIntakeMessage(rawMessage);
      setParsed(result);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse message');
    } finally {
      setParsing(false);
    }
  };

  const handleCreateFromParsed = async () => {
    if (!parsed) return;
    setSubmitting(true);
    setError(null);
    setSuccessId(null);
    try {
      const result = await createProject(parsed as Parameters<typeof createProject>[0]);
      setSuccessId(result.id);
      setParsed(null);
      setRawMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const labelClass = 'block text-xs font-semibold mb-1.5 uppercase tracking-wider';
  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    color: '#ffffff',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    outline: 'none',
  };

  return (
    <AuthGuard>
    <div>
      <h1 className="text-sm font-semibold tracking-widest uppercase mb-6" style={{ color: '#999999' }}>
        Project Intake
      </h1>

      <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid #2a2a2a', paddingBottom: 0 }}>
        {(['manual', 'parse'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 md:flex-none px-5 py-3 text-xs tracking-widest uppercase font-semibold transition-colors min-h-[44px]"
            style={
              tab === t
                ? { color: '#ffffff', borderBottom: '2px solid #c9a84c', marginBottom: -1 }
                : { color: '#999999', borderBottom: '2px solid transparent', marginBottom: -1 }
            }
          >
            {t === 'manual' ? 'Manual Entry' : 'Parse Message'}
          </button>
        ))}
      </div>

      <div className="rounded-xl p-4 md:p-8" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
        {tab === 'manual' ? (
          <form onSubmit={handleManualSubmit} className="space-y-4 w-full max-w-lg">
            {successId && (
              <div className="rounded p-3 text-xs" style={{ backgroundColor: '#1a2a1a', border: '1px solid #4ade80', color: '#4ade80' }}>
                Project created! ID: <span className="font-mono">{successId}</span>
              </div>
            )}
            {error && (
              <div className="rounded p-3 text-xs" style={{ backgroundColor: '#2a1a1a', border: '1px solid #ef4444', color: '#ef4444' }}>
                {error}
              </div>
            )}
            {[
              { label: 'Client Name', key: 'client_name', type: 'text', required: true },
              { label: 'Phone', key: 'client_phone', type: 'tel', required: true },
              { label: 'Email', key: 'client_email', type: 'email', required: true },
              { label: 'Property Address', key: 'property_address', type: 'text', required: true },
              { label: 'Contract Price ($)', key: 'contract_price', type: 'number', required: true },
              { label: 'Staging Date', key: 'staging_date', type: 'date', required: true },
            ].map(({ label, key, type, required }) => (
              <div key={key}>
                <label className={labelClass} style={{ color: '#999999' }}>{label}</label>
                <input
                  type={type}
                  required={required}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = '#c9a84c')}
                  onBlur={(e) => (e.target.style.borderColor = '#2a2a2a')}
                />
              </div>
            ))}
            <div>
              <label className={labelClass} style={{ color: '#999999' }}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={(e) => (e.target.style.borderColor = '#c9a84c')}
                onBlur={(e) => (e.target.style.borderColor = '#2a2a2a')}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded text-black text-xs font-semibold tracking-widest uppercase disabled:opacity-50 transition-opacity hover:opacity-80 min-h-[44px]"
              style={{ backgroundColor: '#c9a84c' }}
            >
              {submitting ? 'Creating…' : 'Create Project'}
            </button>
          </form>
        ) : (
          <div className="w-full max-w-lg space-y-4">
            <form onSubmit={handleParse} className="space-y-4">
              <div>
                <label className={labelClass} style={{ color: '#999999' }}>
                  Raw WhatsApp / SMS Message
                </label>
                <textarea
                  value={rawMessage}
                  onChange={(e) => setRawMessage(e.target.value)}
                  rows={6}
                  required
                  placeholder="Paste the client message here…"
                  style={{ ...inputStyle, resize: 'vertical' }}
                  onFocus={(e) => (e.target.style.borderColor = '#c9a84c')}
                  onBlur={(e) => (e.target.style.borderColor = '#2a2a2a')}
                />
              </div>
              <button
                type="submit"
                disabled={parsing}
                className="w-full md:w-auto py-3 px-8 rounded text-black text-xs font-semibold tracking-widest uppercase disabled:opacity-50 transition-opacity hover:opacity-80 min-h-[44px]"
                style={{ backgroundColor: '#c9a84c' }}
              >
                {parsing ? 'Parsing…' : 'Parse Message'}
              </button>
            </form>

            {parseError && (
              <div className="rounded p-3 text-xs" style={{ backgroundColor: '#2a1a1a', border: '1px solid #ef4444', color: '#ef4444' }}>
                {parseError}
              </div>
            )}

            {parsed && (
              <div className="space-y-3">
                <pre
                  className="rounded p-4 text-xs overflow-x-auto"
                  style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#cccccc' }}
                >
                  {JSON.stringify(parsed, null, 2)}
                </pre>
                <button
                  onClick={handleCreateFromParsed}
                  disabled={submitting}
                  className="w-full md:w-auto py-3 px-8 rounded text-black text-xs font-semibold tracking-widest uppercase disabled:opacity-50 transition-opacity hover:opacity-80 min-h-[44px]"
                  style={{ backgroundColor: '#c9a84c' }}
                >
                  {submitting ? 'Creating…' : 'Create Project from this data'}
                </button>
                {successId && (
                  <div className="rounded p-3 text-xs" style={{ backgroundColor: '#1a2a1a', border: '1px solid #4ade80', color: '#4ade80' }}>
                    Project created! ID: <span className="font-mono">{successId}</span>
                  </div>
                )}
                {error && (
                  <div className="rounded p-3 text-xs" style={{ backgroundColor: '#2a1a1a', border: '1px solid #ef4444', color: '#ef4444' }}>
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </AuthGuard>
  );
}
