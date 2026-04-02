'use client';
import { useState, useEffect } from 'react';

const gold = '#c9a84c';
const API = '/api';

interface Employee {
  id: string;
  name: string;
  phone?: string;
  role?: string;
  email?: string;
  status?: string;
  last_clockin?: string;
  last_clockout?: string;
}

interface Project {
  id: string;
  property_address: string;
  client_name: string;
  status: string;
}

function statusColor(status?: string) {
  if (status === 'clocked_in') return '#22c55e';
  if (status === 'clocked_out') return '#666';
  return '#444';
}

function statusLabel(status?: string) {
  if (status === 'clocked_in') return 'Clocked In';
  if (status === 'clocked_out') return 'Clocked Out';
  return 'Inactive';
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [linkModal, setLinkModal] = useState<{ employee: Employee } | null>(null);
  const [selectedProject, setSelectedProject] = useState('');
  const [linkResult, setLinkResult] = useState<{ url: string; preview: string } | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  // New employee form
  const [form, setForm] = useState({ name: '', phone: '', role: '', email: '', pin: '', whatsapp_number: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, projRes] = await Promise.all([
        fetch(`${API}/employees/`),
        fetch(`${API}/intake/`),
      ]);
      const empData = await empRes.json();
      const projData = await projRes.json();
      setEmployees(Array.isArray(empData) ? empData : []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setProjects(Array.isArray(projData) ? projData.filter((p: any) => p.project_status === 'active' || p.approval_status === 'approved') : []);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`${API}/employees/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.id) {
        setEmployees(prev => [...prev, data]);
        setForm({ name: '', phone: '', role: '', email: '', pin: '', whatsapp_number: '' });
        setSaveMsg('Employee added successfully');
        setTimeout(() => { setSaveMsg(''); setShowAdd(false); }, 1500);
        loadData();
      } else {
        setSaveMsg(data.error || 'Failed to create employee');
      }
    } catch { setSaveMsg('Connection error'); } finally {
      setSaving(false);
    }
  };

  const handleSendLink = async () => {
    if (!linkModal) return;
    setLinkLoading(true);
    setLinkResult(null);
    try {
      const res = await fetch(`${API}/employees/send-clockin-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: linkModal.employee.id,
          project_id: selectedProject || undefined,
        }),
      });
      const data = await res.json();
      if (data.clockin_url) {
        setLinkResult({ url: data.clockin_url, preview: data.message_preview });
      }
    } catch { /* ignore */ } finally {
      setLinkLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8" style={{ backgroundColor: '#0a0a0a', color: '#fff' }}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Employees</h1>
            <p className="text-sm mt-0.5" style={{ color: '#555' }}>Manage team & send clock-in links</p>
          </div>
          <button
            onClick={() => setShowAdd(s => !s)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ backgroundColor: gold, color: '#000' }}
          >
            + Add Employee
          </button>
        </div>

        {/* Add Employee Form */}
        {showAdd && (
          <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
            <p className="text-sm font-semibold text-white mb-4">New Employee</p>
            {saveMsg && (
              <div className="rounded-lg px-3 py-2 text-xs mb-4" style={{ backgroundColor: saveMsg.includes('success') ? '#1a2a1a' : '#2a1a1a', border: `1px solid ${saveMsg.includes('success') ? '#4ade80' : '#ef4444'}`, color: saveMsg.includes('success') ? '#4ade80' : '#ef4444' }}>
                {saveMsg}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Name *"
                className="px-3 py-2 rounded-lg text-sm bg-transparent text-white outline-none"
                style={{ border: '1px solid #2a2a2a' }}
              />
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="px-3 py-2 rounded-lg text-sm bg-transparent text-white outline-none"
                style={{ border: '1px solid #2a2a2a', backgroundColor: '#0a0a0a' }}
              >
                <option value="">Role</option>
                {['Stager', 'Driver', 'Warehouse', 'Lead Stager', 'Assistant'].map(r => (
                  <option key={r} value={r.toLowerCase().replace(' ', '_')}>{r}</option>
                ))}
              </select>
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Phone"
                className="px-3 py-2 rounded-lg text-sm bg-transparent text-white outline-none"
                style={{ border: '1px solid #2a2a2a' }}
              />
              <input
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="Email"
                type="email"
                className="px-3 py-2 rounded-lg text-sm bg-transparent text-white outline-none"
                style={{ border: '1px solid #2a2a2a' }}
              />
              <input
                value={form.whatsapp_number}
                onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value }))}
                placeholder="WhatsApp number"
                className="px-3 py-2 rounded-lg text-sm bg-transparent text-white outline-none"
                style={{ border: '1px solid #2a2a2a' }}
              />
              <input
                value={form.pin}
                onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
                placeholder="PIN (for clock-in)"
                type="password"
                maxLength={6}
                className="px-3 py-2 rounded-lg text-sm bg-transparent text-white outline-none"
                style={{ border: '1px solid #2a2a2a' }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity"
                style={{ backgroundColor: gold, color: '#000' }}
              >
                {saving ? 'Saving…' : 'Save Employee'}
              </button>
              <button
                onClick={() => { setShowAdd(false); setSaveMsg(''); }}
                className="px-4 py-2 rounded-lg text-sm hover:opacity-70 transition-opacity"
                style={{ color: '#666', border: '1px solid #2a2a2a' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Employee List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: gold }} />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-16" style={{ color: '#444' }}>
            <p className="text-4xl mb-3">👤</p>
            <p className="text-sm">No employees yet. Add your first team member.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {employees.map(emp => (
              <div key={emp.id} className="rounded-xl p-4" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ backgroundColor: '#1a1400', border: `1px solid ${gold}33`, color: gold }}>
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{emp.name}</p>
                      {emp.role && <p className="text-xs truncate" style={{ color: '#666' }}>{emp.role}</p>}
                      {emp.phone && <p className="text-xs truncate" style={{ color: '#555' }}>{emp.phone}</p>}
                    </div>
                  </div>

                  {/* Status + Action */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor(emp.status) }} />
                      <span className="text-xs" style={{ color: statusColor(emp.status) }}>{statusLabel(emp.status)}</span>
                    </div>
                    <button
                      onClick={() => { setLinkModal({ employee: emp }); setSelectedProject(''); setLinkResult(null); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{ backgroundColor: '#1a1400', border: `1px solid ${gold}44`, color: gold }}
                    >
                      Send Clock-In Link
                    </button>
                  </div>
                </div>

                {/* Last activity */}
                {(emp.last_clockin || emp.last_clockout) && (
                  <div className="mt-3 pt-3 flex gap-4 text-xs" style={{ borderTop: '1px solid #1a1a1a', color: '#444' }}>
                    {emp.last_clockin && (
                      <span>Last in: {new Date(emp.last_clockin).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                    {emp.last_clockout && (
                      <span>Last out: {new Date(emp.last_clockout).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send Clock-In Link Modal */}
      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-semibold text-white">Send Clock-In Link</p>
                <p className="text-xs mt-0.5" style={{ color: gold }}>{linkModal.employee.name}</p>
              </div>
              <button onClick={() => setLinkModal(null)} className="text-gray-500 hover:text-gray-300 transition-colors text-xl leading-none">×</button>
            </div>

            {!linkResult ? (
              <>
                <div className="mb-4">
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: '#888' }}>Assign to Project (optional)</label>
                  <select
                    value={selectedProject}
                    onChange={e => setSelectedProject(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-transparent text-white outline-none"
                    style={{ border: '1px solid #2a2a2a', backgroundColor: '#0a0a0a' }}
                  >
                    <option value="">No specific project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.property_address} — {p.client_name}</option>
                    ))}
                  </select>
                </div>

                <p className="text-xs mb-5" style={{ color: '#555' }}>
                  A WhatsApp message with the clock-in link will be queued for Tran&apos;s approval before sending.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={handleSendLink}
                    disabled={linkLoading}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: gold, color: '#000' }}
                  >
                    {linkLoading ? 'Generating…' : 'Generate & Queue Link'}
                  </button>
                  <button
                    onClick={() => setLinkModal(null)}
                    className="px-4 py-3 rounded-xl text-sm hover:opacity-70 transition-opacity"
                    style={{ color: '#666', border: '1px solid #2a2a2a' }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div>
                <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: '#1a2a1a', border: '1px solid #2a4a2a' }}>
                  <p className="text-xs font-semibold text-green-400 mb-1">Link Generated ✓</p>
                  <p className="text-xs font-mono break-all" style={{ color: '#aaa' }}>{linkResult.url}</p>
                </div>
                <div className="rounded-lg p-3 mb-5" style={{ backgroundColor: '#1a1400', border: '1px solid #2a2000' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: gold }}>WhatsApp Preview</p>
                  <p className="text-xs whitespace-pre-line" style={{ color: '#aaa' }}>{linkResult.preview}</p>
                </div>
                <p className="text-xs mb-4" style={{ color: '#555' }}>Queued for Tran&apos;s approval in the Approvals dashboard.</p>
                <button
                  onClick={() => setLinkModal(null)}
                  className="w-full py-3 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: gold, color: '#000' }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
