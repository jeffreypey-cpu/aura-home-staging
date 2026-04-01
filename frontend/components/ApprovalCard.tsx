'use client';
import { useState } from 'react';
import { Approval } from '@/lib/api';

interface Props {
  approval: Approval;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function ApprovalCard({ approval, onApprove, onReject }: Props) {
  const [emailsOpen, setEmailsOpen] = useState(false);
  const payload = approval.action_payload || {};
  const emails = payload.emails as unknown[] | undefined;

  const formatted = new Date(approval.created_at).toLocaleString();

  return (
    <div className="bg-white rounded-xl shadow p-6 border-l-4 border-yellow-400">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="font-semibold text-gray-800 capitalize">
            {approval.action_type?.replace(/_/g, ' ')}
          </span>
          <p className="text-xs text-gray-400 mt-0.5">{formatted}</p>
        </div>
        <span className="text-xs text-gray-400">#{approval.id.slice(0, 8)}</span>
      </div>

      {approval.approval_message && (
        <pre className="text-sm text-gray-600 bg-gray-50 rounded p-3 whitespace-pre-wrap mb-3 font-sans">
          {approval.approval_message}
        </pre>
      )}

      {emails && emails.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setEmailsOpen(!emailsOpen)}
            className="text-xs text-blue-600 underline"
          >
            {emailsOpen ? 'Hide' : 'Show'} emails ({emails.length})
          </button>
          {emailsOpen && (
            <pre className="text-xs bg-gray-50 rounded p-3 mt-2 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(emails, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="flex gap-3 mt-4">
        <button
          onClick={() => onApprove(approval.id)}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
        >
          APPROVE
        </button>
        <button
          onClick={() => onReject(approval.id)}
          className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
        >
          REJECT / HOLD
        </button>
      </div>
    </div>
  );
}
