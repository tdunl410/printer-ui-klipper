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

package_available() {
  local pkg="$1"
  apt-cache show "${pkg}" >/dev/null 2>&1
}

ensure_kiosk_runtime() {
  local apt_opts=("-o" "Acquire::Retries=5" "-o" "Acquire::ForceIPv4=true")

  local need_install=0
  command -v xinit >/dev/null 2>&1 || need_install=1
  command -v cog >/dev/null 2>&1 || need_install=1

  if [[ "${need_install}" -eq 0 ]]; then
    return 0
  fi

  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Kiosk runtime dependencies missing and apt-get is unavailable." >&2
    echo "Install manually: xinit xserver-xorg cog" >&2
    exit 1
  fi

  echo "Installing kiosk runtime dependencies (xinit + cog)..."

  if ! sudo apt-get "${apt_opts[@]}" update; then
    echo "Initial apt update failed. Resetting apt metadata and retrying..."
    sudo apt-get clean
    sudo rm -rf /var/lib/apt/lists/*
    sudo apt-get "${apt_opts[@]}" update
  fi

  if ! command -v xinit >/dev/null 2>&1; then
    sudo apt-get "${apt_opts[@]}" install -y --no-install-recommends xinit xserver-xorg
  fi

  if ! command -v cog >/dev/null 2>&1; then
    if ! package_available cog; then
      echo "No cog package found in apt repositories." >&2
      exit 1
    fi

    if ! sudo apt-get "${apt_opts[@]}" install -y --no-install-recommends cog; then
      echo "cog install failed, refreshing apt metadata and retrying once..."
      sudo apt-get clean
      sudo rm -rf /var/lib/apt/lists/*
      sudo apt-get "${apt_opts[@]}" update
      sudo apt-get "${apt_opts[@]}" install -y --no-install-recommends cog
    fi
  fi

  if package_available cog-platform-x11; then
    sudo apt-get "${apt_opts[@]}" install -y --no-install-recommends cog-platform-x11 || \
      echo "Warning: could not install cog-platform-x11; set PRINTER_UI_COG_PLATFORM=drm if x11 is unavailable"
  fi

  if package_available cog-platform-drm; then
    sudo apt-get "${apt_opts[@]}" install -y --no-install-recommends cog-platform-drm || \
      echo "Warning: could not install cog-platform-drm"
  fi

  if package_available wpebackend-fdo; then
    sudo apt-get "${apt_opts[@]}" install -y --no-install-recommends wpebackend-fdo || \
      echo "Warning: could not install wpebackend-fdo"
  elif package_available libwpebackend-fdo-1.0-1; then
    sudo apt-get "${apt_opts[@]}" install -y --no-install-recommends libwpebackend-fdo-1.0-1 || \
      echo "Warning: could not install libwpebackend-fdo-1.0-1"
  fi
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

ensure_kiosk_runtime
install_dependencies
npm run build
sudo mkdir -p "${INSTALL_DIR}/dist"
sudo cp -r dist/* "${INSTALL_DIR}/dist/"
sudo mkdir -p "${INSTALL_DIR}/server"
sudo cp server/static-server.mjs "${INSTALL_DIR}/server/static-server.mjs"
sudo cp server/kiosk-launch.sh "${INSTALL_DIR}/server/kiosk-launch.sh"
sudo chmod +x "${INSTALL_DIR}/server/kiosk-launch.sh"
for tool_pkg in xdotool:xdotool xdpyinfo:x11-utils xrandr:x11-xserver-utils; do
  if ! command -v "${tool_pkg%%:*}" >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
    sudo apt-get install -y --no-install-recommends "${tool_pkg##*:}" || echo "Warning: could not install ${tool_pkg##*:}"
  fi
done
nohup bash -lc 'sleep 2; sudo systemctl restart printer-ui.service; sudo systemctl try-restart printer-ui-kiosk.service 2>/dev/null || true' >/dev/null 2>&1 &
echo "Update complete."
popd >/dev/null
