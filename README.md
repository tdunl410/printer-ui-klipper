# Klipper Portrait Touch UI
Klipper ui designed for my annex k3 with a vertical waveshare 7.9" touchscreen



## Screenshots
Captured at the native `400x1280` portrait size (no printer connected, so values are empty).

| Home | Files | Preheat | Extrude |
|---|---|---|---|
| ![Home](docs/screenshots/home.png) | ![Files](docs/screenshots/files.png) | ![Preheat](docs/screenshots/preheat.png) | ![Extrude](docs/screenshots/extrude.png) |

| Control | Settings | Connectivity | Updates |
|---|---|---|---|
| ![Control](docs/screenshots/control.png) | ![Settings](docs/screenshots/settings.png) | ![Connectivity](docs/screenshots/connectivity.png) | ![Updates](docs/screenshots/updates.png) |

Print screen (shown while Klipper is printing or paused; this capture uses sample data):

<img src="docs/screenshots/print.png" alt="Print" width="200" />

## Repository Layout
- `src/transport` Moonraker HTTP and WebSocket clients
- `src/services` command methods wrapping mutating actions
- `src/stores` Zustand live state/store
- `src/screens` routed UI screens
- `src/components` shared frame/layout and feedback UI
- `server/static-server.mjs` production static file server for kiosk deployment
- `scripts/install-printer-ui.sh` install/build/systemd setup
- `scripts/update-printer-ui.sh` update path after `git pull`

## Local Development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Full Printer Installation (Clone-and-Install)
Run on your printer host user (non-root, must have `sudo`):

```bash
git clone https://github.com/tdunl410/printer-ui-klipper.git printer_ui
cd printer_ui
chmod +x scripts/install-printer-ui.sh scripts/update-printer-ui.sh
./scripts/install-printer-ui.sh
```

The installer now auto-installs/upgrades Node.js 20+ on Raspberry Pi OS/Debian (apt-based) when needed.
Default method uses official Node.js 20 binary install first (avoids apt mirror/package drift issues), then falls back to apt.

Recommended on Raspberry Pi:
```bash
INSTALL_NODE_METHOD=binary ./scripts/install-printer-ui.sh
```

This installs:
- `/opt/printer-ui/dist` static frontend files
- `/opt/printer-ui/server/static-server.mjs` runtime server
- `/etc/default/printer-ui` server runtime environment
- `printer-ui.service` systemd service (enabled + started)
- `printer-ui-kiosk.service` systemd template for Chromium kiosk

Service URLs:
- Default host/port: `127.0.0.1:4409`
- Configure via env vars before install: `PRINTER_UI_HOST`, `PRINTER_UI_PORT`

If you want to disable automatic Node installation:
```bash
AUTO_INSTALL_NODE=0 ./scripts/install-printer-ui.sh
```

Force apt-based Node installation (if you prefer package manager flow):
```bash
INSTALL_NODE_METHOD=apt ./scripts/install-printer-ui.sh
```

Manual Node fallback (if your image blocks auto-install):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Enable kiosk mode:
```bash
sudo systemctl enable --now printer-ui-kiosk.service
```

If kiosk restarts or the panel blinks/clears, check:
```bash
systemctl status printer-ui-kiosk.service --no-pager
journalctl -u printer-ui-kiosk.service -n 120 --no-pager
tail -n 120 /tmp/printer-ui-kiosk.log
```

## Update After Changes
```bash
./scripts/update-printer-ui.sh
```


