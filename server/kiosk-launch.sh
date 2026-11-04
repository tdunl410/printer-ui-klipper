#!/usr/bin/env bash
set -euo pipefail

# Session mode: runs inside the X server started by xinit.
# There is no window manager, so Chromium keeps its default window size unless we
# resize it ourselves. Keep it pinned to the exact current screen resolution.
if [[ "${1:-}" == "--session" ]]; then
  shift
  CHROME_BIN="$1"
  shift

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
    set -- "$@" "--window-position=0,0" "--window-size=${W},${H}"
  else
    echo "Could not detect screen size; relying on Chromium defaults"
  fi

  "${CHROME_BIN}" "$@" &
  CHROME_PID=$!

  if command -v xdotool >/dev/null 2>&1; then
    (
      while kill -0 "${CHROME_PID}" 2>/dev/null; do
        read -r W H <<<"$(screen_size)"
        if [[ -n "${W:-}" && -n "${H:-}" ]]; then
          for win in $(xdotool search --onlyvisible --class chromium 2>/dev/null); do
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

  wait "${CHROME_PID}"
  exit $?
fi

LOG_FILE=/tmp/printer-ui-kiosk.log
exec >>"${LOG_FILE}" 2>&1

echo "[$(date -Iseconds)] Starting printer-ui kiosk launcher"

if ! command -v xinit >/dev/null 2>&1; then
  echo "xinit not found. Install it with: sudo apt-get install -y xinit xserver-xorg"
  exit 1
fi

CHROME_BIN=$(command -v chromium-browser || command -v chromium || command -v google-chrome || true)
if [[ -z "${CHROME_BIN}" ]]; then
  echo "Chromium not found. Install it with: sudo apt-get install -y chromium-browser || sudo apt-get install -y chromium"
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

CHROME_PROFILE_DIR="${XDG_RUNTIME_DIR}/printer-ui-chromium-profile"
mkdir -p "${CHROME_PROFILE_DIR}"

CHROME_FLAGS=(
  --kiosk
  --app="http://${HOST}:${PORT}"
  --disable-pinch
  --overscroll-history-navigation=0
  --noerrdialogs
  --disable-infobars
  --disable-extensions
  --disable-sync
  --disable-background-networking
  --disable-component-update
  --disable-default-apps
  --no-first-run
  --disable-session-crashed-bubble
  --disable-features=BackForwardCache
  --disable-site-isolation-trials
  --disable-gpu
  --disable-dev-shm-usage
  --start-fullscreen
  --force-device-scale-factor=1
  --user-data-dir="${CHROME_PROFILE_DIR}"
)

if [[ ! -u /usr/lib/chromium/chrome-sandbox && ! -u /usr/lib/chromium-browser/chrome-sandbox ]]; then
  echo "chrome-sandbox is not setuid; enabling --no-sandbox fallback"
  CHROME_FLAGS+=(--no-sandbox --disable-setuid-sandbox)
fi

SELF="$(readlink -f "${BASH_SOURCE[0]}")"

echo "Launching ${CHROME_BIN} at http://${HOST}:${PORT}"
if command -v dbus-run-session >/dev/null 2>&1; then
  exec env HOME="${HOME}" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR}" dbus-run-session -- \
    xinit "${SELF}" --session "${CHROME_BIN}" "${CHROME_FLAGS[@]}" -- :0 vt1 -nocursor
else
  exec env HOME="${HOME}" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR}" \
    xinit "${SELF}" --session "${CHROME_BIN}" "${CHROME_FLAGS[@]}" -- :0 vt1 -nocursor
fi
