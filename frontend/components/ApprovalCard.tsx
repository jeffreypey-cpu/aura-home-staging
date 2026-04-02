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

  const formatted = new Date(approval.created_at).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const clientName = (
    (payload.client_name as string) ||
    (payload.employee_name as string) ||
    (payload.vendor_name as string) ||
    ''
  );
  const propertyAddress = (
    (payload.property_address as string) ||
    (payload.address as string) ||
    (payload.project_address as string) ||
    ''
  );

  return (
    <div
      className="rounded-xl p-4 md:p-6"
      style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a', borderLeftWidth: 3, borderLeftColor: '#c9a84c' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0">
          {clientName && (
            <p className="font-semibold text-base leading-tight" style={{ color: '#c9a84c' }}>{clientName}</p>
          )}
          {propertyAddress && (
            <p className="text-sm mt-0.5 truncate" style={{ color: '#888' }}>{propertyAddress}</p>
          )}
          <span className="inline-block font-semibold text-white capitalize text-xs tracking-wide mt-1.5 px-2 py-0.5 rounded" style={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }}>
            {approval.action_type?.replace(/_/g, ' ')}
          </span>
          <p className="text-xs mt-1" style={{ color: '#666' }}>{formatted}</p>
        </div>
        <span className="text-xs font-mono flex-shrink-0 mt-1" style={{ color: '#555' }}>
          #{approval.id.slice(0, 8)}
        </span>
      </div>

      {approval.approval_message && (
        <pre
          className="text-xs md:text-sm rounded p-3 whitespace-pre-wrap mb-3 font-sans overflow-x-auto"
          style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#cccccc' }}
        >
          {approval.approval_message}
        </pre>
      )}

      {/* WhatsApp message preview */}
      {(payload.message as string) && (
        <pre
          className="text-xs rounded p-3 whitespace-pre-wrap mb-3 font-sans overflow-x-auto"
          style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#cccccc' }}
        >
          {payload.message as string}
        </pre>
      )}

      {emails && emails.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setEmailsOpen(!emailsOpen)}
            className="text-xs underline transition-colors hover:text-yellow-400"
            style={{ color: '#c9a84c' }}
          >
            {emailsOpen ? 'Hide' : 'Show'} emails ({emails.length})
          </button>
          {emailsOpen && (
            <pre
              className="text-xs rounded p-3 mt-2 whitespace-pre-wrap overflow-x-auto"
              style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#cccccc' }}
            >
              {JSON.stringify(emails, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mt-4">
        <button
          onClick={() => onApprove(approval.id)}
          className="flex-1 text-black text-xs font-semibold py-3 rounded tracking-wider uppercase transition-opacity hover:opacity-80 min-h-[44px]"
          style={{ backgroundColor: '#c9a84c' }}
        >
          APPROVE
        </button>
        <button
          onClick={() => onReject(approval.id)}
          className="flex-1 text-xs font-semibold py-3 rounded tracking-wider uppercase transition-colors hover:bg-red-950 min-h-[44px]"
          style={{ border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent' }}
        >
          REJECT / HOLD
        </button>
      </div>
    </div>
  );
}
