import { useCallback, useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { KeyboardInput } from '../components/OnScreenKeyboard';
import { WifiNetworks } from '../components/WifiNetworks';
import { usePrinterStore } from '../stores/usePrinterStore';

interface WifiApiNetwork {
  ssid: string;
  signal: number;
  secured: boolean;
  connected: boolean;
}

export function ConnectivityScreen() {
  const connection = usePrinterStore((state) => state.connection);
  const connectionState = usePrinterStore((state) => state.connectionState);
  const boot = usePrinterStore((state) => state.boot);
  const [baseUrl, setBaseUrl] = useState(connection.moonrakerBaseUrl);
  const [wsUrl, setWsUrl] = useState(connection.websocketUrl);
  const [apiConnectedWifi, setApiConnectedWifi] = useState<WifiApiNetwork | null>(null);

  const wifi = connection.networkInterfaces.find((entry) => entry.type === 'wifi');
  const ethernet = connection.networkInterfaces.find((entry) => entry.type === 'ethernet');
  const wifiConnected = Boolean(wifi?.isUp || apiConnectedWifi);

  const refreshConnectedWifi = useCallback(async () => {
    try {
      const response = await fetch('/api/wifi/networks');
      if (!response.ok) return;
      const payload = (await response.json()) as { networks?: WifiApiNetwork[] };
      if (!Array.isArray(payload.networks)) return;
      const connected = payload.networks.find((network) => network.connected) ?? null;
      setApiConnectedWifi(connected);
    } catch {
      // Keep last known/fallback values from Moonraker state.
    }
  }, []);

  useEffect(() => {
    void refreshConnectedWifi();
  }, [refreshConnectedWifi]);

  return (
    <Layout title="Connectivity" subtitle=" ">
      <section className="status-row">
        <article className="status-chip"><div className="k">Moonraker</div><div className={`v ${connectionState === 'online' ? 'status-ok' : ''}`}>{connectionState === 'online' ? 'Online' : 'Offline'}</div></article>
        <article className="status-chip"><div className="k">Wi-Fi</div><div className={`v ${wifiConnected ? 'status-ok' : ''}`}>{wifiConnected ? 'Connected' : 'Inactive'}</div></article>
        <article className="status-chip"><div className="k">Ethernet</div><div className={`v ${ethernet?.isUp ? 'status-ok' : ''}`}>{ethernet?.isUp ? 'Connected' : 'Inactive'}</div></article>
      </section>

      <section className="card">
        <div className="card-label">Connection</div>
        <div className="card-title">Moonraker</div>
        <label className="field-label">Base URL</label>
        <KeyboardInput label="Base URL" value={baseUrl} onChange={setBaseUrl} />
        <label className="field-label">WebSocket URL</label>
        <KeyboardInput label="WebSocket URL" value={wsUrl} onChange={setWsUrl} />

      </section>

      <section className="card">
        <div className="card-title">Wi-Fi</div>
        <div className="kv"><span>SSID</span><strong>{wifi?.ssid || apiConnectedWifi?.ssid || '-'}</strong></div>
        <div className="kv"><span>Signal</span><strong>{typeof wifi?.signalDbm === 'number' ? `${wifi.signalDbm} dBm` : typeof apiConnectedWifi?.signal === 'number' ? `${apiConnectedWifi.signal}%` : '-'}</strong></div>
        <div className="kv"><span>IP Address</span><strong>{wifi?.ipAddresses[0] || '-'}</strong></div>
        <div className="kv"><span>Gateway</span><strong>{wifi?.gateway || '-'}</strong></div>
      </section>

      <WifiNetworks onConnected={() => {
        boot();
        void refreshConnectedWifi();
      }} />


    </Layout>
  );
}
