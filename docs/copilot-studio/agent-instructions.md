# Agent instructions and tool descriptions

The current full **Overview → Instructions** text (about 6,900 characters) lives in Copilot
Studio and was never copied out in full. The website's assistant uses an updated version
of it in [`server/agent/prompt.js`](../../server/agent/prompt.js). The pieces below were
written during the build and are what's set on each tool.

## DAM search tool: Search Q-S Media Manager Assets

**Description**

```text
Search existing assets in the Q-S Getty Media Manager library (the Q-S DAM). Use when the user wants assets Q-S already has, asks to search Media Manager or the DAM, or wants existing Q-S assets included in a broader search. This tool shows its results to the user as a card. After it runs, do not list, repeat, summarize or tabulate the results in text; reply with one short sentence at most.
```

**search input**

```text
Search terms for the Q-S DAM. Use 1-4 plain keywords from the user's request (e.g. beach sunset). By default search all file types with no filter. Only when the user specifically asks for photos or images, append: (extension:jpg OR extension:jpeg OR extension:png OR extension:tif). Only when they specifically ask for video, append: (extension:mp4 OR extension:mov). For an asset name or ID, send it as-is. When the user asks for another page ("more", "next page", "Show page N of these DAM results"), reuse the exact search terms from the MOST RECENT DAM search in the conversation, never an earlier one.
```

**Page input**

```text
Page number for Q-S DAM search. Use 1 for a new search or whenever the search terms change. When the user asks for a specific page (for example "Show page 3 of these DAM results"), use that page number with the same search terms as the last DAM search. For "more", "next page" or "another set", use the last successfully returned DAM page plus 1 with the same search terms. For "previous page", subtract 1, never below 1. Never go past the total pages shown on the last DAM card. If no prior page is known, use 1 without asking.
```

Settings: **Completion → Send an adaptive card → Formula** with `cards/dam-search-card-v11.powerfx`, and **Credentials to use → Maker-provided credentials**.

## Paragraph to add to the instructions with Getty

```text
Asset IDs
A long numeric ID (for example 2220937042) is a Getty Images stock asset ID. Look it up with the Getty photo ID tool; if it returns not found or an ImageNotFound error, use the Getty video ID tool. A short alphanumeric ID is a Q-S DAM asset; search the DAM for it. Never call an ID "not found" until the matching lookup completed. Getty purchase history is not available: for requests like "images no one buys", explain that and offer less common imagery using newest sort and later pages instead.
```

## Settings

- **Generative orchestration:** on.
- **Use information from the Web:** off, so the agent only searches approved sources.
- **Shutterstock tools** and the **Creative Asset Search UI** topic: off.

## Test requests

These came from real use and make a good checklist for any version:

- `Find beach assets in our DAM`, then `more`
- `Find stock photos of a private jet flying in a clear blue sky, side view, room for copy`
- `only show things we already have`
- `show me video instead`
- `find 2220937042` (a Getty video ID)
- `return me 100 new images`
- `find me 25 images and videos that no one ever buys`
