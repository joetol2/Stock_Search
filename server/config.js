// Reads settings from environment variables (and a .env file if there is one).
// Secrets live only in .env or the host's environment, never in the repo.

export function loadConfig(env = process.env) {
  const s = (name, fallback = '') => (env[name] ?? '').trim() || fallback;
  return {
    port: Number(s('PORT', '3000')),
    demoMode: s('DEMO_MODE', 'auto').toLowerCase(),
    appApiKey: s('APP_API_KEY'),
    dam: {
      apiKey: s('DAM_API_KEY'),
      libraryId: s('DAM_LIBRARY_ID', 'hwj47s9kcnvsqmrvk7xzhgtx'),
      assetUrlBase: s('DAM_ASSET_URL_BASE', 'https://dam.gettyimages.com/quigley-simpson/#!asset/'),
    },
    getty: {
      apiKey: s('GETTY_API_KEY'),
      apiSecret: s('GETTY_API_SECRET'),
    },
    agent: {
      apiKey: s('ANTHROPIC_API_KEY'),
      model: s('ANTHROPIC_MODEL', 'claude-opus-5-5'),
      effort: s('ANTHROPIC_EFFORT', 'low'),
    },
  };
}
