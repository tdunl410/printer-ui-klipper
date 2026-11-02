# Node Install Issues

The installer auto-installs/upgrades Node.js 20+ on Raspberry Pi OS/Debian when needed.

## Recommended install mode
```bash
INSTALL_NODE_METHOD=binary ./scripts/install-printer-ui.sh
```

## Use apt-based Node install
```bash
INSTALL_NODE_METHOD=apt ./scripts/install-printer-ui.sh
```

## Disable automatic Node install
```bash
AUTO_INSTALL_NODE=0 ./scripts/install-printer-ui.sh
```

## Manual fallback (NodeSource)
Use this if your image blocks the installer's automatic Node setup:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```