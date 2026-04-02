'use client';
import { useEffect, useState } from 'react';
import {
  getVendors, createVendor, getProjectVendors, assignVendor,
  getProjects, Vendor, ProjectVendor, Project,
} from '@/lib/api';
import AuthGuard from '@/components/AuthGuard';

const SERVICE_TYPES = ['Photographer', 'Cleaner', 'Mover', 'Handyman', 'Locksmith', 'Other'];
const gold = '#c9a84c';

const emptyForm = {
  vendor_name: '', service_type: 'Photographer', contact_name: '', phone: '',
  email: '', address: '', rate: '', rate_type: 'flat', notes: '',
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [projectVendors, setProjectVendors] = useState<ProjectVendor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const [assignVendorId, setAssignVendorId] = useState('');
  const [assignDate, setAssignDate] = useState('');
  const [assignCost, setAssignCost] = useState('');
  const [assigning, setAssigning] = useState(false);

  const refresh = async () => {
    const [v, p] = await Promise.all([getVendors(), getProjects()]);
    setVendors(v);
    setProjects(p.filter(proj => proj.project_status === 'active'));
    setLoading(false);
  };

  const refreshProjectVendors = async (pid: string) => {
    if (!pid) return;
    const data = await getProjectVendors(pid).catch(() => []);
    setProjectVendors(data);
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => { refreshProjectVendors(selectedProject); }, [selectedProject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createVendor({ ...form, rate: form.rate ? Number(form.rate) : undefined });
      setMsg('Vendor added.');
      setForm(emptyForm);
      setShowForm(false);
      refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const handleAssign = async () => {
    if (!assignVendorId || !selectedProject) return;
    setAssigning(true);
    try {
      await assignVendor({
        project_id: selectedProject, vendor_id: assignVendorId,
        service_date: assignDate || undefined,
        cost: assignCost ? Number(assignCost) : undefined,
      });
      setMsg('Vendor assigned.');
      refreshProjectVendors(selectedProject);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    } finally {
      setAssigning(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: 8, padding: '10px 12px', fontSize: 13 };
  const labelClass = 'block text-xs font-semibold mb-1 uppercase tracking-wider';

  return (
    <AuthGuard>
      <div>
        <h1 className="text-sm font-semibold tracking-widest uppercase mb-6" style={{ color: '#999' }}>Vendors</h1>

        {msg && <div className="mb-4 rounded px-4 py-2 text-xs" style={{ backgroundColor: '#1a1400', border: `1px solid ${gold}`, color: gold }}>{msg}</div>}

        {/* ── Vendor List ── */}
        <div className="rounded-xl overflow-hidden mb-8" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #2a2a2a' }}>
            <h2 className="text-xs font-semibold tracking-widest uppercase text-white">Vendor List</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="text-xs px-4 py-2 rounded font-semibold tracking-wider uppercase hover:opacity-80 min-h-[44px]"
              style={{ backgroundColor: gold, color: '#000' }}
            >
              {showForm ? 'Cancel' : '+ Add Vendor'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4" style={{ borderBottom: '1px solid #2a2a2a' }}>
              <div>
                <label className={labelClass} style={{ color: '#999' }}>Vendor Name *</label>
                <input required style={inputStyle} value={form.vendor_name} onChange={e => setForm({ ...form, vendor_name: e.target.value })} />
              </div>
              <div>
                <label className={labelClass} style={{ color: '#999' }}>Service Type *</label>
                <select required style={inputStyle} value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })}>
                  {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} style={{ color: '#999' }}>Contact Name</label>
                <input style={inputStyle} value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
              </div>
              <div>
                <label className={labelClass} style={{ color: '#999' }}>Phone</label>
                <input type="tel" style={inputStyle} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className={labelClass} style={{ color: '#999' }}>Email</label>
                <input type="email" style={inputStyle} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className={labelClass} style={{ color: '#999' }}>Rate ($)</label>
                <input type="number" style={inputStyle} value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} />
              </div>
              <div>
                <label className={labelClass} style={{ color: '#999' }}>Rate Type</label>
                <select style={inputStyle} value={form.rate_type} onChange={e => setForm({ ...form, rate_type: e.target.value })}>
                  <option value="flat">Flat</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
              <div>
                <label className={labelClass} style={{ color: '#999' }}>Address</label>
                <input style={inputStyle} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} style={{ color: '#999' }}>Notes</label>
                <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <button type="submit" disabled={submitting} className="w-full md:w-auto px-8 py-3 rounded font-semibold text-xs tracking-widest uppercase disabled:opacity-50 hover:opacity-80 min-h-[44px]" style={{ backgroundColor: gold, color: '#000' }}>
                  {submitting ? 'Saving…' : 'Add Vendor'}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: gold, borderTopColor: 'transparent' }} /></div>
          ) : vendors.length === 0 ? (
            <p className="px-4 py-8 text-sm text-center" style={{ color: '#555' }}>No vendors yet.</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y" style={{ borderColor: '#2a2a2a' }}>
                {vendors.map(v => (
                  <div key={v.id} className="p-4">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-semibold text-white">{v.vendor_name}</p>
                      <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#1a1a1a', color: gold }}>{v.service_type}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2" style={{ color: '#999' }}>
                      {v.contact_name && <span>Contact: <span className="text-white">{v.contact_name}</span></span>}
                      {v.phone && <span>Phone: <span className="text-white">{v.phone}</span></span>}
                      {v.rate != null && <span>Rate: <span className="text-white">${v.rate} {v.rate_type}</span></span>}
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: '#0a0a0a' }}>
                      {['Vendor Name', 'Service Type', 'Contact', 'Phone', 'Rate'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-widest font-semibold text-white" style={{ borderBottom: '1px solid #2a2a2a' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((v, i) => (
                      <tr key={v.id} style={{ backgroundColor: i % 2 === 0 ? '#141414' : '#111', borderBottom: '1px solid #2a2a2a' }}>
                        <td className="px-4 py-3 font-medium text-white">{v.vendor_name}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#999' }}>{v.service_type}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#999' }}>{v.contact_name || '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#999' }}>{v.phone || '—'}</td>
                        <td className="px-4 py-3 text-white text-xs">{v.rate != null ? `$${v.rate} ${v.rate_type}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ── Assign to Project ── */}
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #2a2a2a' }}>
            <h2 className="text-xs font-semibold tracking-widest uppercase text-white">Assign to Project</h2>
          </div>
          <div className="p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className={labelClass} style={{ color: '#999' }}>Project</label>
                <select style={inputStyle} value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.client_name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} style={{ color: '#999' }}>Vendor</label>
                <select style={inputStyle} value={assignVendorId} onChange={e => setAssignVendorId(e.target.value)}>
                  <option value="">Select vendor…</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} style={{ color: '#999' }}>Service Date</label>
                <input type="date" style={inputStyle} value={assignDate} onChange={e => setAssignDate(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} style={{ color: '#999' }}>Cost ($)</label>
                <input type="number" style={inputStyle} value={assignCost} onChange={e => setAssignCost(e.target.value)} />
              </div>
            </div>
            <button
              onClick={handleAssign}
              disabled={assigning || !assignVendorId || !selectedProject}
              className="w-full md:w-auto px-8 py-3 rounded font-semibold text-xs tracking-widest uppercase disabled:opacity-50 hover:opacity-80 min-h-[44px]"
              style={{ backgroundColor: gold, color: '#000' }}
            >
              {assigning ? 'Assigning…' : 'Assign Vendor'}
            </button>

            {selectedProject && projectVendors.length > 0 && (
              <div className="mt-4">
                <p className="text-xs tracking-widest uppercase mb-3" style={{ color: '#555' }}>Assigned to this project</p>
                <div className="space-y-2">
                  {projectVendors.map(pv => (
                    <div key={pv.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a' }}>
                      <div>
                        <p className="text-sm text-white">{pv.vendors?.vendor_name ?? '—'}</p>
                        <p className="text-xs" style={{ color: '#555' }}>
                          {pv.vendors?.service_type} · {pv.service_date || 'No date'} · {pv.cost != null ? `$${pv.cost}` : 'No cost'}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded capitalize" style={{ backgroundColor: '#1a1a1a', color: gold }}>{pv.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
