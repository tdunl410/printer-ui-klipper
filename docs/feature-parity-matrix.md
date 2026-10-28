# KlipperScreen Feature Parity Matrix

Status legend:
- Planned: included in scope, not implemented yet
- Mocked: represented in UI mockups
- Build: implemented and testable

| Area | Capability | KlipperScreen Equivalent | Status |
|---|---|---|---|
| Core | Printer connection state | Header/status indicators | Mocked |
| Core | Multi-printer selection | Printer dropdown/profile switch | Planned |
| Print | Start print from files | File list print action | Mocked |
| Print | Pause/Resume/Cancel | Active job controls | Mocked |
| Print | Job progress + ETA | Progress card | Mocked |
| Print | Layer / object info (if available) | Job detail panel | Planned |
| Temps | Hotend set + actual | Temp controls | Mocked |
| Temps | Bed set + actual | Temp controls | Mocked |
| Temps | Chamber/support temps | Temp controls | Planned |
| Motion | XY/Z jog | Movement panel | Mocked |
| Motion | Home all / axis | Movement panel | Mocked |
| Motion | Disable steppers | Motor control | Planned |
| Extruder | Extrude/retract | Extrude panel | Planned |
| Extruder | Filament load/unload macros | Macro shortcuts | Planned |
| Calibration | Bed mesh view + actions | Bed mesh screen | Planned |
| Calibration | Z-tilt / screws-tilt | Calibration tools | Planned |
| Calibration | Probe calibrate flows | Calibration tools | Planned |
| Files | Browse, sort, delete, rename | File browser | Mocked |
| Files | Upload/manage gcode | File browser | Mocked |
| Macros | Macro list + run | Macro screen | Mocked |
| Macros | Parameterized macros | Macro input forms | Planned |
| Console | Live terminal/log stream | Console view | Mocked |
| Camera | Live camera feed | Camera panel | Planned |
| Tuning | Speed/flow/fan adjustment | Tune screen | Planned |
| Tuning | Advanced tune params | Tune screen | Planned |
| Power | PSU/smart plug toggles | Power panel | Planned |
| System | Firmware restart | System actions | Mocked |
| System | Reboot/shutdown host | System actions | Mocked |
| Alerts | Error/warning dialogs | Prompt dialogs | Planned |
| Security | Touch lock / PIN lock | Lock controls | Planned |
| Theme | Runtime theme switch | N/A (enhanced) | Mocked |
| Theme | Token-based custom packs | N/A (enhanced) | Planned |

## Acceptance Criteria for "Alternative to KlipperScreen"
A release can be considered a practical alternative when all rows marked Planned/Mocked are promoted to Build and verified on a physical touch panel with:
1. Reliable Moonraker connectivity
2. Full print lifecycle control
3. Core maintenance/calibration workflows
4. Safe access to system actions
