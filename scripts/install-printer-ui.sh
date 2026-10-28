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
AUTO_INSTALL_NODE="${AUTO_INSTALL_NODE:-1}"

echo "Installing Printer UI from ${REPO_DIR}"

node_major_version() {
  node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo "0"
}

install_node_20_debian() {
  echo "Installing Node.js 20.x via NodeSource apt repository..."
  sudo apt-get clean
  sudo apt-get update -o Acquire::Retries=3

  local prereq_missing=()
  if ! dpkg -s ca-certificates >/dev/null 2>&1; then
    prereq_missing+=(ca-certificates)
  fi
  if ! command -v curl >/dev/null 2>&1; then
    prereq_missing+=(curl)
  fi
  if ! command -v gpg >/dev/null 2>&1; then
    prereq_missing+=(gnupg)
  fi

  if [[ "${#prereq_missing[@]}" -gt 0 ]]; then
    sudo apt-get install -y --no-install-recommends -o Acquire::Retries=3 "${prereq_missing[@]}"
  fi

  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get update -o Acquire::Retries=3
  sudo apt-get install -y --no-install-recommends -o Acquire::Retries=3 nodejs
}

ensure_node_20() {
  local has_node=0
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    has_node=1
  fi

  if [[ "${has_node}" -eq 1 ]]; then
    local current_major
    current_major="$(node_major_version)"
    if [[ "${current_major}" -ge 20 ]]; then
      return 0
    fi
    echo "Detected Node.js ${current_major}.x, but 20+ is required."
  else
    echo "Node.js and npm are not installed."
  fi

  if [[ "${AUTO_INSTALL_NODE}" != "1" ]]; then
    echo "Node.js 20+ is required. Install it manually, or re-run with AUTO_INSTALL_NODE=1." >&2
    exit 1
  fi

  if command -v apt-get >/dev/null 2>&1; then
    install_node_20_debian
  else
    echo "Automatic Node install is only implemented for apt-based systems." >&2
    echo "Install Node.js 20+ manually and re-run this installer." >&2
    exit 1
  fi

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "Node.js installation did not complete successfully." >&2
    exit 1
  fi

  local new_major
  new_major="$(node_major_version)"
  if [[ "${new_major}" -lt 20 ]]; then
    echo "Installed Node.js ${new_major}.x, but 20+ is required." >&2
    exit 1
  fi
}

ensure_node_20
NODE_BIN="$(command -v node)"

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
ExecStart=${NODE_BIN} ${INSTALL_DIR}/server/static-server.mjs
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
