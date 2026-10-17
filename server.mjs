import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname);
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/generate') {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      raw += chunk;
      if (Buffer.byteLength(raw) > 256_000) {
        sendJson(res, 413, { error: 'Request is too large.' });
        req.destroy();
      }
    });
    req.on('end', async () => {
      if (res.writableEnded) return;
      try {
        const response = await fetch('http://127.0.0.1:11434/api/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw,
          signal: AbortSignal.timeout(120_000),
        });
        const body = await response.text();
        res.writeHead(response.status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(body);
      } catch {
        sendJson(res, 502, { error: 'Can’t reach Ollama. Make sure Ollama is open and the model is installed, then try again.' });
      }
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405); res.end('Method not allowed'); return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = resolve(root, relative);
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    const content = req.method === 'HEAD' ? null : await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': info.size });
    res.end(content);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(8000, '127.0.0.1', () => console.log('ClassKit is ready at http://localhost:8000 (press Ctrl+C to stop)'));
