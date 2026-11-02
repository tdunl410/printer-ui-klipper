# Klipper Portrait Touch UI
Klipper UI for a portrait Waveshare 7.9" touchscreen setup.

## Main Installation (Recommended)
Run on your printer host user (non-root, must have `sudo`):

```bash
git clone https://github.com/tdunl410/printer-ui-klipper.git printer_ui
cd printer_ui
chmod +x scripts/install-printer-ui.sh scripts/update-printer-ui.sh
INSTALL_NODE_METHOD=binary ./scripts/install-printer-ui.sh
```

This installs:
- `/opt/printer-ui/dist` static frontend files
- `/opt/printer-ui/server/static-server.mjs` runtime server
- `/etc/default/printer-ui` runtime environment
- `printer-ui.service` systemd service (enabled + started)
- `printer-ui-kiosk.service` systemd service (available for Chromium kiosk mode)

Defaults:
- Host/port: `127.0.0.1:4409`
- Override before install with: `PRINTER_UI_HOST`, `PRINTER_UI_PORT`

Enable kiosk mode:

```bash
sudo systemctl enable --now printer-ui-kiosk.service
```

## Update After Changes
```bash
cd ~/printer_ui
./scripts/update-printer-ui.sh
sudo systemctl restart printer-ui.service
sudo systemctl restart printer-ui-kiosk.service
```

## Troubleshooting / Known Issues
- Node install issues: [docs/issues/node-install.md](docs/issues/node-install.md)
- Chromium install issues: [docs/issues/chromium-install.md](docs/issues/chromium-install.md)
- Kiosk restarts or screen blinking: [docs/issues/kiosk-restarts-or-blinking.md](docs/issues/kiosk-restarts-or-blinking.md)
- Update button/source path issues: [docs/issues/update-source-path.md](docs/issues/update-source-path.md)
- `npm ci` lockfile drift issues: [docs/issues/npm-lockfile-drift.md](docs/issues/npm-lockfile-drift.md)
- Disabling KlipperScreen service: [docs/issues/disable-klipperscreen.md](docs/issues/disable-klipperscreen.md)

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