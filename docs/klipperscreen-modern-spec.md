# Klipper Vertical UI (Mainsail Companion) — Product + Technical Spec

## 1) Goal
Build a touch-first UI system for Klipper printers that can replace KlipperScreen while keeping feature parity, with a modern visual design and customizable theming.

Primary target:
- Display: Waveshare 7.9" touch panel in portrait orientation
- Backend: Klipper + Moonraker + Mainsail ecosystem
- Default theme: Purple accent

## 2) Non-Goals (for first implementation)
- Replacing Klipper, Moonraker, or Mainsail server behavior
- Adding printer-control features beyond what Klipper/Moonraker expose
- Multi-window desktop experience (focus is full-screen touch kiosk)

## 3) UX Direction
Design language:
- Large touch targets (minimum 44x44 px)
- Rounded cards, low-contrast surfaces, high legibility
- Always-visible printer status and emergency actions
- Glanceable telemetry (hotend/bed/chamber, print %, ETA, state)
- Bottom navigation optimized for one-hand portrait use

Inspiration details integrated from your references:
- Hero printer render prominently centered on dashboard
- Floating temperature pills near relevant printer zones
- Soft neutral background + purple accents
- Card-based stats and filament lane visualization

## 4) Target Screen + Layout Rules
Assumed panel profile:
- Native orientation: Portrait
- Logical design frame: 400 x 1280 (scales up proportionally)

Layout zones:
1. Header: printer identity, connection state, quick actions
2. Hero: printer render + key status overlays
3. Action row: Start/Resume/Pause/Stop, Settings entry
4. Information cards: temps, progress, ETA, filament, speed/flow
5. Main content region: per-tab controls
6. Settings menu destinations: Dashboard / Print / Files / Move / Preheat / Extrude / Console

## 5) System Architecture
Frontend shell options:
- Preferred: standalone web app served locally and opened in kiosk browser
- Alternative: embedded panel mode if integrated into Mainsail frontend host

Data interfaces:
- Moonraker HTTP API for fetch-on-open data
- Moonraker WebSocket for live updates
- Optional camera stream via MJPEG/WebRTC endpoints

Control model:
- Stateless command actions from UI -> Moonraker methods
- Optimistic UI only for immediate button feedback; final state from socket events

Safety model:
- Confirm dialogs for destructive commands (Stop print, firmware restart, shutdown)
- Lock-screen support for accidental touches during long prints
- Hardware emergency stop remains out-of-band and always preferred

## 6) Feature Parity Scope
The app should implement all user-visible capability areas currently expected from KlipperScreen:
- Dashboard/home status
- Print start/pause/resume/cancel
- File browser + file actions + upload/print
- Temperature presets + manual temperature control
- Motion/jog controls + homing + disable steppers
- Extrusion controls + retract/purge
- Bed mesh and leveling tools
- Macros and macro parameters
- Console/log stream
- Camera view(s)
- Tuning (speed, flow, fan, acceleration/pressure advance where available)
- Power/device controls (when Moonraker power devices configured)
- System operations (restart firmware/service, reboot, shutdown)
- Notifications/errors and recoverable prompts

Detailed mapping lives in `docs/feature-parity-matrix.md`.

## 7) Navigation Model
Primary navigation model:
- A top-right `Settings` button is available on operational screens.
- Settings acts as the navigation hub listing all destinations.
- Bottom tabs are omitted to maximize vertical workspace on the Waveshare portrait layout.

Primary destinations:
- Dashboard
- Print
- Files
- Move (movement, homing, fan controls)
- Preheat (nozzle/bed/chamber setpoints + sensor visibility)
- Extrude
- Console
- Settings

## 8) Theme System
Theme tokens:
- Semantic colors: bg, surface, border, text-primary, text-muted, success, warning, danger, accent
- Radius scale: small, medium, large, pill
- Spacing scale: 4/8/12/16/20/24
- Typography scale: caption/body/title/hero

Default theme:
- Accent family: Purple
- Contrast strategy: neutral background + strong accent only for primary actions/state

Theme delivery:
- CSS custom properties (runtime switchable)
- Optional JSON theme packs persisted to local storage

## 9) Runtime & Deployment
Recommended deployment path:
1. Host web UI on same device as Mainsail or on LAN companion host
2. Launch in Chromium kiosk mode on boot
3. Autoreconnect to Moonraker over local network
4. Optional PIN lock for settings/system pages

## 10) Performance Targets
- First meaningful paint: < 1.5s on Raspberry Pi-class hardware
- Socket update-to-render latency: < 100ms typical
- Touch interaction acknowledgment: < 50ms visual feedback

## 11) Accessibility + Touch Ergonomics
- High contrast mode toggle
- Text scaling presets (100/115/130%)
- Color-independent status indicators (icon + label)
- Haptic/audio feedback hooks where hardware supports it

## 12) Build Plan (Suggested)
Phase 1:
- Dashboard, print controls, files, temperatures, macros, console, settings shell
- Theme system + portrait responsive baseline

Phase 2:
- Advanced calibration flows (mesh, z-tilt, screws-tilt)
- Multi-camera + richer notifications

Phase 3:
- Plugin extension points + per-printer profile packs
- Optional role-based UI restrictions

## 13) Mockup Package
Initial mockups are provided in `mockups/`:
- Dashboard (inspired by supplied screenshot style)
- Print control
- Files/library
- Control + macros
- Settings/theme

The hero render is expected at `assets/printer-render.png`.
