# Daily Dividend

Markets within minutes.

## Daily Market Wrap-Up (Notion)

This site automatically syncs daily market wrap-up content from a Notion page and displays it on GitHub Pages.

### Setup

1. **Create Notion Integration:**
   - Go to https://www.notion.so/my-integrations
   - Click "New integration"
   - Name it (e.g., "Daily Dividend Sync")
   - Copy the "Internal Integration Token"

2. **Get Notion Page ID:**
   - Open your Notion page titled "Daily Market Wrap-Up"
   - Click "Share" → "Copy link"
   - The page ID is the long alphanumeric string in the URL (between the workspace name and the `?`)
   - Example: `https://www.notion.so/workspace/Daily-Market-Wrap-Up-abc123def456...`
   - The ID is `abc123def456...` (32 characters, may include hyphens)

3. **Share Page with Integration:**
   - On your Notion page, click the "..." menu → "Add connections"
   - Select your integration

4. **Configure GitHub Secrets:**
   - Go to your repository Settings → Secrets and variables → Actions
   - Add `NOTION_TOKEN` with your integration token
   - Add `NOTION_PAGE_ID` with your page ID

### Notion Page Format

Your Notion page should follow this structure:

- **Page Title:** "Daily Market Wrap-Up"
- **Entry Format:** Each daily entry starts with a **Heading 2** block:
  ```
  2025-01-15 — Market Rally Continues
  ```
- **Entry Content:** All blocks following the H2 (until the next H2) belong to that entry
- **Supported Block Types:**
  - Paragraphs
  - Headings (H1, H2, H3)
  - Bulleted lists
  - Numbered lists
  - Quotes
  - Code blocks
  - Dividers
  - Images
  - Rich text formatting (bold, italic, code, links)

**Important:** New entries should be added at the **top** of the page (newest first).

### How It Works

1. **GitHub Actions Workflow** (`.github/workflows/notion_sync.yml`):
   - Runs automatically every 5 minutes
   - Can be triggered manually via Actions tab → "Sync Notion Daily Market Wrap-Up" → "Run workflow"
   - Fetches content from Notion using the API
   - Parses entries separated by H2 blocks
   - Generates JSON files in `/data/daily/`

2. **Generated Files:**
   - `/data/daily/index.json` - Latest entry + list of all entries
   - `/data/daily/YYYY-MM-DD.json` - Full content for each entry date

3. **Frontend Pages:**
   - `/daily/index.html` - Lists latest entry and past entries
   - `/daily/post.html?date=YYYY-MM-DD` - Displays individual entry

### Manual Sync

To trigger a sync manually:
1. Go to your repository on GitHub
2. Click "Actions" tab
3. Select "Sync Notion Daily Market Wrap-Up" workflow
4. Click "Run workflow" → "Run workflow"

### Local Testing

To test the sync script locally:

```bash
npm install
NOTION_TOKEN=your_token NOTION_PAGE_ID=your_page_id node scripts/notion_sync.mjs
```

This will generate JSON files in `data/daily/` that you can inspect.

