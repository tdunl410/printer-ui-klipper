# Future Release Plan: Option 2 (Moonraker `zip` Updates)

This document describes how to move `printer-ui` to a release-based update model so Moonraker can update it reliably without building on the printer.

Current installs run from `/opt/printer-ui` and are deployed by a custom update script that builds from a git checkout.
Moonraker `git_repo` updates do not run your deploy build/copy flow, so updates can report success while the UI in `/opt/printer-ui/dist` remains unchanged.

`zip` updates solve this by shipping prebuilt artifacts and letting Moonraker replace files directly.

## Target architecture

- Moonraker manages `printer-ui` as `type: zip`
- Releases are produced in CI (or locally), not on the printer
- Printer stores runtime files at `/opt/printer-ui`
- `/opt/printer-ui/release_info.json` is included in every release artifact
- `printer-ui.service` serves `/opt/printer-ui/dist`
- Optional: `printer-ui-kiosk.service` continues to launch Cog (WPE WebKit)

## Artifact format (required)

Release artifact (zip) must contain:

- `dist/` (prebuilt frontend)
- `server/static-server.mjs`
- `server/kiosk-launch.sh`
- `release_info.json`

Example `release_info.json`:

```json
{
  "project_name": "printer-ui-klipper",
  "project_owner": "tdunl410",
  "version": "v0.2.0",
  "asset_name": "printer-ui.zip"
}
```

Notes:
- `project_name` and `project_owner` must match the GitHub repo.
- `version` must match the release tag.
- Use a fixed asset filename (for example `printer-ui.zip`) to simplify Moonraker config.

## Repository changes to make

## 1) Add packaging script

Create a script (example: `scripts/package-release.sh`) that:

1. Runs clean build (`npm ci`, `npm run build`)
2. Creates a staging directory with `dist/`, `server/`, and `release_info.json`
3. Writes `release_info.json` using the release tag/version
4. Zips staging as `printer-ui.zip`

Suggested behavior:
- Input version via `VERSION=v0.2.0 ./scripts/package-release.sh`
- Validate `VERSION` is non-empty
- Ensure `release_info.json.version == VERSION`

## 2) Keep service/runtime bootstrap separate from git deploy

For release-based installs, keep one bootstrap path for runtime setup:

- systemd units (`printer-ui.service`, optional kiosk unit)
- `/etc/default/printer-ui`
- runtime dependencies (Node, kiosk tools)

This can be either:
- a new bootstrap script (`scripts/install-printer-ui-runtime.sh`), or
- a refactor of existing `scripts/install-printer-ui.sh` so service setup can run without requiring a local git checkout for updates.

## 3) Keep update-manager docs in README

Document that release updates are managed by Moonraker (`type: zip`) and that local `update-printer-ui.sh` is no longer part of normal update flow.

## GitHub release pipeline

## Option A: GitHub Actions (recommended)

Create workflow (example: `.github/workflows/release.yml`):

1. Trigger on tag push `v*`
2. Set up Node 20+
3. Run `npm ci` + `npm run build`
4. Run packaging script with tag version
5. Create GitHub Release for the tag
6. Upload `printer-ui.zip` asset

High-level job outline:

```yaml
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: VERSION=${GITHUB_REF_NAME} ./scripts/package-release.sh
      - uses: softprops/action-gh-release@v2
        with:
          files: printer-ui.zip
```

## Option B: Manual release (interim)

1. Build and package locally
2. Create tag `vX.Y.Z`
3. Push tag
4. Create GitHub Release manually
5. Upload `printer-ui.zip`

## Moonraker configuration

Add/update in `moonraker.conf`:

```ini
[update_manager]
enable_auto_refresh: False
refresh_window: 0-5
refresh_interval: 672
enable_system_updates: True
enable_packagekit: True

[update_manager printer-ui]
type: zip
channel: stable
repo: tdunl410/printer-ui-klipper
path: /opt/printer-ui
managed_services:
  printer-ui
```

Important notes:
- `path` must point to installed runtime files and contain `release_info.json`.
- `path` must not be inside a git repo.
- If using pre-release tags, set `channel: beta`.
- Add `printer-ui-kiosk` to `managed_services` only if your Moonraker allowed-services configuration permits it.

## One-time migration on printer

1. Ensure runtime service exists and points to `/opt/printer-ui`.
2. Install a first release artifact manually to seed `release_info.json`:
   - Stop services
   - Replace `/opt/printer-ui` content with release zip contents
   - Ensure executable bit on `server/kiosk-launch.sh`
3. Start services and verify UI loads.
4. Restart Moonraker.
5. Confirm update manager sees `printer-ui`.

Example migration commands:

```bash
sudo systemctl stop printer-ui.service printer-ui-kiosk.service
sudo mkdir -p /opt/printer-ui
sudo rm -rf /opt/printer-ui/*
sudo unzip -o /path/to/printer-ui.zip -d /opt/printer-ui
sudo chmod +x /opt/printer-ui/server/kiosk-launch.sh
sudo systemctl start printer-ui.service
sudo systemctl try-restart printer-ui-kiosk.service
sudo systemctl restart moonraker
```

## Validation checklist

After migration and after every release:

1. `curl -s http://127.0.0.1:7125/machine/update/status | jq '.result.version_info["printer-ui"]'`
2. Confirm reported version matches release tag
3. Trigger update from frontend or API and confirm status completes
4. Verify UI shows new release behavior/assets
5. `sudo journalctl -u printer-ui.service -n 100 --no-pager` has no startup errors

## Rollback strategy

- Keep previous `printer-ui.zip` assets attached to releases.
- To rollback quickly:
  1. Stop services
  2. Unzip prior release asset into `/opt/printer-ui`
  3. Restart services
- Optional: pin to a known release in operational docs (manual rollback is usually simplest for zip type).

## Risks and mitigations

- Missing/invalid `release_info.json` → Moonraker cannot validate local install
  - Mitigation: enforce in packaging script and CI check.
- Wrong `repo` or owner/name mismatch → no updates found
  - Mitigation: keep `repo` and `release_info.json` aligned.
- Service restart issues after update
  - Mitigation: keep unit files stable and monitor `journalctl`.
- Kiosk service not restarted automatically
  - Mitigation: include kiosk in `managed_services` only when allowed, or make kiosk follow `printer-ui.service` restart behavior.

## Definition of done

This plan is complete when all are true:

- Tagging `vX.Y.Z` creates GitHub Release with `printer-ui.zip`
- `printer-ui.zip` contains valid `release_info.json`
- Moonraker reports `printer-ui` in update status
- Update from Moonraker updates `/opt/printer-ui` without running local build steps
- `printer-ui.service` (and kiosk, if configured) restart cleanly after update
