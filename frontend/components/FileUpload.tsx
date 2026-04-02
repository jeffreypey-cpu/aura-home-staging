'use client';
import { useRef, useState } from 'react';
import { uploadClientFile } from '@/lib/api';

const FILE_TYPES = ['contract', 'invoice', 'photo', 'document', 'other'];
const ACCEPTED = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx';

interface Props {
  projectId: string;
  clientName: string;
  onUploadComplete: () => void;
}

export default function FileUpload({ projectId, clientName, onUploadComplete }: Props) {
  const [fileType, setFileType] = useState('contract');
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    color: '#ffffff',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 12,
    outline: 'none',
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      await uploadClientFile(projectId, file, fileType, clientName, notes || undefined);
      setMessage({ text: 'File uploaded successfully', ok: true });
      setFile(null);
      setNotes('');
      if (inputRef.current) inputRef.current.value = '';
      onUploadComplete();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Upload failed', ok: false });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid #2a2a2a' }}>
      <p className="text-xs tracking-widest uppercase mb-2" style={{ color: '#999999' }}>Upload File</p>
      <div className="flex flex-wrap gap-2 items-center">
        {/* File type */}
        <select
          value={fileType}
          onChange={(e) => setFileType(e.target.value)}
          style={{ ...inputStyle, width: 110 }}
        >
          {FILE_TYPES.map((t) => (
            <option key={t} value={t} style={{ backgroundColor: '#141414' }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        {/* Hidden file input + styled button */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs px-3 py-1.5 rounded tracking-wide transition-opacity hover:opacity-70"
          style={{ border: '1px solid #2a2a2a', color: '#999', backgroundColor: 'transparent' }}
        >
          {file ? '✓ ' + (file.name.length > 22 ? file.name.slice(0, 22) + '…' : file.name) : 'Choose File'}
        </button>

        {/* Notes */}
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          style={{ ...inputStyle, width: 160 }}
        />

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="text-xs px-4 py-1.5 rounded font-semibold tracking-wider uppercase disabled:opacity-40 transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#c9a84c', color: '#000' }}
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {message && (
        <p className="text-xs mt-2" style={{ color: message.ok ? '#4ade80' : '#ef4444' }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
