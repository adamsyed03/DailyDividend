# Retired

This local Chrome bot is retired. Instagram comment replies now run through the Meta API auto-reply
in `workers/ig-autoreply` (see `workers/ig-autoreply/IG_AUTOREPLY.md`), controlled from the
"Instagram auto-reply" section of `/admin`.

The code is kept for reference only. It can no longer be started:
- its panel was removed from `/admin`;
- the `instagram:*` npm scripts were removed from `package.json`;
- `bot.js` exits straight away when run;
- `control.js` refuses to start it, and the server's `/api/admin/instagram-bot/start` and `/job` routes return 410.

Don't run it alongside the new auto-reply: both would answer the same comments.
