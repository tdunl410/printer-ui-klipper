# UI Benchmark Notes — Bambu Lab + Formlabs Inspired Direction

This document summarizes practical UI patterns adapted for the Klipper portrait mockups.

## 1) What was analyzed
Because publicly accessible pages are mostly marketing/support content (not full on-printer UI specs), the redesign is based on recurring interaction characteristics shown across Bambu/Formlabs ecosystems:
- Fast status-at-a-glance
- Large touch-first controls
- Task-first screen grouping
- High visual clarity with clear machine imagery
- Minimal navigation friction

## 2) Key principles applied

### A) Status first, actions second
- Each operational page now starts with status chips (state/progress/temperatures/position), so users can decide quickly before acting.

### B) Task-oriented cards
- Screens are grouped by user intent:
  - Move: homing, jog, fan control
  - Preheat: nozzle/bed/chamber setpoints + sensor visibility
  - Extrude: manual extrusion + macro workflows
  - Print: progress/tuning/action separation

### C) Clear imagery and context
- Dashboard and file/print pages include visual preview blocks and large machine render presentation for fast recognition.

### D) Touch ergonomics
- Larger minimum touch targets, bigger button padding, and simplified one-column action lists in Settings.

### E) Appliance-like consistency
- Repeated card layout, labels, and section structure reduce cognitive load between pages.

## 3) Current implementation outcomes in mockups
- Full-height portrait layout behavior retained
- Bottom-left back button retained on all non-main pages
- Top-right settings entry retained as global menu approach
- Chamber temperature target controls included with nozzle/bed in preheat and status contexts

## 4) Next iteration opportunities
- Add iconography system for each action group
- Add print phase timeline (prepare/warmup/print/cooldown)
- Add confirmation/safety pattern library for stop/restart/shutdown
- Add compact mode vs large-text mode profile
