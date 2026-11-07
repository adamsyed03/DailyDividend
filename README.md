# Daily Dividend MVP

Static Daily Dividend frontend with a small Node.js and Express backend.

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Indian Time Machine game

The historical chip-allocation game is available at:

```text
http://localhost:3000/game
```

It uses the project owner's supplied 250-row monthly market-price file and audit workbook. Apple and the supplied USD-quoted gold benchmark are converted into rupees with official Federal Reserve `DEXINUS` month-end observations. Gameplay reads the local SQLite import and never calls a live market API.

Build or refresh the data in this order:

```bash
npm run time-machine:fx
npm run time-machine:import
npm run time-machine:validate
```

`time-machine:fx` downloads the daily FRED series and selects the final valid observation in every month from 2021 through 2024. If automated network access is unavailable, import a validated month-end file with `npm run time-machine:fx-file -- C:\path\to\validated_fx.csv`, then run the database import and validation commands. The file must contain `month`, `inr_per_usd` and `observation_date`; do not use current or annual-average FX as a substitute.

Run the engine tests and JavaScript syntax checks with:

```bash
npm run test:time-machine
npm run time-machine:check
```

The import health screen is at `http://localhost:3000/game/admin`. It reports missing checkpoint months, source row counts, screenshot-audit status and the unverified gold-instrument warning. Scenario dates and editorial context live in `data/indian-time-machine/scenario_config.json`; editing that file changes the periods without changing calculation code, but the validator will block scoring when a required price or FX month is absent.

Important source limits:

- Equity adjusted closes already include corporate actions. The imported dividend and split rows are audit metadata and are not added again.
- World Bank inflation is annual CPI growth context, not a monthly CPI index and not a precise H1/H2 real-return benchmark.
- The exact gold instrument is absent from the supplied screenshots. Keep the prototype warning until the owner confirms the benchmark.
- Screenshot-transcribed prices need a final visual numerical audit and licence review before public redistribution.

## Deployment uptime

Render's Free web services spin down after idle periods and show a Render loading page while the app wakes back up. To prevent that page in production, run the Daily Dividend web service on a paid Render instance type and set the service health check path to:

```text
/healthz
```

The health check endpoint is intentionally lightweight and does not touch Supabase, Twelve Data, or the local JSON database.

## Authentication

Customer accounts use Supabase Auth with email and password. The server stores Supabase access and refresh tokens in HttpOnly, SameSite cookies; application profile data remains in `daily_dividend_state` keyed by the Supabase Auth user ID. Passwords and password hashes are not stored in the application state.

## Stripe membership

Accounts require an active Stripe subscription. The plan is ₹300 INR per month. Stripe-hosted Checkout accepts promotion codes; `barclays123` maps to a 100%-off coupon with a `forever` duration, so a valid redemption does not require a payment method.

1. Put a Stripe test-mode secret key in `.env` as `STRIPE_SECRET_KEY`.
2. Run `npm run stripe:setup`. Add the printed `STRIPE_PRICE_ID` to `.env` and to the production service environment.
3. In Stripe Workbench, add a snapshot webhook destination at `https://dailydividend.info/api/stripe/webhook` for:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy that endpoint's `whsec_...` signing secret to `STRIPE_WEBHOOK_SECRET` locally and in production.
5. Enable and save the Stripe Customer Portal configuration so members can cancel or manage billing.
6. Set `PUBLIC_APP_URL=https://dailydividend.info` in production.

Use test-mode keys and objects first. When ready to charge real customers, repeat the setup with the live-mode secret key and replace all three Stripe environment values with their live-mode counterparts. Never put Stripe secret or webhook keys in HTML or client-side JavaScript.

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
