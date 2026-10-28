import { useMemo } from 'react';
import { usePrinterStore } from '../stores/usePrinterStore';

export function CommandToast() {
  const commandQueue = usePrinterStore((state) => state.commandQueue);

  const latest = useMemo(() => commandQueue[0], [commandQueue]);
  if (!latest) return null;

  return (
    <div className={`command-toast ${latest.status}`}>
      <strong>{latest.label}</strong>
      <span>{latest.status === 'pending' ? 'Pending…' : latest.status === 'success' ? 'Success' : latest.message || 'Failed'}</span>
    </div>
  );
}
