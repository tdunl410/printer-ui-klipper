# Kiosk only fills part of the screen

## Symptom
The UI is drawn at its default window size (about 380x285) in the top-left corner while
`xrandr` reports the full resolution (for example `400x1280`).

## Cause
The kiosk runs Cog under `xinit` with no window manager, so fullscreen behavior may be
ignored and the window keeps its default size.

## Fix
`server/kiosk-launch.sh` detects the screen size and resizes the Cog window to it,
re-checking every 2 seconds. Update and restart:

```bash
cd ~/printer_ui
./scripts/update-printer-ui.sh
sudo systemctl restart printer-ui-kiosk.service
```

If the Pi runs an older updater that does not copy the launcher, run
`./scripts/install-printer-ui.sh` once instead.

## Checks
```bash
grep -n "session" /opt/printer-ui/server/kiosk-launch.sh   # new launcher installed
tail -30 /tmp/printer-ui-kiosk.log                          # shows "Screen size: WxH"
command -v xdotool xdpyinfo xrandr                          # tools present
```
## If none of this works
Set the screen size manually: 
```bash
sudo apt-get install -y xdotool
sudo DISPLAY=:0 XAUTHORITY=/home/pi/.Xauthority xdotool search --name "Klipper Portrait UI" windowmove 0 0 windowsize 400 1280
```
## Override
Set `PRINTER_UI_WINDOW_SIZE=WIDTH,HEIGHT` in `/etc/default/printer-ui` to force a size.
