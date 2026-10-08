// The list of search sources. To add a source, write it in its own file and add
// one entry to SOURCE_FACTORIES below. See docs/ADDING_A_SOURCE.md.

import { createDamSource } from './dam.js';
import { createGettySource } from './getty.js';
import { createDemoSource } from './demo.js';

const SOURCE_FACTORIES = [
  {
    id: 'dam',
    enabled: (c) => Boolean(c.dam.apiKey),
    create: (c) => createDamSource(c.dam),
  },
  {
    id: 'getty',
    enabled: (c) => Boolean(c.getty.apiKey),
    create: (c) => createGettySource(c.getty),
  },
];

/** Builds the sources that have keys set up, plus the demo source when asked for. */
export function buildSources(config) {
  const sources = SOURCE_FACTORIES.filter((f) => f.enabled(config)).map((f) => f.create(config));
  const wantDemo = config.demoMode === 'true' || (config.demoMode === 'auto' && sources.length === 0);
  if (wantDemo) sources.push(createDemoSource({ assetUrlBase: config.dam.assetUrlBase }));
  return new SourceRegistry(sources);
}

export class SourceRegistry {
  constructor(sources) {
    this.sources = new Map(sources.map((s) => [s.id, s]));
  }

  list() {
    return [...this.sources.values()];
  }

  get(id) {
    return this.sources.get(id);
  }

  /** The source IDs to use for a request: 'all', one ID, or a comma list. */
  resolve(selection) {
    if (!selection || selection === 'all') return this.list();
    const wanted = String(selection).split(',').map((s) => s.trim());
    return wanted.map((id) => this.get(id)).filter(Boolean);
  }

  /**
   * Searches several sources at once. One failing source never hides the others'
   * results; it comes back with an `error` instead.
   */
  async search(selection, params) {
    const sources = this.resolve(selection);
    return Promise.all(
      sources.map(async (s) => {
        try {
          return { ...(await s.search(params)), label: s.label };
        } catch (err) {
          return { source: s.id, label: s.label, page: params.page || 1, total: 0, totalPages: 0, assets: [], error: err.message };
        }
      }),
    );
  }

  /** Finds one asset by ID, asking only the sources whose ID format matches. */
  async findById(id, selection) {
    const candidates = this.resolve(selection).filter((s) => s.looksLikeId(id));
    const errors = [];
    for (const s of candidates) {
      try {
        const asset = await s.getById(id);
        if (asset) return { asset, checked: candidates.map((c) => c.id) };
      } catch (err) {
        errors.push(`${s.label}: ${err.message}`);
      }
    }
    return { asset: null, checked: candidates.map((c) => c.id), errors };
  }
}
