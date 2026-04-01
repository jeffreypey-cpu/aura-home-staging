'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProjects, getPendingApprovals, Project, Approval } from '@/lib/api';
import { Briefcase, Clock, FileCheck, CheckCircle } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getProjects(), getPendingApprovals()])
      .then(([p, a]) => { setProjects(p); setApprovals(a); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const active = projects.filter((p) => p.project_status === 'active').length;
  const contractsSent = projects.filter((p) => p.contract_status === 'sent').length;
  const completed = projects.filter((p) => p.project_status === 'completed').length;

  const stats = [
    { label: 'Total Active Projects', value: active, icon: Briefcase },
    { label: 'Pending Approvals', value: approvals.length, icon: Clock },
    { label: 'Contracts Sent', value: contractsSent, icon: FileCheck },
    { label: 'Jobs Completed', value: completed, icon: CheckCircle },
  ];

  const recent = [...projects].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 5);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8" style={{ color: '#0f1f3d' }}>
        Dashboard
      </h1>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white rounded-xl shadow p-6">
                <Icon className="text-gray-400 mb-2" size={20} />
                <p className="text-3xl font-bold" style={{ color: '#0f1f3d' }}>
                  {value}
                </p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="font-semibold text-gray-700 mb-4">Recent Projects</h2>
              {recent.length === 0 ? (
                <p className="text-sm text-gray-400">No projects yet.</p>
              ) : (
                <ul className="space-y-3">
                  {recent.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-gray-800">{p.client_name}</p>
                        <p className="text-gray-400 text-xs">{p.property_address.slice(0, 35)}</p>
                      </div>
                      <StatusBadge status={p.project_status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-700">Pending Approvals</h2>
                {approvals.length > 0 && (
                  <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {approvals.length}
                  </span>
                )}
              </div>
              {approvals.length === 0 ? (
                <p className="text-sm text-gray-400">No pending approvals.</p>
              ) : (
                <p className="text-sm text-gray-600 mb-3">
                  You have {approvals.length} action{approvals.length !== 1 ? 's' : ''} awaiting review.
                </p>
              )}
              <Link
                href="/approvals"
                className="inline-block text-sm font-semibold underline"
                style={{ color: '#c9a84c' }}
              >
                View all approvals →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
