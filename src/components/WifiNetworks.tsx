import { useCallback, useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { KeyboardInput } from './OnScreenKeyboard';

interface WifiNetwork {
  ssid: string;
  signal: number;
  secured: boolean;
  connected: boolean;
}

async function wifiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

export function WifiNetworks({ onConnected }: { onConnected?: () => void }) {
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<WifiNetwork | null>(null);
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  const scan = useCallback(async (rescan: boolean) => {
    setScanning(true);
    setError('');
    try {
      const result = await wifiRequest<{ networks: WifiNetwork[] }>(`/api/wifi/networks${rescan ? '?rescan=1' : ''}`);
      setNetworks(result.networks);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to scan for networks');
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    void scan(false);
  }, [scan]);

  const closeDialog = () => {
    setSelected(null);
    setPassword('');
    setConnectError('');
  };

  const connect = async () => {
    if (!selected) return;
    setConnecting(true);
    setConnectError('');
    try {
      await wifiRequest('/api/wifi/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid: selected.ssid, password }),
      });
      closeDialog();
      await scan(false);
      onConnected?.();
    } catch (caught) {
      setConnectError(caught instanceof Error ? caught.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const current = networks.find((network) => network.connected);

  return (
    <section className="card">
      <div className="card-label">Wireless</div>
      <div className="card-title">Available Networks</div>
      <div className="kv"><span>Connected to</span><strong>{current?.ssid || '-'}</strong></div>
      {error ? <div className="field-label">{error}</div> : null}
      {networks.map((network) => (
        <button
          type="button"
          className="macro-item button-reset"
          key={network.ssid}
          onClick={() => {
            if (!network.connected) setSelected(network);
          }}
        >
          <span>{network.ssid}</span>
          <strong>{network.connected ? 'Connected' : `${network.secured ? 'Secured · ' : ''}${network.signal}%`}</strong>
        </button>
      ))}
      {!scanning && !error && networks.length === 0 ? <div className="field-label">No networks found</div> : null}
      <div className="btn-row top-gap">
        <button type="button" className="btn" onClick={() => void scan(true)} disabled={scanning}>
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {selected ? (
        <Dialog
          subtitle="Connect to Wi-Fi"
          title={selected.ssid}
          actions={[
            { label: connecting ? 'Connecting…' : 'Connect', variant: 'accent', onClick: () => void connect(), disabled: connecting || (selected.secured && password.length < 8) },
            { label: 'Cancel', onClick: closeDialog, disabled: connecting },
          ]}
        >
          {selected.secured ? (
            <>
              <label className="field-label">Password</label>
              <KeyboardInput label="Wi-Fi password" secret value={password} onChange={setPassword} />
            </>
          ) : null}
          {connectError ? <div className="field-label">{connectError}</div> : null}
        </Dialog>
      ) : null}
    </section>
  );
}
