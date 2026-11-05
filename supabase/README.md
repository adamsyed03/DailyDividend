# Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase/schema.sql`.
3. In this app's `.env`, set:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STATE_ID=default
```

Use the service role key only on the server. Do not expose it in browser code.

## Company logo storage

Create the public `company-logos` bucket and upload the included brand assets with:

```bash
npm run supabase:logos
```

New company logos should be PNG files named with the stable company ID, such as `disney.png`. Use the same ID in the company data; no server allowlist change is needed. The DD brand mark is stored at `brand/dd-logo.png`.

When those values are present, `server.js` stores Daily Dividend state in Supabase. When they are blank, it falls back to `data/daily-dividend-db.json` for local development.

## Google sign-in

In Supabase, open **Authentication → URL Configuration** and set:

- Site URL: `https://dailydividend.info`
- Redirect URL: `https://dailydividend.info/auth/google/callback`
- Redirect URL: `http://localhost:3000/auth/google/callback`

In **Authentication → Providers → Google**, the Client ID and Client Secret must come from the same Google Cloud OAuth 2.0 Web application. In Google Cloud, its authorized redirect URI must be the Supabase callback shown on that provider page, normally `https://<project-ref>.supabase.co/auth/v1/callback`.

If the browser reports `Unable to exchange external code`, inspect **Supabase → Logs → Auth** for the underlying Google token-exchange error and re-save the matching Google Client ID and Client Secret. The four characters shown after that message are only the beginning of Google's temporary authorization code, not the root cause.
