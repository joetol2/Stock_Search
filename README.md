# Stock Search

One website for finding images and video across the **Q-S DAM** (Getty Media Manager) and the **Getty Images** stock catalog, with a chat assistant that searches for you.

- Search both sources at once. Each source has its own Previous / Next pages.
- Filter by photos or video. Getty also has orientation, number of people and sort.
- Paste an asset ID (a DAM code or a long Getty number) to jump straight to it.
- Every result shows its preview, ID, file type and a link to open it.
- DAM results show **Associated Jobs**, **market freezes** (and whether the freeze date has passed) and **Not approved for use**.
- Getty results are watermarked previews and flag **Editorial use only**. Nothing here licenses or downloads.
- The assistant understands plain requests like "people relaxing on a beach, room for copy, vertical", then "more" or "show me video instead".

## Run it

You need [Node.js](https://nodejs.org) 20.12 or newer.

```bash
npm install
cp .env.example .env     # then add your keys to .env
npm start
```

Open http://localhost:3000.

With no keys at all, the site runs on 10 sample DAM assets so you can try it.

## Keys

All keys go in `.env`, which is never committed.

| Setting | What it turns on | Where it comes from |
|---|---|---|
| `DAM_API_KEY` | Q-S DAM search | The Brandfolder API key already used by the Copilot Studio connector |
| `GETTY_API_KEY` | Getty Images stock search | Your Getty Images account rep (`GETTY_API_SECRET` only if Getty says you need it) |
| `ANTHROPIC_API_KEY` | The chat assistant | console.anthropic.com |
| `APP_API_KEY` | A password for the whole site | Any value you choose |

Leave a key blank and that part simply switches off.

## Tests

```bash
npm test
```

## Adding more later

- **A new place to search** (Shutterstock, Adobe Stock, another DAM): one new file in `server/providers/`. See [docs/ADDING_A_SOURCE.md](docs/ADDING_A_SOURCE.md).
- **New governance rules** (client restrictions, content to avoid): `server/lib/governance.js` for rules that read asset data, `server/agent/prompt.js` for how the assistant talks about them.
- **Copilot Studio / Teams**: the site's search is an API, so Copilot Studio can call it as one REST API tool. See [docs/copilot-studio/README.md](docs/copilot-studio/README.md), which also keeps the earlier connector, cards and lessons learned.

## How it's laid out

```
server/
  index.js            starts the site
  app.js              web routes: /api/sources, /api/search, /api/assets/:source/:id, /api/chat
  config.js           reads .env
  providers/          one file per search source, plus the shared registry
  lib/governance.js   reads freezes and Associated Jobs from DAM descriptions
  agent/              the chat assistant (Claude) and its instructions
public/               the website (plain HTML, CSS and JavaScript, no build step)
test/                 tests for each part
docs/                 setup notes and the Copilot Studio files
```
