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