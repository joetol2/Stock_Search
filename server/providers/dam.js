// Q-S DAM: the Getty Media Manager library, which runs on Brandfolder's API.
// API docs: https://developers.brandfolder.com/docs/ (v4)

import { getJson } from './http.js';
import { readDescription, warningsFor } from '../lib/governance.js';
import { DAM_IMAGE_EXTENSIONS, DAM_VIDEO_EXTENSIONS, mediaTypeFor, smallPreview } from '../lib/media.js';

const API_BASE = 'https://brandfolder.com/api/v4';

// DAM IDs are short lowercase letters-and-numbers, e.g. 24r3xb4zsspbqcx3wgxgmnv8.
const DAM_ID = /^[a-z0-9]{18,30}$/;

/** Adds the file-type filter the DAM understands to a keyword search. */
export function damQuery(query, mediaType) {
  const q = String(query || '').trim();
  const exts = mediaType === 'image' ? DAM_IMAGE_EXTENSIONS : mediaType === 'video' ? DAM_VIDEO_EXTENSIONS : null;
  if (!exts) return q;
  const filter = `(${exts.map((e) => `extension:${e}`).join(' OR ')})`;
  return q ? `${q} ${filter}` : filter;
}

/** Turns one Brandfolder asset into our shared Asset shape. */
export function normalizeDamAsset(raw, { assetUrlBase, today } = {}) {
  const a = raw?.attributes || {};
  const fileType = String(a.extension || '').toUpperCase();
  const notes = readDescription(a.description, today);
  const approved = typeof a.approved === 'boolean' ? a.approved : null;
  const name = a.name || '';
  return {
    id: raw.id,
    source: 'dam',
    sourceLabel: 'Q-S DAM',
    title: notes.description || name || 'Untitled asset',
    name,
    description: notes.description,
    mediaType: mediaTypeFor(fileType),
    fileType,
    thumbnailUrl: smallPreview(a.thumbnail_url),
    link: `${assetUrlBase}${raw.id}`,
    linkLabel: 'Open in Media Manager',
    approved,
    freeze: notes.freeze,
    associatedJobs: notes.associatedJobs,
    warnings: warningsFor({ approved, freeze: notes.freeze }),
    watermarked: false,
  };
}

export function createDamSource({ apiKey, libraryId, assetUrlBase, fetchImpl, now = () => new Date() }) {
  const headers = { Authorization: apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}` };
  const opts = { headers, source: 'Q-S DAM', fetchImpl };
  const normalize = (raw) => normalizeDamAsset(raw, { assetUrlBase, today: now() });

  return {
    id: 'dam',
    label: 'Q-S DAM',
    description:
      'Existing assets Q-S already has in the Getty Media Manager library (the Q-S DAM). ' +
      'Shows usage history (Associated Jobs), market freezes and approval status.',
    kind: 'library',
    filters: ['mediaType'],

    looksLikeId(text) {
      const t = String(text || '').trim();
      return DAM_ID.test(t) && /\d/.test(t) && /[a-z]/.test(t);
    },

    async search({ query, page = 1, perPage = 10, mediaType = 'any' }) {
      const params = new URLSearchParams({
        search: damQuery(query, mediaType),
        page: String(page),
        per: String(perPage),
        fields: 'extension',
      });
      const data = await getJson(`${API_BASE}/brandfolders/${encodeURIComponent(libraryId)}/assets?${params}`, opts);
      const assets = (data?.data || []).map(normalize);
      const meta = data?.meta || {};
      const total = Number(meta.total_count ?? assets.length);
      return {
        source: 'dam',
        page: Number(meta.current_page ?? page),
        perPage,
        total,
        totalPages: Number(meta.total_pages ?? Math.max(1, Math.ceil(total / perPage))),
        assets,
      };
    },

    async getById(id) {
      const data = await getJson(`${API_BASE}/assets/${encodeURIComponent(id)}?fields=extension`, opts);
      return data?.data ? normalize(data.data) : null;
    },
  };
}
