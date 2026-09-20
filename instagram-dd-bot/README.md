# Instagram DD Bot

An isolated Node.js + Playwright utility for the Daily Dividend Instagram
account. It uses a visible Google Chrome window on this computer and does not use
the Instagram API, Meta Graph API, or any external automation API.

## Current status

Phase 1 is implemented: persistent Chrome startup and manual Instagram login.
There is currently **no comment scanning, public replying, or DM sending**. Those
controls remain locked until the saved login is tested and Instagram's current
comment DOM is inspected.

The admin panel already stores the intended job:

- One Instagram post or reel URL.
- The exact trigger comment, such as `DD`.
- Four or five rotating public replies, such as "Check your DMs."
- One standardized DM with an optional HTTPS webpage or public PDF link.
- Polling and hourly/daily safety limits.

The eventual workflow for each new qualifying comment is one rotating public
reply followed by one standardized DM. Duplicate tracking will record the two
actions independently so a successful action is never repeated after a partial
failure.

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

1. Persistent Chrome session and manual login (current phase).
2. Inspect one real post/reel and read comments/usernames using current semantic
   DOM selectors.
3. Exact trigger matching, SQLite duplicate tracking, and dry-run recording.
4. Open the commenter's profile/conversation without sending.
5. Rotating public replies, one standardized DM, and explicit live sending.
6. Conservative polling, limits, file logging, and resilience.
