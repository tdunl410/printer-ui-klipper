#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Do not run as root. Run as your regular printer user with sudo access."
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="/opt/printer-ui"
SERVICE_FILE="/etc/systemd/system/printer-ui.service"
KIOSK_SERVICE_FILE="/etc/systemd/system/printer-ui-kiosk.service"
ENV_FILE="/etc/default/printer-ui"
PORT="${PRINTER_UI_PORT:-4409}"
HOST="${PRINTER_UI_HOST:-127.0.0.1}"

echo "Installing Printer UI from ${REPO_DIR}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node 20+ first." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Install Node.js/npm first." >&2
  exit 1
fi

pushd "${REPO_DIR}" >/dev/null

if [[ ! -f package-lock.json ]]; then
  npm install
fi

npm ci
npm run build

sudo mkdir -p "${INSTALL_DIR}/dist" "${INSTALL_DIR}/server"
sudo cp -r dist/* "${INSTALL_DIR}/dist/"
sudo cp server/static-server.mjs "${INSTALL_DIR}/server/static-server.mjs"

cat <<EOF | sudo tee "${ENV_FILE}" >/dev/null
PRINTER_UI_HOST=${HOST}
PRINTER_UI_PORT=${PORT}
PRINTER_UI_DIST=${INSTALL_DIR}/dist
EOF

cat <<EOF | sudo tee "${SERVICE_FILE}" >/dev/null
[Unit]
Description=Printer UI Static Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node ${INSTALL_DIR}/server/static-server.mjs
Restart=always
RestartSec=2
User=${USER}
Group=${USER}

[Install]
WantedBy=multi-user.target
EOF

cat <<EOF | sudo tee "${KIOSK_SERVICE_FILE}" >/dev/null
[Unit]
Description=Printer UI Chromium Kiosk
After=graphical.target printer-ui.service
Wants=printer-ui.service

[Service]
Type=simple
Environment=DISPLAY=:0
ExecStart=/bin/bash -lc 'CHROME_BIN=$(command -v chromium-browser || command -v chromium || command -v google-chrome || true); if [[ -z "$CHROME_BIN" ]]; then echo "Chromium not found"; exit 1; fi; "$CHROME_BIN" --kiosk --app=http://${HOST}:${PORT} --disable-pinch --overscroll-history-navigation=0 --noerrdialogs --disable-infobars'
Restart=always
RestartSec=3
User=${USER}
Group=${USER}

[Install]
WantedBy=graphical.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now printer-ui.service

echo
echo "Base service installed and running at http://${HOST}:${PORT}"
echo "To enable touchscreen kiosk mode, run:"
echo "  sudo systemctl enable --now printer-ui-kiosk.service"

popd >/dev/null
