#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Do not run as root. Run as your regular printer user with sudo access."
  exit 1
fi

DEFAULT_REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="${PRINTER_UI_SOURCE_DIR:-${DEFAULT_REPO_DIR}}"
INSTALL_DIR="/opt/printer-ui"

npm_is_healthy() {
  command -v npm >/dev/null 2>&1 && npm --version >/dev/null 2>&1
}

install_dependencies() {
  if [[ -f package-lock.json ]]; then
    set +e
    npm ci
    local ci_status=$?
    set -e

    if [[ ${ci_status} -eq 0 ]]; then
      return 0
    fi

    echo "npm ci failed (likely lockfile drift/corruption). Falling back to npm install to recover."
    npm install
    return 0
  fi

  echo "package-lock.json not found; running npm install to regenerate lockfile."
  npm install
}

pushd "${REPO_DIR}" >/dev/null

if [[ ! -d .git ]]; then
  echo "No git repository found at ${REPO_DIR}."
  echo "Set PRINTER_UI_SOURCE_DIR in /etc/default/printer-ui to your cloned repo path (for example: /home/pi/printer_ui)."
  popd >/dev/null
  exit 1
fi

CURRENT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "UPDATE_INFO current_commit=${CURRENT_COMMIT}"

git pull --ff-only

TARGET_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "UPDATE_INFO target_commit=${TARGET_COMMIT}"

if ! npm_is_healthy; then
  echo "npm is missing or broken. Running installer to repair Node.js toolchain and deploy update..."
  INSTALL_NODE_METHOD="${INSTALL_NODE_METHOD:-binary}" AUTO_INSTALL_NODE=1 ./scripts/install-printer-ui.sh
  popd >/dev/null
  exit 0
fi

install_dependencies
npm run build
sudo mkdir -p "${INSTALL_DIR}/dist"
sudo cp -r dist/* "${INSTALL_DIR}/dist/"
sudo mkdir -p "${INSTALL_DIR}/server"
sudo cp server/static-server.mjs "${INSTALL_DIR}/server/static-server.mjs"
nohup bash -lc 'sleep 2; sudo systemctl restart printer-ui.service' >/dev/null 2>&1 &
echo "Update complete."
popd >/dev/null
