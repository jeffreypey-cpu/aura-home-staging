'use client';
import { useEffect, useState, useCallback } from 'react';
import { getPendingApprovals, approveAction, rejectAction, Approval } from '@/lib/api';
import ApprovalCard from '@/components/ApprovalCard';
import AuthGuard from '@/components/AuthGuard';

interface Toast {
  message: string;
  type: 'success' | 'error';
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchApprovals = useCallback(async () => {
    try {
      const data = await getPendingApprovals();
      setApprovals(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 30000);
    return () => clearInterval(interval);
  }, [fetchApprovals]);

  const handleApprove = async (id: string) => {
    try {
      await approveAction(id);
      showToast('Action approved successfully', 'success');
      fetchApprovals();
    } catch {
      showToast('Failed to approve action', 'error');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectAction(id);
      showToast('Action rejected / put on hold', 'error');
      fetchApprovals();
    } catch {
      showToast('Failed to reject action', 'error');
    }
  };

  return (
    <AuthGuard>
    <div>
      <div className="flex items-center gap-4 mb-3">
        <h1 className="text-sm font-semibold tracking-widest uppercase text-white">
          Pending Approvals
        </h1>
        {approvals.length > 0 && (
          <span
            className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: '#c9a84c', color: '#000000' }}
          >
            {approvals.length}
          </span>
        )}
      </div>
      <p className="text-xs tracking-wide mb-8" style={{ color: '#999999' }}>
        Review and approve or reject pending AI-generated actions before they execute.
      </p>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#c9a84c', borderTopColor: 'transparent' }} />
        </div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm font-medium" style={{ color: '#999999' }}>No pending approvals</p>
          <p className="text-xs mt-1" style={{ color: '#555555' }}>New approvals will appear here automatically.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {approvals.map((a) => (
            <ApprovalCard
              key={a.id}
              approval={a}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-6 right-6 px-5 py-3 rounded text-sm font-medium z-50 tracking-wide"
          style={{
            backgroundColor: toast.type === 'success' ? '#1a2a1a' : '#2a1a1a',
            border: `1px solid ${toast.type === 'success' ? '#4ade80' : '#ef4444'}`,
            color: toast.type === 'success' ? '#4ade80' : '#ef4444',
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
