# Copilot Studio files

This folder keeps everything from the Copilot Studio build so nothing is lost, plus one
simpler way to connect Copilot Studio to this project.

## The simpler way (recommended)

Host the Stock Search site, then add **one REST API tool** in Copilot Studio from
[`stock-search-api.swagger.yaml`](stock-search-api.swagger.yaml):

1. Change `host:` in that file to the site's address.
2. Set `APP_API_KEY` on the site. In Copilot Studio, use the same value as the API key.
3. **Tools → + Add a tool → REST API**, upload the file, and turn on **SearchStockAssets**.
4. Let the agent reply with a plain list of titles and links.

The site does the DAM and Getty calls, the freeze and Associated Jobs reading and the
paging, so the agent has one tool, no cards and no connector code to keep in sync.

## What's kept from the earlier build

| File | What it is |
|---|---|
| `dam-connector.swagger.yaml` | The working DAM custom connector (search as `SearchDAMAssetsV2`, and lookup by ID) |
| `getty-images-connector.swagger.yaml` | The Getty Images connector, ready for when the API key arrives |
| `GETTY-SETUP.md` | Step-by-step Getty setup in Copilot Studio |
| `cards/dam-search-card-v11.powerfx` | The DAM results card that works in Teams, with Next/Previous page buttons |
| `cards/dam-id-card.powerfx` | The single-asset card for DAM ID lookups |
| `cards/getty-image-card.powerfx`, `cards/getty-video-card.powerfx` | Getty result cards |
| `agent-instructions.md` | The agent's instructions and tool/input descriptions |

## Lessons learned

These are why the website exists, and they still apply if you stay in Copilot Studio.

- **Teams is stricter than the test pane.** A card that works in the test pane can fail in Teams. Always test in Teams after publishing, with **Force newest version** ticked.
- **An empty image address breaks the whole card in Teams** (`InvalidUri`), even when the image is hidden. Never send `url: ""`.
- **Full-size video frames freeze Teams.** Only use small previews (`thumbs.bfldr.com`, or `?width=262` on unsigned `assets.gettyimages.com` frames).
- **Page buttons must be Teams `imBack` actions** ("Show page 3 of these DAM results"). They do nothing in the test pane.
- **Copilot Studio caches a tool's field list.** After changing the connector, re-add the tool, and if it still uses the old fields give the operation a new `operationId`.
- **Connector code (C#) does not run** when Copilot Studio calls the connector, so all cleanup has to happen in the card formula or the instructions.
- **The agent repeats results as a table** unless the tool description says not to. Say "reply with one short sentence at most".
- **"More" must reuse the most recent search terms** and track pages separately for each source.
- **Long numbers are Getty stock IDs; short letter-number codes are DAM IDs.** The DAM can never find a Getty stock ID.
- **Getty access**: the API key comes through the Getty account rep, and Getty requires an "I AGREE" confirmation that the AI tool doesn't train on their content. Someone authorized to sign for Q-S should send it.
