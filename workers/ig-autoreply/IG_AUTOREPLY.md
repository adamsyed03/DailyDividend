# DD Instagram comment auto-reply (IG_AUTOREPLY.md)

Replies to Instagram comments on @dailydividend.official using only Meta's official
Instagram API. It runs free on Cloudflare Workers + D1.

## What it does
- Meta sends every new comment to `/webhook` (signature-checked with the app secret).
- Comments that match a keyword rule are queued with a random 45–240 s delay.
- A 1-minute cron sends a DM (Private Reply) and, for ~60% of comments, a short public
  reply. Wording is varied from a few templates.
- Limits: up to 700 DMs per hour (Meta allows 750), so a 5,000-comment spike clears in a little over 7 hours. The admin panel can set a lower hourly cap. Public replies are off unless switched on in the admin panel, and then capped at 40 per hour. Comments older than 6.5 days are skipped, because Meta refuses private replies after 7 days. One DM per person per post, max 3 per
  person per day. A rate-limit error from Meta pauses everything for 30 minutes.
- Never replies to DD's own comments. Duplicate webhooks are ignored.
- `DRY_RUN=true` logs what it would send without sending anything.

## Admin panel (Supabase)
Keywords, links, DM wording, which posts a rule applies to, pause, test mode and the
hourly cap all live in two Supabase tables, so the DD admin panel edits them directly.
The worker picks up changes within 60 seconds.
- `ig_autoreply_rules`: one row per reel/campaign. Templates can use `{username}` and `{link}`.
- `ig_autoreply_settings`: a single row with `paused`, `dry_run`, `max_dms_per_hour`, `public_replies_enabled`.
- Run `supabase/migrations/20261120000001_ig_autoreply.sql` (repo root) once in the Supabase SQL editor.
- Only accounts listed in `dd_admins` can open the "Instagram auto-reply" section of `/admin`. They sign in
  there with their own DD account, and Supabase row-level security enforces the check.
- Worker settings: `SUPABASE_URL` (text) and `SUPABASE_SERVICE_KEY` (secret).
- `DRY_RUN=true` or `PAUSED=true` on the worker overrides the admin panel, as a safety switch.

## Files
- `worker.js` (this folder): the whole worker. `CONFIG.rules` at the top is only a fallback for when Supabase isn't connected.
- `supabase/migrations/20261120000001_ig_autoreply.sql` (repo root): tables for the admin panel, the `dd_admins`
  list and its row-level security, plus the Anthropic IPO starter rule.
- The D1 schema (`schema.sql` in the original handoff) and `wrangler.toml` are not kept in this repo. The D1
  database and the worker deployment are managed in the Cloudflare dashboard. Don't confuse the D1 schema with
  `supabase/schema.sql`, which is unrelated.

## Cloudflare setup (dashboard)
1. Workers & Pages → D1 → Create database `dd-autoreply` → Console → paste the D1 schema (kept outside this repo) → Execute.
2. Workers & Pages → Create → Worker `dd-autoreply` → Edit code → paste `worker.js` → Deploy.
3. Worker → Settings → Bindings → add D1 database, variable name `DB`, database `dd-autoreply`.
4. Worker → Settings → Variables and secrets:
   - Secrets: `APP_SECRET`, `IG_ACCESS_TOKEN`, `VERIFY_TOKEN`, `ADMIN_KEY`
   - Secret: `SUPABASE_SERVICE_KEY`. Text vars: `SUPABASE_URL`, `DRY_RUN` = `false`, `PAUSED` = `false` (test mode is controlled from the admin panel and starts on)
5. Worker → Settings → Trigger events → Cron → `* * * * *`.

## Meta setup
1. developers.facebook.com → Create app → Business type / "Manage messaging & content on Instagram".
2. Instagram → API setup with Instagram login:
   - Generate a token for @dailydividend.official → paste into `IG_ACCESS_TOKEN`.
   - Copy the Instagram app secret → paste into `APP_SECRET`.
   - Webhooks: callback `https://dd-autoreply.<your-subdomain>.workers.dev/webhook`,
     verify token = your `VERIFY_TOKEN`; subscribe to `comments`.
   - Turn on the webhook subscription for the account (or `POST /admin/subscribe`).
3. In the Instagram app: Settings → Messages and story replies → Message controls →
   Connected tools → **Allow access to messages** must be on.
4. The app must be switched to Live mode for real followers' comments to arrive.
   That needs a privacy policy URL.

## Admin endpoints
Send the `x-admin-key: <ADMIN_KEY>` header. The header is the only accepted way: a `?key=` in the URL is
refused, because URLs end up in logs.
- `GET /admin/status`: queue counts, last 25 comments, token health
- `GET /admin/media`: latest posts with IDs, to restrict a rule to one reel via `mediaIds`
- `POST /admin/run`: process the queue right now
- `POST /admin/subscribe`: subscribe the account to comment webhooks

There is no pause or resume endpoint. Pause from the DD admin panel (or set `PAUSED=true` on the worker).
