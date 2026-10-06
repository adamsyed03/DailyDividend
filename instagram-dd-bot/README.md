# Instagram DD Bot

An isolated Node.js + Playwright utility for the Daily Dividend Instagram
account. It uses a visible Google Chrome window on this computer and does not use
the Instagram API, Meta Graph API, or any external automation API.

## Current status

Phases 1–4 are verified: persistent Chrome login, read-only comment scanning,
exact matching, SQLite duplicate tracking, and non-sending Reply/DM composer
checks. Phase 5 live sending is implemented as a single pass and requires an
explicit confirmation in the admin dashboard. Continuous polling remains locked
until that first controlled live workflow succeeds.

The admin panel already stores the intended job:

- One Instagram post or reel URL.
- The exact trigger comment, such as `DD`.
- Four or five rotating public replies, such as "Check your DMs."
- One standardized DM with an optional HTTPS webpage or public PDF link.
- Polling and hourly/daily safety limits.

The live workflow collapses matching comments to unique Instagram accounts for
the linked post. An account already completed on that same post is skipped, but
an interaction recorded for another post never suppresses the new workflow. For
each eligible account it posts one rotating public reply and then sends one
standardized DM. The two actions are recorded independently so a successful
action is never repeated after a partial failure.

## Run from the terminal

From the Daily Dividend repository root:

```powershell
npm install
npm run instagram:login
```

The Playwright dependency is already listed in `package.json`, and the bot uses
your installed Google Chrome. No Python, virtual environment, Instagram API, or
separate browser download is required.

A visible Chrome window opens at Instagram. Log in manually. The bot never reads
or stores your password. When the terminal reports that the session is ready,
press `Ctrl+C` to close Chrome safely.

Run `npm run instagram:login` a second time. If Instagram opens already signed
in, the persistent-session test passed.

Run a read-only scan of the post saved through the admin dashboard with:

```powershell
npm run instagram:dry-run
```

The dry run may expand comment sections and read visible comment rows. It does
not click Reply, open a conversation, post a comment, or send a DM. Its local DOM
inspection report is written to `logs/last-dom-inspection.json`.

Live mode can be launched from the admin dashboard after reviewing the dry-run
log. It prints a prominent warning and performs at most one public reply and one
standardized DM for each new qualifying comment. SQLite status and hourly/daily
limits are checked before anything is posted. Failed or uncertain attempts are
not retried automatically.

## Use through the admin dashboard

Start Daily Dividend locally:

```powershell
npm run dev
```

Open `http://localhost:3000/admin`, sign in with the existing admin password, and
find **Instagram comment replies**. Enter the job settings, select **Save
settings**, then select **Open Instagram login**.

The browser-control endpoints accept only connections from this computer. A
deployed admin dashboard cannot start Chrome on your device.

## Local files and security

- Chrome session: `browser-profile/`
- Saved dashboard job: `data/current-job.json`
- Future SQLite database: `data/`
- Future logs: `logs/`
- Optional local overrides: `config.json`

These runtime files are ignored by Git. Never copy or commit `browser-profile/`;
it contains the authenticated browser session. The bot uses a dedicated Chrome
profile and does not interfere with your everyday Chrome profile.

A PDF must have a public HTTPS URL to be included as a clickable DM link. A local
file path on this computer is not accessible to an Instagram recipient.

## Safety behavior

Press `Ctrl+C`, close Chrome, or use **Stop** in the dashboard to stop safely.
Only run one bot instance at a time.

If the bot recognizes a CAPTCHA, challenge, checkpoint, unusual-activity warning,
restriction, or "Try again later" screen, it stops and logs the condition. It
does not solve or bypass Instagram security mechanisms.

## Planned phases

1. Persistent Chrome session and manual login (complete).
2. Inspect one real post/reel and read comments/usernames using current semantic
   DOM selectors (complete).
3. Exact trigger matching, SQLite duplicate tracking, and dry-run recording
   (complete).
4. Open the commenter's Reply and DM composers without sending (complete).
5. Rotating public replies, one standardized DM, and explicit live sending
   (implemented; controlled live sending verified).
6. Conservative polling, limits, file logging, and resilience.
