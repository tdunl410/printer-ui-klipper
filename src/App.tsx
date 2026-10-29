import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DeviceFrame } from './components/DeviceFrame';
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
import { usePrinterStore } from './stores/usePrinterStore';

export default function App() {
  const boot = usePrinterStore((state) => state.boot);
  const disconnect = usePrinterStore((state) => state.disconnect);
  const jobState = usePrinterStore((state) => state.job.state);
  const connectionState = usePrinterStore((state) => state.connectionState);
  const klipperState = usePrinterStore((state) => state.klipperState);
  const location = useLocation();
  const klipperDown = klipperState !== 'ready' && connectionState === 'online';
  const activePrint = (jobState === 'printing' || jobState === 'paused') && connectionState === 'online';

  useEffect(() => {
    boot();
    return () => disconnect();
  }, [boot, disconnect]);

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
    </DeviceFrame>
  );
}
