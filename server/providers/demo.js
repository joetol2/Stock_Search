// Sample DAM results so the website can be tried before any API key is set up.
// The data is the shape of 10 real Q-S DAM search results, with client and job
// names replaced and thumbnails removed (their addresses expire).

import { readFileSync } from 'node:fs';
import { normalizeDamAsset } from './dam.js';

const sample = JSON.parse(readFileSync(new URL('./sample-data/dam-sample.json', import.meta.url), 'utf8'));

export function createDemoSource({ assetUrlBase, now = () => new Date() } = {}) {
  const all = () => sample.data.map((raw) => normalizeDamAsset(raw, { assetUrlBase, today: now() }));

  return {
    id: 'demo',
    label: 'Sample DAM (demo)',
    description: 'Ten sample Q-S DAM assets for trying the site. Not live data.',
    kind: 'library',
    filters: ['mediaType'],

    looksLikeId(text) {
      return sample.data.some((a) => a.id === String(text || '').trim());
    },

    async search({ query = '', page = 1, perPage = 10, mediaType = 'any' }) {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      let hits = all().filter((a) => mediaType === 'any' || a.mediaType === mediaType);
      if (words.length) {
        const matching = hits.filter((a) => {
          const text = [a.title, a.name, a.description, ...a.associatedJobs, a.freeze?.text].join(' ').toLowerCase();
          return words.some((w) => text.includes(w));
        });
        // The sample is tiny, so show everything rather than an empty page.
        if (matching.length) hits = matching;
      }
      const start = (page - 1) * perPage;
      return {
        source: 'demo',
        page,
        perPage,
        total: hits.length,
        totalPages: Math.max(1, Math.ceil(hits.length / perPage)),
        assets: hits.slice(start, start + perPage).map((a) => ({ ...a, source: 'demo', sourceLabel: 'Sample DAM' })),
      };
    },

    async getById(id) {
      const hit = all().find((a) => a.id === id);
      return hit ? { ...hit, source: 'demo', sourceLabel: 'Sample DAM' } : null;
    },
  };
}
