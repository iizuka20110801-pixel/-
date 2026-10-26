import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = process.env.PORT || 10000;
const SITE = 'https://ddd-smart.net';
const ALLOW = /^https:\/\/(ddd-smart\.net|cdn\.ddd-smart\.net|d-hentai\.net)\//;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': '*'
};

const MIME = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function fail(res, code, msg) {
  res.writeHead(code, { ...CORS, 'Content-Type': 'text/plain; charset=UTF-8' });
  res.end(msg);
}

async function proxy(req, res, u) {
  let target = u.searchParams.get('url');

  if (!target) {
    const g = u.searchParams.get('g');
    const dir = u.searchParams.get('dir');
    const page = u.searchParams.get('page') || '0';
    if (g && dir) {
      target = SITE + '/doujinshi3/show-m.php?g=' + encodeURIComponent(g) +
               '&dir=' + encodeURIComponent(dir) + '&page=' + encodeURIComponent(page);
    } else if (u.pathname !== '/p' && u.pathname !== '/p/') {
      target = SITE + u.pathname + u.search;
    }
  }
  if (!target) return fail(res, 400, 'missing url');
  if (!ALLOW.test(target)) return fail(res, 403, 'blocked');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);

  let r;
  try {
    r = await fetch(target, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        Referer: 'https://ddd-smart.net/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,image/*,*/*'
      }
    });
  } catch (e) {
    clearTimeout(timer);
    return fail(res, 504, 'upstream error: ' + e.message);
  }
  clearTimeout(timer);

  const ct = r.headers.get('content-type') || '';

  if (ct.includes('text/html')) {
    let b = await r.text();
    // 広告スクリプト除去（popunder / 強制リダイレクト対策）
    b = b.replace(/<script[\s\S]*?<\/script>/gi, '');
    // ルート相対リンクを中継経由へ
    b = b.replace(/(href|src)="\/(?!\/)([^"]*)"/gi,
      (m, a, p) => a + '="/p?url=' + encodeURIComponent(SITE + '/' + p) + '"');
    // ビューアのページ送り（?g=..&dir=..&page=N）
    b = b.replace(/href="\?(?!url=)([^"]*)"/gi, (m, q) => 'href="/p?' + q + '"');
    res.writeHead(r.status, {
      ...CORS,
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'public, max-age=120'
    });
    return res.end(b);
  }

  const buf = Buffer.from(await r.arrayBuffer());
  res.writeHead(r.status, {
    ...CORS,
    'Content-Type': ct || 'application/octet-stream',
    'Content-Length': buf.length,
    'Cache-Control': 'public, max-age=86400'
  });
  res.end(buf);
}

async function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) return fail(res, 403, 'forbidden');
  try {
    const buf = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': pathname === '/' ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(buf);
  } catch {
    fail(res, 404, 'not found');
  }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'method not allowed');

  if (u.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }
  if (u.pathname === '/p' || u.pathname === '/p/') return proxy(req, res, u);

  return serveStatic(res, u.pathname);
});

server.listen(PORT, () => console.log('listening on ' + PORT));
