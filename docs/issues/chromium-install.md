# Chromium Install Issues

If Chromium fails to install on Raspberry Pi OS/Debian, run these blocks on the Pi in order.

## 1) Temporarily block bullseye-security repo
```bash
sudo rm -f /etc/apt/preferences.d/99-block-bullseye-security
sudo tee /etc/apt/preferences.d/99-block-bullseye-security >/dev/null <<'EOF'
Package: *
Pin: release n=bullseye-security
Pin-Priority: -1
EOF
```

## 2) Refresh apt metadata
```bash
sudo apt-get clean
sudo rm -rf /var/lib/apt/lists/*
sudo apt-get -o Acquire::ForceIPv4=true -o Acquire::Retries=5 update
```

## 3) Install kiosk dependencies
```bash
sudo apt-get -o Acquire::ForceIPv4=true -o Acquire::Retries=5 install -y --no-install-recommends xinit xserver-xorg chromium-browser
```

If that package name fails, try Debian package names:

```bash
sudo apt-get -o Acquire::ForceIPv4=true -o Acquire::Retries=5 install -y --no-install-recommends xinit xserver-xorg chromium chromium-sandbox
```

## 4) Re-run installer and verify kiosk service
```bash
INSTALL_NODE_METHOD=binary ./scripts/install-printer-ui.sh
sudo systemctl restart printer-ui-kiosk.service
systemctl status printer-ui-kiosk.service --no-pager
```

## 5) Restore normal repo priority
```bash
sudo rm -f /etc/apt/preferences.d/99-block-bullseye-security
sudo apt-get update
```