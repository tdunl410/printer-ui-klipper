import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const host = process.env.PRINTER_UI_HOST ?? '0.0.0.0';
const port = Number(process.env.PRINTER_UI_PORT ?? 4409);
const root = process.env.PRINTER_UI_DIST ?? join(process.cwd(), 'dist');

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