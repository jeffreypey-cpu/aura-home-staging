'use client';
import { useEffect, useState } from 'react';
import { getProjects, generateContract, completeProject, Project } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import AuthGuard from '@/components/AuthGuard';
import ClientFilesPanel from '@/components/ClientFilesPanel';

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
  const [openFilesId, setOpenFilesId] = useState<string | null>(null);

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

  const toggleFiles = (id: string) => {
    setOpenFilesId((prev) => (prev === id ? null : id));
  };

  return (
    <AuthGuard>
    <div>
      <h1 className="text-sm font-semibold tracking-widest uppercase mb-6" style={{ color: '#999999' }}>
        Projects
      </h1>

      {actionMsg && (
        <div
          className="mb-4 rounded px-4 py-2 text-xs tracking-wide"
          style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a', color: '#c9a84c' }}
        >
          {actionMsg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#c9a84c', borderTopColor: 'transparent' }} />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm" style={{ color: '#999999' }}>No projects yet</p>
        </div>
      ) : (
        <>
          {/* ── Mobile: card list ── */}
          <div className="md:hidden space-y-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="rounded-xl p-4"
                style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.client_name}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#999999' }}>
                      {truncate(p.property_address, 30)}
                    </p>
                  </div>
                  <StatusBadge status={p.project_status} />
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3" style={{ color: '#999999' }}>
                  <span>Price: <span className="text-white">{formatPrice(p.contract_price)}</span></span>
                  <span>Date: <span className="text-white">{p.staging_date}</span></span>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <StatusBadge status={p.contract_status} />
                  <StatusBadge status={p.docusign_status} />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleContract(p.id)}
                    className="w-full py-3 text-xs rounded tracking-wider uppercase transition-opacity hover:opacity-70 min-h-[44px]"
                    style={{ border: '1px solid #c9a84c', color: '#c9a84c', backgroundColor: 'transparent' }}
                  >
                    Contract
                  </button>
                  <button
                    onClick={() => handleComplete(p.id)}
                    className="w-full py-3 text-xs rounded tracking-wider uppercase transition-opacity hover:opacity-70 min-h-[44px]"
                    style={{ border: '1px solid #555555', color: '#999999', backgroundColor: 'transparent' }}
                  >
                    Complete
                  </button>
                  <button
                    onClick={() => toggleFiles(p.id)}
                    className="w-full py-3 text-xs rounded tracking-wider uppercase transition-opacity hover:opacity-70 min-h-[44px]"
                    style={
                      openFilesId === p.id
                        ? { backgroundColor: '#c9a84c', color: '#000', border: '1px solid #c9a84c' }
                        : { border: '1px solid #3a3a3a', color: '#888', backgroundColor: 'transparent' }
                    }
                  >
                    📁 Files
                  </button>
                  {openFilesId === p.id && (
                    <div className="mt-2">
                      <ClientFilesPanel projectId={p.id} clientName={p.client_name} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop: table ── */}
          <div className="hidden md:block rounded-xl overflow-hidden" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#0a0a0a' }}>
                  {['Client', 'Address', 'Price', 'Staging Date', 'Contract', 'DocuSign', 'Status', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs uppercase tracking-widest font-semibold"
                      style={{ color: '#ffffff', borderBottom: '1px solid #2a2a2a' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p, i) => (
                  <>
                    <tr
                      key={p.id}
                      className="transition-colors"
                      style={{
                        backgroundColor: openFilesId === p.id ? '#1a1a1a' : i % 2 === 0 ? '#141414' : '#111111',
                        borderBottom: openFilesId === p.id ? 'none' : '1px solid #2a2a2a',
                      }}
                      onMouseEnter={(e) => { if (openFilesId !== p.id) e.currentTarget.style.backgroundColor = '#1a1a1a'; }}
                      onMouseLeave={(e) => { if (openFilesId !== p.id) e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#141414' : '#111111'; }}
                    >
                      <td className="px-4 py-3 font-medium text-white">{p.client_name}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#999999' }}>{truncate(p.property_address, 30)}</td>
                      <td className="px-4 py-3 text-white">{formatPrice(p.contract_price)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#999999' }}>{p.staging_date}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.contract_status} /></td>
                      <td className="px-4 py-3"><StatusBadge status={p.docusign_status} /></td>
                      <td className="px-4 py-3"><StatusBadge status={p.project_status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleContract(p.id)}
                            className="px-2 py-1 text-xs rounded tracking-wider uppercase transition-opacity hover:opacity-70 min-h-[44px]"
                            style={{ border: '1px solid #c9a84c', color: '#c9a84c', backgroundColor: 'transparent' }}
                          >
                            Contract
                          </button>
                          <button
                            onClick={() => handleComplete(p.id)}
                            className="px-2 py-1 text-xs rounded tracking-wider uppercase transition-opacity hover:opacity-70 min-h-[44px]"
                            style={{ border: '1px solid #555555', color: '#999999', backgroundColor: 'transparent' }}
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => toggleFiles(p.id)}
                            className="px-2 py-1 text-xs rounded tracking-wider uppercase transition-opacity hover:opacity-70 min-h-[44px]"
                            style={
                              openFilesId === p.id
                                ? { backgroundColor: '#c9a84c', color: '#000', border: '1px solid #c9a84c' }
                                : { border: '1px solid #3a3a3a', color: '#888', backgroundColor: 'transparent' }
                            }
                          >
                            📁 Files
                          </button>
                        </div>
                      </td>
                    </tr>
                    {openFilesId === p.id && (
                      <tr key={`${p.id}-files`} style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td colSpan={8} className="px-4 pb-4 pt-0" style={{ backgroundColor: '#1a1a1a' }}>
                          <ClientFilesPanel projectId={p.id} clientName={p.client_name} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
    </AuthGuard>
  );
}
