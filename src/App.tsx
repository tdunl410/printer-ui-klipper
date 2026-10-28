import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CommandToast } from './components/CommandToast';
import { DeviceFrame } from './components/DeviceFrame';
import { ConnectivityScreen } from './screens/ConnectivityScreen';
import { ControlScreen } from './screens/ControlScreen';
import { ExtrudeScreen } from './screens/ExtrudeScreen';
import { FilesScreen } from './screens/FilesScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MoveScreen } from './screens/MoveScreen';
import { PreheatScreen } from './screens/PreheatScreen';
import { PrintScreen } from './screens/PrintScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { UpdatesScreen } from './screens/UpdatesScreen';
import { usePrinterStore } from './stores/usePrinterStore';

export default function App() {
  const boot = usePrinterStore((state) => state.boot);
  const disconnect = usePrinterStore((state) => state.disconnect);

  useEffect(() => {
    boot();
    return () => disconnect();
  }, [boot, disconnect]);

  return (
    <>
      <DeviceFrame>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/print" element={<PrintScreen />} />
          <Route path="/files" element={<FilesScreen />} />
          <Route path="/move" element={<MoveScreen />} />
          <Route path="/preheat" element={<PreheatScreen />} />
          <Route path="/extrude" element={<ExtrudeScreen />} />
          <Route path="/control" element={<ControlScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/connectivity" element={<ConnectivityScreen />} />
          <Route path="/updates" element={<UpdatesScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DeviceFrame>
      <CommandToast />
    </>
  );
}
