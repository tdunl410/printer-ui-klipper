import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Dialog } from './components/Dialog';
import { DeviceFrame } from './components/DeviceFrame';
import { CommandToast } from './components/CommandToast';
import { ConnectivityScreen } from './screens/ConnectivityScreen';
import { ControlScreen } from './screens/ControlScreen';
import { ExtrudeScreen } from './screens/ExtrudeScreen';
import { FilesScreen } from './screens/FilesScreen';
import { HomeScreen } from './screens/HomeScreen';
import { KlipperStateScreen } from './screens/KlipperStateScreen';
import { PreheatScreen } from './screens/PreheatScreen';
import { PrintScreen } from './screens/PrintScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { UpdatesScreen } from './screens/UpdatesScreen';
import { useCommands, usePrinterStore } from './stores/usePrinterStore';
import { durationLabel, filamentLabel } from './utils/format';
import { fetchThumbnailUrl } from './utils/thumbnail';

interface PrintSummary {
  filename: string;
  durationSec: number;
  filamentMm: number;
}

export default function App() {
  const boot = usePrinterStore((state) => state.boot);
  const disconnect = usePrinterStore((state) => state.disconnect);
  const jobState = usePrinterStore((state) => state.job.state);
  const connectionState = usePrinterStore((state) => state.connectionState);
  const klipperState = usePrinterStore((state) => state.klipperState);
  const job = usePrinterStore((state) => state.job);
  const connection = usePrinterStore((state) => state.connection);
  const runAction = usePrinterStore((state) => state.runAction);
  const commands = useCommands();
  const location = useLocation();
  const prevJobState = useRef(jobState);
  const [summary, setSummary] = useState<PrintSummary | null>(null);
  const [summaryThumb, setSummaryThumb] = useState<string>();
  const klipperDown = klipperState !== 'ready' && connectionState === 'online';
  const activePrint = (jobState === 'printing' || jobState === 'paused') && connectionState === 'online';

  useEffect(() => {
    boot();
    return () => disconnect();
  }, [boot, disconnect]);

  useEffect(() => {
    const prev = prevJobState.current;
    prevJobState.current = jobState;
    if (jobState === 'complete' && (prev === 'printing' || prev === 'paused')) {
      setSummary({ filename: job.filename, durationSec: job.printDurationSec, filamentMm: job.filamentUsedMm });
    }
  }, [jobState, job.filename, job.printDurationSec, job.filamentUsedMm]);

  useEffect(() => {
    setSummaryThumb(undefined);
    if (!summary?.filename) return;
    let cancelled = false;
    void fetchThumbnailUrl(connection.moonrakerBaseUrl, summary.filename).then((url) => {
      if (!cancelled) setSummaryThumb(url);
    });
    return () => {
      cancelled = true;
    };
  }, [summary?.filename, connection.moonrakerBaseUrl]);

  return (
    <DeviceFrame>
      {klipperDown ? <KlipperStateScreen /> : (
        <>
      {activePrint && location.pathname !== '/print' ? <Navigate to="/print" replace /> : null}
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/print" element={<PrintScreen />} />
        <Route path="/files" element={<FilesScreen />} />
        <Route path="/move" element={<Navigate to="/control" replace />} />
        <Route path="/preheat" element={<PreheatScreen />} />
        <Route path="/extrude" element={<ExtrudeScreen />} />
        <Route path="/control" element={<ControlScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/connectivity" element={<ConnectivityScreen />} />
        <Route path="/updates" element={<UpdatesScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
        </>
      )}
      {summary ? (
        <Dialog
          subtitle="Print Complete"
          title={summary.filename}
          actions={[
            {
              label: 'Print Again',
              variant: 'accent',
              onClick: () => {
                const filename = summary.filename;
                setSummary(null);
                void runAction('Print Again', () => commands.startPrint(filename));
              },
            },
            { label: 'Close', onClick: () => setSummary(null) },
          ]}
        >
          <div className="media-thumb thumb-gap file-selected-thumb">
            {summaryThumb ? <img src={summaryThumb} alt={`${summary.filename} preview`} /> : <div className="file-thumb-placeholder">No Preview</div>}
          </div>
          <div className="kv"><span>Print Time</span><strong>{durationLabel(summary.durationSec)}</strong></div>
          <div className="kv"><span>Filament Used</span><strong>{filamentLabel(summary.filamentMm)}</strong></div>
        </Dialog>
      ) : null}
      <CommandToast />
    </DeviceFrame>
  );
}
