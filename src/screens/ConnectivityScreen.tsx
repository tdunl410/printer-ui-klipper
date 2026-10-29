import { useState } from 'react';
import { Layout } from '../components/Layout';
import { KeyboardInput } from '../components/OnScreenKeyboard';
import { WifiNetworks } from '../components/WifiNetworks';
import { usePrinterStore } from '../stores/usePrinterStore';

export function ConnectivityScreen() {
  const connection = usePrinterStore((state) => state.connection);
  const connectionState = usePrinterStore((state) => state.connectionState);
  const setConnectionUrls = usePrinterStore((state) => state.setConnectionUrls);
  const boot = usePrinterStore((state) => state.boot);
  const [baseUrl, setBaseUrl] = useState(connection.moonrakerBaseUrl);
  const [wsUrl, setWsUrl] = useState(connection.websocketUrl);

  const wifi = connection.networkInterfaces.find((entry) => entry.type === 'wifi');
  const ethernet = connection.networkInterfaces.find((entry) => entry.type === 'ethernet');

  return (
    <Layout title="Connectivity" subtitle="Moonraker + Network">
      <section className="status-row">
        <article className="status-chip"><div className="k">Moonraker</div><div className={`v ${connectionState === 'online' ? 'status-ok' : ''}`}>{connectionState === 'online' ? 'Online' : 'Offline'}</div></article>
        <article className="status-chip"><div className="k">Wi-Fi</div><div className={`v ${wifi?.isUp ? 'status-ok' : ''}`}>{wifi?.isUp ? 'Connected' : 'Inactive'}</div></article>
        <article className="status-chip"><div className="k">Ethernet</div><div className={`v ${ethernet?.isUp ? 'status-ok' : ''}`}>{ethernet?.isUp ? 'Connected' : 'Inactive'}</div></article>
      </section>

      <section className="card">
        <div className="card-label">Connection</div>
        <div className="card-title">Moonraker</div>
        <label className="field-label">Base URL</label>
        <KeyboardInput label="Base URL" value={baseUrl} onChange={setBaseUrl} />
        <label className="field-label">WebSocket URL</label>
        <KeyboardInput label="WebSocket URL" value={wsUrl} onChange={setWsUrl} />
        <div className="btn-row top-gap">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setConnectionUrls(baseUrl, wsUrl);
              boot();
            }}
          >
            Reconnect
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setConnectionUrls(baseUrl, wsUrl);
              boot();
            }}
          >
            Switch Host
          </button>
          <button type="button" className="btn" onClick={() => boot()}>Test API</button>
        </div>
      </section>

      <section className="card">
        <div className="card-label">Wireless</div>
        <div className="card-title">Wi-Fi</div>
        <div className="kv"><span>SSID</span><strong>{wifi?.ssid || '-'}</strong></div>
        <div className="kv"><span>Signal</span><strong>{typeof wifi?.signalDbm === 'number' ? `${wifi.signalDbm} dBm` : '-'}</strong></div>
        <div className="kv"><span>IP Address</span><strong>{wifi?.ipAddresses[0] || '-'}</strong></div>
        <div className="kv"><span>Gateway</span><strong>{wifi?.gateway || '-'}</strong></div>
      </section>

      <WifiNetworks onConnected={() => boot()} />

      <section className="card">
        <div className="card-label">Wired</div>
        <div className="card-title">Ethernet</div>
        <div className="kv"><span>Link</span><strong>{ethernet?.isUp ? 'Connected' : 'Disconnected'}</strong></div>
        <div className="kv"><span>IP Address</span><strong>{ethernet?.ipAddresses[0] || '-'}</strong></div>
        <div className="kv"><span>Gateway</span><strong>{ethernet?.gateway || '-'}</strong></div>
      </section>

    </Layout>
  );
}
