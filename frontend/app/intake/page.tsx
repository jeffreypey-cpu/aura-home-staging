'use client';
import { useState } from 'react';
import { createProject, parseIntakeMessage } from '@/lib/api';

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

  const labelClass = 'block text-sm font-semibold mb-1';
  const inputClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400';

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#0f1f3d' }}>
        Project Intake
      </h1>

      <div className="flex gap-2 mb-6">
        {(['manual', 'parse'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t
                ? 'text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
            style={tab === t ? { backgroundColor: '#0f1f3d' } : {}}
          >
            {t === 'manual' ? 'Manual Entry' : 'Parse Message'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow p-8">
        {tab === 'manual' ? (
          <form onSubmit={handleManualSubmit} className="space-y-4 max-w-lg">
            {successId && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
                Project created! ID: <span className="font-mono">{successId}</span>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
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
                <label className={labelClass} style={{ color: '#0f1f3d' }}>
                  {label}
                </label>
                <input
                  type={type}
                  required={required}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className={inputClass}
                />
              </div>
            ))}
            <div>
              <label className={labelClass} style={{ color: '#0f1f3d' }}>
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50 transition-colors hover:opacity-90"
              style={{ backgroundColor: '#c9a84c' }}
            >
              {submitting ? 'Creating…' : 'Create Project'}
            </button>
          </form>
        ) : (
          <div className="max-w-lg space-y-4">
            <form onSubmit={handleParse} className="space-y-4">
              <div>
                <label className={labelClass} style={{ color: '#0f1f3d' }}>
                  Raw WhatsApp / SMS Message
                </label>
                <textarea
                  value={rawMessage}
                  onChange={(e) => setRawMessage(e.target.value)}
                  rows={6}
                  required
                  placeholder="Paste the client message here…"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={parsing}
                className="py-2.5 px-6 rounded-lg text-white font-semibold text-sm disabled:opacity-50 transition-colors hover:opacity-90"
                style={{ backgroundColor: '#c9a84c' }}
              >
                {parsing ? 'Parsing…' : 'Parse Message'}
              </button>
            </form>

            {parseError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {parseError}
              </div>
            )}

            {parsed && (
              <div className="space-y-3">
                <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-x-auto">
                  {JSON.stringify(parsed, null, 2)}
                </pre>
                <button
                  onClick={handleCreateFromParsed}
                  disabled={submitting}
                  className="py-2.5 px-6 rounded-lg font-semibold text-sm disabled:opacity-50 text-white transition-colors"
                  style={{ backgroundColor: '#0f1f3d' }}
                >
                  {submitting ? 'Creating…' : 'Create Project from this data'}
                </button>
                {successId && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
                    Project created! ID: <span className="font-mono">{successId}</span>
                  </div>
                )}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
