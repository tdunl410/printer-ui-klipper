import { constants as fsConstants, createReadStream } from 'node:fs';
import { access, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const host = process.env.PRINTER_UI_HOST ?? '0.0.0.0';
const port = Number(process.env.PRINTER_UI_PORT ?? 4409);
const root = process.env.PRINTER_UI_DIST ?? join(process.cwd(), 'dist');

const loopbackAddresses = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const serverDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(serverDir, '..');
const updateScript = process.env.PRINTER_UI_UPDATE_SCRIPT ?? join(projectRoot, 'scripts', 'update-printer-ui.sh');
const configPath = process.env.PRINTER_UI_CONFIG_PATH ?? join(projectRoot, 'data', 'user-config.json');
const MAX_UPDATE_LOG_LINES = 80;

const defaultUiConfig = {
  appearance: {
    theme: 'purple',
    printerName: 'Printer',
    printerRender: '',
  },
  connection: {},
  presets: {
    temperature: [
      { id: 'pla', name: 'PLA', nozzle: 210, bed: 60, chamber: 0, fan: 50 },
      { id: 'abs', name: 'ABS', nozzle: 280, bed: 100, chamber: 80, fan: 30 },
      { id: 'cooldown', name: 'COOLDOWN', nozzle: 0, bed: 0, chamber: 1, fan: 0 },
    ],
  },
  customizations: {},
};

const uiUpdateState = {
  status: 'idle',
  startedAt: 0,
  finishedAt: 0,
  logs: [],
  error: '',
  currentCommit: '',
  targetCommit: '',
  pid: undefined,
};

const trimLogLine = (line) => line.replace(/\s+/g, ' ').trim();

function pushUiUpdateLog(rawLine) {
  const line = trimLogLine(String(rawLine ?? ''));
  if (!line) return;

  if (line.startsWith('UPDATE_INFO ')) {
    const payload = line.slice('UPDATE_INFO '.length);
    const splitAt = payload.indexOf('=');
    if (splitAt > 0) {
      const key = payload.slice(0, splitAt).trim();
      const value = payload.slice(splitAt + 1).trim();
      if (key === 'current_commit') {
        uiUpdateState.currentCommit = value;
      } else if (key === 'target_commit') {
        uiUpdateState.targetCommit = value;
      }
    }
  }

  uiUpdateState.logs.push(line);
  if (uiUpdateState.logs.length > MAX_UPDATE_LOG_LINES) {
    uiUpdateState.logs.shift();
  }
}

function resetUiUpdateState() {
  uiUpdateState.status = 'idle';
  uiUpdateState.startedAt = 0;
  uiUpdateState.finishedAt = 0;
  uiUpdateState.logs = [];
  uiUpdateState.error = '';
  uiUpdateState.currentCommit = '';
  uiUpdateState.targetCommit = '';
  uiUpdateState.pid = undefined;
}

function snapshotUiUpdateState() {
  return {
    status: uiUpdateState.status,
    startedAt: uiUpdateState.startedAt,
    finishedAt: uiUpdateState.finishedAt,
    logs: [...uiUpdateState.logs],
    lastLog: uiUpdateState.logs.at(-1) ?? '',
    error: uiUpdateState.error,
    currentCommit: uiUpdateState.currentCommit,
    targetCommit: uiUpdateState.targetCommit,
    pid: uiUpdateState.pid,
    scriptPath: updateScript,
  };
}

async function startUiUpdateJob() {
  if (uiUpdateState.status === 'running') {
    return { accepted: false, code: 409, body: { error: 'UI update already running', update: snapshotUiUpdateState() } };
  }

  resetUiUpdateState();
  uiUpdateState.status = 'running';
  uiUpdateState.startedAt = Date.now();

  try {
    await access(updateScript, fsConstants.R_OK | fsConstants.X_OK);
  } catch {
    uiUpdateState.status = 'error';
    uiUpdateState.finishedAt = Date.now();
    uiUpdateState.error = `Update script is missing or not executable: ${updateScript}`;
    return { accepted: false, code: 500, body: { error: uiUpdateState.error, update: snapshotUiUpdateState() } };
  }

  const child = spawn(updateScript, [], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  uiUpdateState.pid = child.pid;

  let stdoutBuffer = '';
  let stderrBuffer = '';

  const flushBuffered = (chunk, buffer, isError) => {
    const combined = buffer + chunk;
    const lines = combined.split(/\r?\n/);
    const remainder = lines.pop() ?? '';
    lines.forEach((line) => {
      pushUiUpdateLog(isError ? `[stderr] ${line}` : line);
    });
    return remainder;
  };

  child.stdout?.on('data', (chunk) => {
    stdoutBuffer = flushBuffered(String(chunk), stdoutBuffer, false);
  });

  child.stderr?.on('data', (chunk) => {
    stderrBuffer = flushBuffered(String(chunk), stderrBuffer, true);
  });

  child.on('error', (error) => {
    uiUpdateState.status = 'error';
    uiUpdateState.finishedAt = Date.now();
    uiUpdateState.error = `Failed to launch update script: ${error.message}`;
    pushUiUpdateLog(uiUpdateState.error);
  });

  child.on('close', (code, signal) => {
    if (stdoutBuffer.trim()) {
      pushUiUpdateLog(stdoutBuffer.trim());
    }
    if (stderrBuffer.trim()) {
      pushUiUpdateLog(`[stderr] ${stderrBuffer.trim()}`);
    }

    if (uiUpdateState.status === 'error') {
      return;
    }

    uiUpdateState.finishedAt = Date.now();
    if (code === 0) {
      uiUpdateState.status = 'success';
      pushUiUpdateLog('Update finished successfully.');
      return;
    }

    uiUpdateState.status = 'error';
    uiUpdateState.error = signal
      ? `Update script terminated by signal ${signal}`
      : `Update script exited with code ${code ?? 'unknown'}`;
    pushUiUpdateLog(uiUpdateState.error);
  });

  return { accepted: true, code: 202, body: { ok: true, update: snapshotUiUpdateState() } };
}

function nmcli(args, timeout = 30000) {
  return new Promise((resolve, reject) => {
    execFile('nmcli', args, { timeout }, (error, stdout, stderr) => {
      if (error) {
        if ((error).code === 'ENOENT') {
          reject(new Error('Wi-Fi control requires NetworkManager (nmcli) on the printer host.'));
          return;
        }
        reject(new Error((stderr || stdout || error.message).trim()));
        return;
      }
      resolve(stdout);
    });
  });
}

// nmcli terse output separates fields with ':' and escapes literal colons as '\:'
function splitTerse(line) {
  return line.split(/(?<!\\):/).map((part) => part.replace(/\\:/g, ':').replace(/\\\\/g, '\\'));
}

const firstIpv4 = (raw) => {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  const ip = value.includes('/') ? value.split('/')[0] : value;
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip) ? ip : '';
};

async function readConnectedDevices() {
  const statusOutput = await nmcli(['-t', '-f', 'DEVICE,TYPE,STATE,CONNECTION', 'device', 'status']);
  const devices = statusOutput
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [device, type, state, connection] = splitTerse(line);
      return {
        device: String(device ?? '').trim(),
        type: String(type ?? '').trim(),
        state: String(state ?? '').trim(),
        connection: String(connection ?? '').trim(),
      };
    })
    .filter((entry) => entry.device && entry.state === 'connected');

  const withIps = await Promise.all(devices.map(async (entry) => {
    try {
      const ipOutput = await nmcli(['-g', 'IP4.ADDRESS', 'device', 'show', entry.device], 10000);
      const ipAddresses = ipOutput
        .split('\n')
        .map(firstIpv4)
        .filter(Boolean);
      return { ...entry, ipAddresses };
    } catch {
      return { ...entry, ipAddresses: [] };
    }
  }));

  return withIps;
}

async function listWifiNetworks(rescan) {
  const output = await nmcli(['-t', '-f', 'IN-USE,SSID,SIGNAL,SECURITY', 'dev', 'wifi', 'list', '--rescan', rescan ? 'yes' : 'auto']);
  const connectedDevices = await readConnectedDevices();
  const wifiBySsid = new Map(
    connectedDevices
      .filter((entry) => entry.type === 'wifi' && entry.connection && entry.connection !== '--')
      .map((entry) => [entry.connection, entry]),
  );

  const bySsid = new Map();
  for (const line of output.split('\n').filter(Boolean)) {
    const [inUse, ssid, signal, security] = splitTerse(line);
    if (!ssid) continue;
    const connected = inUse === '*';
    const connectedInfo = connected ? wifiBySsid.get(ssid) : undefined;
    const ipAddresses = connectedInfo?.ipAddresses ?? [];
    const entry = {
      ssid,
      signal: Number(signal) || 0,
      secured: Boolean(security && security !== '--'),
      connected,
      ipAddress: ipAddresses[0],
      ipAddresses,
    };
    const existing = bySsid.get(ssid);
    if (!existing) {
      bySsid.set(ssid, entry);
    } else {
      existing.connected ||= entry.connected;
      existing.signal = Math.max(existing.signal, entry.signal);
      if (!existing.ipAddress && entry.ipAddress) {
        existing.ipAddress = entry.ipAddress;
      }
      if ((!Array.isArray(existing.ipAddresses) || existing.ipAddresses.length === 0) && Array.isArray(entry.ipAddresses) && entry.ipAddresses.length > 0) {
        existing.ipAddresses = entry.ipAddresses;
      }
    }
  }

  const primaryIp = connectedDevices.find((entry) => entry.ipAddresses.length > 0)?.ipAddresses[0] ?? '';

  return {
    networks: [...bySsid.values()].sort((a, b) => Number(b.connected) - Number(a.connected) || b.signal - a.signal),
    primaryIp,
  };
}

function readBody(req, maxSize = 4096) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > maxSize) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(base, patch) {
  if (!isPlainObject(base)) {
    return patch;
  }

  const output = { ...base };
  if (!isPlainObject(patch)) {
    return output;
  }

  Object.entries(patch).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = deepMerge(output[key], value);
      return;
    }
    output[key] = value;
  });

  return output;
}

async function ensureUiConfig() {
  const directory = dirname(configPath);
  await mkdir(directory, { recursive: true });

  try {
    const raw = await readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      throw new Error('Invalid config root');
    }
    const merged = deepMerge(defaultUiConfig, parsed);
    return merged;
  } catch {
    try {
      await access(configPath, fsConstants.F_OK);
      return structuredClone(defaultUiConfig);
    } catch {
      await saveUiConfig(defaultUiConfig);
      return structuredClone(defaultUiConfig);
    }
  }
}

async function saveUiConfig(config) {
  const directory = dirname(configPath);
  await mkdir(directory, { recursive: true });
  const nextText = `${JSON.stringify(config, null, 2)}\n`;
  const tempPath = `${configPath}.tmp`;
  await writeFile(tempPath, nextText, 'utf8');
  await rename(tempPath, configPath);
}

// Wi-Fi control is limited to the local kiosk browser
async function handleWifi(req, res, path) {
  if (!loopbackAddresses.has(req.socket.remoteAddress ?? '')) {
    sendJson(res, 403, { error: 'Wi-Fi control is only available from the printer screen' });
    return;
  }

  try {
    if (req.method === 'GET' && path === '/api/wifi/networks') {
      const rescan = new URL(req.url, 'http://localhost').searchParams.get('rescan') === '1';
      sendJson(res, 200, await listWifiNetworks(rescan));
      return;
    }

    if (req.method === 'POST' && path === '/api/wifi/connect') {
      const { ssid, password } = JSON.parse(await readBody(req));
      if (typeof ssid !== 'string' || !ssid || ssid.startsWith('-')) {
        sendJson(res, 400, { error: 'Invalid network name' });
        return;
      }
      const args = ['dev', 'wifi', 'connect', ssid];
      if (typeof password === 'string' && password) args.push('password', password);
      await nmcli(args, 45000);
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Wi-Fi request failed';
    if (message.includes('requires NetworkManager')) {
      sendJson(res, 501, { error: message });
      return;
    }
    sendJson(res, 500, { error: message });
  }
}

async function handleUi(req, res, path) {
  if (!loopbackAddresses.has(req.socket.remoteAddress ?? '')) {
    sendJson(res, 403, { error: 'UI update is only available from the printer screen' });
    return;
  }

  try {
    if (req.method === 'GET' && path === '/api/ui/update-screen') {
      sendJson(res, 200, { update: snapshotUiUpdateState() });
      return;
    }

    if (req.method === 'GET' && path === '/api/ui/config') {
      const config = await ensureUiConfig();
      sendJson(res, 200, { config });
      return;
    }

    if (req.method === 'PATCH' && path === '/api/ui/config') {
      const body = JSON.parse(await readBody(req, 256000));
      if (!isPlainObject(body)) {
        sendJson(res, 400, { error: 'Config patch must be an object' });
        return;
      }

      const current = await ensureUiConfig();
      const next = deepMerge(current, body);
      await saveUiConfig(next);
      sendJson(res, 200, { config: next });
      return;
    }

    if (req.method === 'POST' && path === '/api/ui/update-screen') {
      const startResult = await startUiUpdateJob();
      sendJson(res, startResult.code, startResult.body);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'UI request failed' });
  }
}

const contentTypeMap = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function safePath(urlPath) {
  const trimmed = urlPath.split('?')[0] || '/';
  const decoded = decodeURIComponent(trimmed);
  const normalized = normalize(decoded).replace(/^\/+/, '');
  return join(root, normalized);
}

async function sendFile(path, res) {
  const fileStat = await stat(path);
  if (!fileStat.isFile()) {
    throw new Error('Not a file');
  }

  const ext = extname(path).toLowerCase();
  const type = contentTypeMap[ext] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  createReadStream(path).pipe(res);
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  const requestPath = req.url.split('?')[0];
  if (requestPath.startsWith('/api/wifi/')) {
    await handleWifi(req, res, requestPath);
    return;
  }

  if (requestPath.startsWith('/api/ui/')) {
    await handleUi(req, res, requestPath);
    return;
  }

  try {
    const requested = safePath(req.url);
    await sendFile(requested, res);
    return;
  } catch {
    try {
      await sendFile(join(root, 'index.html'), res);
      return;
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
});

server.listen(port, host, () => {
  console.log(`Printer UI server listening at http://${host}:${port}`);
});