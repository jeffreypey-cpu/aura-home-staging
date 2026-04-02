'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const gold = '#c9a84c';
const API = '/api';

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function ClockInContent() {
  const params = useSearchParams();
  const employeeId = params.get('employee_id') || '';
  const projectId = params.get('project_id') || '';

  type State = 'idle' | 'clocked_in' | 'clocked_out';
  const [state, setState] = useState<State>('idle');
  const [employee, setEmployee] = useState<{ name: string; role?: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [clockinTime, setClockinTime] = useState('');
  const [clockoutTime, setClockoutTime] = useState('');
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [todayAssignment, setTodayAssignment] = useState<{ day_type: string; address: string; project_id?: string } | null>(null);
  const [activeProjectId, setActiveProjectId] = useState(projectId);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load employee info + today's schedule
  useEffect(() => {
    if (!employeeId) return;
    fetch(`${API}/employees/${employeeId}`)
      .then(r => r.json())
      .then(d => { if (d.name) setEmployee(d); })
      .catch(() => {});

    const today = new Date().toISOString().split('T')[0];
    fetch(`${API}/schedule/employee/${employeeId}`)
      .then(r => r.json())
      .then((days: Array<{ scheduled_date: string; day_type: string; address?: string; project_id?: string }>) => {
        const assignment = days.find(d => d.scheduled_date === today);
        if (assignment) {
          setTodayAssignment({ day_type: assignment.day_type, address: assignment.address || '', project_id: assignment.project_id });
          if (assignment.project_id && !projectId) setActiveProjectId(assignment.project_id);
        }
      })
      .catch(() => {});
  }, [employeeId, projectId]);

  // Tick timer
  useEffect(() => {
    if (state === 'clocked_in') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state]);

  const handleClockIn = async () => {
    if (!employeeId) { setError('No employee ID found in link.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/employees/clockin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, project_id: activeProjectId || undefined, note }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      const ct = new Date(data.clockin_time);
      setClockinTime(ct.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setElapsed(0);
      setState('clocked_in');
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/employees/clockout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, note }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      const ct = new Date(data.clockout_time);
      setClockoutTime(ct.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setTotalHours(data.total_hours);
      setState('clocked_out');
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!employeeId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4" style={{ backgroundColor: gold, color: '#000' }}>A</div>
          <p className="text-white font-semibold text-lg mb-2">Aura Home Staging</p>
          <p className="text-sm" style={{ color: '#666' }}>Invalid clock-in link. Please request a new link from your manager.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#0a0a0a' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-3" style={{ backgroundColor: gold, color: '#000' }}>A</div>
          <p className="text-white font-bold text-xl tracking-wide">AURA HOME STAGING</p>
          {employee && (
            <p className="text-sm mt-1" style={{ color: gold }}>
              {employee.name}{employee.role ? ` · ${employee.role}` : ''}
            </p>
          )}
        </div>

        {/* STATE: IDLE — Clock In */}
        {state === 'idle' && (
          <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
            <p className="text-white font-semibold text-lg mb-1">Ready to start?</p>
            <p className="text-sm mb-4" style={{ color: '#555' }}>
              {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            {todayAssignment && (
              <div className="rounded-lg px-3 py-2.5 mb-4 text-left" style={{ backgroundColor: '#1a1400', border: `1px solid ${gold}33` }}>
                <p className="text-xs font-semibold mb-0.5" style={{ color: gold }}>Your assignment today</p>
                <p className="text-xs text-white">
                  {todayAssignment.day_type === 'prep_day' ? '🚛 Prep & Load' : todayAssignment.day_type === 'staging_day' ? '🏠 Staging Day' : '📦 De-Stage'}
                </p>
                {todayAssignment.address && <p className="text-xs mt-0.5" style={{ color: '#888' }}>📍 {todayAssignment.address}</p>}
              </div>
            )}
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note (optional)…"
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm text-white bg-transparent outline-none resize-none mb-4"
              style={{ border: '1px solid #2a2a2a', color: '#999' }}
            />
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <button
              onClick={handleClockIn}
              disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-lg disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: gold, color: '#000' }}
            >
              {loading ? 'Clocking In…' : 'CLOCK IN'}
            </button>
          </div>
        )}

        {/* STATE: CLOCKED IN — Timer */}
        {state === 'clocked_in' && (
          <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
            <div className="w-3 h-3 rounded-full mx-auto mb-4 animate-pulse" style={{ backgroundColor: '#22c55e' }} />
            <p className="font-bold text-white text-lg mb-1">Clocked In</p>
            <p className="text-xs mb-6" style={{ color: '#555' }}>Since {clockinTime}</p>

            {/* Timer ring */}
            <div className="relative w-36 h-36 mx-auto mb-6 flex items-center justify-center rounded-full" style={{ border: `4px solid ${gold}`, boxShadow: `0 0 20px ${gold}33` }}>
              <span className="font-mono font-bold text-2xl" style={{ color: gold }}>{formatDuration(elapsed)}</span>
            </div>

            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note (optional)…"
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm text-white bg-transparent outline-none resize-none mb-4"
              style={{ border: '1px solid #2a2a2a', color: '#999' }}
            />
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <button
              onClick={handleClockOut}
              disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-lg disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #3a3a3a' }}
            >
              {loading ? 'Clocking Out…' : 'CLOCK OUT'}
            </button>
          </div>
        )}

        {/* STATE: CLOCKED OUT — Summary */}
        {state === 'clocked_out' && (
          <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl mx-auto mb-4" style={{ backgroundColor: '#1a2a1a', border: '1px solid #22c55e' }}>
              ✓
            </div>
            <p className="font-bold text-white text-lg mb-1">Day Complete</p>
            <p className="text-xs mb-6" style={{ color: '#555' }}>Great work today!</p>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center px-3 py-2 rounded-lg" style={{ backgroundColor: '#0a0a0a' }}>
                <span className="text-xs" style={{ color: '#666' }}>Clock In</span>
                <span className="text-sm font-medium text-white">{clockinTime}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 rounded-lg" style={{ backgroundColor: '#0a0a0a' }}>
                <span className="text-xs" style={{ color: '#666' }}>Clock Out</span>
                <span className="text-sm font-medium text-white">{clockoutTime}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 rounded-lg" style={{ backgroundColor: '#1a1400', border: `1px solid #2a2000` }}>
                <span className="text-xs font-semibold" style={{ color: gold }}>Total Hours</span>
                <span className="text-sm font-bold" style={{ color: gold }}>{totalHours}h</span>
              </div>
            </div>

            <p className="text-xs" style={{ color: '#444' }}>Your hours have been recorded. See you next time!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClockInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: gold }} />
      </div>
    }>
      <ClockInContent />
    </Suspense>
  );
}
