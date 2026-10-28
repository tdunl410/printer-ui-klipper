# Klipper Portrait Touch UI

Production-oriented touchscreen UI for Klipper printers, designed for portrait Waveshare panels and Moonraker integration.

## Implemented
- React + TypeScript + Vite app with route-per-screen architecture.
- Mockup-matching portrait UI frame (`400x1280` locked ratio) and touch-first components.
- Moonraker REST snapshot fetch + WebSocket live updates with reconnect behavior.
- Core operator routes: Home, Print, Files, Move, Preheat, Extrude, Console, Settings, Connectivity, Updates.
- Command action layer for print lifecycle, heater/fan controls, movement, extrusion, and macros.
- Command queue feedback toast (`pending/success/error`) and confirm gates for destructive actions.
- Theme tokens with runtime switching (purple default + blue/green/rose).

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
git clone <your-repo-url> printer_ui
cd printer_ui
chmod +x scripts/install-printer-ui.sh scripts/update-printer-ui.sh
./scripts/install-printer-ui.sh
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

Enable kiosk mode:
```bash
sudo systemctl enable --now printer-ui-kiosk.service
```

## Update After Changes
```bash
./scripts/update-printer-ui.sh
```

## Moonraker Connectivity
- Edit Base URL and WebSocket URL from the `Connectivity` screen.
- Values persist in local storage and are used on reconnect/boot.

## Notes
- Hardware emergency stop remains out-of-band and should remain physical/hardware-first.
- Existing docs and mockups are kept in `docs/` and `mockups/` for parity tracking and further iteration.
