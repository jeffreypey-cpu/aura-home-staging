export default function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() || '';

  let classes = 'inline-block px-2 py-0.5 rounded-full text-xs font-semibold ';

  if (['draft', 'not_sent', 'none'].includes(s)) {
    classes += 'bg-gray-100 text-gray-600';
  } else if (['pending', 'pending_approval'].includes(s)) {
    classes += 'bg-yellow-100 text-yellow-700';
  } else if (['approved', 'active'].includes(s)) {
    classes += 'bg-blue-100 text-blue-700';
  } else if (['sent', 'signed', 'completed'].includes(s)) {
    classes += 'bg-green-100 text-green-700';
  } else if (['hold', 'rejected'].includes(s)) {
    classes += 'bg-red-100 text-red-700';
  } else {
    classes += 'bg-gray-100 text-gray-600';
  }

  return <span className={classes}>{status}</span>;
}
