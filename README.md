# Daily Dividend MVP

Static Daily Dividend frontend with a small Node.js and Express backend.

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Authentication

Customer accounts use Supabase Auth with email and password. The server stores Supabase access and refresh tokens in HttpOnly, SameSite cookies; application profile data remains in `daily_dividend_state` keyed by the Supabase Auth user ID. Passwords and password hashes are not stored in the application state.

## Company logos

Logo slots use `/api/logo/:companyId` and automatically fall back to the company's initial. Curated logos are read from the public Supabase Storage bucket configured by `SUPABASE_LOGO_BUCKET` (default: `company-logos`). Set up the bucket and upload the included DD, Netflix, and Visa assets with:

```bash
npm run supabase:logos
```

Upload future files as `<company-id>.png`, for example `disney.png`, `reliance.png`, and `hdfc.png`. Use that same ID in the company's frontend data. Supabase-hosted logos do not require a server allowlist entry.

Logo.dev remains an optional final fallback. To enable it, add a publishable token:

```text
LOGO_DEV_TOKEN=your_publishable_token
```

The server resolves the company's configured domain, downloads the logo once, and caches it under `public/assets/logos/`. Add each new company's stable ID and domain to `COMPANY_LOGO_DOMAINS` in `server.js`; no manual image upload is required.

Emoji use native Unicode and the operating system's emoji font. They are not stored in the database.

## Data

Persistent app state is stored in:

```text
data/daily-dividend-db.json
```

The browser stores an anonymous `dailyDividendUserId` in `localStorage`.

## End-of-day stock prices

Create or update `.env` in the project root with your free Twelve Data API key:

```text
TWELVE_DATA_API_KEY=your_api_key_here
```

The key is read only by `server.js` and is never sent to the frontend. This project already includes a small `.env` loader, so no additional `dotenv` package is required.

Cached EOD prices for NFLX, DIS, SPOT, and HDB are stored under `prices` in `data/daily-dividend-db.json`. To refresh them, log in at `http://localhost:3000/admin` and click **Refresh stock prices**. You can also send an authenticated `POST /api/admin/refresh-prices` request using the admin bearer token.

Test the public cached-price API in a browser or terminal:

```bash
curl http://localhost:3000/api/prices
curl http://localhost:3000/api/prices/NFLX
```

If Twelve Data fails for a ticker, its previous cached value remains unchanged and the refresh response identifies the failure.

## API

- `POST /api/session` creates an anonymous user and returns `{ userId }`.
- `GET /api/user/:userId` returns streak, saved companies, previous votes, and read history.
- `POST /api/read` with `{ userId, companyId }` updates the reading streak.
- `POST /api/save` with `{ userId, companyId }` toggles a saved item.
- `POST /api/vote` with `{ userId, companyId, vote }` stores one vote per user per company.
- `GET /api/votes/:companyId` returns aggregate bull, neutral, and bear percentages.
- `GET /api/prices` returns cached EOD prices for NFLX, DIS, SPOT, and HDB.
- `GET /api/prices/:ticker` returns one cached EOD price.
- `POST /api/admin/refresh-prices` refreshes the cache from Twelve Data (admin authentication required).
- `GET /api/logo/:companyId` returns a cached company logo when the logo provider is configured.
