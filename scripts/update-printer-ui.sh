#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Do not run as root. Run as your regular printer user with sudo access."
  exit 1
fi

DEFAULT_REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="${PRINTER_UI_SOURCE_DIR:-${DEFAULT_REPO_DIR}}"
INSTALL_DIR="/opt/printer-ui"

deploy_runtime_scripts() {
  sudo mkdir -p "${INSTALL_DIR}/server"
  sudo cp server/kiosk-launch.sh "${INSTALL_DIR}/server/kiosk-launch.sh"
  sudo chmod +x "${INSTALL_DIR}/server/kiosk-launch.sh"
  sudo cp server/static-server.mjs "${INSTALL_DIR}/server/static-server.mjs"
}

npm_is_healthy() {
  command -v npm >/dev/null 2>&1 && npm --version >/dev/null 2>&1
}

package_available() {
  local pkg="$1"
  apt-cache show "${pkg}" >/dev/null 2>&1
}

has_supported_cog_platform_module() {
  local search_roots=(
    /usr/lib
    /usr/lib64
    /usr/local/lib
    /usr/lib/aarch64-linux-gnu
    /usr/lib/arm-linux-gnueabihf
    /usr/lib/x86_64-linux-gnu
  )
  local root
  for root in "${search_roots[@]}"; do
    [[ -d "${root}" ]] || continue
    if find "${root}" -maxdepth 10 -type f \( \
      -name 'libcogplatform-drm.so*' -o \
      -name 'libcogplatform-x11.so*' -o \
      -name 'libcogplatform-gtk4.so*' -o \
      -name 'libcogplatform-gtk.so*' \
    \) 2>/dev/null | head -n1 | grep -q .; then
      return 0
    fi
  done
  return 1
}

apt_install_if_available() {
  local -a apt_opts=()
  while [[ "$#" -gt 0 ]]; do
    if [[ "$1" == "--" ]]; then
      shift
      break
    fi
    apt_opts+=("$1")
    shift
  done

  local pkg
  for pkg in "$@"; do
    if package_available "${pkg}"; then
      apt_install_with_recovery "${apt_opts[@]}" -- "${pkg}" || \
        echo "Warning: could not install ${pkg}"
    fi
  done
}

apt_update_with_recovery() {
  local -a apt_opts=("$@")

  if sudo apt-get "${apt_opts[@]}" update; then
    return 0
  fi

  echo "Initial apt update failed. Resetting apt metadata and retrying..."
  sudo apt-get clean
  sudo rm -rf /var/lib/apt/lists/*
  sudo apt-get "${apt_opts[@]}" update
}

apt_install_with_recovery() {
  local -a apt_opts=()
  while [[ "$#" -gt 0 ]]; do
    if [[ "$1" == "--" ]]; then
      shift
      break
    fi
    apt_opts+=("$1")
    shift
  done

  local -a packages=("$@")
  if [[ ${#packages[@]} -eq 0 ]]; then
    echo "apt_install_with_recovery called without package names" >&2
    return 1
  fi

  if sudo apt-get "${apt_opts[@]}" install -y --no-install-recommends "${packages[@]}"; then
    return 0
  fi

  echo "Install failed, refreshing apt metadata and retrying..."
  sudo apt-get clean
  sudo rm -rf /var/lib/apt/lists/*
  sudo apt-get "${apt_opts[@]}" update

  if sudo apt-get "${apt_opts[@]}" install -y --no-install-recommends "${packages[@]}"; then
    return 0
  fi

  local base_suite=""
  if [[ -r /etc/os-release ]]; then
    base_suite="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
  fi

  if [[ -n "${base_suite}" ]]; then
    echo "Install still failing; retrying against base suite '${base_suite}' to bypass stale security package refs..."
    sudo apt-get "${apt_opts[@]}" install -y --no-install-recommends -t "${base_suite}" "${packages[@]}"
    return $?
  fi

  return 1
}

ensure_kiosk_runtime() {
  local apt_opts=(
    "-o" "Acquire::Retries=5"
    "-o" "Acquire::ForceIPv4=true"
    "-o" "Acquire::By-Hash=true"
    "-o" "Acquire::http::No-Cache=true"
    "-o" "Acquire::https::No-Cache=true"
  )

  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Kiosk runtime dependencies missing and apt-get is unavailable." >&2
    echo "Install manually: xinit xserver-xorg cog and Cog/WPE runtime packages" >&2
    exit 1
  fi

  echo "Installing kiosk runtime dependencies..."

  apt_update_with_recovery "${apt_opts[@]}"

  apt_install_with_recovery "${apt_opts[@]}" -- xinit xserver-xorg
  apt_install_if_available "${apt_opts[@]}" -- xdotool x11-utils x11-xserver-utils

  if package_available cog; then
    apt_install_with_recovery "${apt_opts[@]}" -- cog
  else
    echo "Required package 'cog' was not found in apt repositories." >&2
    exit 1
  fi

  apt_install_if_available "${apt_opts[@]}" -- \
    cog-platform-x11 \
    cog-platform-drm \
    cog-platform-gtk4 \
    cog-platform-gtk \
    libcogplatform-x11-0 \
    libcogplatform-drm-0 \
    libcogplatform-gtk4-0 \
    libcogplatform-gtk-0 \
    libcogplatform-fdo-0 \
    cog-platform-fdo \
    cog-platform-wl \
    cog-platform-wayland

  apt_install_if_available "${apt_opts[@]}" -- \
    wpebackend-fdo \
    libwpebackend-fdo-1.0-1 \
    wpebackend-default \
    libwpebackend-default-1.0-1

  local mesa_pkgs=()
  package_available libegl-mesa0 && mesa_pkgs+=(libegl-mesa0)
  package_available libgles2-mesa && mesa_pkgs+=(libgles2-mesa)
  package_available libgbm1 && mesa_pkgs+=(libgbm1)
  if [[ ${#mesa_pkgs[@]} -gt 0 ]]; then
    apt_install_with_recovery "${apt_opts[@]}" -- "${mesa_pkgs[@]}" || \
      echo "Warning: could not install some Mesa runtime packages (${mesa_pkgs[*]})"
  fi

  sudo ldconfig || true

  if ! command -v xinit >/dev/null 2>&1; then
    echo "xinit is still missing after update." >&2
    exit 1
  fi

  if ! command -v cog >/dev/null 2>&1; then
    echo "cog is still missing after update." >&2
    exit 1
  fi

  if ! ldconfig -p 2>/dev/null | grep -Eq 'libWPEBackend-(default|fdo)'; then
    echo "No usable WPE backend found after update (expected libWPEBackend-default or libWPEBackend-fdo)." >&2
    exit 1
  fi

  if ! has_supported_cog_platform_module; then
    echo "No usable non-Wayland Cog platform library found after update (expected drm, x11, gtk4, or gtk Cog platform module)." >&2
    exit 1
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

deploy_runtime_scripts
ensure_kiosk_runtime
install_dependencies
npm run build
sudo mkdir -p "${INSTALL_DIR}/dist"
sudo cp -r dist/* "${INSTALL_DIR}/dist/"
deploy_runtime_scripts
nohup bash -lc 'sleep 2; sudo systemctl restart printer-ui.service; sudo systemctl try-restart printer-ui-kiosk.service 2>/dev/null || true' >/dev/null 2>&1 &
echo "Update complete."
popd >/dev/null
