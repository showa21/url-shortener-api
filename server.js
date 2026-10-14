'use strict';
const http = require('http');
const crypto = require('crypto');

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function createServer({ baseUrl = '' } = {}) {
  const links = new Map(); // code -> { code, url, clicks, createdAt }

  function send(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
    res.end(payload);
  }

  function readJson(req) {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
        if (data.length > 1e6) { reject(new Error('Body too large')); req.destroy(); }
      });
      req.on('end', () => {
        try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('Invalid JSON')); }
      });
      req.on('error', reject);
    });
  }

  return http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'POST' && pathname === '/api/links') {
        const { url, alias } = await readJson(req);
        if (!isValidUrl(url)) return send(res, 400, { error: 'A valid http(s) url is required' });
        let code = alias;
        if (code !== undefined) {
          if (!/^[A-Za-z0-9_-]{3,32}$/.test(code)) return send(res, 400, { error: 'Alias must be 3-32 chars: letters, digits, - or _' });
          if (links.has(code)) return send(res, 409, { error: 'Alias already in use' });
        } else {
          do { code = randomCode(); } while (links.has(code));
        }
        const link = { code, url, clicks: 0, createdAt: new Date().toISOString() };
        links.set(code, link);
        return send(res, 201, { ...link, shortUrl: `${baseUrl}/${code}` });
      }

      if (req.method === 'GET' && pathname === '/api/links') {
        return send(res, 200, [...links.values()]);
      }

      const statsMatch = pathname.match(/^\/api\/links\/([^/]+)$/);
      if (statsMatch) {
        const link = links.get(statsMatch[1]);
        if (!link) return send(res, 404, { error: 'Not found' });
        if (req.method === 'GET') return send(res, 200, link);
        if (req.method === 'DELETE') { links.delete(link.code); res.writeHead(204); return res.end(); }
      }

      if (req.method === 'GET' && /^\/[^/]+$/.test(pathname)) {
        const link = links.get(pathname.slice(1));
        if (!link) return send(res, 404, { error: 'Not found' });
        link.clicks += 1;
        res.writeHead(302, { Location: link.url });
        return res.end();
      }

      send(res, 404, { error: 'Not found' });
    } catch (err) {
      send(res, 400, { error: err.message });
    }
  });
}

module.exports = { createServer, isValidUrl };

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createServer({ baseUrl: `http://localhost:${port}` }).listen(port, () =>
    console.log(`URL shortener listening on http://localhost:${port}`));
}
