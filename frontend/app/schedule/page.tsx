'use client';
import { useState, useEffect, useCallback } from 'react';

const gold = '#c9a84c';
const API = '/api';

const DAY_TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string; border: string }> = {
  prep_day:     { emoji: '🚛', label: 'Prep & Load',   color: '#f59e0b', bg: '#1a1400', border: '#3a2800' },
  staging_day:  { emoji: '🏠', label: 'Staging Day',   color: '#60a5fa', bg: '#001428', border: '#003060' },
  destage_day:  { emoji: '📦', label: 'De-Stage',      color: '#a78bfa', bg: '#0f0020', border: '#2a0060' },
};

interface Assignment {
  id?: string;
  project_id?: string;
  project_name?: string;
  employee_id?: string;
  employee_name?: string;
  day_type: string;
  address?: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
  employee?: { name: string; role?: string };
  project?: { client_name: string; property_address: string };
}

interface DayGroup {
  date: string;
  day_name: string;
  assignments: Assignment[];
}

interface Employee {
  id: string;
  name: string;
  phone?: string;
  role?: string;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDateRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${weekStart.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function AssignmentCard({ a, onDelete }: { a: Assignment; onDelete?: () => void }) {
  const cfg = DAY_TYPE_CONFIG[a.day_type] || DAY_TYPE_CONFIG.staging_day;
  const name = a.employee_name || a.employee?.name || '—';
  const proj = a.project_name || (a.project ? `${a.project.client_name}` : '—');
  return (
    <div className="rounded-lg px-3 py-2.5 text-xs relative" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-semibold" style={{ color: cfg.color }}>{cfg.emoji} {cfg.label}</span>
        {onDelete && (
          <button onClick={onDelete} className="opacity-40 hover:opacity-80 transition-opacity text-red-400 leading-none">✕</button>
        )}
      </div>
      <p className="font-medium text-white truncate">{proj}</p>
      <p className="truncate mt-0.5" style={{ color: '#888' }}>👤 {name}</p>
      {a.address && <p className="truncate mt-0.5" style={{ color: '#666' }}>📍 {a.address}</p>}
      <p className="mt-0.5" style={{ color: '#555' }}>🕐 {a.start_time || '08:00'} – {a.end_time || '17:00'}</p>
      {a.notes && <p className="mt-0.5 italic" style={{ color: '#555' }}>{a.notes}</p>}
    </div>
  );
}

export default function SchedulePage() {
  const [tab, setTab] = useState<'weekly' | 'upcoming'>('weekly');
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [savedSchedule, setSavedSchedule] = useState<DayGroup[]>([]);
  const [draftSchedule, setDraftSchedule] = useState<DayGroup[] | null>(null);
  const [upcoming, setUpcoming] = useState<DayGroup[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [sendModal, setSendModal] = useState(false);
  const [selectedEmps, setSelectedEmps] = useState<string[]>([]);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendDone, setSendDone] = useState(false);
  const [heatherSummary, setHeatherSummary] = useState('');
  const [loadingWeek, setLoadingWeek] = useState(false);

  const weekStartStr = toDateStr(weekStart);

  const loadWeek = useCallback(async () => {
    setLoadingWeek(true);
    setDraftSchedule(null);
    setApproved(false);
    setSendDone(false);
    try {
      const res = await fetch(`${API}/schedule/week/${weekStartStr}`);
      const data = await res.json();
      setSavedSchedule(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) setApproved(true);
    } catch { setSavedSchedule([]); }
    finally { setLoadingWeek(false); }
  }, [weekStartStr]);

  const loadUpcoming = useCallback(async () => {
    try {
      const res = await fetch(`${API}/schedule/upcoming`);
      const data = await res.json();
      setUpcoming(Array.isArray(data) ? data : []);
    } catch { setUpcoming([]); }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch(`${API}/employees/`);
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch { setEmployees([]); }
  }, []);

  useEffect(() => { loadWeek(); loadEmployees(); }, [loadWeek, loadEmployees]);
  useEffect(() => { if (tab === 'upcoming') loadUpcoming(); }, [tab, loadUpcoming]);

  const handleGenerate = async () => {
    setGenerating(true);
    setHeatherSummary('');
    try {
      const res = await fetch(`${API}/schedule/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: weekStartStr }),
      });
      const data = await res.json();
      setDraftSchedule(data.schedule || []);
      setHeatherSummary(data.heather_summary || '');
    } catch { setDraftSchedule([]); }
    finally { setGenerating(false); }
  };

  const handleDeleteDraft = (dateStr: string, idx: number) => {
    if (!draftSchedule) return;
    setDraftSchedule(prev => prev!.map(d => {
      if (d.date !== dateStr) return d;
      const assignments = [...d.assignments];
      assignments.splice(idx, 1);
      return { ...d, assignments };
    }).filter(d => d.assignments.length > 0));
  };

  const handleApprove = async () => {
    if (!draftSchedule) return;
    setApproving(true);
    try {
      const res = await fetch(`${API}/schedule/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: weekStartStr, schedule: draftSchedule }),
      });
      const data = await res.json();
      if (data.success) {
        setApproved(true);
        setDraftSchedule(null);
        loadWeek();
      }
    } catch { /* ignore */ }
    finally { setApproving(false); }
  };

  const handleSendWhatsApp = async () => {
    setSendLoading(true);
    try {
      await fetch(`${API}/schedule/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: weekStartStr, employee_ids: selectedEmps }),
      });
      setSendDone(true);
      setSendModal(false);
    } catch { /* ignore */ }
    finally { setSendLoading(false); }
  };

  const prevWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  const goToday = () => setWeekStart(getMonday(new Date()));

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const displaySchedule = draftSchedule ?? savedSchedule;

  const getDayAssignments = (dateStr: string) =>
    displaySchedule.find(d => d.date === dateStr)?.assignments || [];

  return (
    <div className="min-h-screen px-4 py-8" style={{ backgroundColor: '#0a0a0a', color: '#fff' }}>
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-widest uppercase" style={{ color: gold }}>Schedule</h1>
          <p className="text-sm italic mt-0.5" style={{ color: '#555' }}>Managed by Heather</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
          {(['weekly', 'upcoming'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all"
              style={tab === t ? { backgroundColor: gold, color: '#000' } : { color: '#666' }}>
              {t === 'weekly' ? 'Weekly View' : 'Upcoming'}
            </button>
          ))}
        </div>

        {/* ── TAB: WEEKLY VIEW ── */}
        {tab === 'weekly' && (
          <div>
            {/* Week nav */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="flex items-center gap-1 rounded-lg overflow-hidden" style={{ border: '1px solid #2a2a2a' }}>
                <button onClick={prevWeek} className="px-3 py-2 text-xs hover:opacity-70 transition-opacity" style={{ color: '#888', borderRight: '1px solid #2a2a2a' }}>‹ Prev</button>
                <button onClick={goToday} className="px-3 py-2 text-xs hover:opacity-70 transition-opacity" style={{ color: '#888' }}>Today</button>
                <button onClick={nextWeek} className="px-3 py-2 text-xs hover:opacity-70 transition-opacity" style={{ color: '#888', borderLeft: '1px solid #2a2a2a' }}>Next ›</button>
              </div>
              <span className="text-sm font-semibold text-white">{formatDateRange(new Date(weekStart))}</span>
            </div>

            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity"
                style={{ backgroundColor: gold, color: '#000' }}
              >
                {generating ? 'Heather is building your schedule…' : '✦ Generate with Heather'}
              </button>

              {draftSchedule && draftSchedule.length > 0 && (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: '#1a3a1a', color: '#4ade80', border: '1px solid #2a5a2a' }}
                >
                  {approving ? 'Saving…' : '✓ Approve Schedule'}
                </button>
              )}

              {approved && (
                <button
                  onClick={() => { setSendModal(true); setSelectedEmps(employees.map(e => e.id)); setSendDone(false); }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: '#1a1400', color: gold, border: `1px solid ${gold}44` }}
                >
                  📱 Send to Employees
                </button>
              )}

              {sendDone && <span className="text-xs text-green-400">Queued for Tran&apos;s approval ✓</span>}
            </div>

            {/* Heather summary */}
            {heatherSummary && (
              <div className="rounded-xl p-4 mb-6 flex gap-3" style={{ backgroundColor: '#1a1400', border: `1px solid ${gold}33` }}>
                <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold" style={{ backgroundColor: gold, color: '#000' }}>H</div>
                <p className="text-sm" style={{ color: '#e5e5e5' }}>{heatherSummary}</p>
              </div>
            )}

            {/* Draft mode notice */}
            {draftSchedule && (
              <div className="rounded-lg px-4 py-2 mb-4 text-xs" style={{ backgroundColor: '#1a1200', border: '1px solid #3a2800', color: '#f59e0b' }}>
                ✦ Draft — review and approve to save
              </div>
            )}

            {loadingWeek ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: gold }} />
              </div>
            ) : (
              <>
                {/* Desktop: 7-column grid */}
                <div className="hidden lg:grid grid-cols-7 gap-2">
                  {weekDays.map((d, i) => {
                    const ds = toDateStr(d);
                    const assignments = getDayAssignments(ds);
                    const isToday = ds === toDateStr(new Date());
                    return (
                      <div key={ds} className="rounded-xl p-2 min-h-[160px]" style={{ backgroundColor: '#141414', border: `1px solid ${isToday ? gold + '44' : '#2a2a2a'}` }}>
                        <div className="text-center mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: isToday ? gold : '#666' }}>{dayNames[i]}</p>
                          <p className="text-lg font-bold" style={{ color: isToday ? gold : '#fff' }}>{d.getDate()}</p>
                        </div>
                        <div className="space-y-1.5">
                          {assignments.map((a, idx) => (
                            <AssignmentCard
                              key={idx}
                              a={a}
                              onDelete={draftSchedule ? () => handleDeleteDraft(ds, idx) : undefined}
                            />
                          ))}
                          {assignments.length === 0 && (
                            <p className="text-center text-xs py-4" style={{ color: '#333' }}>—</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile/tablet: stacked cards */}
                <div className="lg:hidden space-y-3">
                  {weekDays.map((d, i) => {
                    const ds = toDateStr(d);
                    const assignments = getDayAssignments(ds);
                    const isToday = ds === toDateStr(new Date());
                    return (
                      <div key={ds} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${isToday ? gold + '44' : '#2a2a2a'}` }}>
                        <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: isToday ? '#1a1400' : '#141414' }}>
                          <span className="font-semibold text-sm" style={{ color: isToday ? gold : '#fff' }}>{fullDayNames[i]}</span>
                          <span className="text-xs" style={{ color: '#555' }}>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                        {assignments.length > 0 ? (
                          <div className="p-3 space-y-2" style={{ backgroundColor: '#0f0f0f' }}>
                            {assignments.map((a, idx) => (
                              <AssignmentCard
                                key={idx}
                                a={a}
                                onDelete={draftSchedule ? () => handleDeleteDraft(ds, idx) : undefined}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="px-4 py-3 text-xs" style={{ backgroundColor: '#0f0f0f', color: '#333' }}>No assignments</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {displaySchedule.length === 0 && !generating && (
                  <div className="text-center py-16" style={{ color: '#444' }}>
                    <p className="text-4xl mb-3">📅</p>
                    <p className="text-sm mb-4">No schedule for this week yet.</p>
                    <button
                      onClick={handleGenerate}
                      className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: gold, color: '#000' }}
                    >
                      ✦ Generate with Heather
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB: UPCOMING ── */}
        {tab === 'upcoming' && (
          <div className="space-y-4">
            {upcoming.length === 0 ? (
              <div className="text-center py-16" style={{ color: '#444' }}>
                <p className="text-4xl mb-3">📅</p>
                <p className="text-sm">No upcoming schedule found.</p>
              </div>
            ) : upcoming.map(day => (
              <div key={day.date} className="rounded-xl overflow-hidden" style={{ border: '1px solid #2a2a2a' }}>
                <div className="px-4 py-2.5 flex items-center gap-3" style={{ backgroundColor: '#141414' }}>
                  <span className="font-semibold text-sm text-white">{day.day_name}</span>
                  <span className="text-xs" style={{ color: gold }}>
                    {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div style={{ backgroundColor: '#0f0f0f' }}>
                  {day.assignments.map((a, idx) => {
                    const cfg = DAY_TYPE_CONFIG[a.day_type] || DAY_TYPE_CONFIG.staging_day;
                    const name = a.employee?.name || a.employee_name || '—';
                    const proj = a.project?.client_name || a.project_name || '—';
                    return (
                      <div key={idx} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-xs" style={{ borderTop: idx > 0 ? '1px solid #1a1a1a' : undefined }}>
                        <span className="font-semibold" style={{ color: cfg.color }}>{cfg.emoji} {cfg.label}</span>
                        <span className="text-white">{proj}</span>
                        <span style={{ color: '#888' }}>👤 {name}</span>
                        {a.address && <span style={{ color: '#666' }}>📍 {a.address}</span>}
                        <span style={{ color: '#555' }}>🕐 {a.start_time || '08:00'} – {a.end_time || '17:00'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send to Employees Modal */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-semibold text-white">Send Schedule via WhatsApp</p>
                <p className="text-xs mt-0.5" style={{ color: '#666' }}>Will be queued for Tran&apos;s approval</p>
              </div>
              <button onClick={() => setSendModal(false)} className="text-gray-500 hover:text-gray-300 text-xl leading-none">×</button>
            </div>

            <p className="text-xs font-medium mb-3" style={{ color: '#888' }}>Select employees to notify:</p>
            <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
              {employees.map(e => (
                <label key={e.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:opacity-80" style={{ backgroundColor: '#0a0a0a' }}>
                  <input
                    type="checkbox"
                    checked={selectedEmps.includes(e.id)}
                    onChange={ev => {
                      if (ev.target.checked) setSelectedEmps(p => [...p, e.id]);
                      else setSelectedEmps(p => p.filter(id => id !== e.id));
                    }}
                    className="accent-yellow-500"
                  />
                  <span className="text-sm text-white">{e.name}</span>
                  {e.role && <span className="text-xs" style={{ color: '#555' }}>{e.role}</span>}
                </label>
              ))}
              {employees.length === 0 && <p className="text-xs" style={{ color: '#444' }}>No employees found.</p>}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSendWhatsApp}
                disabled={sendLoading || selectedEmps.length === 0}
                className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity"
                style={{ backgroundColor: gold, color: '#000' }}
              >
                {sendLoading ? 'Queueing…' : `Send via Heather (${selectedEmps.length})`}
              </button>
              <button
                onClick={() => setSendModal(false)}
                className="px-4 py-3 rounded-xl text-sm hover:opacity-70"
                style={{ color: '#666', border: '1px solid #2a2a2a' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
