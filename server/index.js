import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from './config.js';
import { buildSources } from './providers/index.js';
import { Agent } from './agent/agent.js';
import { createApp } from './app.js';

try {
  process.loadEnvFile();
} catch {
  // No .env file: settings come from the environment instead.
}

const config = loadConfig();
const registry = buildSources(config);
const agent = config.agent.apiKey
  ? new Agent({ client: new Anthropic({ apiKey: config.agent.apiKey }), registry, model: config.agent.model, effort: config.agent.effort })
  : null;

createApp({ registry, agent, appApiKey: config.appApiKey }).listen(config.port, () => {
  console.log(`Stock Search is running at http://localhost:${config.port}`);
  console.log(`Sources: ${registry.list().map((s) => s.label).join(', ') || 'none'}`);
  console.log(`Assistant: ${agent ? `on (${config.agent.model})` : 'off (add ANTHROPIC_API_KEY to turn it on)'}`);
});
