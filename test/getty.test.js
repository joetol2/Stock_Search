import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGettySource } from '../server/providers/getty.js';

const image = {
  id: '1167612765', title: 'Private jet', caption: 'A jet', asset_family: 'creative', collection_name: 'Moment',
  display_sizes: [{ name: 'thumb', uri: 'https://t/thumb.jpg' }, { name: 'preview', uri: 'https://t/preview.jpg' }],
};
const video = {
  id: '2220937042', title: 'Waves', asset_family: 'editorial',
  display_sizes: [{ name: 'preview', uri: 'https://t/clip.mp4' }, { name: 'thumb', uri: 'https://t/still.jpg' }],
};

function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init) => {
    const u = new URL(url);
    calls.push({ url: u, init });
    for (const [prefix, body] of routes) {
      if (u.pathname.startsWith(prefix)) return new Response(JSON.stringify(body), { status: 200 });
    }
    return new Response('', { status: 404 });
  };
  fn.calls = calls;
  return fn;
}

test('photo search sends filters and builds cards', async () => {
  const fetchImpl = fakeFetch([['/v3/search/images/creative', { result_count: 25, images: [image] }]]);
  const getty = createGettySource({ apiKey: 'gk', fetchImpl });
  const page = await getty.search({ query: 'jet', page: 2, perPage: 10, orientation: 'vertical', people: 'none', sort: 'newest' });
  const { url, init } = fetchImpl.calls[0];
  assert.equal(url.searchParams.get('phrase'), 'jet');
  assert.equal(url.searchParams.get('orientations'), 'Vertical');
  assert.equal(url.searchParams.get('number_of_people'), 'none');
  assert.equal(url.searchParams.get('sort_order'), 'newest');
  assert.equal(init.headers['Api-Key'], 'gk');
  assert.equal(page.totalPages, 3);
  const a = page.assets[0];
  assert.equal(a.thumbnailUrl, 'https://t/preview.jpg');
  assert.equal(a.link, 'https://www.gettyimages.com/detail/1167612765');
  assert.equal(a.watermarked, true);
});

test('video search uses the still thumbnail and flags editorial use', async () => {
  const fetchImpl = fakeFetch([['/v3/search/videos/creative', { result_count: 1, videos: [video] }]]);
  const page = await createGettySource({ apiKey: 'gk', fetchImpl }).search({ query: 'waves', mediaType: 'video' });
  assert.equal(page.assets[0].thumbnailUrl, 'https://t/still.jpg');
  assert.equal(page.assets[0].mediaType, 'video');
  assert.deepEqual(page.assets[0].warnings, ['Editorial use only']);
});

test('ID lookup tries photos, then video', async () => {
  const fetchImpl = fakeFetch([['/v3/images/', { images: [], images_not_found: ['2220937042'] }], ['/v3/videos/', { videos: [video] }]]);
  const asset = await createGettySource({ apiKey: 'gk', fetchImpl }).getById('2220937042');
  assert.equal(asset.mediaType, 'video');
  assert.equal(fetchImpl.calls.length, 2);
});

test('with a secret, a token is fetched once and reused', async () => {
  let tokenCalls = 0;
  const fetchImpl = async (url, init) => {
    if (String(url).includes('oauth2/token')) {
      tokenCalls++;
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 1800 }), { status: 200 });
    }
    assert.equal(init.headers.Authorization, 'Bearer tok');
    return new Response(JSON.stringify({ result_count: 0, images: [] }), { status: 200 });
  };
  const getty = createGettySource({ apiKey: 'gk', apiSecret: 's', fetchImpl });
  await getty.search({ query: 'a' });
  await getty.search({ query: 'b' });
  assert.equal(tokenCalls, 1);
});
