import { useCallback, useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { WifiNetworks } from '../components/WifiNetworks';
import { usePrinterStore } from '../stores/usePrinterStore';

interface WifiApiNetwork {
  ssid: string;
  signal: number;
  secured: boolean;
  connected: boolean;
  ipAddress?: string;
  ipAddresses?: string[];
}

export function ConnectivityScreen() {
  const connection = usePrinterStore((state) => state.connection);
  const connectionState = usePrinterStore((state) => state.connectionState);
  const boot = usePrinterStore((state) => state.boot);
  const [apiConnectedWifi, setApiConnectedWifi] = useState<WifiApiNetwork | null>(null);

  const wifi = connection.networkInterfaces.find((entry) => entry.type === 'wifi');
  const ethernet = connection.networkInterfaces.find((entry) => entry.type === 'ethernet');
  const wifiConnected = Boolean(wifi?.isUp || apiConnectedWifi);
  const wifiIp = wifi?.ipAddresses.find(Boolean);
  const apiWifiIp = apiConnectedWifi?.ipAddresses?.find(Boolean) || apiConnectedWifi?.ipAddress;
  const ethernetIp = ethernet?.ipAddresses.find(Boolean);
  const activeInterfaceIp = connection.networkInterfaces
    .find((entry) => entry.isUp && entry.ipAddresses.length > 0)
    ?.ipAddresses.find(Boolean);
  const displayedIpAddress = wifiIp || apiWifiIp || ethernetIp || activeInterfaceIp || '-';

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
        <div className="card-title">Wi-Fi</div>
        <div className="kv"><span>SSID</span><strong>{wifi?.ssid || apiConnectedWifi?.ssid || '-'}</strong></div>
        <div className="kv"><span>Signal</span><strong>{typeof wifi?.signalDbm === 'number' ? `${wifi.signalDbm} dBm` : typeof apiConnectedWifi?.signal === 'number' ? `${apiConnectedWifi.signal}%` : '-'}</strong></div>
        <div className="kv"><span>IP Address</span><strong>{displayedIpAddress}</strong></div>
      </section>

      <WifiNetworks onConnected={() => {
        boot();
        void refreshConnectedWifi();
      }} />


    </Layout>
  );
}
