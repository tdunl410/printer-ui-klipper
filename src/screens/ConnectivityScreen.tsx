import { BackButton, Layout } from '../components/Layout';
import { usePrinterStore } from '../stores/usePrinterStore';

export function ConnectivityScreen() {
  const connection = usePrinterStore((state) => state.connection);
  const connectionState = usePrinterStore((state) => state.connectionState);
  const setConnectionUrls = usePrinterStore((state) => state.setConnectionUrls);
  const boot = usePrinterStore((state) => state.boot);

  return (
    <Layout title="Connectivity" subtitle="Moonraker + Network">
      <section className="status-row">
        <article className="status-chip"><div className="k">Moonraker</div><div className={`v ${connectionState === 'online' ? 'status-ok' : ''}`}>{connectionState === 'online' ? 'Online' : 'Offline'}</div></article>
        <article className="status-chip"><div className="k">Wi-Fi</div><div className="v status-ok">Connected</div></article>
        <article className="status-chip"><div className="k">Ethernet</div><div className="v">Inactive</div></article>
      </section>

      <section className="card">
        <div className="card-label">Connection</div>
        <div className="card-title">Moonraker</div>
        <label className="field-label">Base URL</label>
        <input
          className="input"
          defaultValue={connection.moonrakerBaseUrl}
          onBlur={(event) => setConnectionUrls(event.target.value, connection.websocketUrl)}
        />
        <label className="field-label">WebSocket URL</label>
        <input
          className="input"
          defaultValue={connection.websocketUrl}
          onBlur={(event) => setConnectionUrls(connection.moonrakerBaseUrl, event.target.value)}
        />
        <div className="btn-row top-gap">
          <button type="button" className="btn" onClick={() => boot()}>Reconnect</button>
          <button type="button" className="btn" onClick={() => boot()}>Switch Host</button>
          <button type="button" className="btn" onClick={() => boot()}>Test API</button>
        </div>
      </section>

      <section className="card">
        <div className="card-label">Wireless</div>
        <div className="card-title">Wi-Fi</div>
        <div className="kv"><span>SSID</span><strong>Workshop-5G</strong></div>
        <div className="kv"><span>Signal</span><strong>-58 dBm</strong></div>
        <div className="kv"><span>IP Address</span><strong>192.168.1.42</strong></div>
        <div className="kv"><span>Gateway</span><strong>192.168.1.1</strong></div>
      </section>

      <section className="card">
        <div className="card-label">Wired</div>
        <div className="card-title">Ethernet</div>
        <div className="kv"><span>Link</span><strong>Disconnected</strong></div>
        <div className="kv"><span>Mode</span><strong>DHCP</strong></div>
      </section>

      <BackButton to="/settings" />
    </Layout>
  );
}
