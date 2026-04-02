'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getRevenueAnalytics, getProjectAnalytics, getPipelineAnalytics,
  RevenueAnalytics, ProjectAnalytics, PipelineAnalytics,
} from '@/lib/api';
import AuthGuard from '@/components/AuthGuard';

const gold = '#c9a84c';
function fmt(n: number) { return '$' + Math.round(n).toLocaleString(); }

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl p-4 md:p-6" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
      <p className="text-3xl md:text-4xl font-light text-white mb-1">{value}</p>
      <p className="text-xs tracking-widest uppercase" style={{ color: '#999' }}>{label}</p>
      {sub && <p className="text-xs mt-1" style={{ color: '#555' }}>{sub}</p>}
    </div>
  );
}

function RevenueBar({ data }: { data: { month: string; revenue: number }[] }) {
  const max = Math.max(...data.map(d => d.revenue), 1);
  return (
    <div className="mt-4">
      <div className="flex items-end gap-1 md:gap-2 h-32">
        {data.map(d => {
          const pct = Math.max(2, (d.revenue / max) * 100);
          const label = d.month.slice(5); // "MM"
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t transition-all"
                style={{ height: `${pct}%`, backgroundColor: d.revenue > 0 ? gold : '#2a2a2a' }}
                title={`${d.month}: ${fmt(d.revenue)}`}
              />
              <span className="text-xs" style={{ color: '#555', fontSize: 10 }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="capitalize" style={{ color: '#999' }}>{label}</span>
        <span className="text-white">{count} <span style={{ color: '#555' }}>({pct}%)</span></span>
      </div>
      <div className="rounded-full h-1.5" style={{ backgroundColor: '#2a2a2a' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: gold }} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [revenue, setRevenue] = useState<RevenueAnalytics | null>(null);
  const [projects, setProjects] = useState<ProjectAnalytics | null>(null);
  const [pipeline, setPipeline] = useState<PipelineAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getRevenueAnalytics(), getProjectAnalytics(), getPipelineAnalytics()])
      .then(([r, p, pl]) => { setRevenue(r); setProjects(p); setPipeline(pl); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AuthGuard>
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: gold, borderTopColor: 'transparent' }} />
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div>
        <h1 className="text-sm font-semibold tracking-widest uppercase mb-8" style={{ color: '#999' }}>Analytics</h1>

        {/* ── Revenue ── */}
        <section className="mb-10">
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: gold }}>Revenue</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Revenue" value={fmt(revenue?.total_revenue ?? 0)} />
            <StatCard label="This Month" value={fmt(revenue?.revenue_this_month ?? 0)} />
            <StatCard label="This Year" value={fmt(revenue?.revenue_this_year ?? 0)} />
            <StatCard label="Avg Contract" value={fmt(revenue?.avg_contract_value ?? 0)} />
          </div>
          <div className="rounded-xl p-4 md:p-6" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
            <p className="text-xs font-semibold tracking-widest uppercase mb-1 text-white">Monthly Revenue — Last 12 Months</p>
            {revenue?.revenue_by_month && revenue.revenue_by_month.length > 0
              ? <RevenueBar data={revenue.revenue_by_month} />
              : <p className="text-sm py-8 text-center" style={{ color: '#555' }}>No revenue data yet.</p>}
          </div>
        </section>

        {/* ── Projects ── */}
        <section className="mb-10">
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: gold }}>Projects</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Projects" value={String(projects?.total_projects ?? 0)} />
            <StatCard label="Active" value={String(projects?.active_projects ?? 0)} />
            <StatCard label="Completed" value={String(projects?.completed_projects ?? 0)} />
            <StatCard label="Avg Duration" value={`${projects?.avg_staging_duration_days ?? 0}d`} sub="average staging days" />
          </div>
          <div className="rounded-xl p-4 md:p-6" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
            <p className="text-xs font-semibold tracking-widest uppercase mb-4 text-white">By Status</p>
            {projects && Object.entries(projects.by_status).map(([status, count]) => (
              <StatusBar key={status} label={status} count={count} total={projects.total_projects} />
            ))}
          </div>
        </section>

        {/* ── Pipeline ── */}
        <section className="mb-10">
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: gold }}>Pipeline</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <StatCard label="Pipeline Value" value={fmt(pipeline?.pipeline_value ?? 0)} sub="active projects total" />
            <StatCard label="Pending Signatures" value={String(pipeline?.pending_signatures ?? 0)} sub="DocuSign awaiting" />
            <StatCard label="Unpaid Invoices" value={String(pipeline?.unpaid_invoices ?? 0)} sub="invoices not paid" />
          </div>
          {(pipeline?.pending_approvals ?? 0) > 0 && (
            <div className="rounded-xl p-4 md:p-6 flex items-center justify-between" style={{ backgroundColor: '#141414', border: `1px solid ${gold}` }}>
              <div>
                <p className="text-sm font-semibold text-white">{pipeline?.pending_approvals} pending approval{pipeline?.pending_approvals !== 1 ? 's' : ''}</p>
                <p className="text-xs mt-0.5" style={{ color: '#999' }}>AI actions awaiting your review</p>
              </div>
              <Link
                href="/approvals"
                className="text-xs px-4 py-2.5 rounded font-semibold tracking-wider uppercase hover:opacity-80 min-h-[44px] flex items-center"
                style={{ backgroundColor: gold, color: '#000' }}
              >
                Review →
              </Link>
            </div>
          )}
        </section>
      </div>
    </AuthGuard>
  );
}
