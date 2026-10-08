# Adding a search source

Every source (the DAM, Getty, the demo data) follows the same small shape, described in
[`server/providers/README.md`](../server/providers/README.md). The website and the assistant
pick up a new source on their own.

1. **Copy an example.** Start from `server/providers/getty.js` for a stock site or
   `server/providers/dam.js` for an asset library. Save it as, say, `server/providers/shutterstock.js`.
2. **Change the three functions.**
   - `search(params)` calls the source's API and returns `{ source, page, perPage, total, totalPages, assets }`.
   - `getById(id)` returns one asset, or `null` if it doesn't exist.
   - `looksLikeId(text)` returns true for that source's ID format, so pasted IDs go to the right place.
   Turn each result into the shared asset shape with a `normalize...` function, and give it a
   `link`, `linkLabel` and any `warnings`.
3. **Add its keys** to `server/config.js` and `.env.example`.
4. **Register it** with one entry in `SOURCE_FACTORIES` in `server/providers/index.js`:
   ```js
   { id: 'shutterstock', enabled: (c) => Boolean(c.shutterstock.apiKey), create: (c) => createShutterstockSource(c.shutterstock) },
   ```
5. **Write a test** like `test/getty.test.js`, which uses a fake `fetch` so it never needs a real key.
6. Run `npm test`, then `npm start` and search.

Tips:
- Use `getJson` from `providers/http.js`; it turns 401/403/429 into plain-English errors.
- If a source fails, the registry shows its error on that source only. The other sources still show results.
- Describe the source well in `description`. The assistant reads it to decide when to search there.
