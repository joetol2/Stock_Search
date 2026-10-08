import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDamSource, damQuery, normalizeDamAsset } from '../server/providers/dam.js';

const sample = JSON.parse(readFileSync(new URL('../server/providers/sample-data/dam-sample.json', import.meta.url), 'utf8'));
const BASE = 'https://dam.gettyimages.com/quigley-simpson/#!asset/';

test('photo and video filters are added to the DAM search', () => {
  assert.equal(damQuery('beach', 'any'), 'beach');
  assert.equal(damQuery('beach', 'image'), 'beach (extension:jpg OR extension:jpeg OR extension:png OR extension:tif)');
  assert.equal(damQuery('beach', 'video'), 'beach (extension:mp4 OR extension:mov)');
});

test('a DAM asset becomes a card with file type, link and notes', () => {
  const raw = sample.data.find((a) => a.attributes.name === 'GettyImages-641784462');
  const a = normalizeDamAsset({ ...raw, attributes: { ...raw.attributes, thumbnail_url: 'https://assets.gettyimages.com/x/element.png' } }, { assetUrlBase: BASE, today: new Date('2026-10-08') });
  assert.equal(a.id, '243q6rpmj8mcmbvgrfr82c');
  assert.equal(a.fileType, 'MOV');
  assert.equal(a.mediaType, 'video');
  assert.equal(a.title, 'GettyImages-641784462');
  assert.equal(a.link, `${BASE}243q6rpmj8mcmbvgrfr82c`);
  assert.equal(a.thumbnailUrl, 'https://assets.gettyimages.com/x/element.png?width=262');
  assert.deepEqual(a.associatedJobs, ['ACME20_100001QSM_Media Partnerships - Streaming']);
});

test('search calls Brandfolder with the library, page and bearer key', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify({ ...sample, meta: { current_page: 2, total_pages: 198, total_count: 1976 } }), { status: 200 });
  };
  const dam = createDamSource({ apiKey: 'k', libraryId: 'lib1', assetUrlBase: BASE, fetchImpl });
  const page = await dam.search({ query: 'beach', page: 2, perPage: 10, mediaType: 'video' });
  assert.equal(calls[0].url.pathname, '/api/v4/brandfolders/lib1/assets');
  assert.equal(calls[0].url.searchParams.get('search'), 'beach (extension:mp4 OR extension:mov)');
  assert.equal(calls[0].url.searchParams.get('page'), '2');
  assert.equal(calls[0].url.searchParams.get('fields'), 'extension');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer k');
  assert.equal(page.totalPages, 198);
  assert.equal(page.total, 1976);
  assert.equal(page.assets.length, 10);
});

test('DAM IDs are recognised, Getty numbers are not', () => {
  const dam = createDamSource({ apiKey: 'k', libraryId: 'l', assetUrlBase: BASE });
  assert.equal(dam.looksLikeId('24r3xb4zsspbqcx3wgxgmnv8'), true);
  assert.equal(dam.looksLikeId('2220937042'), false);
  assert.equal(dam.looksLikeId('beach'), false);
});

test('a bad key gives a plain-English error', async () => {
  const dam = createDamSource({ apiKey: 'k', libraryId: 'l', assetUrlBase: BASE, fetchImpl: async () => new Response('nope', { status: 401 }) });
  await assert.rejects(dam.search({ query: 'x' }), /rejected the API key/);
});
