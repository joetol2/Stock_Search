import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Agent } from '../server/agent/agent.js';
import { buildSources } from '../server/providers/index.js';
import { loadConfig } from '../server/config.js';

// A stand-in for the Anthropic client that replays scripted responses.
function scriptedClient(responses) {
  const requests = [];
  return {
    requests,
    beta: {
      messages: {
        create: async (req) => {
          requests.push(structuredClone(req));
          return responses.shift();
        },
      },
    },
  };
}

test('the assistant searches, shows cards and keeps the conversation', async () => {
  const client = scriptedClient([
    {
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 't1', name: 'search_assets', input: { query: 'beach', source: 'all' } }],
    },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Found 1 beach asset. Say "more" for the next page.' }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'That was the last page.' }] },
  ]);
  const registry = buildSources(loadConfig({}));
  const agent = new Agent({ client, registry, model: 'claude-opus-5-5', now: () => new Date('2026-10-08') });

  const first = await agent.chat(null, 'find beach assets');
  assert.match(first.reply, /beach/);
  assert.equal(first.results[0].kind, 'search');
  assert.equal(first.results[0].pages[0].source, 'demo');

  const toolResult = client.requests[1].messages.at(-1).content[0];
  assert.equal(toolResult.type, 'tool_result');
  assert.match(toolResult.content, /total_matches/);

  const second = await agent.chat(first.conversationId, 'more');
  assert.equal(second.conversationId, first.conversationId);
  // The second turn sends the whole history back, including the first turn's tool calls.
  assert.equal(client.requests[2].messages.length, 5);
  assert.equal(client.requests[0].model, 'claude-opus-5-5');
  assert.match(client.requests[0].system, /Today is 2026-10-08/);
});

test('an unknown ID is reported without a card', async () => {
  const client = scriptedClient([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'get_asset_by_id', input: { id: '2220937042' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'No connected source uses that ID format.' }] },
  ]);
  const agent = new Agent({ client, registry: buildSources(loadConfig({})), model: 'm' });
  const out = await agent.chat(null, 'find 2220937042');
  assert.deepEqual(out.results, []);
  assert.match(client.requests[1].messages.at(-1).content[0].content, /does not match/);
});
