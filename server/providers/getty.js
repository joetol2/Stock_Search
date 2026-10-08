// Getty Images stock catalog (creative images and video).
// API docs: https://developers.gettyimages.com/docs/
// Search only: previews are watermarked comps and nothing here licenses or downloads.

import { getJson, SourceError } from './http.js';

const API_BASE = 'https://api.gettyimages.com/v3';
const TOKEN_URL = 'https://authentication.gettyimages.com/oauth2/token';
const FIELDS = 'id,title,caption,asset_family,collection_name,preview,thumb';

// Getty IDs are long numbers, e.g. 1167612765 or 2220937042.
const GETTY_ID = /^\d{6,12}$/;

const ORIENTATIONS = {
  horizontal: 'Horizontal',
  vertical: 'Vertical',
  square: 'Square',
  panoramic: 'PanoramicHorizontal',
};
const PEOPLE = new Set(['none', 'one', 'two', 'group']);
const SORTS = new Set(['best_match', 'most_popular', 'newest', 'random']);

function pickSize(displaySizes = [], order) {
  for (const name of order) {
    const hit = displaySizes.find((d) => d.name === name && d.uri);
    if (hit) return hit.uri;
  }
  return null;
}

/** Turns one Getty image or video into our shared Asset shape. */
export function normalizeGettyAsset(raw, mediaType) {
  const sizes = raw.display_sizes || [];
  // Video "preview" and "comp" sizes are MP4 clips, so videos use the still "thumb".
  const thumbnailUrl = mediaType === 'video' ? pickSize(sizes, ['thumb']) : pickSize(sizes, ['preview', 'comp', 'thumb']);
  const editorial = String(raw.asset_family || '').toLowerCase() === 'editorial';
  return {
    id: String(raw.id),
    source: 'getty',
    sourceLabel: 'Getty Images',
    title: raw.title || raw.caption || `Getty ${mediaType} ${raw.id}`,
    name: raw.collection_name || '',
    description: raw.caption || '',
    mediaType,
    fileType: mediaType === 'video' ? 'VIDEO' : 'IMAGE',
    thumbnailUrl,
    link: `https://www.gettyimages.com/detail/${raw.id}`,
    linkLabel: 'View on Getty Images',
    approved: null,
    freeze: null,
    associatedJobs: [],
    warnings: editorial ? ['Editorial use only'] : [],
    watermarked: true,
  };
}

export function createGettySource({ apiKey, apiSecret, fetchImpl = fetch }) {
  let token = null; // { value, expiresAt }

  async function authHeaders() {
    const headers = { 'Api-Key': apiKey };
    if (!apiSecret) return headers;
    if (!token || Date.now() > token.expiresAt) {
      const res = await fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: apiKey, client_secret: apiSecret }),
      });
      if (!res.ok) throw new SourceError(`Getty Images rejected the API key and secret (${res.status}).`, { status: res.status, source: 'Getty Images' });
      const body = await res.json();
      token = { value: body.access_token, expiresAt: Date.now() + (Number(body.expires_in || 1800) - 60) * 1000 };
    }
    return { ...headers, Authorization: `Bearer ${token.value}` };
  }

  async function get(path) {
    return getJson(`${API_BASE}${path}`, { headers: await authHeaders(), source: 'Getty Images', fetchImpl });
  }

  return {
    id: 'getty',
    label: 'Getty Images',
    description:
      'The Getty Images stock catalog: new creative photos and video to license. ' +
      'Previews are watermarked. Supports orientation, number of people and sort order.',
    kind: 'stock',
    filters: ['mediaType', 'orientation', 'people', 'sort'],

    looksLikeId(text) {
      return GETTY_ID.test(String(text || '').trim());
    },

    async search({ query, page = 1, perPage = 10, mediaType = 'any', orientation, people, sort }) {
      const isVideo = mediaType === 'video';
      const params = new URLSearchParams({ phrase: query || '', page: String(page), page_size: String(perPage), fields: FIELDS });
      if (!isVideo && ORIENTATIONS[orientation]) params.set('orientations', ORIENTATIONS[orientation]);
      if (!isVideo && PEOPLE.has(people)) params.set('number_of_people', people);
      if (SORTS.has(sort)) params.set('sort_order', sort);

      const data = await get(`/search/${isVideo ? 'videos' : 'images'}/creative?${params}`);
      const items = (isVideo ? data?.videos : data?.images) || [];
      const total = Number(data?.result_count ?? items.length);
      return {
        source: 'getty',
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
        assets: items.map((i) => normalizeGettyAsset(i, isVideo ? 'video' : 'image')),
      };
    },

    // Getty uses one ID space for photos and video, so try photos first, then video.
    async getById(id) {
      const images = await get(`/images/${encodeURIComponent(id)}?fields=${FIELDS}`);
      if (images?.images?.length) return normalizeGettyAsset(images.images[0], 'image');
      const videos = await get(`/videos/${encodeURIComponent(id)}?fields=${FIELDS}`);
      if (videos?.videos?.length) return normalizeGettyAsset(videos.videos[0], 'video');
      return null;
    },
  };
}
