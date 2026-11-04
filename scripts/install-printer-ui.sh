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
KIOSK_LAUNCHER_FILE="${INSTALL_DIR}/server/kiosk-launch.sh"
ENV_FILE="/etc/default/printer-ui"
PORT="${PRINTER_UI_PORT:-4409}"
HOST="${PRINTER_UI_HOST:-127.0.0.1}"
AUTO_INSTALL_NODE="${AUTO_INSTALL_NODE:-1}"
INSTALL_NODE_METHOD="${INSTALL_NODE_METHOD:-binary}"
AUTO_INSTALL_KIOSK_DEPS="${AUTO_INSTALL_KIOSK_DEPS:-1}"

echo "Installing Printer UI from ${REPO_DIR}"

node_major_version() {
  node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo "0"
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

install_node_20_binary() {
  local machine
  machine="$(uname -m)"
  local node_arch
  case "${machine}" in
    aarch64|arm64)
      node_arch="arm64"
      ;;
    armv7l|armv6l)
      node_arch="armv7l"
      ;;
    x86_64|amd64)
      node_arch="x64"
      ;;
    *)
      echo "Unsupported CPU architecture for binary Node install: ${machine}" >&2
      return 1
      ;;
  esac

  local node_release="${NODE_20_RELEASE:-latest-v20.x}"
  local base_url="https://nodejs.org/dist/${node_release}"

  echo "Installing Node.js 20.x binary for ${node_arch} from ${base_url}..."

  local shasums
  shasums="$(curl -fsSL "${base_url}/SHASUMS256.txt")"

  local tarball
  tarball="$(printf '%s\n' "${shasums}" | awk -v arch="${node_arch}" '$2 ~ ("linux-" arch "\\.tar\\.xz$") { print $2; exit }')"

  if [[ -z "${tarball}" ]]; then
    echo "Could not find a Node.js tarball for architecture ${node_arch}." >&2
    return 1
  fi

  local tmp_dir
  tmp_dir="$(mktemp -d)"

  if ! curl -fsSL "${base_url}/${tarball}" -o "${tmp_dir}/${tarball}"; then
    rm -rf "${tmp_dir}"
    return 1
  fi

  if ! tar -xJf "${tmp_dir}/${tarball}" -C "${tmp_dir}"; then
    rm -rf "${tmp_dir}"
    return 1
  fi

  local extracted_dir
  extracted_dir="$(find "${tmp_dir}" -maxdepth 1 -type d -name 'node-v20*' | head -n 1)"

  if [[ -z "${extracted_dir}" ]]; then
    echo "Node.js archive extract failed for ${tarball}." >&2
    rm -rf "${tmp_dir}"
    return 1
  fi

  sudo cp -f "${extracted_dir}/bin/node" /usr/local/bin/node
  sudo rm -rf /usr/local/lib/node_modules
  sudo mkdir -p /usr/local/lib
  sudo cp -R "${extracted_dir}/lib/node_modules" /usr/local/lib/node_modules
  sudo ln -sfn ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm
  sudo ln -sfn ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

  rm -rf "${tmp_dir}"
  hash -r
}

ensure_node_20() {
  local has_node=0
  if command -v node >/dev/null 2>&1 && npm_is_healthy; then
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
    if command -v node >/dev/null 2>&1; then
      echo "Node.js exists, but npm is missing or broken. Repairing Node toolchain..."
    else
      echo "Node.js and npm are not installed."
    fi
  fi

  if [[ "${AUTO_INSTALL_NODE}" != "1" ]]; then
    echo "Node.js 20+ is required. Install it manually, or re-run with AUTO_INSTALL_NODE=1." >&2
    exit 1
  fi

  local installed=0
  if [[ "${INSTALL_NODE_METHOD}" == "binary" || "${INSTALL_NODE_METHOD}" == "auto" ]]; then
    if install_node_20_binary; then
      installed=1
    fi
  fi

  if [[ "${installed}" -eq 0 && ( "${INSTALL_NODE_METHOD}" == "apt" || "${INSTALL_NODE_METHOD}" == "auto" || "${INSTALL_NODE_METHOD}" == "binary" ) ]]; then
    if command -v apt-get >/dev/null 2>&1; then
      install_node_20_debian
      installed=1
    fi
  fi

  if [[ "${installed}" -eq 0 ]]; then
    echo "Automatic Node install failed. Install Node.js 20+ manually and re-run this installer." >&2
    exit 1
  fi

  if ! command -v node >/dev/null 2>&1 || ! npm_is_healthy; then
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

ensure_display_tools() {
  # xdotool resizes the kiosk window; x11-utils (xdpyinfo) and xrandr read the screen size.
  local missing=()
  command -v xdotool >/dev/null 2>&1 || missing+=(xdotool)
  command -v xdpyinfo >/dev/null 2>&1 || missing+=(x11-utils)
  command -v xrandr >/dev/null 2>&1 || missing+=(x11-xserver-utils)
  if [[ ${#missing[@]} -gt 0 ]] && command -v apt-get >/dev/null 2>&1; then
    echo "Installing display tools: ${missing[*]}"
    apt_install_with_recovery \
      -o Acquire::Retries=5 \
      -o Acquire::ForceIPv4=true \
      -o Acquire::By-Hash=true \
      -o Acquire::http::No-Cache=true \
      -o Acquire::https::No-Cache=true \
      -- "${missing[@]}" || echo "Warning: could not install ${missing[*]}"
  fi
}

ensure_kiosk_runtime() {
  local apt_opts=(
    "-o" "Acquire::Retries=5"
    "-o" "Acquire::ForceIPv4=true"
    "-o" "Acquire::By-Hash=true"
    "-o" "Acquire::http::No-Cache=true"
    "-o" "Acquire::https::No-Cache=true"
  )

  if [[ "${AUTO_INSTALL_KIOSK_DEPS}" != "1" ]]; then
    echo "Kiosk runtime dependencies are missing (xinit/cog)." >&2
    echo "Install manually or rerun with AUTO_INSTALL_KIOSK_DEPS=1." >&2
    exit 1
  fi

  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Cannot auto-install kiosk dependencies: apt-get not found." >&2
    exit 1
  fi

  echo "Installing kiosk runtime dependencies (xinit + cog)..."

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
    echo "xinit is still missing after install." >&2
    exit 1
  fi

  if ! command -v cog >/dev/null 2>&1; then
    echo "cog is still missing after install." >&2
    exit 1
  fi

  if ! ldconfig -p 2>/dev/null | grep -Eq 'libWPEBackend-(default|fdo)'; then
    echo "No usable WPE backend found after install (expected libWPEBackend-default or libWPEBackend-fdo)." >&2
    exit 1
  fi

  if ! has_supported_cog_platform_module; then
    echo "No usable non-Wayland Cog platform library found after install (expected drm, x11, gtk4, or gtk Cog platform module)." >&2
    exit 1
  fi
}

ensure_node_20
ensure_kiosk_runtime
ensure_display_tools
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

sudo cp "${REPO_DIR}/server/kiosk-launch.sh" "${KIOSK_LAUNCHER_FILE}"
sudo chmod +x "${KIOSK_LAUNCHER_FILE}"

cat <<EOF | sudo tee "${ENV_FILE}" >/dev/null
PRINTER_UI_HOST=${HOST}
PRINTER_UI_PORT=${PORT}
PRINTER_UI_DIST=${INSTALL_DIR}/dist
PRINTER_UI_SOURCE_DIR=${REPO_DIR}
PRINTER_UI_UPDATE_SCRIPT=${REPO_DIR}/scripts/update-printer-ui.sh
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
Description=Printer UI WPE WebKit Kiosk (Cog)
After=network-online.target printer-ui.service
Wants=printer-ui.service
Conflicts=getty@tty1.service
After=getty@tty1.service

[Service]
Type=simple
EnvironmentFile=${ENV_FILE}
Environment=HOME=/home/${USER}
Environment=XDG_RUNTIME_DIR=/run/user/%U
PAMName=login
StandardInput=tty
TTYPath=/dev/tty1
TTYReset=yes
TTYVHangup=no
TTYVTDisallocate=yes
ExecStart=${KIOSK_LAUNCHER_FILE}
Restart=always
RestartSec=3
User=${USER}
Group=${USER}
WorkingDirectory=/home/${USER}

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now printer-ui.service

echo
echo "Base service installed and running at http://${HOST}:${PORT}"
echo "To enable touchscreen kiosk mode, run:"
echo "  sudo systemctl enable --now printer-ui-kiosk.service"

popd >/dev/null
