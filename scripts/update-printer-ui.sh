#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Do not run as root. Run as your regular printer user with sudo access."
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="/opt/printer-ui"

npm_is_healthy() {
  command -v npm >/dev/null 2>&1 && npm --version >/dev/null 2>&1
}

pushd "${REPO_DIR}" >/dev/null
git pull --ff-only

if ! npm_is_healthy; then
  echo "npm is missing or broken. Running installer to repair Node.js toolchain and deploy update..."
  INSTALL_NODE_METHOD="${INSTALL_NODE_METHOD:-binary}" AUTO_INSTALL_NODE=1 ./scripts/install-printer-ui.sh
  popd >/dev/null
  exit 0
fi

npm ci
npm run build
sudo mkdir -p "${INSTALL_DIR}/dist"
sudo cp -r dist/* "${INSTALL_DIR}/dist/"
sudo systemctl restart printer-ui.service
echo "Update complete."
popd >/dev/null
