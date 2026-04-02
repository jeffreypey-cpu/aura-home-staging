'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getProjects, getPendingApprovals, getApproachingProjects, getNotifications,
  requestExtension, completeProject, getClientFolders,
  Project, Approval, ClientFolder, Notification,
} from '@/lib/api';
import { Briefcase, Clock, FileCheck, CheckCircle, AlertTriangle, FolderOpen, ChevronDown, ChevronRight, X } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import AuthGuard from '@/components/AuthGuard';
import ClientFilesPanel from '@/components/ClientFilesPanel';

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ─── Days Remaining Badge ────────────────────────────────────────────────────

function DaysRemainingBadge({ days }: { days: number | null | undefined }) {
  if (days == null) return null;
  if (days <= 3) return (
    <span style={{ backgroundColor: '#2a1a1a', color: '#ef4444', border: '1px solid #ef4444' }}
      className="text-xs px-2 py-0.5 rounded font-semibold">
      {days}d left — URGENT
    </span>
  );
  if (days <= 7) return (
    <span style={{ backgroundColor: '#2a1a0a', color: '#fb923c', border: '1px solid #fb923c' }}
      className="text-xs px-2 py-0.5 rounded font-semibold">
      {days}d left
    </span>
  );
  if (days <= 14) return (
    <span style={{ backgroundColor: '#2a2a0a', color: '#c9a84c', border: '1px solid #c9a84c' }}
      className="text-xs px-2 py-0.5 rounded font-semibold">
      {days}d left
    </span>
  );
  return (
    <span style={{ backgroundColor: '#1a2a1a', color: '#4ade80', border: '1px solid #4ade80' }}
      className="text-xs px-2 py-0.5 rounded font-semibold">
      {days}d left
    </span>
  );
}

// ─── Notification Panel ───────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, { border: string; dot: string; pill: string }> = {
  urgent: { border: '#ef4444', dot: '#ef4444', pill: '#2a1a1a' },
  high:   { border: '#fb923c', dot: '#fb923c', pill: '#2a1a0a' },
  medium: { border: '#c9a84c', dot: '#c9a84c', pill: '#1a1400' },
  low:    { border: '#555555', dot: '#555555', pill: '#1a1a1a' },
};

function NotificationsPanel({
  notifications,
  onDismiss,
}: {
  notifications: Notification[];
  onDismiss: (idx: number) => void;
}) {
  if (notifications.length === 0) return null;

  return (
    <div className="mb-8">
      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#c9a84c' }}>
        Notifications
      </p>
      {/* Mobile: horizontal scroll pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 md:hidden" style={{ scrollbarWidth: 'none' }}>
        {notifications.map((n, idx) => {
          const s = PRIORITY_STYLES[n.priority] || PRIORITY_STYLES.low;
          return (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-full px-3 py-2 flex-shrink-0"
              style={{ backgroundColor: s.pill, border: `1px solid ${s.border}` }}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
              <span className="text-xs text-white whitespace-nowrap">{n.message}</span>
              <button onClick={() => onDismiss(idx)} className="ml-1 hover:opacity-70" style={{ color: '#555' }} aria-label="Dismiss">
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
      {/* Desktop: stacked rows */}
      <div className="hidden md:block space-y-2">
        {notifications.map((n, idx) => {
          const s = PRIORITY_STYLES[n.priority] || PRIORITY_STYLES.low;
          return (
            <div
              key={idx}
              className="flex items-center justify-between rounded-lg px-4 py-3"
              style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a', borderLeft: `4px solid ${s.border}` }}
            >
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
                <span className="text-sm text-white">{n.message}</span>
                {n.days_remaining != null && (
                  <span className="text-xs" style={{ color: '#555' }}>· {n.days_remaining}d remaining</span>
                )}
              </div>
              <button onClick={() => onDismiss(idx)} className="ml-4 flex-shrink-0 hover:opacity-70 transition-opacity" style={{ color: '#555' }} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function StagingProgressBar({ project }: { project: Project }) {
  if (!project.staging_date || !project.final_day_of_service) return null;

  const start = new Date(project.staging_date).getTime();
  const end = new Date(project.final_day_of_service).getTime();
  const now = Date.now();
  const total = end - start;
  const elapsed = now - start;
  const pct = total <= 0 ? 100 : Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));

  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#fb923c' : '#c9a84c';

  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1" style={{ color: '#555' }}>
        <span>{project.staging_date}</span>
        <span>{pct}%</span>
        <span>{project.final_day_of_service}</span>
      </div>
      <div className="rounded-full overflow-hidden" style={{ backgroundColor: '#2a2a2a', height: 4 }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

// ─── Timeline Project Row ─────────────────────────────────────────────────────

function TimelineRow({
  project,
  onAction,
}: {
  project: Project;
  onAction: () => void;
}) {
  const [extending, setExtending] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const endingSoon =
    project.days_remaining != null && project.days_remaining <= 7;

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      await completeProject(project.id);
      onAction();
    } finally {
      setSubmitting(false);
    }
  };

  const handleExtend = async () => {
    if (!newDate) return;
    setSubmitting(true);
    try {
      await requestExtension({ project_id: project.id, new_end_date: newDate });
      setExtending(false);
      onAction();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="rounded-xl p-4 mb-3"
      style={{
        backgroundColor: '#141414',
        border: endingSoon ? '1px solid #c9a84c' : '1px solid #2a2a2a',
      }}
    >
      {/* Top: name/address left, days pill right */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{project.client_name}</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: '#999' }}>
            {truncate(project.property_address, 20)}
          </p>
        </div>
        <DaysRemainingBadge days={project.days_remaining} />
      </div>

      <StagingProgressBar project={project} />

      {/* Status badges */}
      <div className="flex flex-wrap gap-2 mt-2 mb-3">
        <StatusBadge status={project.contract_status} />
        <StatusBadge status={project.docusign_status} />
        <StatusBadge status={project.invoice_status ?? 'draft'} />
      </div>

      {/* Action buttons — full width on mobile */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => setExtending(!extending)}
          disabled={submitting}
          className="flex-1 text-xs py-2.5 rounded font-semibold tracking-wider uppercase hover:opacity-80 transition-opacity min-h-[44px]"
          style={{ backgroundColor: '#c9a84c', color: '#000' }}
        >
          Extend
        </button>
        <button
          onClick={handleComplete}
          disabled={submitting}
          className="flex-1 text-xs py-2.5 rounded font-semibold tracking-wider uppercase hover:opacity-70 transition-opacity min-h-[44px]"
          style={{ border: '1px solid #555', color: '#999', backgroundColor: 'transparent' }}
        >
          Complete
        </button>
      </div>

      {/* Extend form */}
      {extending && (
        <div className="mt-3 pt-3 flex flex-col sm:flex-row items-start sm:items-center gap-3" style={{ borderTop: '1px solid #2a2a2a' }}>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full sm:w-auto rounded px-3 py-2 text-sm text-white focus:outline-none min-h-[44px]"
            style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a' }}
          />
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleExtend}
              disabled={submitting || !newDate}
              className="flex-1 sm:flex-none text-xs px-4 py-2.5 rounded font-semibold tracking-wider uppercase disabled:opacity-50 hover:opacity-80 min-h-[44px]"
              style={{ backgroundColor: '#c9a84c', color: '#000' }}
            >
              {submitting ? 'Saving…' : 'Submit'}
            </button>
            <button
              onClick={() => setExtending(false)}
              className="flex-1 sm:flex-none text-xs px-4 py-2.5 rounded hover:opacity-70 transition-opacity min-h-[44px]"
              style={{ border: '1px solid #555', color: '#555', backgroundColor: 'transparent' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Extension Alert (kept for backward compat) ───────────────────────────────

function ExtensionAlert({ project, onDone }: { project: Project; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const handleRequest = async () => {
    if (!newDate) return;
    setSubmitting(true);
    try {
      await requestExtension({ project_id: project.id, new_end_date: newDate, extension_notes: notes });
      setMsg('Extension request queued for approval.');
      setOpen(false);
      onDone();
    } catch {
      setMsg('Failed to submit extension request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      await completeProject(project.id);
      onDone();
    } catch {
      setMsg('Failed to mark complete.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl p-4 mb-3" style={{ backgroundColor: '#1a1400', border: '1px solid #c9a84c', borderLeft: '4px solid #c9a84c' }}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} style={{ color: '#c9a84c', marginTop: 2, flexShrink: 0 }} />
          <div>
            <p className="text-sm font-semibold text-white">
              Staging ending soon — {project.client_name} at {project.property_address}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#999999' }}>
              {project.days_remaining} days remaining · End date: {project.final_day_of_service || 'N/A'}
            </p>
            {msg && <p className="text-xs mt-1" style={{ color: '#c9a84c' }}>{msg}</p>}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-3 sm:mt-0 sm:ml-4 sm:flex-shrink-0 w-full sm:w-auto">
          <button
            onClick={() => setOpen(!open)}
            disabled={submitting}
            className="w-full sm:w-auto text-xs px-3 py-2.5 rounded font-semibold tracking-wider uppercase transition-opacity hover:opacity-80 min-h-[44px]"
            style={{ backgroundColor: '#c9a84c', color: '#000' }}
          >
            Request Extension
          </button>
          <button
            onClick={handleComplete}
            disabled={submitting}
            className="w-full sm:w-auto text-xs px-3 py-2.5 rounded font-semibold tracking-wider uppercase transition-opacity hover:opacity-70 min-h-[44px]"
            style={{ border: '1px solid #555', color: '#999', backgroundColor: 'transparent' }}
          >
            Mark Complete
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 pl-7 space-y-3">
          <div>
            <label className="block text-xs tracking-widest uppercase mb-1" style={{ color: '#999999' }}>New End Date</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="rounded px-3 py-2 text-sm text-white focus:outline-none"
              style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', width: 200 }}
            />
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase mb-1" style={{ color: '#999999' }}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded px-3 py-2 text-sm text-white focus:outline-none w-full max-w-md"
              style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', resize: 'vertical' }}
            />
          </div>
          <button
            onClick={handleRequest}
            disabled={submitting || !newDate}
            className="text-xs px-4 py-2 rounded font-semibold tracking-wider uppercase disabled:opacity-50 hover:opacity-80"
            style={{ backgroundColor: '#c9a84c', color: '#000' }}
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Client Folder Row ────────────────────────────────────────────────────────

function ClientFolderRow({ folder }: { folder: ClientFolder }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ borderBottom: '1px solid #2a2a2a' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
        style={{ backgroundColor: 'transparent' }}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown size={14} style={{ color: '#999' }} /> : <ChevronRight size={14} style={{ color: '#999' }} />}
          <FolderOpen size={14} style={{ color: '#c9a84c' }} />
          <span className="text-sm text-white font-medium">{folder.client_name}</span>
        </div>
        <div className="flex items-center gap-3">
          {folder.file_types.map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#2a2a2a', color: '#c9a84c' }}>
              {t}
            </span>
          ))}
          <span className="text-xs" style={{ color: '#999' }}>{folder.file_count} file{folder.file_count !== 1 ? 's' : ''}</span>
          <span className="text-xs" style={{ color: '#555' }}>
            {new Date(folder.latest_upload).toLocaleDateString()}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <ClientFilesPanel
            projectId={folder.project_id}
            clientName={folder.client_name}
          />
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [approaching, setApproaching] = useState<Project[]>([]);
  const [folders, setFolders] = useState<ClientFolder[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedExpanded, setCompletedExpanded] = useState(false);

  const fetchAll = () => {
    Promise.all([
      getProjects(),
      getPendingApprovals(),
      getApproachingProjects().catch(() => []),
      getClientFolders().catch(() => []),
      getNotifications().catch(() => []),
    ]).then(([p, a, ap, f, n]) => {
      setProjects(p);
      setApprovals(a);
      setApproaching(ap);
      setFolders(f);
      setNotifications(n);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
    // Auto-refresh notifications every 60 seconds
    const timer = setInterval(() => {
      getNotifications().then(setNotifications).catch(() => null);
    }, 60000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissNotification = (idx: number) => {
    setNotifications((prev) => prev.filter((_, i) => i !== idx));
  };

  const active = projects.filter((p) => p.project_status === 'active').length;
  const contractsSent = projects.filter((p) => p.contract_status === 'sent').length;
  const completed = projects.filter((p) => p.project_status === 'completed').length;

  const stats = [
    { label: 'TOTAL ACTIVE PROJECTS', value: active, icon: Briefcase },
    { label: 'PENDING APPROVALS', value: approvals.length, icon: Clock },
    { label: 'CONTRACTS SENT', value: contractsSent, icon: FileCheck },
    { label: 'JOBS COMPLETED', value: completed, icon: CheckCircle },
  ];

  const recent = [...projects].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 5);

  const activeTimeline = projects
    .filter((p) => p.project_status === 'active')
    .sort((a, b) => {
      const aDate = a.final_day_of_service ?? '';
      const bDate = b.final_day_of_service ?? '';
      return aDate.localeCompare(bDate);
    });

  const completedProjects = projects.filter((p) => p.project_status === 'completed');

  return (
    <AuthGuard>
    <div>
      <h1 className="text-sm font-semibold tracking-widest uppercase mb-8" style={{ color: '#999999' }}>
        Dashboard
      </h1>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#c9a84c', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          {/* Notifications Panel */}
          <NotificationsPanel notifications={notifications} onDismiss={dismissNotification} />

          {/* Extension Alert Banners */}
          {approaching.length > 0 && (
            <div className="mb-8">
              <p className="text-xs tracking-widest uppercase mb-3 flex items-center gap-2" style={{ color: '#c9a84c' }}>
                <AlertTriangle size={12} /> Staging Ending Soon
              </p>
              {approaching.map((p) => (
                <ExtensionAlert key={p.id} project={p} onDone={fetchAll} />
              ))}
            </div>
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-xl p-6"
                style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}
              >
                <Icon size={18} style={{ color: '#c9a84c' }} className="mb-3" />
                <p className="text-4xl font-light text-white mb-1">{value}</p>
                <p className="text-xs tracking-widest" style={{ color: '#999999' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Project Timeline */}
          <div className="mb-8">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#999999' }}>
              Project Timeline
            </p>

            {activeTimeline.length === 0 ? (
              <p className="text-sm" style={{ color: '#555' }}>No active projects.</p>
            ) : (
              activeTimeline.map((p) => (
                <TimelineRow key={p.id} project={p} onAction={fetchAll} />
              ))
            )}

            {/* Completed (collapsed) */}
            {completedProjects.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setCompletedExpanded(!completedExpanded)}
                  className="flex items-center gap-2 text-xs tracking-widest uppercase mb-3 hover:opacity-80 transition-opacity"
                  style={{ color: '#555' }}
                >
                  {completedExpanded
                    ? <ChevronDown size={12} />
                    : <ChevronRight size={12} />}
                  Completed ({completedProjects.length})
                </button>
                {completedExpanded && completedProjects.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl p-4 mb-2 opacity-50"
                    style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{p.client_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#999' }}>{p.property_address}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: '#555' }}>
                          {p.staging_date} → {p.final_day_of_service}
                        </span>
                        <StatusBadge status="completed" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Projects + Approvals */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="rounded-xl p-6" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
              <h2 className="text-xs font-semibold tracking-widest uppercase text-white mb-4">Recent Projects</h2>
              {recent.length === 0 ? (
                <p className="text-sm" style={{ color: '#999999' }}>No projects yet.</p>
              ) : (
                <ul className="space-y-3">
                  {recent.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-sm" style={{ borderBottom: '1px solid #2a2a2a', paddingBottom: 12 }}>
                      <div>
                        <p className="font-medium text-white">{p.client_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#999999' }}>{p.property_address.slice(0, 35)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <DaysRemainingBadge days={p.days_remaining} />
                        <StatusBadge status={p.project_status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl p-6" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold tracking-widest uppercase text-white">Pending Approvals</h2>
                {approvals.length > 0 && (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: '#c9a84c', color: '#000000' }}
                  >
                    {approvals.length}
                  </span>
                )}
              </div>
              {approvals.length === 0 ? (
                <p className="text-sm" style={{ color: '#999999' }}>No pending approvals.</p>
              ) : (
                <p className="text-sm mb-3" style={{ color: '#999999' }}>
                  You have {approvals.length} action{approvals.length !== 1 ? 's' : ''} awaiting review.
                </p>
              )}
              <Link
                href="/approvals"
                className="inline-block text-xs tracking-widest uppercase font-semibold hover:opacity-80 transition-opacity"
                style={{ color: '#c9a84c' }}
              >
                View all approvals →
              </Link>
            </div>
          </div>

          {/* Client Files */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #2a2a2a' }}>
              <FolderOpen size={14} style={{ color: '#c9a84c' }} />
              <h2 className="text-xs font-semibold tracking-widest uppercase text-white">Client Files</h2>
              <span className="text-xs ml-1" style={{ color: '#555' }}>{folders.length} client{folders.length !== 1 ? 's' : ''}</span>
            </div>
            {folders.length === 0 ? (
              <p className="px-4 py-6 text-sm" style={{ color: '#999999' }}>No files stored yet.</p>
            ) : (
              folders.map((f) => <ClientFolderRow key={`${f.client_name}-${f.project_id}`} folder={f} />)
            )}
          </div>
        </>
      )}
    </div>
    </AuthGuard>
  );
}
