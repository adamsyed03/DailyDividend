/**
 * Daily Dividend — Instagram comment auto-reply
 * ------------------------------------------------
 * Uses only Meta's official Instagram API (Instagram Login, graph.instagram.com).
 * Runs on Cloudflare Workers (free plan) with a D1 database and a 1-minute cron.
 *
 * How it works
 *   1. Meta sends a webhook to POST /webhook every time someone comments.
 *   2. If the comment matches a rule, it is queued in D1 with a random delay.
 *      Nothing is sent from the webhook itself.
 *   3. Every minute the cron sends a small batch from the queue, spaced out,
 *      within per-minute / per-hour / per-day caps. Each person gets at most
 *      one DM per post and a limited number per day.
 *   4. If Meta returns a rate-limit error, everything pauses for a while.
 *
 * Env / bindings (set in the Cloudflare dashboard)
 *   DB               D1 database binding
 *   APP_SECRET       secret  – Instagram app secret (Meta app > Instagram > API setup)
 *   IG_ACCESS_TOKEN  secret  – long-lived Instagram user access token
 *   VERIFY_TOKEN     secret  – any random string; also pasted into Meta's webhook form
 *   ADMIN_KEY        secret  – any random string; protects the /admin endpoints
 *   SUPABASE_URL     var     – e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY secret – service role key (reads rules/settings)
 *   DRY_RUN          var     – "true" forces test mode, whatever the admin panel says
 *   PAUSED           var     – "true" forces pause, whatever the admin panel says
 *
 * Keywords, links, message wording, pause and test mode are edited in the
 * DD admin panel (Supabase tables ig_autoreply_rules / ig_autoreply_settings).
 * The rules below in CONFIG are only a fallback if Supabase isn't set up.
 */

// =====================================================================
// CONFIG — edit rules and pacing here
// =====================================================================
const CONFIG = {
  graphVersion: "v24.0",

  // ---- Pacing ----
  // Meta's hard limit is 750 private replies (DMs to commenters) per hour.
  // At 700/hour a 5,000-comment spike clears in a little over 7 hours,
  // well inside Meta's 7-day window for private replies. The gap to 750
  // leaves room for DMs the team sends by hand.
  minDelaySeconds: 45,        // shortest wait after a comment before replying
  maxDelaySeconds: 240,       // longest wait
  maxPerMinute: 12,           // DMs per minute, across everything
  maxPerHour: 700,            // hard ceiling (Meta's limit: 750). The admin panel can set lower.
  maxPerDay: 12000,
  gapBetweenSendsMs: [2000, 5000], // random pause between two sends in a batch
  rateLimitPauseMinutes: 30,  // pause everything if Meta says we're going too fast
  expireAfterHours: 156,      // give up after 6.5 days (Meta refuses after 7)

  // Public replies under comments are the most visible, spam-looking part.
  // They are OFF unless switched on in the admin panel, and even then capped.
  maxPublicRepliesPerHour: 40,
  configCacheSeconds: 60,     // how often admin-panel changes are picked up

  // ---- Per-person limits ----
  oncePerUserPerPost: true,   // never DM the same person twice for the same post
  maxPerUserPerDay: 3,        // across all posts

  // ---- What to react to ----
  ignoreRepliesToComments: false, // true = only react to top-level comments
  ignoreUsernames: [],            // e.g. team accounts you don't want auto-replied

  // ---- Rules ----
  // First matching rule wins. Keywords match whole words, case-insensitive.
  // mediaIds: [] means any post/reel. Use /admin/media to find a reel's ID.
  // dm / publicReply: several variants; one is picked at random each time.
  //   {username} is replaced with the commenter's handle.
  // publicReplyChance: 0–1, share of matched comments that also get a public reply.
  rules: [
    {
      name: "Anthropic IPO",
      keywords: ["anthropic", "claude"],
      mediaIds: [],
      link: "https://www.dailydividend.info/rabbit-holes/anthropic-ipo-decoded",
      dm: [
        "Thank you for your comment. Here's the full breakdown of the Anthropic (Claude) IPO: {link} Hope you find it useful and let us know if you have any thoughts :)",
        "Hey {username}, thanks for commenting! Here's our full breakdown of the Anthropic (Claude) IPO: {link} Let us know what you think :)",
        "Thanks for the comment! As promised, here's the Anthropic (Claude) IPO breakdown: {link} Hope it's useful :)",
      ],
      publicReply: [],
      publicReplyChance: 0,
    },
    // Example of a second rule — copy this block for each new reel.
    // {
    //   name: "Jio IPO",
    //   keywords: ["jio"],
    //   mediaIds: [],
    //   dm: [
    //     "Here you go.. Jio IPO breakdown and details: <link> Hope it's useful :)",
    //   ],
    //   publicReply: ["Sent to your DMs @{username} 📩"],
    //   publicReplyChance: 0.6,
    // },
  ],
};

// =====================================================================
// Entry points
// =====================================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/webhook" && request.method === "GET") return verifyWebhook(url, env);
      if (url.pathname === "/webhook" && request.method === "POST") return await receiveWebhook(request, env);
      if (url.pathname.startsWith("/admin/")) return await admin(request, url, env);
      if (url.pathname === "/") return text("DD auto-reply is running.");
      return text("Not found", 404);
    } catch (err) {
      console.error("fetch error", err && err.stack ? err.stack : err);
      return text("Internal error", 500);
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runCron(env));
  },
};

// =====================================================================
// Webhook
// =====================================================================
function verifyWebhook(url, env) {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && env.VERIFY_TOKEN && token === env.VERIFY_TOKEN && challenge) {
    return text(challenge);
  }
  return text("Forbidden", 403);
}

async function receiveWebhook(request, env) {
  const raw = await request.text();
  const sig = request.headers.get("x-hub-signature-256") || "";
  if (!(await validSignature(raw, sig, env.APP_SECRET))) {
    console.warn("Rejected webhook with bad signature");
    return text("Bad signature", 401);
  }

  let body;
  try { body = JSON.parse(raw); } catch { return text("ok"); }
  if (body.object !== "instagram" || !Array.isArray(body.entry)) return text("ok");

  for (const entry of body.entry) {
    const accountId = String(entry.id || "");
    for (const change of entry.changes || []) {
      if (change.field !== "comments" || !change.value) continue;
      await handleComment(env, accountId, change.value);
    }
  }
  // Always 200 quickly so Meta doesn't retry.
  return text("ok");
}

async function handleComment(env, accountId, v) {
  const commentId = v.id && String(v.id);
  const fromId = v.from && v.from.id && String(v.from.id);
  const username = (v.from && v.from.username) || "";
  const mediaId = (v.media && v.media.id && String(v.media.id)) || "";
  const commentText = v.text || "";
  if (!commentId || !fromId) return;

  // Never reply to ourselves (our own public replies also trigger webhooks).
  if (fromId === accountId) return;
  if (CONFIG.ignoreUsernames.map(lower).includes(lower(username))) return;
  if (CONFIG.ignoreRepliesToComments && v.parent_id) return;

  const { rules } = await loadConfig(env);
  const rule = matchRule(rules, commentText, mediaId);
  if (!rule) return; // non-matching comments are not stored

  const now = Date.now();
  let status = "pending";
  let note = null;

  if (CONFIG.oncePerUserPerPost) {
    const dup = await env.DB.prepare(
      "SELECT 1 FROM jobs WHERE user_id = ? AND media_id = ? AND status IN ('pending','sending','sent','dry_run') LIMIT 1"
    ).bind(fromId, mediaId).first();
    if (dup) { status = "skipped"; note = "already handled this person on this post"; }
  }

  const delay = randInt(CONFIG.minDelaySeconds, CONFIG.maxDelaySeconds) * 1000;
  // INSERT OR IGNORE: Meta can deliver the same webhook more than once.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO jobs
       (comment_id, account_id, media_id, user_id, username, text, rule, status, send_after, attempts, dm_sent, reply_sent, last_error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`
  ).bind(commentId, accountId, mediaId, fromId, username, commentText.slice(0, 500), rule.id, status, now + delay, note, now).run();
}

function matchRule(rules, commentText, mediaId) {
  const t = lower(commentText);
  for (const rule of rules) {
    if (rule.mediaIds && rule.mediaIds.length && !rule.mediaIds.map(String).includes(mediaId)) continue;
    for (const kw of rule.keywords || []) {
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(lower(kw))}($|[^\\p{L}\\p{N}])`, "u");
      if (re.test(t)) return rule;
    }
  }
  return null;
}

async function validSignature(raw, header, secret) {
  if (!secret || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", enc(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc(raw)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice(7).toLowerCase();
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

// =====================================================================
// Cron: send queued replies, slowly
// =====================================================================
async function runCron(env) {
  useEnv(env);
  await maybeRefreshToken(env);
  await maybeCleanup(env);
  return processQueue(env);
}

async function processQueue(env) {
  const now = Date.now();

  // Recover anything a crashed run left half-done (dm_sent/reply_sent flags
  // make the retry safe).
  await env.DB.prepare(
    "UPDATE jobs SET status = 'pending' WHERE status = 'sending' AND claimed_at < ?"
  ).bind(now - 10 * 60000).run();

  // Cheap check first: anything due?
  const due = await env.DB.prepare(
    "SELECT 1 AS n FROM jobs WHERE status = 'pending' AND send_after <= ? LIMIT 1"
  ).bind(now).first();
  if (!due) return { sent: 0, reason: "nothing due" };

  const { rules, settings } = await loadConfig(env);
  if (env.PAUSED === "true" || settings.paused) return { sent: 0, reason: "paused" };
  const backoff = Number(await kvGet(env, "backoff_until")) || 0;
  if (backoff > now) return { sent: 0, reason: "backing off until " + new Date(backoff).toISOString() };

  const budget = await remainingBudget(env, now, settings);
  if (budget <= 0) return { sent: 0, reason: "cap reached" };

  // Claim the batch atomically so two overlapping cron runs can never pick
  // up the same comment (prevents double DMs).
  const { results: jobs } = await env.DB.prepare(
    `UPDATE jobs SET status = 'sending', claimed_at = ?
       WHERE comment_id IN (
         SELECT comment_id FROM jobs WHERE status = 'pending' AND send_after <= ? ORDER BY send_after LIMIT ?
       )
     RETURNING *`
  ).bind(now, now, budget).all();

  const dryRun = env.DRY_RUN === "true" || settings.dryRun;
  const token = dryRun ? null : await getToken(env);
  let sent = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const rule = rules.find((r) => r.id === job.rule);
    if (!rule) { await finish(env, job, "skipped", "rule no longer exists"); continue; }

    if (now - job.created_at > CONFIG.expireAfterHours * 3600000) {
      await finish(env, job, "skipped", "too old: Meta only allows private replies within 7 days");
      continue;
    }

    const todayForUser = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM jobs WHERE user_id = ? AND status IN ('sent','dry_run') AND processed_at > ?"
    ).bind(job.user_id, now - 86400000).first();
    if (todayForUser && todayForUser.n >= CONFIG.maxPerUserPerDay) {
      await finish(env, job, "skipped", "daily limit for this person");
      continue;
    }

    const dmText = fill(pick(rule.dm), job.username, rule.link);
    const wantPublic = settings.publicRepliesEnabled && job.username && rule.publicReply && rule.publicReply.length &&
      Math.random() < (rule.publicReplyChance ?? 1) &&
      (await counterGet(env, "pub:h", now)) < CONFIG.maxPublicRepliesPerHour;
    const replyText = wantPublic ? fill(pick(rule.publicReply), job.username, rule.link) : null;

    if (dryRun) {
      await finish(env, job, "dry_run", `DM: ${dmText}${replyText ? ` | Public: ${replyText}` : ""}`);
      await countSend(env, now);
      if (replyText) await counterAdd(env, "pub:h", now);
      sent++;
      continue;
    }

    try {
      if (!job.dm_sent) {
        await graph(`/${job.account_id}/messages`, token, {
          recipient: { comment_id: job.comment_id },
          message: { text: dmText },
        });
        await env.DB.prepare("UPDATE jobs SET dm_sent = 1 WHERE comment_id = ?").bind(job.comment_id).run();
        await countSend(env, now);
      }
      if (replyText && !job.reply_sent) {
        await sleep(randInt(1500, 4000));
        await graph(`/${job.comment_id}/replies`, token, { message: replyText });
        await env.DB.prepare("UPDATE jobs SET reply_sent = 1 WHERE comment_id = ?").bind(job.comment_id).run();
        await counterAdd(env, "pub:h", now);
      }
      await finish(env, job, "sent", null);
      sent++;
    } catch (err) {
      const e = err instanceof GraphError ? err : new GraphError(String(err), 0, 0);
      console.error("send failed", job.comment_id, e.code, e.subcode, e.message);
      if (e.isRateLimit) {
        await kvSet(env, "backoff_until", String(Date.now() + CONFIG.rateLimitPauseMinutes * 60000));
        await retryLater(env, job, e.message, CONFIG.rateLimitPauseMinutes * 60000, false);
        await releaseRest(env, jobs.slice(i + 1));
        break; // stop the whole batch
      }
      if (e.isAuth) {
        await kvSet(env, "token_error", `${new Date().toISOString()} ${e.message}`);
        await kvSet(env, "backoff_until", String(Date.now() + 60 * 60000));
        await retryLater(env, job, e.message, 60 * 60000, false);
        await releaseRest(env, jobs.slice(i + 1));
        break;
      }
      await retryLater(env, job, e.message, 5 * 60000, true);
    }

    if (i < jobs.length - 1) await sleep(randInt(...CONFIG.gapBetweenSendsMs));
  }
  return { sent };
}

// Send counters live in small fixed-window buckets (this minute / hour / day),
// so checking the caps costs 3 row reads instead of scanning the whole log.
// That keeps a 5,000-comment spike inside D1's free daily read allowance.
const BUCKETS = { m: 60000, h: 3600000, d: 86400000, "pub:h": 3600000 };
const bucketKey = (name, now) => `${name}:${Math.floor(now / BUCKETS[name])}`;

async function counterGet(env, name, now) {
  const row = await env.DB.prepare("SELECT n FROM counters WHERE k = ?").bind(bucketKey(name, now)).first();
  return row ? row.n : 0;
}
async function counterAdd(env, name, now) {
  await env.DB.prepare(
    "INSERT INTO counters (k, n, expires) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1"
  ).bind(bucketKey(name, now), now + 2 * BUCKETS[name]).run();
}
async function countSend(env, now) {
  await Promise.all(["m", "h", "d"].map((b) => counterAdd(env, b, now)));
}

async function remainingBudget(env, now, settings) {
  const [m, h, d] = await Promise.all(["m", "h", "d"].map((b) => counterGet(env, b, now)));
  // Jobs another overlapping run is sending right now also use up budget.
  const inFlight = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM jobs WHERE status = 'sending'"
  ).first();
  const perHour = Math.min(CONFIG.maxPerHour, settings.maxPerHour || CONFIG.maxPerHour);
  const perMinute = Math.min(CONFIG.maxPerMinute, Math.ceil(perHour / 60));
  return Math.min(perMinute - m, perHour - h, CONFIG.maxPerDay - d) - (inFlight ? inFlight.n : 0);
}

async function releaseRest(env, rest) {
  for (const j of rest) {
    await env.DB.prepare("UPDATE jobs SET status = 'pending' WHERE comment_id = ? AND status = 'sending'").bind(j.comment_id).run();
  }
}

async function finish(env, job, status, note) {
  await env.DB.prepare(
    "UPDATE jobs SET status = ?, last_error = ?, processed_at = ? WHERE comment_id = ?"
  ).bind(status, note, Date.now(), job.comment_id).run();
}

async function retryLater(env, job, msg, waitMs, countAttempt) {
  const attempts = job.attempts + (countAttempt ? 1 : 0);
  if (attempts >= 3) return finish(env, job, "failed", msg);
  await env.DB.prepare(
    "UPDATE jobs SET status = 'pending', attempts = ?, last_error = ?, send_after = ? WHERE comment_id = ?"
  ).bind(attempts, msg, Date.now() + waitMs, job.comment_id).run();
}

// =====================================================================
// Rules + settings from Supabase (edited in the DD admin panel)
// =====================================================================
let cachedConfig = null;
let cachedAt = 0;

const DEFAULT_SETTINGS = { paused: false, dryRun: true, maxPerHour: CONFIG.maxPerHour, publicRepliesEnabled: false };

function localConfig() {
  return {
    source: "worker.js fallback",
    settings: { ...DEFAULT_SETTINGS },
    rules: CONFIG.rules.map((r, i) => normalizeRule({ ...r, id: `local:${r.name}`, priority: i })),
  };
}

function normalizeRule(r) {
  return {
    id: String(r.id),
    name: r.name,
    priority: r.priority ?? 100,
    keywords: (r.keywords || []).map((k) => String(k).trim()).filter(Boolean),
    mediaIds: (r.mediaIds || r.media_ids || []).map(String).filter(Boolean),
    link: r.link || r.link_url || "",
    dm: (r.dm || r.dm_templates || []).filter((t) => t && t.trim()),
    publicReply: (r.publicReply || r.public_reply_templates || []).filter((t) => t && t.trim()),
    publicReplyChance: Number(r.publicReplyChance ?? r.public_reply_chance ?? 0),
  };
}

async function loadConfig(env) {
  if (cachedConfig && Date.now() - cachedAt < CONFIG.configCacheSeconds * 1000) return cachedConfig;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    cachedConfig = localConfig(); cachedAt = Date.now();
    return cachedConfig;
  }
  try {
    const headers = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
    const base = env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";
    const [rRes, sRes] = await Promise.all([
      fetch(`${base}/ig_autoreply_rules?select=*&enabled=eq.true&order=priority.asc,created_at.asc`, { headers }),
      fetch(`${base}/ig_autoreply_settings?select=*&id=eq.1`, { headers }),
    ]);
    if (!rRes.ok || !sRes.ok) throw new Error(`Supabase ${rRes.status}/${sRes.status}`);
    const rows = await rRes.json();
    const [s] = await sRes.json();
    const config = {
      source: "supabase",
      settings: s ? {
        paused: !!s.paused,
        dryRun: !!s.dry_run,
        maxPerHour: Number(s.max_dms_per_hour) || CONFIG.maxPerHour,
        publicRepliesEnabled: !!s.public_replies_enabled,
      } : { ...DEFAULT_SETTINGS },
      // A rule with no keywords or no DM text can't do anything useful; skip it.
      rules: rows.map(normalizeRule).filter((r) => r.keywords.length && r.dm.length),
    };
    cachedConfig = config; cachedAt = Date.now();
    await kvSet(env, "last_good_config", JSON.stringify(config));
    return config;
  } catch (err) {
    console.error("loadConfig failed, using last good copy", err);
    const saved = await kvGet(env, "last_good_config");
    // If Supabase is down, keep running on the last rules we saw, but never
    // fall back to "live" if we have nothing: test mode is the safe default.
    cachedConfig = saved ? { ...JSON.parse(saved), source: "last good copy (Supabase unreachable)" } : localConfig();
    cachedAt = Date.now();
    return cachedConfig;
  }
}

// =====================================================================
// Meta Graph API
// =====================================================================
// Overridable only for local testing (env.GRAPH_HOST); production uses Meta's host.
let GRAPH_HOST = "https://graph.instagram.com";
const useEnv = (env) => { if (env && env.GRAPH_HOST) GRAPH_HOST = env.GRAPH_HOST; };

class GraphError extends Error {
  constructor(message, code, subcode) {
    super(message);
    this.code = code;
    this.subcode = subcode;
  }
  get isRateLimit() { return [4, 17, 32, 613].includes(this.code) || this.subcode === 2446079; }
  get isAuth() { return this.code === 190 || this.code === 102; }
}

async function graph(path, token, payload, method = "POST") {
  const url = `${GRAPH_HOST}/${CONFIG.graphVersion}${path}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: method === "GET" ? undefined : JSON.stringify(payload || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const er = data.error || {};
    throw new GraphError(er.message || `HTTP ${res.status}`, er.code || res.status, er.error_subcode || 0);
  }
  return data;
}

async function graphGet(pathWithQuery, token) {
  const url = `${GRAPH_HOST}/${CONFIG.graphVersion}${pathWithQuery}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const er = data.error || {};
    throw new GraphError(er.message || `HTTP ${res.status}`, er.code || res.status, er.error_subcode || 0);
  }
  return data;
}

// Long-lived Instagram tokens last ~60 days. We refresh weekly and keep the
// newest one in D1. If you paste a new IG_ACCESS_TOKEN secret, it takes over.
async function getToken(env) {
  const seed = env.IG_ACCESS_TOKEN || "";
  const seedTag = seed.slice(-12);
  const storedTag = await kvGet(env, "token_seed_tag");
  if (storedTag !== seedTag) {
    await kvSet(env, "access_token", seed);
    await kvSet(env, "token_seed_tag", seedTag);
    await kvSet(env, "token_refreshed_at", String(Date.now()));
    return seed;
  }
  return (await kvGet(env, "access_token")) || seed;
}

async function maybeRefreshToken(env) {
  if (!env.IG_ACCESS_TOKEN) return;
  const token = await getToken(env);
  const last = Number(await kvGet(env, "token_refreshed_at")) || 0;
  if (Date.now() - last < 7 * 86400000) return;
  try {
    const res = await fetch(
      `${GRAPH_HOST}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`
    );
    const data = await res.json();
    if (data.access_token) {
      await kvSet(env, "access_token", data.access_token);
      await kvSet(env, "token_refreshed_at", String(Date.now()));
      await kvSet(env, "token_error", "");
    } else {
      await kvSet(env, "token_error", `${new Date().toISOString()} refresh failed: ${JSON.stringify(data.error || data)}`);
      await kvSet(env, "token_refreshed_at", String(Date.now() - 6 * 86400000)); // try again tomorrow
    }
  } catch (err) {
    console.error("token refresh error", err);
  }
}

async function maybeCleanup(env) {
  const last = Number(await kvGet(env, "last_cleanup")) || 0;
  if (Date.now() - last < 86400000) return;
  await env.DB.prepare(
    "DELETE FROM jobs WHERE status != 'pending' AND created_at < ?"
  ).bind(Date.now() - 30 * 86400000).run();
  await env.DB.prepare("DELETE FROM counters WHERE expires < ?").bind(Date.now()).run();
  await kvSet(env, "last_cleanup", String(Date.now()));
}

// =====================================================================
// Admin endpoints (send header  x-admin-key: <ADMIN_KEY>; the header is the only way, never a ?key= URL)
//   GET  /admin/status     queue counts, recent activity, token health
//   GET  /admin/media      your latest posts/reels with their IDs (for mediaIds)
//   POST /admin/subscribe  subscribe the account to comment webhooks
//   POST /admin/run        process the queue right now
// Pausing is done only from the DD admin panel (ig_autoreply_settings.paused) or the PAUSED var.
// =====================================================================
async function admin(request, url, env) {
  useEnv(env);
  const key = request.headers.get("x-admin-key");
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return text("Forbidden", 403);
  const path = url.pathname.replace("/admin/", "");

  if (path === "status") {
    const { results: counts } = await env.DB.prepare(
      "SELECT status, COUNT(*) AS n FROM jobs GROUP BY status"
    ).all();
    const { results: recent } = await env.DB.prepare(
      "SELECT username, rule, status, text, last_error, datetime(created_at/1000,'unixepoch') AS created, datetime(processed_at/1000,'unixepoch') AS processed FROM jobs ORDER BY created_at DESC LIMIT 25"
    ).all();
    const backlog = await env.DB.prepare("SELECT COUNT(*) AS n FROM jobs WHERE status IN ('pending','sending')").first();
    return json({
      backlog: backlog.n,
      estimatedHoursToClear: Math.round((backlog.n / CONFIG.maxPerHour) * 10) / 10,
      sentThisHour: await counterGet(env, "h", Date.now()),
      publicRepliesThisHour: await counterGet(env, "pub:h", Date.now()),
      config: await (async () => {
        const c = await loadConfig(env);
        return { source: c.source, settings: c.settings, rules: c.rules.map((r) => ({ id: r.id, name: r.name, keywords: r.keywords, posts: r.mediaIds.length || "all" })) };
      })(),
      forcedDryRun: env.DRY_RUN === "true",
      forcedPause: env.PAUSED === "true",
      backoffUntil: Number(await kvGet(env, "backoff_until")) || null,
      tokenRefreshedAt: Number(await kvGet(env, "token_refreshed_at")) || null,
      tokenError: (await kvGet(env, "token_error")) || null,
      counts,
      recent,
    });
  }

  if (path === "media") {
    const token = await getToken(env);
    const data = await graphGet("/me/media?fields=id,caption,media_product_type,permalink,timestamp&limit=20", token);
    return json((data.data || []).map((m) => ({
      id: m.id, type: m.media_product_type, posted: m.timestamp,
      permalink: m.permalink, caption: (m.caption || "").slice(0, 80),
    })));
  }

  if (request.method !== "POST") return text("Use POST", 405);

  if (path === "subscribe") {
    const token = await getToken(env);
    const data = await graph("/me/subscribed_apps?subscribed_fields=comments", token, {});
    return json(data);
  }
  if (path === "run") return json(await processQueue(env));

  return text("Not found", 404);
}

// =====================================================================
// Helpers
// =====================================================================
async function kvGet(env, k) {
  const row = await env.DB.prepare("SELECT v FROM kv WHERE k = ?").bind(k).first();
  return row ? row.v : null;
}
async function kvSet(env, k, v) {
  await env.DB.prepare(
    "INSERT INTO kv (k, v, updated_at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at"
  ).bind(k, v, Date.now()).run();
}
const enc = (s) => new TextEncoder().encode(s);
const lower = (s) => String(s || "").toLowerCase();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fill = (tpl, username, link) =>
  tpl.replaceAll("{username}", username || "there").replaceAll("{link}", link || "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (s, status = 200) => new Response(s, { status, headers: { "content-type": "text/plain" } });
const json = (o, status = 200) => new Response(JSON.stringify(o, null, 2), { status, headers: { "content-type": "application/json" } });
