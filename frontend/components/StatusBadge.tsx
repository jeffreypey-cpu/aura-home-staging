export default function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() || '';

  let style: React.CSSProperties = { padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, display: 'inline-block', letterSpacing: '0.05em' };

  if (['draft', 'not_sent', 'none'].includes(s)) {
    style = { ...style, backgroundColor: '#2a2a2a', color: '#999999' };
  } else if (['pending', 'pending_approval'].includes(s)) {
    style = { ...style, backgroundColor: '#2a2a2a', color: '#c9a84c' };
  } else if (['approved', 'active'].includes(s)) {
    style = { ...style, backgroundColor: '#1a2a1a', color: '#4ade80' };
  } else if (['sent', 'signed', 'completed'].includes(s)) {
    style = { ...style, backgroundColor: '#1a2a1a', color: '#4ade80' };
  } else if (['hold', 'rejected'].includes(s)) {
    style = { ...style, backgroundColor: '#2a1a1a', color: '#ef4444' };
  } else {
    style = { ...style, backgroundColor: '#2a2a2a', color: '#999999' };
  }

  return <span style={style}>{status}</span>;
}
