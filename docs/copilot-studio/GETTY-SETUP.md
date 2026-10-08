# Getty Images Stock Search: Setup for Q-S Creative Asset Search

This setup adds the Getty Images stock catalog alongside the Q-S DAM. It uses no flows: the agent calls a custom connector directly, the same way your working DAM tool does.

**Files**
- `getty-images-connector.swagger.yaml`: the custom connector, with four actions:
  - Search Getty Images stock photos
  - Search Getty Images stock video
  - Get Getty Images stock photos by ID
  - Get Getty Images stock videos by ID
- `getty-image-card.powerfx`: results card for photo search and photo ID lookup.
- `getty-video-card.powerfx`: results card for video search and video ID lookup.

**Before you start:** you need the Getty Images API key from your Getty account rep. This is not the Brandfolder / Media Manager key.

---

## Step 1: Create the connector (about 5 minutes)

1. Go to https://make.powerapps.com and choose the **same environment** as the agent (top right).
2. Open **Custom connectors**, then **+ New custom connector → Import an OpenAPI file**.
3. Set the name to `Getty Images Stock Search` and upload `getty-images-connector.swagger.yaml`. Click **Continue**.
4. Click through the tabs. Everything is pre-filled:
   - **General:** host `api.gettyimages.com`, base URL `/v3`.
   - **Security:** API Key, parameter name `Api-Key`, location Header.
   - **Definition:** you should see the 4 actions.
5. Click **Create connector**.
6. Go to the **Test** tab → **+ New connection** and paste the Getty API key.
7. Test **SearchGettyCreativeImages** with `phrase = beach`.
   - You should get **200** with 10 `images`.
   - **401:** the key is wrong or not activated yet.
   - **403:** the key works, but the account isn't entitled to that search. Tell the rep.

## Step 2: Add the photo search tool to the agent

1. In Copilot Studio, open **Q-S Creative Asset Search → Tools → + Add a tool**.
2. Search for `Getty Images Stock Search`, choose **Search Getty Images stock photos**, then **Add and configure**.
3. Under **Inputs**, open **Page**. Set **Fill using** to **Dynamically fill with AI**, click **Customize**, and paste this description:

   ```text
   Page number for Getty Images stock photo search. Use 1 for a new search or whenever the phrase or filters change. For "more", "show more", "next page", or "another set", use the last successfully returned Getty stock photo page plus 1 with the same phrase and filters. For "previous page", subtract 1, never below 1. Track this separately from DAM pages and Getty video pages. For a request like "100 new images", fetch successive pages of 10. If no prior page is known, use 1 without asking. Never request a page beyond result_count divided by 10 (rounded up); Getty rejects it with InvalidPage.
   ```

   Leave **Should prompt user** unchecked.
4. Leave Orientation, Number of people and Sort order as **Dynamically fill with AI**. Their descriptions already tell the agent to set them only when you ask.
5. Under **Completion → After running**, choose **Send an adaptive card**. Change **Format** to **Formula**, then replace everything with the contents of `getty-image-card.powerfx`.
6. Set **Credentials to use** to **Maker-provided credentials**, so users don't each need a Getty key. Click **Save**.

## Step 3: Add the video search tool

Repeat Step 2 with **Search Getty Images stock video**, with two changes:
- In the Page description, replace "stock photo" with "stock video".
- Use `getty-video-card.powerfx` for the card.

## Step 4: Add the two ID lookup tools

1. Add **Get Getty Images stock photos by ID** and **Get Getty Images stock videos by ID**.
2. Set **Asset IDs** to **Dynamically fill with AI**.
3. For the card, use `getty-image-card.powerfx` for photos and `getty-video-card.powerfx` for videos. The total-count line falls back to the number found, so the same cards work here.
4. Set credentials to **Maker-provided** and **Save**.

## Step 5: Instructions (one small addition)

Your current instructions already describe Getty Images stock search, so you don't need to rewrite them. Paste the paragraph below **at the end** of Overview → Instructions. It's about 510 characters, which keeps you under the limit.

```text
Asset IDs
A long numeric ID (for example 2220937042) is a Getty Images stock asset ID. Look it up with the Getty photo ID tool; if it returns not found or an ImageNotFound error, use the Getty video ID tool. A short alphanumeric ID is a Q-S DAM asset; search the DAM for it. Never call an ID "not found" until the matching lookup completed. Getty purchase history is not available: for requests like "images no one buys", explain that and offer less common imagery using newest sort and later pages instead.
```

## Step 6: Settings check

Go to **Settings → Generative AI**:
- **Orchestration:** Generative (on).
- **Use information from the Web:** **off**, so the agent searches only your approved sources.

Go to **Tools**:
- Every Shutterstock tool should be **off**.
- **Topics → Creative Asset Search UI** should be **off**.

## Step 7: Test in the Test pane (new conversation each time)

| Type this | Expected |
|---|---|
| `Find stock photos of a private jet flying in a clear blue sky, side view, room for copy` | 10 Getty photos, plus 10 DAM results if All Sources |
| `more please` | Getty page 2: same search, new images |
| `only show things we already have` | DAM search only |
| `show me video instead` | 10 Getty videos (thumbnail stills) |
| `find 2220937042` | Getty video ID lookup returns that clip |
| `find me 25 images no one ever buys` | Explains no purchase data, then offers less common imagery |

Then **Publish** and repeat a couple of these in Teams.

---

## Plan A (worth trying first once you have the key): Getty's MCP server

Getty runs an official MCP server at `https://mcp.gettyimages.com/v1`, and Copilot Studio can add MCP servers as tools: **Tools → + Add a tool → New tool → Model Context Protocol**. If it connects, you'd skip Steps 1–4. Getty adds new tools to it over time.

Caveats:
- Getty's MCP uses OAuth 2.0 **client credentials** (API key + secret). Copilot Studio's MCP wizard may not support that type of login.
- If the wizard won't accept it, or the results don't show as cards, use Plan B (Steps 1–7).

## Notes and known limits
- **Previews are watermarked comps.** Nothing here licenses or downloads assets.
- **API key only.** Search uses the API key alone. Getty says some account-specific results and downloads need an additional access token (key + secret). If the rep says your account needs that for search, tell me and I'll add the token step to the connector.
- **Unverified response details.** I haven't run these against a live key. Two details are based on Getty's documentation and are unconfirmed:
  - The preview size names `preview` and `thumb` come from Getty's docs. The connector asks for them explicitly through a hidden `fields` setting.
  - The `gettyimages.com/detail/<id>` link format.
  If a card shows "Preview unavailable" or a link breaks, send me the raw output from the test run and I'll adjust.
