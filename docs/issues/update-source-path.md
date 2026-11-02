# Update Button / Source Path Issues

The in-app **Update Screen** action runs `scripts/update-printer-ui.sh` from paths configured in `/etc/default/printer-ui`.

If updates fail, ensure these values point to your real git clone (not `/opt/printer-ui`):

```bash
sudo sed -i 's|^PRINTER_UI_SOURCE_DIR=.*|PRINTER_UI_SOURCE_DIR=/home/pi/printer_ui|' /etc/default/printer-ui
sudo sed -i 's|^PRINTER_UI_UPDATE_SCRIPT=.*|PRINTER_UI_UPDATE_SCRIPT=/home/pi/printer_ui/scripts/update-printer-ui.sh|' /etc/default/printer-ui
sudo systemctl restart printer-ui.service
```

If those keys are missing, run the installer again from your clone:

```bash
cd ~/printer_ui
./scripts/install-printer-ui.sh
```