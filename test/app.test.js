import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { buildSources, SourceRegistry } from '../server/providers/index.js';
import { loadConfig } from '../server/config.js';

let server;
let base;

before(async () => {
  const registry = buildSources(loadConfig({ DEMO_MODE: 'auto' }));
  server = createApp({ registry }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

test('with no keys, only the demo source is on', async () => {
  const body = await (await fetch(`${base}/api/sources`)).json();
  assert.deepEqual(body.sources.map((s) => s.id), ['demo']);
  assert.equal(body.assistant, false);
});

test('search returns grouped results', async () => {
  const body = await (await fetch(`${base}/api/search?q=beach`)).json();
  assert.equal(body.results[0].source, 'demo');
  assert.ok(body.results[0].assets.some((a) => a.name === 'Laguna BEACH 1062 R2'));
});

test('an ID in the search box also returns the exact asset', async () => {
  const body = await (await fetch(`${base}/api/search?q=23hz6r7j9pffbhv8k6fxqtq`)).json();
  assert.equal(body.exact.id, '23hz6r7j9pffbhv8k6fxqtq');
});

test('an empty search is refused', async () => {
  assert.equal((await fetch(`${base}/api/search?q=`)).status, 400);
});

test('chat explains how to turn the assistant on', async () => {
  const res = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"message":"hi"}' });
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /ANTHROPIC_API_KEY/);
});

test('the website is served', async () => {
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /Creative Asset Search/);
});

test('one failing source does not hide another', async () => {
  const ok = { id: 'a', label: 'A', looksLikeId: () => false, search: async () => ({ source: 'a', page: 1, total: 1, totalPages: 1, assets: [{ id: '1' }] }) };
  const bad = { id: 'b', label: 'B', looksLikeId: () => false, search: async () => { throw new Error('down'); } };
  const results = await new SourceRegistry([ok, bad]).search('all', { query: 'x' });
  assert.equal(results[0].assets.length, 1);
  assert.equal(results[1].error, 'down');
});

test('a site password blocks requests without it', async () => {
  const s = createApp({ registry: new SourceRegistry([]), appApiKey: 'secret' }).listen(0);
  await new Promise((r) => s.once('listening', r));
  const url = `http://localhost:${s.address().port}/api/sources`;
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { 'x-api-key': 'secret' } })).status, 200);
  assert.equal((await fetch(url, { headers: { Authorization: `Basic ${Buffer.from('me:secret').toString('base64')}` } })).status, 200);
  s.close();
});
