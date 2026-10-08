# Search sources

Each file in this folder is one place we can search. The website and the chat
assistant only talk to sources through the shape below, so a new source never
needs changes anywhere else except one line in `index.js`.

## A source

```js
export function createMySource(config) {
  return {
    id: 'my-source',            // short, used in URLs and by the assistant
    label: 'My Source',          // shown on the website
    description: 'What it holds', // read by the assistant to pick a source
    kind: 'library' | 'stock',   // 'library' = assets Q-S already has
    filters: ['mediaType'],      // which optional filters it understands
    looksLikeId(text) { ... },   // true if text is one of this source's asset IDs
    async search(params) { ... },// returns a SearchPage
    async getById(id) { ... },   // returns an Asset or null
  };
}
```

`params` is `{ query, page, perPage, mediaType, orientation, people, sort }`.
`mediaType` is `'any'`, `'image'` or `'video'`. Ignore filters you don't support.

## SearchPage

```js
{ source, page, perPage, total, totalPages, assets: [Asset] }
```

## Asset

```js
{
  id, source, sourceLabel,
  title,            // what to show in bold
  name,             // file or asset name
  description,      // plain text, may be ''
  mediaType,        // 'image' | 'video' | 'other'
  fileType,         // 'JPEG', 'MOV', ... or ''
  thumbnailUrl,     // small preview, or null
  link,             // opens the asset in its own system
  linkLabel,        // e.g. 'Open in Media Manager'
  approved,         // true | false | null when unknown
  freeze,           // null | { text, until, expired }
  associatedJobs,   // [] of job names
  warnings,         // [] of short strings to show in red
  watermarked,      // true for stock previews
}
```

See `dam.js` and `getty.js` for real examples, and `docs/ADDING_A_SOURCE.md`
for a step-by-step guide.
