'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createServer, isValidUrl } = require('../server');

async function withServer(fn) {
  const server = createServer({ baseUrl: 'http://short.test' });
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}

const post = (base, body) =>
  fetch(`${base}/api/links`, { method: 'POST', body: JSON.stringify(body) });

test('isValidUrl accepts http(s) only', () => {
  assert.ok(isValidUrl('https://example.com/a'));
  assert.ok(!isValidUrl('javascript:alert(1)'));
  assert.ok(!isValidUrl('nope'));
});

test('creates a link, redirects and counts clicks', () => withServer(async (base) => {
  const res = await post(base, { url: 'https://example.com' });
  assert.strictEqual(res.status, 201);
  const link = await res.json();
  assert.match(link.code, /^[A-Za-z0-9]{6}$/);
  assert.strictEqual(link.shortUrl, `http://short.test/${link.code}`);

  const redirect = await fetch(`${base}/${link.code}`, { redirect: 'manual' });
  assert.strictEqual(redirect.status, 302);
  assert.strictEqual(redirect.headers.get('location'), 'https://example.com');

  const stats = await (await fetch(`${base}/api/links/${link.code}`)).json();
  assert.strictEqual(stats.clicks, 1);
}));

test('custom alias works and duplicates conflict', () => withServer(async (base) => {
  assert.strictEqual((await post(base, { url: 'https://a.com', alias: 'my-link' })).status, 201);
  assert.strictEqual((await post(base, { url: 'https://b.com', alias: 'my-link' })).status, 409);
  assert.strictEqual((await post(base, { url: 'https://b.com', alias: '!!' })).status, 400);
}));

test('rejects invalid urls, handles delete and unknown codes', () => withServer(async (base) => {
  assert.strictEqual((await post(base, { url: 'ftp://x' })).status, 400);
  const { code } = await (await post(base, { url: 'https://example.com' })).json();
  assert.strictEqual((await fetch(`${base}/api/links/${code}`, { method: 'DELETE' })).status, 204);
  assert.strictEqual((await fetch(`${base}/${code}`, { redirect: 'manual' })).status, 404);
}));
