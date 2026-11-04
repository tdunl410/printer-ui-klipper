#!/usr/bin/env bash
set -euo pipefail

# Session mode: runs inside the X server started by xinit.
# There is no window manager, so Cog keeps its default window size unless we
# resize it ourselves. Keep it pinned to the exact current screen resolution.
if [[ "${1:-}" == "--session" ]]; then
  shift
  COG_BIN="$1"
  shift
  APP_URL="$1"
  shift
  SESSION_PLATFORM="${1:-}"
  if [[ -n "${SESSION_PLATFORM}" && "${SESSION_PLATFORM}" != --* ]]; then
    shift
  else
    SESSION_PLATFORM=""
  fi

  screen_size() {
    local size=""
    if [[ -n "${PRINTER_UI_WINDOW_SIZE:-}" ]]; then
      size="${PRINTER_UI_WINDOW_SIZE/,/ }"
      echo "${size/x/ }"
      return
    fi
    size="$(xdpyinfo 2>/dev/null | sed -n 's/^ *dimensions: *\([0-9]*\)x\([0-9]*\).*/\1 \2/p' | head -n1)"
    if [[ -z "${size}" ]]; then
      size="$(xrandr 2>/dev/null | sed -n 's/^Screen 0:.*current \([0-9]*\) x \([0-9]*\).*/\1 \2/p' | head -n1)"
    fi
    echo "${size}"
  }

  read -r W H <<<"$(screen_size)"
  if [[ -n "${W:-}" && -n "${H:-}" ]]; then
    echo "Screen size: ${W}x${H}"
    if [[ "${SESSION_PLATFORM}" == "drm" ]]; then
      export COG_PLATFORM_DRM_VIDEO_MODE="${W}x${H}"
    fi
  else
    echo "Could not detect screen size; relying on Cog defaults"
  fi

  "${COG_BIN}" "$@" "${APP_URL}" &
  COG_PID=$!

  if command -v xdotool >/dev/null 2>&1; then
    (
      while kill -0 "${COG_PID}" 2>/dev/null; do
        read -r W H <<<"$(screen_size)"
        if [[ -n "${W:-}" && -n "${H:-}" ]]; then
          for win in $(xdotool search --onlyvisible --class 'cog|Cog|WPE' 2>/dev/null); do
            geom="$(xdotool getwindowgeometry --shell "${win}" 2>/dev/null || true)"
            cw="$(sed -n 's/^WIDTH=//p' <<<"${geom}")"
            ch="$(sed -n 's/^HEIGHT=//p' <<<"${geom}")"
            cx="$(sed -n 's/^X=//p' <<<"${geom}")"
            cy="$(sed -n 's/^Y=//p' <<<"${geom}")"
            # Ignore tiny helper windows
            if [[ -n "${cw}" && "${cw}" -gt 100 ]] && \
               [[ "${cw}" != "${W}" || "${ch}" != "${H}" || "${cx}" != "0" || "${cy}" != "0" ]]; then
              xdotool windowmove "${win}" 0 0 windowsize "${win}" "${W}" "${H}" 2>/dev/null || true
            fi
          done
        fi
        sleep 2
      done
    ) &
  else
    echo "xdotool not found; install it (sudo apt-get install -y xdotool) to keep the window at full screen size"
  fi

  wait "${COG_PID}"
  exit $?
fi

LOG_FILE=/tmp/printer-ui-kiosk.log
exec >>"${LOG_FILE}" 2>&1

echo "[$(date -Iseconds)] Starting printer-ui kiosk launcher"

COG_BIN=$(command -v cog || true)
if [[ -z "${COG_BIN}" ]]; then
  echo "Cog not found. Install it with: sudo apt-get install -y cog"
  exit 1
fi

HOST=${PRINTER_UI_HOST:-127.0.0.1}
PORT=${PRINTER_UI_PORT:-4409}

RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}
if [[ ! -d "${RUNTIME_DIR}" ]]; then
  RUNTIME_DIR="/tmp/printer-ui-runtime-$(id -u)"
  mkdir -p "${RUNTIME_DIR}"
  chmod 700 "${RUNTIME_DIR}"
fi

export HOME=${HOME:-/home/$(id -un)}
export XDG_RUNTIME_DIR="${RUNTIME_DIR}"

unset DBUS_STARTER_ADDRESS
unset DBUS_STARTER_BUS_TYPE
unset DBUS_SESSION_BUS_ADDRESS
unset DBUS_SYSTEM_BUS_ADDRESS

APP_URL="http://${HOST}:${PORT}"
COG_PLATFORM="${PRINTER_UI_COG_PLATFORM:-auto}"

SELF="$(readlink -f "${BASH_SOURCE[0]}")"

has_cog_platform_module() {
  local platform="$1"
  local search_roots=(
    /usr/lib
    /usr/lib64
    /usr/local/lib
    /usr/lib/aarch64-linux-gnu
    /usr/lib/arm-linux-gnueabihf
    /usr/lib/x86_64-linux-gnu
  )

  for root in "${search_roots[@]}"; do
    [[ -d "${root}" ]] || continue
    if find "${root}" -maxdepth 10 -type f \( \
      -name "*cog*platform*${platform}*.so" -o \
      -name "*${platform}*platform*.so" -o \
      -name "libcogplatform-${platform}.so" -o \
      -name "libcogplatform_${platform}.so" \
    \) 2>/dev/null | head -n1 | grep -q .; then
      return 0
    fi
  done

  return 1
}

detect_cog_platform() {
  local candidates=(x11 drm fdo wl wayland)
  local candidate
  for candidate in "${candidates[@]}"; do
    if has_cog_platform_module "${candidate}"; then
      echo "${candidate}"
      return 0
    fi
  done
  echo ""
  return 1
}

if [[ -z "${WPE_BACKEND:-}" ]]; then
  if ldconfig -p 2>/dev/null | grep -q "libWPEBackend-default\.so"; then
    :
  elif ldconfig -p 2>/dev/null | grep -q "libWPEBackend-fdo"; then
    export WPE_BACKEND=fdo
    echo "WPE_BACKEND not set; using fdo backend"
  fi
fi

if [[ "${COG_PLATFORM}" == "auto" ]]; then
  detected_platform="$(detect_cog_platform || true)"
  if [[ -n "${detected_platform}" ]]; then
    COG_PLATFORM="${detected_platform}"
  else
    COG_PLATFORM=""
    echo "No explicit Cog platform module detected; letting Cog choose defaults"
  fi
elif ! has_cog_platform_module "${COG_PLATFORM}"; then
  detected_platform="$(detect_cog_platform || true)"
  if [[ -n "${detected_platform}" ]]; then
    echo "Requested Cog platform '${COG_PLATFORM}' not found; falling back to '${detected_platform}'"
    COG_PLATFORM="${detected_platform}"
  else
    echo "Requested Cog platform '${COG_PLATFORM}' not found and no known platform modules detected; letting Cog choose defaults"
    COG_PLATFORM=""
  fi
fi

if [[ -n "${COG_PLATFORM}" ]]; then
  echo "Launching ${COG_BIN} at ${APP_URL} (platform=${COG_PLATFORM})"
else
  echo "Launching ${COG_BIN} at ${APP_URL} (platform=default)"
fi

DRM_RENDERER="${PRINTER_UI_COG_DRM_RENDERER:-gles}"
DRM_DISABLE_ATOMIC="${PRINTER_UI_COG_DRM_DISABLE_ATOMIC:-1}"
DRM_POINTER="${PRINTER_UI_COG_DRM_POINTER:-1}"
DRM_CURSOR="${PRINTER_UI_COG_DRM_CURSOR:-0}"
DRM_PLATFORM_PARAMS="${PRINTER_UI_COG_DRM_PLATFORM_PARAMS:-renderer=${DRM_RENDERER}}"
COG_CONFIG_FILE="${XDG_RUNTIME_DIR}/printer-ui-cog.ini"

cat >"${COG_CONFIG_FILE}" <<EOF
[drm]
renderer=${DRM_RENDERER}
disable-atomic-modesetting=$( [[ "${DRM_DISABLE_ATOMIC}" == "1" || "${DRM_DISABLE_ATOMIC}" == "true" || "${DRM_DISABLE_ATOMIC}" == "on" ]] && echo true || echo false )
pointer=$( [[ "${DRM_POINTER}" == "1" || "${DRM_POINTER}" == "true" || "${DRM_POINTER}" == "on" ]] && echo true || echo false )
cursor=$( [[ "${DRM_CURSOR}" == "1" || "${DRM_CURSOR}" == "true" || "${DRM_CURSOR}" == "on" ]] && echo true || echo false )
EOF

if [[ -n "${COG_PLATFORM}" && "${COG_PLATFORM}" != "x11" ]]; then
  if [[ "${COG_PLATFORM}" == "drm" ]]; then
    exec env HOME="${HOME}" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR}" \
      "${COG_BIN}" -C "${COG_CONFIG_FILE}" --platform="${COG_PLATFORM}" --platform-params="${DRM_PLATFORM_PARAMS}" "${APP_URL}"
  fi
  exec env HOME="${HOME}" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR}" \
    "${COG_BIN}" --platform="${COG_PLATFORM}" "${APP_URL}"
fi

if command -v xdpyinfo >/dev/null 2>&1 && xdpyinfo -display :0 >/dev/null 2>&1; then
  echo "Detected active X display :0; starting Cog on existing server"
  if [[ -n "${COG_PLATFORM}" ]]; then
    exec env HOME="${HOME}" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR}" DISPLAY=:0 \
      "${COG_BIN}" --platform="${COG_PLATFORM}" "${APP_URL}"
  fi
  exec env HOME="${HOME}" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR}" DISPLAY=:0 \
    "${COG_BIN}" "${APP_URL}"
fi

if ! command -v xinit >/dev/null 2>&1; then
  echo "xinit not found and no active X display. Install it with: sudo apt-get install -y xinit xserver-xorg"
  exit 1
fi

if command -v dbus-run-session >/dev/null 2>&1; then
  if [[ -n "${COG_PLATFORM}" ]]; then
    exec env HOME="${HOME}" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR}" dbus-run-session -- \
      xinit "${SELF}" --session "${COG_BIN}" "${APP_URL}" "${COG_PLATFORM}" --platform="${COG_PLATFORM}" -- :0 vt1 -nocursor
  fi
  exec env HOME="${HOME}" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR}" dbus-run-session -- \
    xinit "${SELF}" --session "${COG_BIN}" "${APP_URL}" -- :0 vt1 -nocursor
else
  if [[ -n "${COG_PLATFORM}" ]]; then
    exec env HOME="${HOME}" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR}" \
      xinit "${SELF}" --session "${COG_BIN}" "${APP_URL}" "${COG_PLATFORM}" --platform="${COG_PLATFORM}" -- :0 vt1 -nocursor
  fi
  exec env HOME="${HOME}" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR}" \
    xinit "${SELF}" --session "${COG_BIN}" "${APP_URL}" -- :0 vt1 -nocursor
fi
