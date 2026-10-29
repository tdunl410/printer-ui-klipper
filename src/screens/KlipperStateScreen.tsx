import { useState } from 'react';
import { Dialog } from '../components/Dialog';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

const titles = {
  startup: 'Klipper is starting up',
  shutdown: 'Printer is shut down',
  error: 'Klipper reported an error',
  disconnected: 'Klipper is disconnected',
  ready: '',
} as const;

// Full-screen takeover shown whenever Klipper is not ready, like Mainsail's state panel
export function KlipperStateScreen() {
  const commands = useCommands();
  const klipperState = usePrinterStore((state) => state.klipperState);
  const klipperMessage = usePrinterStore((state) => state.klipperMessage);
  const runAction = usePrinterStore((state) => state.runAction);
  const [confirmReboot, setConfirmReboot] = useState(false);

  return (
    <section className="screen">
      <section className="card">
        <div className="card-label">Klipper State: {klipperState}</div>
        <div className="card-title">{titles[klipperState]}</div>
        {klipperMessage ? <div className="state-message">{klipperMessage}</div> : null}
        <div className="state-actions top-gap">
          <button type="button" className="btn accent" onClick={() => void runAction('Firmware Restart', () => commands.firmwareRestart())}>
            Firmware Restart
          </button>
          <button type="button" className="btn" onClick={() => void runAction('Restart Klipper', () => commands.systemAction('restart-klipper'))}>
            Restart Klipper
          </button>
          <button type="button" className="btn" onClick={() => setConfirmReboot(true)}>Reboot System</button>
        </div>
      </section>

      {confirmReboot ? (
        <Dialog
          subtitle="Confirm Action"
          title="Reboot host machine?"
          actions={[
            {
              label: 'Reboot',
              variant: 'accent',
              onClick: () => {
                void runAction('Restart Host', () => commands.systemAction('restart-host'));
                setConfirmReboot(false);
              },
            },
            { label: 'Cancel', onClick: () => setConfirmReboot(false) },
          ]}
        />
      ) : null}
    </section>
  );
}
