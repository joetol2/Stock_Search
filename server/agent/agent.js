// The chat assistant: Claude with three tools that call the search sources.
// The website shows search results as cards, so the assistant's own reply stays short.

import { randomUUID } from 'node:crypto';
import { systemPrompt } from './prompt.js';

const MAX_TOOL_ROUNDS = 8;
const MAX_CONVERSATIONS = 200;

export function toolDefinitions(sources) {
  const ids = sources.map((s) => s.id);
  return [
    {
      name: 'search_assets',
      description:
        'Search one source or all connected sources for images and video. Results are shown to the user as cards automatically. ' +
        'Call once per source when sources need different page numbers.',
      input_schema: {
        type: 'object',
        properties: {
          source: { type: 'string', enum: ['all', ...ids], description: 'Which source to search. Default all.' },
          query: { type: 'string', description: 'Short keyword search built from the request, e.g. "beach sunset".' },
          page: { type: 'integer', minimum: 1, description: 'Page number. 1 for a new search.' },
          media_type: { type: 'string', enum: ['any', 'image', 'video'], description: 'Only when the user asks for photos or video.' },
          orientation: { type: 'string', enum: ['horizontal', 'vertical', 'square', 'panoramic'], description: 'Getty only, when asked.' },
          number_of_people: { type: 'string', enum: ['none', 'one', 'two', 'group'], description: 'Getty only, when asked.' },
          sort: { type: 'string', enum: ['best_match', 'most_popular', 'newest', 'random'], description: 'Getty only. Default best_match.' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
    {
      name: 'get_asset_by_id',
      description:
        'Look up one asset by its ID. Long numbers are Getty Images IDs; short letter-and-number codes are Q-S DAM IDs. The asset is shown to the user as a card.',
      input_schema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'The asset ID exactly as the user gave it.' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  ];
}

// What the model sees from a search: enough to talk about the results, not the full cards.
function brief(asset) {
  return {
    id: asset.id,
    title: asset.title,
    type: asset.fileType || asset.mediaType,
    ...(asset.warnings.length ? { warnings: asset.warnings } : {}),
    ...(asset.associatedJobs.length ? { associated_jobs: asset.associatedJobs.length } : {}),
  };
}

/**
 * Runs one tool call. Returns the text for the model and the cards for the website.
 */
export async function runTool(registry, name, input) {
  if (name === 'search_assets') {
    const params = {
      query: input.query,
      page: input.page || 1,
      perPage: 10,
      mediaType: input.media_type || 'any',
      orientation: input.orientation,
      people: input.number_of_people,
      sort: input.sort,
    };
    const pages = await registry.search(input.source || 'all', params);
    const forModel = pages.map((p) =>
      p.error
        ? { source: p.source, error: p.error }
        : { source: p.source, page: p.page, total_pages: p.totalPages, total_matches: p.total, results: p.assets.map(brief) },
    );
    return { text: JSON.stringify(forModel), display: { kind: 'search', query: params.query, params, pages } };
  }
  if (name === 'get_asset_by_id') {
    const { asset, checked, errors } = await registry.findById(String(input.id).trim());
    if (asset) return { text: JSON.stringify({ found: true, source: asset.source, ...brief(asset) }), display: { kind: 'asset', asset } };
    const why = checked.length ? `Checked ${checked.join(', ')}.` : 'That ID does not match the ID format of any connected source.';
    return { text: JSON.stringify({ found: false, note: why, errors }), display: null };
  }
  return { text: `Unknown tool ${name}`, display: null, isError: true };
}

export class Agent {
  /**
   * @param {{ client: any, registry: import('../providers/index.js').SourceRegistry, model: string, effort?: string, now?: () => Date }} opts
   */
  constructor({ client, registry, model, effort = 'low', now = () => new Date() }) {
    this.client = client;
    this.registry = registry;
    this.model = model;
    this.effort = effort;
    this.now = now;
    // History is kept on the server so Claude's thinking blocks go back unchanged each turn.
    this.conversations = new Map();
  }

  async chat(conversationId, userText) {
    const id = conversationId && this.conversations.has(conversationId) ? conversationId : randomUUID();
    const messages = this.conversations.get(id) || [];
    messages.push({ role: 'user', content: userText });

    const sources = this.registry.list();
    const system = systemPrompt(sources, this.now().toISOString().slice(0, 10));
    const tools = toolDefinitions(sources);
    const displays = [];
    let reply = '';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        system,
        tools,
        messages,
        output_config: { effort: this.effort },
        // If Claude declines a request, the API retries it on a fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'refusal') {
        reply = "Sorry, I can't help with that request.";
        break;
      }
      if (response.stop_reason === 'pause_turn') continue;

      const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      if (text) reply = text;

      const toolUses = response.content.filter((b) => b.type === 'tool_use');
      if (response.stop_reason !== 'tool_use' || toolUses.length === 0) break;

      const results = await Promise.all(
        toolUses.map(async (t) => {
          try {
            const out = await runTool(this.registry, t.name, t.input || {});
            if (out.display) displays.push(out.display);
            return { type: 'tool_result', tool_use_id: t.id, content: out.text, ...(out.isError ? { is_error: true } : {}) };
          } catch (err) {
            return { type: 'tool_result', tool_use_id: t.id, content: err.message, is_error: true };
          }
        }),
      );
      messages.push({ role: 'user', content: results });
    }

    this.conversations.delete(id);
    this.conversations.set(id, messages);
    if (this.conversations.size > MAX_CONVERSATIONS) this.conversations.delete(this.conversations.keys().next().value);

    return { conversationId: id, reply: reply || 'Done.', results: displays };
  }
}
