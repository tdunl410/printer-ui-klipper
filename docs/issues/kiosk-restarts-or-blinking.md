# Kiosk Restarts or Screen Blinking

If the kiosk service keeps restarting, or the display blinks/clears, inspect service and logs:

```bash
systemctl status printer-ui-kiosk.service --no-pager
journalctl -u printer-ui-kiosk.service -n 120 --no-pager
tail -n 120 /tmp/printer-ui-kiosk.log
```

After changes, restart kiosk service:

```bash
sudo systemctl restart printer-ui-kiosk.service
```

## Common Root Cause: tty1 conflict (SIGHUP restart loop, then boot text on screen)

If the status shows `code=killed, signal=HUP` and `/tmp/printer-ui-kiosk.log` is missing, the
unit is fighting `getty@tty1` for the console. The installer now writes `TTYVHangup=no` and
`Conflicts=getty@tty1.service`. On an existing install, either re-run the installer or:

```bash
sudo systemctl edit printer-ui-kiosk.service   # add [Service] TTYVHangup=no
sudo systemctl disable --now getty@tty1.service
sudo systemctl restart printer-ui-kiosk.service
```

Check who holds the console with `sudo fuser -v /dev/tty1`.

## Common Root Cause: DBus/X Session Environment

If logs show repeated DBus errors like `Failed to connect to the bus` and then `xinit: connection to X server lost`, reinstalling the updated kiosk launcher usually fixes it:

```bash
cd ~/printer_ui
INSTALL_NODE_METHOD=binary ./scripts/install-printer-ui.sh
sudo systemctl daemon-reload
sudo systemctl restart printer-ui.service
sudo systemctl restart printer-ui-kiosk.service
```

Then verify:

```bash
systemctl status printer-ui-kiosk.service --no-pager
journalctl -u printer-ui-kiosk.service -n 120 --no-pager
tail -n 120 /tmp/printer-ui-kiosk.log
```