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