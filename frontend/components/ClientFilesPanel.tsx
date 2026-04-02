'use client';
import { useEffect, useState, useCallback } from 'react';
import { getClientFiles, deleteClientFile, ClientFile } from '@/lib/api';
import FileUpload from '@/components/FileUpload';

const TYPE_EMOJI: Record<string, string> = {
  contract: '📄',
  invoice: '💰',
  photo: '📷',
  document: '📁',
  other: '📁',
};

const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  contract: { bg: '#1a2040', color: '#818cf8' },
  invoice:  { bg: '#1a2a1a', color: '#4ade80' },
  photo:    { bg: '#2a1a2a', color: '#e879f9' },
  document: { bg: '#1a1a2a', color: '#60a5fa' },
  other:    { bg: '#2a2a2a', color: '#999999' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

interface Props {
  projectId: string;
  clientName: string;
}

export default function ClientFilesPanel({ projectId, clientName }: Props) {
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const data = await getClientFiles(projectId);
      setFiles(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const handleDelete = async (fileId: string) => {
    setDeleting(fileId);
    try {
      await deleteClientFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  };

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}>
      {loading ? (
        <p className="text-xs py-2" style={{ color: '#999' }}>Loading…</p>
      ) : files.length === 0 ? (
        <p className="text-xs italic py-1" style={{ color: '#555' }}>No files uploaded yet</p>
      ) : (
        <ul className="space-y-0">
          {files.map((f) => {
            const colors = TYPE_COLOR[f.file_type] ?? TYPE_COLOR.other;
            const emoji = TYPE_EMOJI[f.file_type] ?? '📁';
            return (
              <li
                key={f.id}
                className="flex items-start justify-between py-2"
                style={{ borderBottom: '1px solid #1e1e1e' }}
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className="text-sm mt-0.5">{emoji}</span>
                  <div className="min-w-0">
                    <p className="text-xs text-white truncate" style={{ maxWidth: 280 }}>
                      {f.file_name.length > 40 ? f.file_name.slice(0, 40) + '…' : f.file_name}
                    </p>
                    {f.notes && (
                      <p className="text-xs mt-0.5" style={{ color: '#555' }}>{f.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: colors.bg, color: colors.color }}
                  >
                    {f.file_type}
                  </span>
                  <span className="text-xs" style={{ color: '#555' }}>{formatDate(f.uploaded_at)}</span>
                  <button
                    onClick={() => handleDelete(f.id)}
                    disabled={deleting === f.id}
                    className="text-xs px-1.5 py-0.5 rounded transition-opacity hover:opacity-80 disabled:opacity-30"
                    style={{ color: '#ef4444', border: '1px solid #3a1a1a', backgroundColor: 'transparent' }}
                    title="Delete file record"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <FileUpload
        projectId={projectId}
        clientName={clientName}
        onUploadComplete={fetchFiles}
      />
    </div>
  );
}
