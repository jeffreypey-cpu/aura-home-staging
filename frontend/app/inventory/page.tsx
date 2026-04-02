'use client';
import { useEffect, useRef, useState } from 'react';
import {
  getInventory, createInventoryItem, analyzeInventoryImage, confirmInventoryItem,
  getProjectInventory, assignInventory, returnInventory,
  getProjects, InventoryItem, ProjectInventory, Project,
} from '@/lib/api';
import AuthGuard from '@/components/AuthGuard';
import { Package, Camera, ClipboardList, Search, X, Edit2, Trash2, Printer } from 'lucide-react';

const gold = '#c9a84c';
const CATEGORIES = ['Sofa','Chair','Table','Bed','Dresser','Lamp','Art','Rug','Mirror','Curtain','Pillow','Throw','Side Table','Coffee Table','Dining Table','Bookshelf','Desk','Bench','Ottoman','Decor','Plant','Other'];
const CONDITIONS = ['excellent','good','fair'];
const CATEGORY_FILTERS = ['All', 'Sofa', 'Chair', 'Table', 'Lamp', 'Art', 'Rug', 'Decor', 'Other'];

type Tab = 'items' | 'add' | 'assign';
type AddTab = 'photo' | 'manual';
type ExtItem = InventoryItem & { qr_base64?: string | null };

function fmt(n?: number | null) { return n != null ? '$' + n.toLocaleString() : '—'; }

function condStyle(c?: string): React.CSSProperties {
  if (c === 'excellent') return { backgroundColor: '#1a2a1a', color: '#4ade80', border: '1px solid #4ade80' };
  if (c === 'fair') return { backgroundColor: '#2a1a1a', color: '#ef4444', border: '1px solid #ef4444' };
  return { backgroundColor: '#2a2a0a', color: gold, border: `1px solid ${gold}` };
}

const inputSty: React.CSSProperties = { width: '100%', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none' };
const lblCls = 'block text-xs font-semibold mb-1.5 uppercase tracking-wider';

// ── Print Label ───────────────────────────────────────────────────────────────
function printLabel(item: ExtItem) {
  const win = window.open('', '_blank', 'width=420,height=580');
  if (!win) return;
  win.document.write(`<html><head><title>${item.sku || 'Label'}</title>
  <style>
    body{margin:0;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;padding:28px;box-sizing:border-box;text-align:center;}
    .brand{font-size:10px;letter-spacing:4px;color:#aaa;text-transform:uppercase;margin-bottom:20px;}
    img{width:280px;height:280px;}
    .name{font-size:22px;font-weight:700;margin:14px 0 4px;}
    .sku{font-family:monospace;font-size:14px;color:#555;margin-bottom:8px;}
    .meta{font-size:12px;color:#888;}
  </style></head><body>
  <div class="brand">Aura Home Staging</div>
  ${item.qr_base64 ? `<img src="data:image/png;base64,${item.qr_base64}" />` : '<div style="width:280px;height:280px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:14px;color:#aaa;">No QR</div>'}
  <div class="name">${item.item_name}</div>
  <div class="sku">${item.sku || '—'}</div>
  <div class="meta">${item.category} · ${item.condition || 'good'}</div>
  <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`);
  win.document.close();
}

// ── Inventory Card ────────────────────────────────────────────────────────────
function InventoryCard({ item, onRefresh, onAssign }: { item: ExtItem; onRefresh: () => void; onAssign: () => void }) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [form, setForm] = useState({ item_name: item.item_name, category: item.category, description: item.description || '', condition: item.condition || 'good', estimated_value: item.estimated_value?.toString() || '', quantity_total: item.quantity_total.toString(), purchase_price: item.purchase_price?.toString() || '', notes: item.notes || '' });
  const [saving, setSaving] = useState(false);
  const ff = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/inventory/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, quantity_total: Number(form.quantity_total), estimated_value: form.estimated_value ? Number(form.estimated_value) : undefined, purchase_price: form.purchase_price ? Number(form.purchase_price) : undefined }) });
      if (res.ok) { setEditing(false); onRefresh(); }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    await fetch(`/api/inventory/${item.id}`, { method: 'DELETE' });
    onRefresh();
  };

  const initial = item.item_name.charAt(0).toUpperCase();

  return (
    <div className="rounded-xl p-5 flex flex-col gap-3 transition-all" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
      {/* Top badges */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ backgroundColor: '#1a1400', color: gold }}>{item.category}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded capitalize" style={condStyle(item.condition)}>{item.condition || 'good'}</span>
          <span className="text-xs font-semibold" style={{ color: item.quantity_available > 0 ? '#4ade80' : '#ef4444' }}>
            {item.quantity_available}/{item.quantity_total}
          </span>
        </div>
      </div>

      {/* Placeholder / QR */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0" style={{ backgroundColor: '#1a1a1a', color: gold }}>
          {initial}
        </div>
        {item.qr_base64 && (
          <img src={`data:image/png;base64,${item.qr_base64}`} alt="QR" className="w-12 h-12 rounded" />
        )}
      </div>

      {/* Name + SKU + description */}
      {editing ? (
        <div className="space-y-2">
          <input style={inputSty} value={form.item_name} onChange={ff('item_name')} placeholder="Item name" />
          <select style={inputSty} value={form.category} onChange={ff('category')}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select style={inputSty} value={form.condition} onChange={ff('condition')}>
            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input style={inputSty} type="number" value={form.quantity_total} onChange={ff('quantity_total')} placeholder="Qty" />
          <input style={inputSty} type="number" value={form.estimated_value} onChange={ff('estimated_value')} placeholder="Est. value ($)" />
          <input style={inputSty} value={form.description} onChange={ff('description')} placeholder="Description" />
          <div className="flex gap-2 mt-2">
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider min-h-[44px]" style={{ backgroundColor: '#4ade80', color: '#000' }}>{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => setEditing(false)} className="flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider min-h-[44px]" style={{ border: '1px solid #555', color: '#999' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">{item.item_name}</p>
            {item.sku && <p className="text-xs font-mono mt-0.5" style={{ color: '#555' }}>{item.sku}</p>}
            {item.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: '#777' }}>{item.description}</p>}
          </div>
          {item.estimated_value != null && (
            <p className="text-sm font-semibold" style={{ color: gold }}>{fmt(item.estimated_value)}</p>
          )}
        </>
      )}

      {/* Remove confirmation */}
      {removing && (
        <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: '#2a1a1a', border: '1px solid #ef4444' }}>
          <p className="text-white mb-2">Remove <strong>{item.item_name}</strong>? This cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={handleDelete} className="flex-1 py-2 rounded font-semibold uppercase tracking-wider min-h-[44px]" style={{ backgroundColor: '#ef4444', color: '#fff' }}>Remove</button>
            <button onClick={() => setRemoving(false)} className="flex-1 py-2 rounded font-semibold uppercase tracking-wider min-h-[44px]" style={{ border: '1px solid #555', color: '#999' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!editing && !removing && (
        <div className="grid grid-cols-2 gap-2 mt-auto">
          <button onClick={() => setEditing(true)} className="py-2.5 rounded text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-1 min-h-[44px] hover:opacity-80" style={{ border: `1px solid ${gold}`, color: gold }}>
            <Edit2 size={11} />Edit
          </button>
          <button onClick={() => setRemoving(true)} className="py-2.5 rounded text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-1 min-h-[44px] hover:opacity-80" style={{ border: '1px solid #ef4444', color: '#ef4444' }}>
            <Trash2 size={11} />Remove
          </button>
          <button onClick={() => printLabel(item)} className="py-2.5 rounded text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-1 min-h-[44px] hover:opacity-80" style={{ border: '1px solid #555', color: '#999' }}>
            <Printer size={11} />Print
          </button>
          <button onClick={onAssign} disabled={item.quantity_available < 1} className="py-2.5 rounded text-xs uppercase tracking-wider font-semibold min-h-[44px] hover:opacity-80 disabled:opacity-30" style={{ backgroundColor: gold, color: '#000' }}>
            Assign
          </button>
        </div>
      )}
    </div>
  );
}

// ── Manual Form ───────────────────────────────────────────────────────────────
function ManualForm({ onSaved }: { onSaved: () => void }) {
  const empty = { item_name: '', category: 'Sofa', description: '', quantity_total: '1', condition: 'good', purchase_price: '', estimated_value: '', notes: '' };
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const ff = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createInventoryItem({ ...form, quantity_total: Number(form.quantity_total), purchase_price: form.purchase_price ? Number(form.purchase_price) : undefined, estimated_value: form.estimated_value ? Number(form.estimated_value) : undefined });
      setMsg('Item saved.'); setForm(empty); onSaved();
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); setTimeout(() => setMsg(''), 3000); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {msg && <div className="rounded px-4 py-2 text-xs" style={{ backgroundColor: '#1a1400', border: `1px solid ${gold}`, color: gold }}>{msg}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><label className={lblCls} style={{ color: '#999' }}>Item Name *</label><input required style={inputSty} value={form.item_name} onChange={ff('item_name')} /></div>
        <div><label className={lblCls} style={{ color: '#999' }}>Category</label><select style={inputSty} value={form.category} onChange={ff('category')}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className={lblCls} style={{ color: '#999' }}>Condition</label><select style={inputSty} value={form.condition} onChange={ff('condition')}>{CONDITIONS.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className={lblCls} style={{ color: '#999' }}>Quantity</label><input type="number" min="1" style={inputSty} value={form.quantity_total} onChange={ff('quantity_total')} /></div>
        <div><label className={lblCls} style={{ color: '#999' }}>Est. Value ($)</label><input type="number" style={inputSty} value={form.estimated_value} onChange={ff('estimated_value')} /></div>
        <div><label className={lblCls} style={{ color: '#999' }}>Purchase Price ($)</label><input type="number" style={inputSty} value={form.purchase_price} onChange={ff('purchase_price')} /></div>
        <div className="md:col-span-2"><label className={lblCls} style={{ color: '#999' }}>Description</label><input style={inputSty} value={form.description} onChange={ff('description')} /></div>
        <div className="md:col-span-2"><label className={lblCls} style={{ color: '#999' }}>Notes</label><textarea rows={2} style={{ ...inputSty, resize: 'vertical' }} value={form.notes} onChange={ff('notes')} /></div>
      </div>
      <button type="submit" disabled={submitting} className="w-full md:w-auto px-8 py-3 rounded font-semibold text-xs tracking-widest uppercase disabled:opacity-50 hover:opacity-80 min-h-[44px]" style={{ backgroundColor: gold, color: '#000' }}>
        {submitting ? 'Saving…' : 'Save Item'}
      </button>
    </form>
  );
}

// ── Photo Form ────────────────────────────────────────────────────────────────
function PhotoForm({ onSaved }: { onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const [qrB64, setQrB64] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const ff = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setPreview(URL.createObjectURL(f)); setAiResult(null); setQrB64(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true); setMsg('');
    try {
      const res = await analyzeInventoryImage(file);
      setAiResult(res.ai_result); setQrB64(res.qr_base64); setImagePath(res.image_path);
      setForm({ item_name: String(res.ai_result.item_name || ''), category: String(res.ai_result.category || 'Other'), description: String(res.ai_result.description || ''), condition: String(res.ai_result.condition || 'good'), estimated_value: res.ai_result.estimated_value != null ? String(res.ai_result.estimated_value) : '', sku: String(res.ai_result.sku || ''), quantity_total: '1', purchase_price: '', notes: '' });
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Analysis failed'); }
    finally { setAnalyzing(false); }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await confirmInventoryItem({ ...form, quantity_total: Number(form.quantity_total), estimated_value: form.estimated_value ? Number(form.estimated_value) : undefined, purchase_price: form.purchase_price ? Number(form.purchase_price) : undefined, image_path: imagePath });
      setMsg('Item saved!'); setAiResult(null); setFile(null); setPreview(null); setQrB64(null); setForm({});
      onSaved();
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); setTimeout(() => setMsg(''), 4000); }
  };

  return (
    <div className="space-y-6">
      {msg && <div className="rounded px-4 py-2 text-xs" style={{ backgroundColor: '#1a1400', border: `1px solid ${gold}`, color: gold }}>{msg}</div>}

      {/* Upload zone */}
      <div onClick={() => fileRef.current?.click()}
        className="relative rounded-xl flex flex-col items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
        style={{ minHeight: 200, border: `2px dashed ${gold}`, backgroundColor: '#0a0a0a' }}>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
        {preview
          ? <img src={preview} alt="Preview" className="rounded-xl object-cover" style={{ maxHeight: 220, maxWidth: '100%' }} />
          : <><Camera size={40} style={{ color: gold }} className="mb-3" /><p className="text-sm" style={{ color: '#999' }}>Tap to take a photo or upload image</p></>}
      </div>

      {file && !aiResult && !analyzing && (
        <button onClick={handleAnalyze} className="w-full py-3 rounded font-semibold text-xs tracking-widest uppercase hover:opacity-80 min-h-[44px]" style={{ backgroundColor: gold, color: '#000' }}>
          Analyze with Heather
        </button>
      )}

      {analyzing && (
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: gold, animationDelay: `${i*0.15}s` }} />)}</div>
          <span className="text-sm italic" style={{ color: '#999' }}>Heather is identifying this item…</span>
        </div>
      )}

      {aiResult && (
        <form onSubmit={handleConfirm} className="space-y-4">
          {/* Heather result card */}
          <div className="rounded-xl p-4" style={{ backgroundColor: '#0a0a0a', border: `1px solid #2a2000` }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ backgroundColor: gold, color: '#000' }}>H</div>
              <div>
                <p className="text-sm font-semibold text-white">I&apos;ve identified this item:</p>
                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: aiResult.confidence === 'high' ? '#1a2a1a' : aiResult.confidence === 'medium' ? '#1a1400' : '#2a1a1a', color: aiResult.confidence === 'high' ? '#4ade80' : aiResult.confidence === 'medium' ? gold : '#ef4444' }}>
                  {String(aiResult.confidence).toUpperCase()} CONFIDENCE
                </span>
              </div>
            </div>
            {aiResult.heather_note != null && <p className="text-xs italic" style={{ color: '#777' }}>&ldquo;{String(aiResult.heather_note)}&rdquo;</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className={lblCls} style={{ color: '#999' }}>Item Name *</label><input required style={inputSty} value={form.item_name || ''} onChange={ff('item_name')} /></div>
            <div><label className={lblCls} style={{ color: '#999' }}>Category</label><select style={inputSty} value={form.category || 'Other'} onChange={ff('category')}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className={lblCls} style={{ color: '#999' }}>Condition</label><select style={inputSty} value={form.condition || 'good'} onChange={ff('condition')}>{CONDITIONS.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className={lblCls} style={{ color: '#999' }}>Est. Value ($)</label><input type="number" style={inputSty} value={form.estimated_value || ''} onChange={ff('estimated_value')} /></div>
            <div><label className={lblCls} style={{ color: '#999' }}>Quantity</label><input type="number" min="1" style={inputSty} value={form.quantity_total || '1'} onChange={ff('quantity_total')} /></div>
            <div><label className={lblCls} style={{ color: '#999' }}>Purchase Price ($)</label><input type="number" style={inputSty} value={form.purchase_price || ''} onChange={ff('purchase_price')} /></div>
            <div><label className={lblCls} style={{ color: '#999' }}>SKU (auto-generated)</label><input readOnly style={{ ...inputSty, color: gold, cursor: 'default' }} value={form.sku || ''} /></div>
            <div className="md:col-span-2"><label className={lblCls} style={{ color: '#999' }}>Description</label><textarea rows={2} style={{ ...inputSty, resize: 'vertical' }} value={form.description || ''} onChange={ff('description')} /></div>
          </div>

          {qrB64 && (
            <div className="flex items-center gap-4">
              <img src={`data:image/png;base64,${qrB64}`} alt="QR" className="w-24 h-24 rounded-lg" />
              <div><p className="text-xs font-mono" style={{ color: gold }}>{form.sku}</p><p className="text-xs mt-1" style={{ color: '#555' }}>QR code ready to print</p></div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={submitting} className="flex-1 md:flex-none px-8 py-3 rounded font-semibold text-xs tracking-widest uppercase disabled:opacity-50 hover:opacity-80 min-h-[44px]" style={{ backgroundColor: gold, color: '#000' }}>
              {submitting ? 'Saving…' : 'Confirm and Save'}
            </button>
            <button type="button" onClick={() => { setAiResult(null); setForm({}); }} className="px-6 py-3 rounded text-xs uppercase tracking-wider font-semibold hover:opacity-70 min-h-[44px]" style={{ border: '1px solid #555', color: '#999' }}>
              Re-analyze
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Assign Tab ────────────────────────────────────────────────────────────────
function AssignTab({ items }: { items: ExtItem[] }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [projectInv, setProjectInv] = useState<ProjectInventory[]>([]);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');

  useEffect(() => { getProjects().then(p => setProjects(p.filter(x => x.project_status === 'active'))).catch(() => null); }, []);
  useEffect(() => { if (selectedProject) getProjectInventory(selectedProject).then(setProjectInv).catch(() => null); }, [selectedProject]);

  const handleAssign = async (itemId: string) => {
    if (!selectedProject) return;
    try {
      await assignInventory({ project_id: selectedProject, inventory_id: itemId, quantity_used: Number(qty[itemId] || 1) });
      setMsg('Assigned.'); getProjectInventory(selectedProject).then(setProjectInv).catch(() => null);
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Failed'); }
    setTimeout(() => setMsg(''), 3000);
  };

  const handleReturn = async (aid: string) => {
    await returnInventory(aid).catch(() => null);
    getProjectInventory(selectedProject).then(setProjectInv).catch(() => null);
  };

  const available = items.filter(i => i.quantity_available > 0);

  return (
    <div className="space-y-6">
      {msg && <div className="rounded px-4 py-2 text-xs" style={{ backgroundColor: '#1a1400', border: `1px solid ${gold}`, color: gold }}>{msg}</div>}
      <div>
        <label className={lblCls} style={{ color: '#999' }}>Select Project</label>
        <select style={inputSty} value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
          <option value="">Select project…</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.client_name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Available */}
        <div>
          <p className="text-xs tracking-widest uppercase mb-3" style={{ color: '#555' }}>Available Items</p>
          <div className="space-y-2">
            {available.length === 0 ? <p className="text-sm" style={{ color: '#555' }}>No items available.</p>
              : available.map(item => (
                <div key={item.id} className="flex items-center justify-between rounded-lg px-4 py-3 gap-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a' }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{item.item_name}</p>
                    <p className="text-xs" style={{ color: '#555' }}>{item.category} · {item.quantity_available} avail</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input type="number" min="1" max={item.quantity_available} value={qty[item.id] || '1'} onChange={e => setQty(p => ({ ...p, [item.id]: e.target.value }))}
                      className="rounded text-center text-xs text-white" style={{ width: 44, backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', padding: '6px 4px' }} />
                    <button onClick={() => handleAssign(item.id)} disabled={!selectedProject} className="text-xs px-3 py-2 rounded uppercase tracking-wider font-semibold hover:opacity-80 disabled:opacity-30 min-h-[44px]" style={{ backgroundColor: gold, color: '#000' }}>
                      Assign
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Assigned */}
        <div>
          <p className="text-xs tracking-widest uppercase mb-3" style={{ color: '#555' }}>Assigned to Project</p>
          {!selectedProject
            ? <p className="text-sm" style={{ color: '#555' }}>Select a project to see assignments.</p>
            : projectInv.length === 0
              ? <p className="text-sm" style={{ color: '#555' }}>Nothing assigned yet.</p>
              : <div className="space-y-2">
                  {projectInv.map(a => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a' }}>
                      <div>
                        <p className="text-sm text-white">{(a as ProjectInventory & { inventory?: InventoryItem }).inventory?.item_name ?? '—'}</p>
                        <p className="text-xs" style={{ color: '#555' }}>Qty: {a.quantity_used}</p>
                      </div>
                      <button onClick={() => handleReturn(a.id)} className="text-xs px-3 py-2 rounded hover:opacity-70 min-h-[44px]" style={{ border: '1px solid #555', color: '#999' }}>Return</button>
                    </div>
                  ))}
                </div>
          }
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>('items');
  const [addTab, setAddTab] = useState<AddTab>('photo');
  const [items, setItems] = useState<ExtItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');

  const refresh = () => {
    setLoading(true);
    getInventory().then(setItems).catch(() => null).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const filtered = items.filter(item => {
    const matchCat = catFilter === 'All' || item.category === catFilter || (catFilter === 'Other' && !CATEGORY_FILTERS.slice(1, -1).includes(item.category));
    const matchSearch = !search || item.item_name.toLowerCase().includes(search.toLowerCase()) || item.category.toLowerCase().includes(search.toLowerCase()) || (item.sku?.toLowerCase().includes(search.toLowerCase()) ?? false);
    return matchCat && matchSearch;
  });

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'items',  label: 'All Items',        icon: <Package size={13} /> },
    { id: 'add',    label: 'Add Item',          icon: <Camera size={13} /> },
    { id: 'assign', label: 'Assign to Project', icon: <ClipboardList size={13} /> },
  ];

  return (
    <AuthGuard>
      <div>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-sm font-semibold tracking-widest uppercase" style={{ color: gold }}>
              Inventory
              <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full" style={{ backgroundColor: '#1a1400', color: gold }}>{items.length}</span>
            </h1>
            <p className="text-xs italic mt-1" style={{ color: '#555' }}>Heather is managing your inventory</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-6" style={{ borderBottom: '1px solid #2a2a2a' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-3 text-xs tracking-widest uppercase font-semibold transition-colors min-h-[44px]"
              style={tab === t.id ? { color: '#fff', borderBottom: `2px solid ${gold}`, marginBottom: -1 } : { color: '#555', borderBottom: '2px solid transparent', marginBottom: -1 }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* TAB 1 — ALL ITEMS */}
        {tab === 'items' && (
          <div>
            {/* Search + category filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#555' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, category, SKU…"
                  className="w-full text-sm text-white pl-9 pr-8 py-2.5 rounded-lg focus:outline-none"
                  style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }} />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#555' }}><X size={13} /></button>}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap mb-5">
              {CATEGORY_FILTERS.map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className="text-xs px-3 py-1.5 rounded-full font-semibold transition-colors min-h-[36px]"
                  style={catFilter === c ? { backgroundColor: gold, color: '#000' } : { backgroundColor: '#1a1a1a', color: '#777', border: '1px solid #2a2a2a' }}>
                  {c}
                </button>
              ))}
            </div>

            {loading
              ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: gold, borderTopColor: 'transparent' }} /></div>
              : filtered.length === 0
                ? <div className="text-center py-20">
                    <p className="text-sm mb-3" style={{ color: '#555' }}>{items.length === 0 ? 'No inventory items yet.' : 'No items match your search.'}</p>
                    {items.length === 0 && <button onClick={() => setTab('add')} className="text-xs uppercase tracking-widest font-semibold hover:opacity-80" style={{ color: gold }}>Add your first item →</button>}
                  </div>
                : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(item => <InventoryCard key={item.id} item={item} onRefresh={refresh} onAssign={() => setTab('assign')} />)}
                  </div>
            }
          </div>
        )}

        {/* TAB 2 — ADD ITEM */}
        {tab === 'add' && (
          <div className="rounded-xl p-4 md:p-6" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
            <div className="flex gap-0 mb-6" style={{ borderBottom: '1px solid #2a2a2a' }}>
              {[{ id: 'photo' as AddTab, label: 'Photo Scan' }, { id: 'manual' as AddTab, label: 'Manual Entry' }].map(st => (
                <button key={st.id} onClick={() => setAddTab(st.id)}
                  className="flex-1 md:flex-none px-5 py-2.5 text-xs tracking-widest uppercase font-semibold transition-colors min-h-[44px]"
                  style={addTab === st.id ? { color: '#fff', borderBottom: `2px solid ${gold}`, marginBottom: -1 } : { color: '#555', borderBottom: '2px solid transparent', marginBottom: -1 }}>
                  {st.label}
                </button>
              ))}
            </div>
            {addTab === 'photo' ? <PhotoForm onSaved={() => { refresh(); setTab('items'); }} /> : <ManualForm onSaved={() => { refresh(); setTab('items'); }} />}
          </div>
        )}

        {/* TAB 3 — ASSIGN */}
        {tab === 'assign' && (
          <div className="rounded-xl p-4 md:p-6" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
            <AssignTab items={items} />
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
