// Small fetch wrapper so every source reports errors the same way.

export class SourceError extends Error {
  constructor(message, { status, source } = {}) {
    super(message);
    this.name = 'SourceError';
    this.status = status;
    this.source = source;
  }
}

/**
 * GETs JSON. Returns null on 404 so "not found" is easy to handle.
 * @param {string} url
 * @param {{ headers?: Record<string,string>, source: string, fetchImpl?: typeof fetch, timeoutMs?: number }} opts
 */
export async function getJson(url, { headers = {}, source, fetchImpl = fetch, timeoutMs = 15000 }) {
  let res;
  try {
    res = await fetchImpl(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new SourceError(`Could not reach ${source}: ${err.message}`, { source });
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new SourceError(explain(res.status, source, body), { status: res.status, source });
  }
  return res.json();
}

function explain(status, source, body) {
  const detail = body ? ` (${body.slice(0, 200)})` : '';
  if (status === 401) return `${source} rejected the API key. Check it in your .env file.${detail}`;
  if (status === 403) return `${source} accepted the key but this account isn't allowed to do that search.${detail}`;
  if (status === 429) return `${source} says we're searching too fast. Try again in a minute.`;
  return `${source} returned an error (${status}).${detail}`;
}
