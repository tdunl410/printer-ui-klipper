#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Do not run as root. Run as your regular printer user with sudo access."
  exit 1
fi

INSTALL_DIR="/opt/printer-ui"
SERVICE_FILE="/etc/systemd/system/printer-ui.service"
KIOSK_SERVICE_FILE="/etc/systemd/system/printer-ui-kiosk.service"
ENV_FILE="/etc/default/printer-ui"
DEFAULT_REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="${DEFAULT_REPO_DIR}"

if [[ -f "${ENV_FILE}" ]]; then
  ENV_REPO_DIR="$(grep -E '^PRINTER_UI_SOURCE_DIR=' "${ENV_FILE}" | tail -n 1 | cut -d '=' -f2-)"
  if [[ -n "${ENV_REPO_DIR:-}" ]]; then
    REPO_DIR="${ENV_REPO_DIR}"
  fi
fi

is_safe_repo_dir() {
  local repo_path="$1"
  [[ -n "${repo_path}" ]] || return 1
  [[ "${repo_path}" != "/" ]] || return 1
  [[ "${repo_path}" != "/home" ]] || return 1
  [[ "${repo_path}" != "/Users" ]] || return 1
  [[ -d "${repo_path}" ]] || return 1
  [[ -f "${repo_path}/package.json" ]] || return 1
  [[ -f "${repo_path}/scripts/install-printer-ui.sh" ]] || return 1
  [[ -d "${repo_path}/src" ]] || return 1
}

stop_disable_service_if_present() {
  local service_name="$1"

  if sudo systemctl list-unit-files "${service_name}" --no-legend 2>/dev/null | grep -q "${service_name}"; then
    echo "Stopping ${service_name} (if running)..."
    sudo systemctl stop "${service_name}" 2>/dev/null || true

    echo "Disabling ${service_name} (if enabled)..."
    sudo systemctl disable "${service_name}" 2>/dev/null || true
  fi
}

echo "Uninstalling Printer UI deployment..."

stop_disable_service_if_present "printer-ui-kiosk.service"
stop_disable_service_if_present "printer-ui.service"

if [[ -f "${KIOSK_SERVICE_FILE}" ]]; then
  echo "Removing ${KIOSK_SERVICE_FILE}"
  sudo rm -f "${KIOSK_SERVICE_FILE}"
fi

if [[ -f "${SERVICE_FILE}" ]]; then
  echo "Removing ${SERVICE_FILE}"
  sudo rm -f "${SERVICE_FILE}"
fi

if [[ -f "${ENV_FILE}" ]]; then
  echo "Removing ${ENV_FILE}"
  sudo rm -f "${ENV_FILE}"
fi

if [[ -d "${INSTALL_DIR}" ]]; then
  echo "Removing ${INSTALL_DIR}"
  sudo rm -rf "${INSTALL_DIR}"
fi

echo "Reloading systemd daemon..."
sudo systemctl daemon-reload
sudo systemctl reset-failed

if is_safe_repo_dir "${REPO_DIR}"; then
  echo "Removing source repository at ${REPO_DIR}"
  rm -rf "${REPO_DIR}"
else
  echo "Skipping source repository removal (unsafe or unrecognized path): ${REPO_DIR}"
fi

echo
echo "Printer UI uninstall complete."
echo "Left untouched: Node.js, Chromium, and display dependencies."