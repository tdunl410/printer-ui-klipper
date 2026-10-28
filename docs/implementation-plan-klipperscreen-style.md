# Implementation Plan — KlipperScreen-Style UI for Real Printer Use

## 1) Objective
Ship a production-ready touch UI that can run on a printer-mounted Waveshare display and functionally replace KlipperScreen for daily operation.

Primary constraints:
- Portrait Waveshare 7.9" layout
- Moonraker as API/WebSocket source of truth
- Touch-first UX, fast and safe controls
- Themeable (default: purple)

## 2) Recommended Technical Approach

### Frontend
- Framework: React + TypeScript + Vite (fast local dev, componentized screens)
- Routing: simple client-side routing by screen (`/home`, `/print`, `/preheat`, etc.)
- State: lightweight store (Zustand or Redux Toolkit) with socket event reducers
- Styling: CSS variables for themes + component-scoped classes

### Data + Control Layer
- Moonraker REST for initial snapshots on page load
- Moonraker WebSocket for live updates (temps, state, progress, logs)
- Command service wraps all mutating actions (pause, resume, set temp, macro run)
- Command queue with visual pending/success/error states

### Runtime/Launcher
- Start UI at boot in Chromium kiosk mode (`--kiosk --app=http://localhost:<port>`)
- Disable screen blanking/sleep for appliance behavior
- Auto-reconnect logic for Moonraker/network interruptions

## 3) App Architecture

## 3.1 Layering
1. `transport/` — Moonraker HTTP + WebSocket client
2. `domain/` — normalized printer/job/temp/macro models
3. `stores/` — app state slices and actions
4. `screens/` — page-level UI (Home, Print, Preheat, Control, Settings)
5. `components/` — shared cards, dock, modal, keyboard, graph
6. `services/` — update checks, logs export, network status probes

## 3.2 Critical Modules
- Connection Manager: heartbeat + reconnect backoff + online/offline banners
- Safety Gate: confirms destructive actions (stop, reset, shutdown)
- Theme Engine: runtime token swapping and persistence
- Device Profile: panel resolution/ratio and touch scaling profile

## 4) Feature Delivery Sequence (Milestones)

### Milestone A — Functional Core (replace daily basics)
- Home + Print + Preheat + Control + Settings pages
- Start/pause/resume/cancel print
- Nozzle/bed/chamber setpoints and live temps
- Move/jog/home + fan controls
- Macro launch + console stream
- Bottom dock and navigation consistency

Exit criteria:
- End-to-end print lifecycle works from UI only
- UI remains usable under active print load

### Milestone B — KlipperScreen Parity Expansion
- File management (browse/upload/delete/rename)
- Extrude/retract/load/unload flows
- Power devices and host actions
- Network settings + updates pages
- Notifications and error dialogs

Exit criteria:
- All frequent operator tasks complete without desktop fallback

### Milestone C — Advanced Maintenance
- Bed mesh and leveling workflows
- Camera integration
- Parameterized macro forms
- Optional lock mode and role restrictions

Exit criteria:
- Maintenance/calibration tasks usable from panel

## 5) Moonraker Integration Plan

### 5.1 Startup data fetch
- `/printer/objects/query` for baseline printer objects
- `/server/files/list` and selected file metadata
- `/machine/system_info` and service versions

### 5.2 Live subscriptions
- Subscribe to required objects (`toolhead`, `extruder`, `heater_bed`, chamber sensor objects, fans, print_stats, display_status)
- Push incremental updates into store slices

### 5.3 Command mapping examples
- Pause/Resume/Cancel: `printer.print.pause`, `printer.print.resume`, `printer.print.cancel`
- Temp set: `printer.gcode.script` with `SET_HEATER_TEMPERATURE`
- Macros: `printer.gcode.script` with macro invocation
- Restart/shutdown: machine/server endpoints with confirmation

## 6) Deployment Plan (Printer Host)

### 6.1 Packaging
- Build static frontend (`dist/`)
- Serve with lightweight HTTP service (Caddy/Nginx/static node server)

### 6.2 Autostart
- systemd service for UI server
- systemd autologin user + kiosk Chromium service

### 6.3 Recovery
- Watchdog restarts browser if process exits
- Offline fallback screen if Moonraker unavailable

## 7) Operational UX Requirements
- Touch targets >= 44 px
- Readable status at a glance in <1 second
- Action feedback in <100ms visual response
- Fixed panel ratio lock (Waveshare profile)
- Scroll behavior for overflowing pages

## 8) Security + Safety
- Confirm dialogs for destructive commands
- Optional PIN for settings/system pages
- Never bypass hardware emergency stop semantics
- Audit log line for executed critical actions

## 9) Suggested Repository Evolution
- `src/screens/` for page routes mirroring current mockups
- `src/components/graph/` for temperature graph widget
- `src/theme/` for token presets (`dark-purple`, etc.)
- `src/moonraker/` for API and subscription utilities

## 10) Risks and Mitigations
- WebSocket instability on weak Wi-Fi -> reconnect manager + offline cache
- Incomplete object coverage across configs -> capability detection and feature flags
- Touch mis-taps during print -> larger controls + debounce + confirm flows
- Performance on Pi-class hardware -> memoized selectors, reduced re-renders, throttled graph updates

## 11) Done Definition (Production Candidate)
- Completes all high-frequency print tasks without fallback UI
- Soak-tested for >= 24h connected runtime without lockups
- Verified on physical panel orientation and touch input
- Passes test plan in `docs/test-plan-klipperscreen-style.md`
