import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const host = process.env.PRINTER_UI_HOST ?? '0.0.0.0';
const port = Number(process.env.PRINTER_UI_PORT ?? 4409);
const root = process.env.PRINTER_UI_DIST ?? join(process.cwd(), 'dist');

const loopbackAddresses = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function nmcli(args, timeout = 30000) {
  return new Promise((resolve, reject) => {
    execFile('nmcli', args, { timeout }, (error, stdout, stderr) => {
      if (error) {
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

async function listWifiNetworks(rescan) {
  const output = await nmcli(['-t', '-f', 'IN-USE,SSID,SIGNAL,SECURITY', 'dev', 'wifi', 'list', '--rescan', rescan ? 'yes' : 'auto']);
  const bySsid = new Map();
  for (const line of output.split('\n').filter(Boolean)) {
    const [inUse, ssid, signal, security] = splitTerse(line);
    if (!ssid) continue;
    const entry = { ssid, signal: Number(signal) || 0, secured: Boolean(security && security !== '--'), connected: inUse === '*' };
    const existing = bySsid.get(ssid);
    if (!existing) {
      bySsid.set(ssid, entry);
    } else {
      existing.connected ||= entry.connected;
      existing.signal = Math.max(existing.signal, entry.signal);
    }
  }
  return [...bySsid.values()].sort((a, b) => Number(b.connected) - Number(a.connected) || b.signal - a.signal);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 4096) {
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

// Wi-Fi control is limited to the local kiosk browser
async function handleWifi(req, res, path) {
  if (!loopbackAddresses.has(req.socket.remoteAddress ?? '')) {
    sendJson(res, 403, { error: 'Wi-Fi control is only available from the printer screen' });
    return;
  }

  try {
    if (req.method === 'GET' && path === '/api/wifi/networks') {
      const rescan = new URL(req.url, 'http://localhost').searchParams.get('rescan') === '1';
      sendJson(res, 200, { networks: await listWifiNetworks(rescan) });
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
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Wi-Fi request failed' });
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