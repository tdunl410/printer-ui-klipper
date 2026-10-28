# Test Plan — KlipperScreen-Style Printer UI

## 1) Test Goals
Validate that the UI is reliable, safe, and fast enough to be used as a practical KlipperScreen alternative on a real printer.

## 2) Test Environments

### E1: Local Dev Simulation
- Browser on desktop
- Mock Moonraker responses + replayed socket stream
- Used for rapid regression checks

### E2: Bench Hardware
- Target SBC (Pi-class)
- Waveshare portrait display
- Real Moonraker instance, no live print required

### E3: Live Printer Validation
- Actual printer configuration
- Real jobs, heaters, fans, macros
- Long-run stability and operator acceptance

## 3) Test Types

## 3.1 Functional Tests
- Navigation: every route reachable from dock/settings
- Print lifecycle: start -> pause -> resume -> cancel
- Temperature control: nozzle/bed/chamber setpoints apply correctly
- Move/homing/fan controls send correct commands
- Macro execution and console output visible
- Connectivity and updates pages load and show expected data

Pass criteria:
- 100% of core flows complete without UI dead-end

## 3.2 Integration Tests (Moonraker)
- Initial data fetch renders complete screen state
- WebSocket reconnect after manual disconnect
- Stale state recovery after backend restart
- Error handling when command endpoint fails

Pass criteria:
- Reconnect within 10s and recover without app restart

## 3.3 UI/UX Tests
- Touch target hit accuracy on panel
- Text legibility at operator distance
- Scroll behavior on long settings pages
- Fixed aspect ratio maintained across boot/resolution changes

Pass criteria:
- No clipped critical controls and no accidental touch hotspots

## 3.4 Safety Tests
- Confirmation required for stop/shutdown/restart/reset
- Back navigation never triggers dangerous action
- Repeated taps do not queue duplicate critical commands

Pass criteria:
- Zero unsafe command execution without explicit confirm

## 3.5 Performance Tests
- Cold start to first useful screen
- Socket update-to-render latency under active print
- Graph rendering impact on frame rate

Targets:
- First meaningful screen: < 1.5s
- Telemetry render latency: < 100ms typical
- No sustained frame drops that hinder control use

## 3.6 Reliability/Soak Tests
- 24h connected idle run
- 8h active print monitoring run
- Random network interruption injection (Wi-Fi toggle)

Pass criteria:
- No crashes/hangs; recovers from disconnect automatically

## 4) Detailed Test Matrix (Core)

1. Home Screen
- Verify printer state, temperatures, render visibility, quick actions

2. Print Screen
- Verify progress, ETA, action buttons, tune values
- Pause/resume/cancel command and status reflection

3. Preheat Screen
- Set nozzle/bed/chamber temperatures
- Verify all-temp graph updates and legend clarity

4. Control Screen
- Execute macros and verify console output stream

5. Settings Screen
- Open Connectivity and Updates pages
- Verify theme, interface controls, and system actions

6. Connectivity Page
- Verify Moonraker status, Wi-Fi fields, reconnect/scan buttons

7. Updates Page
- Verify version display and update/log action workflows

## 5) Regression Checklist (Every Release)
- Navigation links intact
- Dock active state correct per page
- Back button behavior unchanged
- No overlap between content, back button, and dock
- Aspect-ratio lock still enforced
- Scroll on overflow still works on all long pages

## 6) Acceptance Tests on Printer (Final Gate)
- A1: Print a known short test file end-to-end using only this UI
- A2: Mid-print pause, temp adjust, and resume succeeds
- A3: Trigger a network disconnect and verify automatic recovery
- A4: Perform a safe restart of Klipper from Settings
- A5: Run a calibration-related macro and confirm expected behavior

All A1-A5 must pass for release candidate approval.

## 7) Defect Severity Guide
- S1 Critical: unsafe command behavior, print control failure, app crash
- S2 Major: wrong telemetry/actions, navigation dead-end
- S3 Minor: visual misalignment, non-blocking UI defects

Release policy:
- S1: must be fixed
- S2: must be fixed or explicitly waived
- S3: allowed with documented follow-up

## 8) Tooling Suggestions
- Playwright for browser-level flow tests
- Contract tests for Moonraker API wrappers
- Lightweight telemetry logging for reconnect and command failures
- Manual test run sheet for on-printer validation
