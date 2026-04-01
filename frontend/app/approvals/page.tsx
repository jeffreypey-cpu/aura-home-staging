'use client';
import { useEffect, useState, useCallback } from 'react';
import { getPendingApprovals, approveAction, rejectAction, Approval } from '@/lib/api';
import ApprovalCard from '@/components/ApprovalCard';

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
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#0f1f3d' }}>
          Pending Approvals
        </h1>
        {approvals.length > 0 && (
          <span className="bg-yellow-100 text-yellow-700 text-sm font-semibold px-3 py-0.5 rounded-full">
            {approvals.length}
          </span>
        )}
      </div>
      <p className="text-gray-500 mb-8 text-sm">
        Review and approve or reject pending AI-generated actions before they execute.
      </p>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium">No pending approvals</p>
          <p className="text-sm mt-1">New approvals will appear here automatically.</p>
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
          className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium z-50 ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
