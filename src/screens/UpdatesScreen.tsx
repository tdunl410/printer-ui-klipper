import { useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

type UiUpdateStatus = {
  status: 'idle' | 'running' | 'success' | 'error';
  logs: string[];
  lastLog: string;
  error: string;
  currentCommit: string;
  targetCommit: string;
};

export function UpdatesScreen() {
  const commands = useCommands();
  const boot = usePrinterStore((state) => state.boot);
  const runAction = usePrinterStore((state) => state.runAction);
  const connectionState = usePrinterStore((state) => state.connectionState);
  const versions = usePrinterStore((state) => state.versions);
  const updateCount = usePrinterStore((state) => state.updateCount);
  const detectedUpdates = usePrinterStore((state) => state.detectedUpdates);
  const [updateFeedback, setUpdateFeedback] = useState<UiUpdateStatus>({
    status: 'idle',
    logs: [],
    lastLog: '',
    error: '',
    currentCommit: '',
    targetCommit: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const pendingUpdates = detectedUpdates.filter((entry) => entry.isPending);

  const commitLabel = useMemo(() => {
    if (updateFeedback.currentCommit && updateFeedback.targetCommit) {
      return `${updateFeedback.currentCommit} → ${updateFeedback.targetCommit}`;
    }
    return updateFeedback.targetCommit || updateFeedback.currentCommit;
  }, [updateFeedback.currentCommit, updateFeedback.targetCommit]);

  const feedbackMessage = updateFeedback.error
    || updateFeedback.lastLog
    || (updateFeedback.status === 'running' ? 'Update in progress…' : '');

  const onUpdateAll = async () => {
    setIsUpdating(true);
    setUpdateFeedback({
      status: 'running',
      logs: [],
      lastLog: 'Starting full update…',
      error: '',
      currentCommit: '',
      targetCommit: '',
    });

    await runAction('Update All', async () => {
      try {
        await commands.updateAll();
        setUpdateFeedback((state) => ({
          ...state,
          status: 'success',
          lastLog: 'Full update requested. Reloading when complete…',
        }));
        window.setTimeout(() => {
          window.location.reload();
        }, 2500);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Full update failed.';
        setUpdateFeedback((state) => ({
          ...state,
          status: 'error',
          error: message,
          lastLog: message,
        }));
        throw error;
      }
    });

    setIsUpdating(false);
  };

  const onUpdateTarget = async (name: string) => {
    setIsUpdating(true);
    setUpdateFeedback({
      status: 'running',
      logs: [],
      lastLog: `Starting ${name} update…`,
      error: '',
      currentCommit: '',
      targetCommit: '',
    });

    await runAction(`Update ${name}`, async () => {
      try {
        await commands.updateTarget(name);
        setUpdateFeedback((state) => ({
          ...state,
          status: 'success',
          lastLog: `${name} update requested. Reloading when complete…`,
        }));
        window.setTimeout(() => {
          window.location.reload();
        }, 2500);
      } catch (error) {
        const message = error instanceof Error ? error.message : `${name} update failed.`;
        setUpdateFeedback((state) => ({
          ...state,
          status: 'error',
          error: message,
          lastLog: message,
        }));
        throw error;
      }
    });

    setIsUpdating(false);
  };

  return (
    <Layout title="Updates" subtitle="Versions + Logs">
      <section className="status-row">
        <article className="status-chip"><div className="k">System</div><div className="v">{connectionState === 'online' ? 'Ready' : 'Offline'}</div></article>
        <article className="status-chip"><div className="k">Moonraker</div><div className="v">{versions.moonraker || '-'}</div></article>
        <article className="status-chip"><div className="k">Updates</div><div className="v">{updateCount}</div></article>
      </section>

      <section className="card">
        <div className="card-label">Installed Versions</div>
        <div className="card-title">Core Services</div>
        <div className="kv"><span>Klipper</span><strong>{versions.klipper || '-'}</strong></div>
        <div className="kv"><span>Moonraker</span><strong>{versions.moonraker || '-'}</strong></div>
        <div className="kv"><span>Mainsail</span><strong>{versions.mainsail || '-'}</strong></div>
        <div className="kv"><span>Fluidd</span><strong>{versions.fluidd || '-'}</strong></div>
      </section>

      <section className="card">
        <div className="card-label">Available Updates</div>
        <div className="card-title">Queue</div>
        <div className="file-item">{updateCount > 0 ? `${updateCount} updates reported by Moonraker` : 'No pending updates reported'}</div>
        {commitLabel ? <div className="file-item">Commit: {commitLabel}</div> : null}
        {feedbackMessage ? <div className="file-item">Status: {feedbackMessage}</div> : null}
        {pendingUpdates.length > 0 ? (
          <div className="btn-row updates-actions top-gap">
            {pendingUpdates.map((entry) => (
              <button
                key={entry.name}
                type="button"
                className="btn"
                onClick={() => { void onUpdateTarget(entry.name); }}
                disabled={isUpdating}
              >
                Update {entry.displayName}
              </button>
            ))}
          </div>
        ) : null}
        <div className="btn-row updates-actions">
          <button type="button" className="btn accent" onClick={() => boot()}>Refresh</button>
          <button
            type="button"
            className="btn"
            onClick={() => { void onUpdateAll(); }}
            disabled={isUpdating || pendingUpdates.length === 0}
          >
            Update All
          </button>
          <button type="button" className="btn" onClick={() => runAction('Restart Klipper', () => commands.systemAction('restart-klipper'))}>Restart Klipper</button>
          <button type="button" className="btn" onClick={() => runAction('Restart Host', () => commands.systemAction('restart-host'))}>Restart Host</button>
        </div>
      </section>
    </Layout>
  );
}
