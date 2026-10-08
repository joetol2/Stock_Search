import express from 'express';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
const MEDIA_TYPES = new Set(['any', 'image', 'video']);

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/**
 * Builds the web app.
 * @param {{ registry: import('./providers/index.js').SourceRegistry, agent?: import('./agent/agent.js').Agent | null, appApiKey?: string }} deps
 */
export function createApp({ registry, agent = null, appApiKey = '' }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  if (appApiKey) {
    // People get a browser password prompt (any user name, the key as password).
    // Other callers, like a Copilot Studio tool, send the key in an x-api-key header.
    app.use((req, res, next) => {
      if (req.get('x-api-key') === appApiKey) return next();
      const [scheme, encoded] = (req.get('authorization') || '').split(' ');
      if (scheme === 'Basic' && encoded) {
        const password = Buffer.from(encoded, 'base64').toString().split(':').slice(1).join(':');
        if (password === appApiKey) return next();
      }
      res.set('WWW-Authenticate', 'Basic realm="Stock Search"').status(401).json({ error: 'This site needs a password.' });
    });
  }

  const api = express.Router();

  api.get('/sources', (req, res) => {
    res.json({
      sources: registry.list().map((s) => ({ id: s.id, label: s.label, description: s.description, kind: s.kind, filters: s.filters })),
      assistant: Boolean(agent),
    });
  });

  api.get('/search', async (req, res) => {
    const query = String(req.query.q ?? req.query.query ?? '').trim();
    if (!query) return res.status(400).json({ error: 'Add something to search for (q).' });
    const params = {
      query,
      page: clampInt(req.query.page, 1, 1, 10000),
      perPage: clampInt(req.query.perPage, 10, 1, 50),
      mediaType: MEDIA_TYPES.has(req.query.mediaType) ? req.query.mediaType : 'any',
      orientation: req.query.orientation || undefined,
      people: req.query.people || undefined,
      sort: req.query.sort || undefined,
    };
    const sources = String(req.query.sources || 'all');
    const results = await registry.search(sources, params);

    // A query that is just an ID also gets an exact lookup, shown above the keyword results.
    let exact = null;
    if (!/\s/.test(query) && params.page === 1) {
      const found = await registry.findById(query, sources);
      exact = found.asset;
    }
    res.json({ query, params, exact, results });
  });

  api.get('/assets/:source/:id', async (req, res) => {
    const source = registry.get(req.params.source);
    if (!source) return res.status(404).json({ error: `No source called ${req.params.source}.` });
    try {
      const asset = await source.getById(req.params.id);
      if (!asset) return res.status(404).json({ error: 'Asset not found.' });
      res.json({ asset });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  api.post('/chat', async (req, res) => {
    if (!agent) return res.status(503).json({ error: 'The assistant is off. Add ANTHROPIC_API_KEY to your .env file to turn it on.' });
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Type a message first.' });
    try {
      res.json(await agent.chat(req.body?.conversationId, message.slice(0, 4000)));
    } catch (err) {
      console.error('chat failed:', err);
      res.status(502).json({ error: `The assistant hit a problem: ${err.message}` });
    }
  });

  app.use('/api', api);
  app.use(express.static(PUBLIC_DIR));
  return app;
}
