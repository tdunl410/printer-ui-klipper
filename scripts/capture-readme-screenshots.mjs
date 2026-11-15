import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const screenshotsDir = path.join(root, 'docs', 'screenshots');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const captures = [
  {
    width: 400,
    height: 1280,
    theme: 'purple',
    render: 'printer-render.png',
    screenshots: [
      ['/', 'home.png'],
      ['/files', 'files.png'],
      ['/preheat', 'preheat.png'],
      ['/extrude', 'extrude.png'],
      ['/control', 'control.png'],
      ['/settings', 'settings.png'],
      ['/appearance', 'appearance.png'],
      ['/connectivity', 'connectivity.png'],
      ['/updates', 'updates.png'],
      ['/print', 'print.png'],
      ['/print/tune', 'live-tune.png'],
    ],
  },
  {
    width: 800,
    height: 480,
    theme: 'red',
    render: 'printer-render2.png',
    screenshots: [
      ['/', 'Home-Horizontal.png'],
      ['/files', 'Files-Horizontal.png'],
      ['/control', 'Control-Horizontal.png'],
      ['/preheat', 'Preheat-Horizontal.png'],
      ['/extrude', 'Extrude-Horizontal.png'],
      ['/settings', 'Settings-Horizontal.png'],
      ['/appearance', 'Appearance-Horizontal.png'],
      ['/connectivity', 'Connectivity-Horizontal.png'],
      ['/updates', 'Updates-Horizontal.png'],
      ['/print', 'Print-Horizontal.png'],
      ['/print/tune', 'Live-Tune-Horizontal.png'],
    ],
  },
];

const sampleState = (theme, render, route) => ({
  profileName: 'TigerScreen',
  connectionState: 'online',
  klipperState: 'ready',
  theme,
  printerRender: render,
  connection: {
    hostname: 'voron-2-4',
    networkState: 'online',
    networkInterfaces: [{
      name: 'wlan0',
      type: 'wifi',
      isUp: true,
      ssid: 'Workshop Wi-Fi',
      signalDbm: -48,
      ipAddresses: ['192.168.1.42'],
      gateway: '192.168.1.1',
    }],
  },
  temperatures: {
    nozzle: { current: 208, target: 210 },
    bed: { current: 59, target: 60 },
    chamber: { current: 41, target: 45 },
    ambient: 23,
    controller: 37,
    raspberryPi: 44,
    sensors: {},
  },
  stats: { totalTimeHours: 263, printCount: 126, filamentKg: 1.4 },
  job: {
    filename: 'dragon_vase_0.2mm_PLA.gcode',
    progress: 0.55,
    state: route === '/print' || route === '/print/tune' ? 'printing' : 'idle',
    layer: '78/142',
    eta: '00:51',
    remaining: '00:51',
    elapsed: '01:02',
    printDurationSec: 3720,
    filamentUsedMm: 1842,
  },
  files: [
    { path: 'dragon_vase_0.2mm_PLA.gcode', modified: 1763150000, size: 12500000 },
    { path: 'benchy_0.2mm_PLA.gcode', modified: 1763125000, size: 8300000 },
    { path: 'voron_cube_0.2mm_PLA.gcode', modified: 1763100000, size: 6400000 },
    { path: 'calibration_tower.gcode', modified: 1763075000, size: 4900000 },
    { path: 'functional_parts/bracket.gcode', modified: 1763050000, size: 2700000 },
  ],
  position: { x: 112.4, y: 108.7, z: 24.2 },
  printerSpeedMmS: 30,
  speedPercent: 100,
  flowPercent: 100,
  zOffset: 0.02,
  fanPartPercent: 65,
  outputPins: [{ name: 'case_light', label: 'Case Light', percent: 80 }],
  excludeObjects: {
    currentObject: 'dragon_vase',
    objects: [{
      name: 'dragon_vase',
      polygon: [[40, 40], [180, 40], [180, 180], [40, 180]],
      isExcluded: false,
    }],
  },
});

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    ...(process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ]
      : []),
    ...(process.platform === 'win32'
      ? [
          path.join(process.env.PROGRAMFILES ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
          path.join(process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        ]
      : []),
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (result.status === 0) return candidate;
  }

  throw new Error('Chrome/Chromium not found. Install a browser or set CHROME_BIN to its executable path.');
}

async function findFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite exited with code ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Vite did not become ready at ${url}`);
}

function createCdpClient(webSocketUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const pending = new Map();
    const eventWaiters = new Map();
    let nextId = 0;

    socket.addEventListener('open', () => {
      const send = (method, params = {}) => new Promise((resolveCommand, rejectCommand) => {
        const id = ++nextId;
        const timer = setTimeout(() => {
          pending.delete(id);
          rejectCommand(new Error(`Chrome DevTools command timed out: ${method}`));
        }, 15000);
        pending.set(id, { resolve: resolveCommand, reject: rejectCommand, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });

      socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.id) {
          const waiter = pending.get(message.id);
          if (!waiter) return;
          clearTimeout(waiter.timer);
          pending.delete(message.id);
          if (message.error) waiter.reject(new Error(message.error.message));
          else waiter.resolve(message.result);
          return;
        }

        const queue = eventWaiters.get(message.method);
        if (queue?.length) queue.shift()(message.params);
      });

      const waitForEvent = (method) => new Promise((eventResolve) => {
        const queue = eventWaiters.get(method) ?? [];
        queue.push(eventResolve);
        eventWaiters.set(method, queue);
      });

      resolve({ socket, send, waitForEvent });
    }, { once: true });

    socket.addEventListener('error', reject, { once: true });
  });
}

async function evaluate(send, expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || 'Screenshot page evaluation failed');
  }
  return response.result?.value;
}

function assertPngSize(data, width, height, filename) {
  const actualWidth = data.readUInt32BE(16);
  const actualHeight = data.readUInt32BE(20);
  if (actualWidth !== width || actualHeight !== height) {
    throw new Error(`${filename} is ${actualWidth}x${actualHeight}; expected ${width}x${height}`);
  }
}

async function main() {
  if (typeof WebSocket !== 'function') {
    throw new Error('This script requires Node.js 22 or newer (built-in WebSocket support).');
  }

  const chrome = findChrome();
  const vitePort = await findFreePort();
  let cdpPort = await findFreePort();
  while (cdpPort === vitePort) cdpPort = await findFreePort();
  const baseUrl = `http://127.0.0.1:${vitePort}`;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'printer-ui-screenshots-'));
  const vite = spawn(process.execPath, [
    viteBin,
    '--host', '127.0.0.1',
    '--port', String(vitePort),
    '--strictPort',
  ], { cwd: root, stdio: 'inherit' });
  let browser;
  let cdp;

  try {
    await waitForServer(baseUrl, vite);
    browser = spawn(chrome, [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${path.join(tempDir, 'chrome-profile')}`,
      'about:blank',
    ], { stdio: 'ignore' });

    const cdpUrl = `http://127.0.0.1:${cdpPort}`;
    const cdpDeadline = Date.now() + 30000;
    let target;
    while (Date.now() < cdpDeadline) {
      if (browser.exitCode !== null) throw new Error(`Chrome exited with code ${browser.exitCode}`);
      try {
        const version = await fetch(`${cdpUrl}/json/version`);
        if (version.ok) {
          const response = await fetch(`${cdpUrl}/json/new?${baseUrl}/`, { method: 'PUT' });
          if (!response.ok) throw new Error(`Could not create a Chrome tab (${response.status})`);
          target = await response.json();
          break;
        }
      } catch {
        await sleep(250);
      }
    }
    if (!target) throw new Error('Chrome DevTools did not become ready');

    cdp = await createCdpClient(target.webSocketDebuggerUrl);
    const { send, waitForEvent } = cdp;
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Fetch.enable', {
      patterns: [
        { urlPattern: `${baseUrl}/api/ui/config*`, requestStage: 'Request' },
        { urlPattern: `${baseUrl}/api/wifi/networks*`, requestStage: 'Request' },
      ],
    });
    cdp.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.method !== 'Fetch.requestPaused') return;
      const payload = message.params.request.url.includes('/api/ui/config')
        ? { config: {} }
        : {
            networks: [{ ssid: 'Workshop Wi-Fi', signal: 92, secured: true, connected: true }],
            primaryIp: '192.168.1.42',
          };
      const body = Buffer.from(JSON.stringify(payload)).toString('base64');
      void send('Fetch.fulfillRequest', {
        requestId: message.params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body,
      });
    });

    const loaded = waitForEvent('Page.loadEventFired');
    await send('Page.navigate', { url: `${baseUrl}/` });
    await loaded;
    await sleep(1000);

    const connectionState = `(async () => {
      const { usePrinterStore } = await import('/src/stores/usePrinterStore.ts');
      return usePrinterStore.getState().connectionState;
    })()`;
    const bootDeadline = Date.now() + 10000;
    while (await evaluate(send, connectionState) === 'connecting' && Date.now() < bootDeadline) {
      await sleep(100);
    }
    if (await evaluate(send, connectionState) === 'connecting') {
      throw new Error('Printer UI did not finish starting');
    }
    await evaluate(send, `(async () => {
      const { usePrinterStore } = await import('/src/stores/usePrinterStore.ts');
      usePrinterStore.getState().disconnect();
      await new Promise(resolve => setTimeout(resolve, 150));
    })()`);

    let count = 0;
    for (const viewport of captures) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      });

      for (const [route, filename] of viewport.screenshots) {
        const state = JSON.stringify(sampleState(viewport.theme, viewport.render, route));
        const expression = `(async () => {
          const { usePrinterStore } = await import('/src/stores/usePrinterStore.ts');
          const store = usePrinterStore.getState();
          const sample = ${state};
          usePrinterStore.setState({
            ...sample,
            connection: { ...store.connection, ...sample.connection },
          });
          document.body.dataset.theme = ${JSON.stringify(viewport.theme)};
          document.documentElement.style.setProperty('--text-scale', '1');
          history.pushState({}, '', ${JSON.stringify(route)});
          dispatchEvent(new PopStateEvent('popstate'));
        })()`;
        await evaluate(send, expression);
        await sleep(300);
        await evaluate(send, 'Promise.all(Array.from(document.images, image => image.decode().catch(() => undefined)))');

        const screenshot = await send('Page.captureScreenshot', {
          format: 'png',
          fromSurface: true,
          captureBeyondViewport: false,
        });
        const data = Buffer.from(screenshot.data, 'base64');
        assertPngSize(data, viewport.width, viewport.height, filename);
        fs.writeFileSync(path.join(screenshotsDir, filename), data);
        count += 1;
      }
    }

    console.log(`Regenerated ${count} README screenshots.`);
  } finally {
    cdp?.socket.close();
    browser?.kill('SIGTERM');
    vite.kill('SIGTERM');
    await sleep(400);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
