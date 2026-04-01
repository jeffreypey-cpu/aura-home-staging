'use client';
import { useEffect, useState } from 'react';
import { getProjects, generateContract, completeProject, Project } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';

function formatPrice(n: number) {
  return '$' + n.toLocaleString();
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleContract = async (id: string) => {
    try {
      await generateContract(id);
      setActionMsg('Contract generation triggered');
      fetchProjects();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Failed');
    }
    setTimeout(() => setActionMsg(null), 3000);
  };

  const handleComplete = async (id: string) => {
    if (!confirm('Mark this project as complete?')) return;
    try {
      await completeProject(id);
      setActionMsg('Project marked complete');
      fetchProjects();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Failed');
    }
    setTimeout(() => setActionMsg(null), 3000);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#0f1f3d' }}>
        Projects
      </h1>

      {actionMsg && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-blue-700 text-sm">
          {actionMsg}
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-medium">No projects yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#0f1f3d' }} className="text-white">
                {['Client', 'Address', 'Price', 'Staging Date', 'Contract', 'DocuSign', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((p, i) => (
                <tr
                  key={p.id}
                  className={`hover:bg-yellow-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  <td className="px-4 py-3 font-medium">{p.client_name}</td>
                  <td className="px-4 py-3 text-gray-500">{truncate(p.property_address, 30)}</td>
                  <td className="px-4 py-3">{formatPrice(p.contract_price)}</td>
                  <td className="px-4 py-3">{p.staging_date}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.contract_status} /></td>
                  <td className="px-4 py-3"><StatusBadge status={p.docusign_status} /></td>
                  <td className="px-4 py-3"><StatusBadge status={p.project_status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleContract(p.id)}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded font-medium"
                      >
                        Contract
                      </button>
                      <button
                        onClick={() => handleComplete(p.id)}
                        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded font-medium"
                      >
                        Complete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
