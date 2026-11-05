import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Serves the exported web bundle as a single-page app.
 *
 * Every unknown path falls back to index.html because expo-router routes on the
 * client: a request for /(booking)/date is a route, not a file.
 *
 * The port matters. The API's CORS allowlist is WEB_URL in apps/api/.env, which
 * carries http://localhost:3000 -- and an origin of http://127.0.0.1:3000 is a
 * *different* origin to a browser, so every request fails and every screen
 * photographs its error state. Serve on 3000 and open localhost, or add the
 * origin you do use to WEB_URL.
 */
const MIME = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

export function serveExport(root, port = 3000) {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.join(root, pathname);

    if (!file.startsWith(root)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(root, 'index.html');
    }

    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
}
