# TigerScreen
This project started because I didn't like the look of KlipperScreen, and since I'm running a somewhat nonstandard VERRRRYYY tall 7.9" screen on one of my printers, the other user interfaces just didn't look right. 
Originally it was designed with the express purpose of being for portrait layout, but with some css trickery I have managed to make it look not bad in landscape as well. 
This is still very much a work in progress, a lot of the UI may change in the future. 

Some features arent implemented yet, some lowkey I just forgot existed so when i remember about them ill implement them. 

Plz support me I dont want to maintain this but i will if u donate:))))
https://buymeacoffee.com/tiger3dprinting

## Screenshots
### Portrait layout (400x1280)
These screenshots use the default purple accent and `printer-render`.

| Home | Files | Preheat | Extrude |
|---|---|---|---|
| ![Home](docs/screenshots/home.png) | ![Files](docs/screenshots/files.png) | ![Preheat](docs/screenshots/preheat.png) | ![Extrude](docs/screenshots/extrude.png) |

| Control | Settings | Appearance | Connectivity |
|---|---|---|---|
| ![Control](docs/screenshots/control.png) | ![Settings](docs/screenshots/settings.png) | ![Appearance](docs/screenshots/appearance.png) | ![Connectivity](docs/screenshots/connectivity.png) |



Print and Live Tune screens (shown while Klipper is printing or paused; these captures use sample data). 

<img src="docs/screenshots/print.png" alt="Print" width="200" /> <img src="docs/screenshots/live-tune.png" alt="Live Tune" width="200" />

Updates screen

<img src="docs/screenshots/updates.png" alt="Updates" width="200" />

### Landscape layout (800x480 for a 480x800 display rotated horizontally)
These screenshots use the red accent and `printer-render2`.

| Home | Files | Control |
|---|---|---|
| ![Home](docs/screenshots/Home-Horizontal.png) | ![Files](docs/screenshots/Files-Horizontal.png) | ![Control](docs/screenshots/Control-Horizontal.png) |

| Preheat | Extrude | Settings |
|---|---|---|
| ![Preheat](docs/screenshots/Preheat-Horizontal.png) | ![Extrude](docs/screenshots/Extrude-Horizontal.png) | ![Settings](docs/screenshots/Settings-Horizontal.png) |

| Appearance | Connectivity | Updates |
|---|---|---|
| ![Appearance](docs/screenshots/Appearance-Horizontal.png) | ![Connectivity](docs/screenshots/Connectivity-Horizontal.png) | ![Updates](docs/screenshots/Updates-Horizontal.png) |

| Print | Live Tune |
|---|---|
| ![Print](docs/screenshots/Print-Horizontal.png) | ![Live Tune](docs/screenshots/Live-Tune-Horizontal.png) |

## Main Installation (Recommended)
Run on your printer host user (non-root, must have `sudo`):

```bash
git clone https://github.com/tdunl410/printer-ui-klipper.git printer_ui
cd printer_ui
chmod +x scripts/install-printer-ui.sh scripts/update-printer-ui.sh scripts/uninstall-printer-ui.sh
INSTALL_NODE_METHOD=binary ./scripts/install-printer-ui.sh
```

This installs:
- `/opt/printer-ui/dist` static frontend files
- `/opt/printer-ui/server/static-server.mjs` runtime server
- `/opt/printer-ui/server/kiosk-launch.sh` kiosk launcher (source: `server/kiosk-launch.sh`)
- display tools used by the launcher: `xdotool`, `x11-utils`, `x11-xserver-utils`
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

The kiosk launcher always sizes the Chromium window to the exact X screen resolution
(for example `400x1280`). It runs without a window manager, so it detects the size with
`xdpyinfo`/`xrandr` and keeps the window pinned to it with `xdotool`. To force a size, set
`PRINTER_UI_WINDOW_SIZE=400,1280` in `/etc/default/printer-ui`.

The kiosk launch defaults also disable non-kiosk Chromium features and disable
BackForwardCache/site isolation trials to reduce memory usage on low-resource systems.

## Update After Changes
```bash
cd ~/printer_ui
./scripts/update-printer-ui.sh
sudo systemctl restart printer-ui.service
sudo systemctl restart printer-ui-kiosk.service
```

## Moonraker Update Manager
Add this to `moonraker.conf` to let Moonraker manage updates for printer-ui:

```ini
[update_manager]
channel: dev

[update_manager printer-ui]
type: git_repo
channel: dev
path: /home/pi/printer_ui
origin: https://github.com/tdunl410/printer-ui-klipper.git
primary_branch: main
managed_services:
  printer-ui
```

Then restart Moonraker and confirm the entry appears in update status:

```bash
sudo systemctl restart moonraker
curl -s http://127.0.0.1:7125/machine/update/status | jq
```

Notes:
- Set `path` to your real git clone location (not `/opt/printer-ui`).
- If you use a fork, change `origin` to your repository URL.

## Uninstall
Run from your repo as your regular printer user (non-root, with `sudo`):

```bash
cd ~/printer_ui
./scripts/uninstall-printer-ui.sh
```

This removes:
- `/opt/printer-ui`
- `/etc/default/printer-ui`
- `/etc/systemd/system/printer-ui.service`
- `/etc/systemd/system/printer-ui-kiosk.service`
- your cloned `printer_ui` repo directory

It also stops/disables the `printer-ui.service` and `printer-ui-kiosk.service` units if present,
then reloads systemd.

It does **not** remove Node.js, Chromium, or display tools.

## Troubleshooting / Known Issues
- Node install issues: [docs/issues/node-install.md](docs/issues/node-install.md)
- Chromium install issues: [docs/issues/chromium-install.md](docs/issues/chromium-install.md)
- UI only fills part of the screen: see [docs/issues/kiosk-window-size.md](docs/issues/kiosk-window-size.md)
- Kiosk restarts or screen blinking: [docs/issues/kiosk-restarts-or-blinking.md](docs/issues/kiosk-restarts-or-blinking.md)
- Update button/source path issues: [docs/issues/update-source-path.md](docs/issues/update-source-path.md)
- `npm ci` lockfile drift issues: [docs/issues/npm-lockfile-drift.md](docs/issues/npm-lockfile-drift.md)
- Disabling KlipperScreen service: [docs/issues/disable-klipperscreen.md](docs/issues/disable-klipperscreen.md)

## Local Development
```bash
npm install
npm run dev
```

Regenerate all README screenshots using built-in sample printer data; no printer connection is needed. This requires Node.js 22+ and Chrome/Chromium (`CHROME_BIN` can select a non-default browser path):

```bash
npm run screenshots
```

## Build
```bash
npm run build
npm run preview
```
