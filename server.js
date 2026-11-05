const crypto = require('crypto');
const fsSync = require('fs');
const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const compression = require('compression');
const { createClient } = require('@supabase/supabase-js');
const { createInstagramBotController } = require('./instagram-dd-bot/control');

loadEnv();

const analytics = {
  capture() {},
  identify() {},
  async shutdown() {}
};

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'daily-dividend-db.json');
const LOGO_CACHE_DIR = path.join(__dirname, 'public', 'assets', 'logos');
const LOGO_DEV_TOKEN = process.env.LOGO_DEV_TOKEN || '';
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || '';
const SUPABASE_LOGO_BUCKET = process.env.SUPABASE_LOGO_BUCKET || 'company-logos';
const PRICE_COMPANIES = Object.freeze({
  NFLX: { ticker: 'NFLX', name: 'Netflix', currency: 'USD', exchange: 'NASDAQ', yearStartPrice: 90.99 },
  NVDA: { ticker: 'NVDA', name: 'NVIDIA', currency: 'USD', exchange: 'NASDAQ', yearStartPrice: 135.00 },
  DIS:  { ticker: 'DIS',  name: 'Disney',  currency: 'USD', exchange: 'NYSE', yearStartPrice: 111.85 },
  META: { ticker: 'META', name: 'Meta',    currency: 'USD', exchange: 'NASDAQ', yearStartPrice: 585.27 },
  SPOT: { ticker: 'SPOT', name: 'Spotify', currency: 'USD', exchange: 'NYSE', yearStartPrice: null },
  KO:   { ticker: 'KO',   name: 'Coca-Cola', currency: 'USD', exchange: 'NYSE', yearStartPrice: 61.50 }
  // RELIANCE:NSE and HDFCBANK:NSE require Twelve Data Grow plan ($79/mo)
});
const BUILT_IN_LIVE_COMPANIES = Object.freeze(['netflix', 'nvidia', 'disney', 'reliance', 'hdfc', 'meta', 'cocacola', 'spotify']);
const LOCAL_LOGO_FILES = Object.freeze({
  netflix: path.join(__dirname, 'Site Pics', 'netflix logo.png'),
  visa: path.join(__dirname, 'Site Pics', 'visalogo.png')
});
const COMPANY_LOGO_DOMAINS = Object.freeze({
  netflix: 'netflix.com', nvidia: 'nvidia.com', disney: 'thewaltdisneycompany.com', reliance: 'ril.com', hdfc: 'hdfcbank.com',
  meta: 'meta.com', cocacola: 'coca-cola.com',
  spotify: 'spotify.com', visa: 'visa.com', zomato: 'zomato.com',
  ferrari: 'ferrari.com', hermes: 'hermes.com', google: 'google.com', amazon: 'amazon.com',
  costco: 'costco.com', tcs: 'tcs.com', 'asian-paints': 'asianpaints.com'
});
const VALID_VOTES = new Set(['bull', 'neutral', 'bear']);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'barclays';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_STATE_ID = process.env.SUPABASE_STATE_ID || 'default';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const STRIPE_API_VERSION = process.env.STRIPE_API_VERSION || '2026-10-28.endive';
const PUBLIC_APP_URL = String(process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);
const LEGAL_POLICY_VERSION = '2026-11-04';
const GOOGLE_OAUTH_STORAGE_KEY = 'dd-google-oauth';
const GOOGLE_OAUTH_VERIFIER_COOKIE = 'dd_google_pkce';
const GOOGLE_OAUTH_CONTEXT_COOKIE = 'dd_google_context';
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  : null;
const adminTokens = new Map();
const DB_CACHE_TTL_MS = 5000;
const PRICE_CACHE_MAX_AGE_MS = 20 * 60 * 60 * 1000;
let dbCache = null;
let dbCacheExpiresAt = 0;
let dbReadPromise = null;
const logoMemoryCache = new Map();
let priceRefreshPromise = null;
let stripePlanCache = null;
let stripePlanCacheExpiresAt = 0;
const instagramBot = createInstagramBotController();

app.use(compression());
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: 'Stripe webhook is not configured.' });
    const event = verifyStripeWebhook(req.body, req.get('stripe-signature'));
    await processStripeEvent(event);
    res.json({ received: true });
  } catch (error) {
    console.error('[stripe webhook]', error.message);
    res.status(400).json({ error: 'Invalid Stripe webhook.' });
  }
});
app.use(express.json({ limit: '8mb' }));

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true });
});

const SERIALIZED_USER_MUTATIONS = new Set([
  '/api/read', '/api/save', '/api/vote', '/api/deep-dive',
  '/api/story-complete', '/api/search-used', '/api/next-company-click'
]);
let userMutationQueue = Promise.resolve();
app.use(async (req, res, next) => {
  if (!SERIALIZED_USER_MUTATIONS.has(req.path) || req.method === 'GET') return next();
  let release;
  const previous = userMutationQueue;
  userMutationQueue = new Promise(resolve => { release = resolve; });
  await previous;
  let released = false;
  const done = () => {
    if (released) return;
    released = true;
    release();
  };
  res.once('finish', done);
  res.once('close', done);
  next();
});

function loadEnv() {
  const envFile = path.join(__dirname, '.env');
  if (!fsSync.existsSync(envFile)) return;
  const lines = fsSync.readFileSync(envFile, 'utf8').split(/\r?\n/);
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

async function sendSupabaseLogo(res, objectPath) {
  const cached = logoMemoryCache.get(objectPath);
  if (cached) {
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.type(cached.type).send(cached.logo);
    return true;
  }
  if (!supabase) return false;
  const { data, error } = await supabase.storage.from(SUPABASE_LOGO_BUCKET).download(objectPath);
  if (error || !data) return false;
  const logo = Buffer.from(await data.arrayBuffer());
  if (!logo.length || logo.length > 2 * 1024 * 1024) return false;
  const type = data.type || 'image/png';
  logoMemoryCache.set(objectPath, { logo, type });
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  res.type(type).send(logo);
  return true;
}

async function sendFirstSupabaseLogo(res, objectPaths) {
  for (const objectPath of objectPaths) {
    if (await sendSupabaseLogo(res, objectPath)) return true;
  }
  return false;
}

function todayKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(a, b) {
  const start = Date.parse(`${a}T00:00:00.000Z`);
  const end = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((end - start) / 86400000);
}

function validDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function clientReadDate(value) {
  if (!validDateKey(value)) return todayKey();
  const today = todayKey();
  const diff = daysBetween(today, value);
  return Math.abs(diff) <= 1 ? value : today;
}

function uniqueReadDates(user) {
  return [...new Set((Array.isArray(user.readHistory) ? user.readHistory : [])
    .map(item => item && item.date)
    .filter(validDateKey))].sort();
}

function calculateCurrentStreak(user, referenceDate = todayKey()) {
  const dates = uniqueReadDates(user);
  if (!dates.length) return { streak: 0, lastReadDate: null };
  const dateSet = new Set(dates);
  const lastReadDate = dates.at(-1);
  const daysSinceLastRead = daysBetween(lastReadDate, referenceDate);
  if (daysSinceLastRead > 1) return { streak: 0, lastReadDate };
  let cursor = lastReadDate;
  let streak = 0;
  while (dateSet.has(cursor)) {
    streak += 1;
    const prev = new Date(`${cursor}T00:00:00.000Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    cursor = todayKey(prev);
  }
  return { streak, lastReadDate };
}

function syncUserStreak(user, referenceDate = todayKey()) {
  const current = calculateCurrentStreak(user, referenceDate);
  user.streak = current.streak;
  user.lastReadDate = current.lastReadDate;
  return current;
}

function emptyDb() {
  return {
    users: {},
    votes: {},
    settings: {
      featuredCompany: 'netflix'
    },
    companies: {},
    prices: emptyPrices(),
    nudges: {}
  };
}

function emptyPrices() {
  return Object.fromEntries(Object.entries(PRICE_COMPANIES).map(([key, company]) => [key, {
    ...company,
    price: 0,
    change: null,
    changeDirection: null,
    date: null,
    lastUpdated: null
  }]));
}

function normalizePrices(prices) {
  const source = prices && typeof prices === 'object' ? prices : {};
  return Object.fromEntries(Object.entries(emptyPrices()).map(([key, fallback]) => {
    const cached = source[key] && typeof source[key] === 'object' ? source[key] : {};
    const price = Number(cached.price);
    const change = typeof cached.change === 'number' && Number.isFinite(cached.change) ? cached.change : null;
    return [key, {
      ...fallback,
      price: Number.isFinite(price) && price >= 0 ? price : fallback.price,
      currency: typeof cached.currency === 'string' && cached.currency ? cached.currency : fallback.currency,
      change,
      changeDirection: change !== null ? (change >= 0 ? 'up' : 'down') : null,
      date: typeof cached.date === 'string' && cached.date ? cached.date : null,
      lastUpdated: typeof cached.lastUpdated === 'string' && cached.lastUpdated ? cached.lastUpdated : null
    }];
  }));
}

function normalizeDb(parsed = {}) {
  const empty = emptyDb();
  return {
    users: parsed.users && typeof parsed.users === 'object' ? parsed.users : empty.users,
    votes: parsed.votes && typeof parsed.votes === 'object' ? parsed.votes : empty.votes,
    settings: {
      ...empty.settings,
      ...(parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {})
    },
    companies: parsed.companies && typeof parsed.companies === 'object' ? parsed.companies : empty.companies,
    prices: normalizePrices(parsed.prices),
    nudges: parsed.nudges && typeof parsed.nudges === 'object' ? parsed.nudges : empty.nudges
  };
}

function cloneDb(db) {
  return structuredClone(db);
}

async function loadDbFromStore() {
  if (supabase) {
    const { data, error } = await supabase
      .from('daily_dividend_state')
      .select('data')
      .eq('id', SUPABASE_STATE_ID)
      .maybeSingle();
    if (error) throw error;
    return normalizeDb(data && data.data ? data.data : emptyDb());
  }
  try {
    return normalizeDb(JSON.parse(await fs.readFile(DB_FILE, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') return emptyDb();
    throw error;
  }
}

async function readDb() {
  if (dbCache && Date.now() < dbCacheExpiresAt) return cloneDb(dbCache);
  if (!dbReadPromise) dbReadPromise = loadDbFromStore();
  try {
    const db = await dbReadPromise;
    dbCache = normalizeDb(db);
    dbCacheExpiresAt = Date.now() + DB_CACHE_TTL_MS;
    return cloneDb(dbCache);
  } finally {
    dbReadPromise = null;
  }
}

async function writeDb(db) {
  const normalized = normalizeDb(db);
  if (supabase) {
    const { error } = await supabase
      .from('daily_dividend_state')
      .upsert({
        id: SUPABASE_STATE_ID,
        data: normalized,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    dbCache = normalized;
    dbCacheExpiresAt = Date.now() + DB_CACHE_TTL_MS;
    return;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(normalized, null, 2));
  dbCache = normalized;
  dbCacheExpiresAt = Date.now() + DB_CACHE_TTL_MS;
}

async function mirrorPricesToLocalFile(prices) {
  let localDb = {};
  try {
    localDb = JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  localDb.prices = normalizePrices(prices);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(localDb, null, 2));
}

async function safeMirrorPricesToLocalFile(prices) {
  try {
    await mirrorPricesToLocalFile(prices);
    return null;
  } catch (error) {
    console.warn('[prices] Local JSON mirror skipped:', error.message);
    return error.message;
  }
}

async function fetchTwelveDataQuote(symbolKey) {
  const company = PRICE_COMPANIES[symbolKey];
  const url = new URL('https://api.twelvedata.com/quote');
  url.searchParams.set('symbol', company.ticker);
  if (company.exchange) url.searchParams.set('exchange', company.exchange);
  url.searchParams.set('apikey', TWELVE_DATA_API_KEY);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status === 'error') {
    throw new Error(payload.message || `Twelve Data returned HTTP ${response.status}.`);
  }
  const price = Number(payload.close || payload.price);
  if (!Number.isFinite(price) || price < 0) throw new Error('Twelve Data returned an invalid quote price.');
  return {
    price,
    currency: typeof payload.currency === 'string' && payload.currency ? payload.currency : (company.currency || 'USD'),
    date: typeof payload.datetime === 'string' && payload.datetime ? payload.datetime : null
  };
}

async function doRefreshPrices(db) {
  db.prices = normalizePrices(db.prices);
  const results = [];
  for (const symbolKey of Object.keys(PRICE_COMPANIES)) {
    try {
      const fresh = await fetchTwelveDataQuote(symbolKey);
      const yearStart = PRICE_COMPANIES[symbolKey].yearStartPrice;
      const rawChange = yearStart ? (fresh.price - yearStart) / yearStart * 100 : null;
      const change = rawChange !== null ? parseFloat(rawChange.toFixed(2)) : null;
      db.prices[symbolKey] = {
        ...db.prices[symbolKey],
        ...fresh,
        change,
        changeDirection: change !== null ? (change >= 0 ? 'up' : 'down') : null,
        lastUpdated: new Date().toISOString()
      };
      results.push({ symbolKey, ok: true, price: fresh.price });
    } catch (error) {
      console.warn(`Price refresh failed for ${symbolKey}:`, error.message);
      results.push({ symbolKey, ok: false, error: error.message });
    }
  }
  return results;
}

function priceCacheIsStale(prices, now = Date.now()) {
  const normalized = normalizePrices(prices);
  return Object.values(normalized).some(price => {
    if (!price.price) return true;
    const updatedAt = Date.parse(price.lastUpdated || '');
    return !Number.isFinite(updatedAt) || now - updatedAt > PRICE_CACHE_MAX_AGE_MS;
  });
}

async function refreshPricesIfStale(db) {
  if (!TWELVE_DATA_API_KEY || !priceCacheIsStale(db.prices)) {
    db.prices = normalizePrices(db.prices);
    return { refreshed: false, updated: 0, failed: [] };
  }

  if (!priceRefreshPromise) {
    priceRefreshPromise = (async () => {
      const results = await doRefreshPrices(db);
      const updated = results.filter(r => r.ok).length;
      const failed = results.filter(r => !r.ok);
      if (updated) {
        await writeDb(db);
        await safeMirrorPricesToLocalFile(db.prices);
      }
      return { refreshed: true, updated, failed };
    })().finally(() => {
      priceRefreshPromise = null;
    });
  }

  return priceRefreshPromise;
}

async function autoRefreshPrices() {
  if (!TWELVE_DATA_API_KEY) return;
  try {
    const db = await readDb();
    const results = await doRefreshPrices(db);
    const updated = results.filter(r => r.ok).length;
    if (updated) {
      await writeDb(db);
      await safeMirrorPricesToLocalFile(db.prices);
      console.log(`[prices] Auto-refreshed ${updated}/${results.length} at ${new Date().toISOString()}`);
    }
  } catch (error) {
    console.error('[prices] Auto-refresh error:', error.message);
  }
}

function timeZoneParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function timeZoneOffsetMs(date, timeZone) {
  const parts = timeZoneParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function zonedTimeToUtc({ year, month, day, hour, minute = 0, second = 0 }, timeZone) {
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 2; i += 1) {
    utc = Date.UTC(year, month - 1, day, hour, minute, second) - timeZoneOffsetMs(new Date(utc), timeZone);
  }
  return new Date(utc);
}

function nextNewYorkPriceRefreshDate(now = new Date()) {
  const timeZone = 'America/New_York';
  const ny = timeZoneParts(now, timeZone);
  const afterTodayRefresh = ny.hour > 17 || (ny.hour === 17 && (ny.minute > 0 || ny.second > 0));
  const targetBase = afterTodayRefresh
    ? new Date(Date.UTC(ny.year, ny.month - 1, ny.day + 1, 12, 0, 0))
    : now;
  const targetNy = timeZoneParts(targetBase, timeZone);
  return zonedTimeToUtc({
    year: targetNy.year,
    month: targetNy.month,
    day: targetNy.day,
    hour: 17,
    minute: 0,
    second: 0
  }, timeZone);
}

function scheduleDailyPriceRefresh() {
  const nextRun = nextNewYorkPriceRefreshDate();
  const delay = Math.max(1000, nextRun.getTime() - Date.now());
  console.log(`[prices] Next automatic refresh scheduled for ${nextRun.toISOString()} (5:00 PM America/New_York)`);
  setTimeout(async () => {
    await autoRefreshPrices();
    scheduleDailyPriceRefresh();
  }, delay);
}

function makeUser(userId = crypto.randomUUID()) {
  return {
    userId,
    firstName: '',
    lastName: '',
    username: '',
    country: '',
    phoneCode: '',
    phoneNumber: '',
    profession: '',
    financeProficiency: null,
    howHeard: '',
    marketPreferences: [],
    sectorPreferences: [],
    ageRange: '',
    investorLevel: '',
    onboardingCompleted: false,
    authProvider: '',
    authProviders: [],
    lastSignInAt: null,
    signInCount: 0,
    createdAt: new Date().toISOString(),
    streak: 0,
    lastReadDate: null,
    savedCompanies: [],
    previousVotes: {},
    voteData: {},
    readHistory: [],
    deepDiveOpens: 0,
    completedStories: [],
    todayReads: 0,
    libraryReads: 0,
    searchUses: 0,
    nextCompanyClicks: 0,
    sectorsRead: [],
    contrarianVotes: 0,
    stripeCustomerId: '',
    stripeSubscriptionId: '',
    subscriptionStatus: 'inactive',
    subscriptionCancelAtPeriodEnd: false,
    subscriptionCurrentPeriodEnd: null,
    subscriptionUpdatedAt: null,
    personalityScores: { contrarian: 0, operator: 0, patternSpotter: 0, momentumReader: 0 },
    readingPersonality: null
  };
}

function requireString(value, name, res) {
  if (typeof value !== 'string' || !value.trim()) {
    res.status(400).json({ error: `${name} is required.` });
    return null;
  }
  return value.trim();
}

function getUser(db, userId) {
  if (!db.users[userId]) {
    db.users[userId] = makeUser(userId);
  }
  return db.users[userId];
}

function profile(user) {
  syncUserStreak(user);
  return {
    userId: user.userId,
    email: user.email || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    username: user.username || '',
    country: user.country || '',
    phoneCode: user.phoneCode || '',
    phoneNumber: user.phoneNumber || '',
    profession: user.profession || '',
    financeProficiency: user.financeProficiency || null,
    howHeard: user.howHeard || '',
    marketPreferences: Array.isArray(user.marketPreferences) ? user.marketPreferences : [],
    sectorPreferences: Array.isArray(user.sectorPreferences) ? user.sectorPreferences : [],
    ageRange: user.ageRange || '',
    investorLevel: user.investorLevel || '',
    onboardingCompleted: Boolean(user.onboardingCompleted),
    authProvider: user.authProvider || '',
    authProviders: Array.isArray(user.authProviders) ? user.authProviders : [],
    lastSignInAt: user.lastSignInAt || null,
    signInCount: Number(user.signInCount) || 0,
    streak: user.streak || 0,
    savedCompanies: user.savedCompanies || [],
    previousVotes: user.previousVotes || {},
    voteData: user.voteData || {},
    readHistory: user.readHistory || [],
    deepDiveOpens: user.deepDiveOpens || 0,
    completedStories: user.completedStories || [],
    todayReads: user.todayReads || 0,
    libraryReads: user.libraryReads || 0,
    searchUses: user.searchUses || 0,
    subscriptionActive: ACTIVE_SUBSCRIPTION_STATUSES.has(user.subscriptionStatus),
    subscriptionStatus: user.subscriptionStatus || 'inactive',
    subscriptionCancelAtPeriodEnd: Boolean(user.subscriptionCancelAtPeriodEnd),
    subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
    nextCompanyClicks: user.nextCompanyClicks || 0,
    sectorsRead: user.sectorsRead || [],
    contrarianVotes: user.contrarianVotes || 0,
    personalityScores: user.personalityScores || { contrarian: 0, operator: 0, patternSpotter: 0, momentumReader: 0 },
    readingPersonality: user.readingPersonality || null
  };
}

function normalize(value) {
  return String(value || '').trim();
}

function normalizeLookup(value) {
  return normalize(value).toLowerCase();
}

function recordUserSignIn(user, authUser, fallbackProvider = 'email') {
  const appMetadata = (authUser && authUser.app_metadata) || {};
  const identityProviders = Array.isArray(authUser && authUser.identities)
    ? authUser.identities.map(identity => normalizeLookup(identity && identity.provider)).filter(Boolean)
    : [];
  const metadataProviders = Array.isArray(appMetadata.providers)
    ? appMetadata.providers.map(normalizeLookup).filter(Boolean)
    : [];
  const provider = normalizeLookup(appMetadata.provider || identityProviders[0] || fallbackProvider) || fallbackProvider;
  user.authProvider = provider;
  user.authProviders = [...new Set([provider, ...metadataProviders, ...identityProviders])];
  user.lastSignInAt = new Date().toISOString();
  user.signInCount = (Number(user.signInCount) || 0) + 1;
}

function normalizePhoneNumber(value, phoneCode = '') {
  return normalize(value).replace(/\D/g, '');
}

function authClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

function oauthCookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge
  };
}

function googleAuthClient(req, res) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const cookies = parseCookies(req);
  const verifierKey = `${GOOGLE_OAUTH_STORAGE_KEY}-code-verifier`;
  const storage = {
    isServer: true,
    getItem(key) {
      return key === verifierKey ? (cookies[GOOGLE_OAUTH_VERIFIER_COOKIE] || null) : null;
    },
    setItem(key, value) {
      if (key !== verifierKey) return;
      cookies[GOOGLE_OAUTH_VERIFIER_COOKIE] = String(value);
      res.cookie(GOOGLE_OAUTH_VERIFIER_COOKIE, String(value), oauthCookieOptions(10 * 60 * 1000));
    },
    removeItem(key) {
      if (key !== verifierKey) return;
      delete cookies[GOOGLE_OAUTH_VERIFIER_COOKIE];
      res.clearCookie(GOOGLE_OAUTH_VERIFIER_COOKIE, oauthCookieOptions());
    }
  };
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      flowType: 'pkce',
      storageKey: GOOGLE_OAUTH_STORAGE_KEY,
      storage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

function parseCookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index < 0) return cookies;
    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    return cookies;
  }, {});
}

function setAuthCookies(res, session) {
  const secure = process.env.NODE_ENV === 'production';
  const common = { httpOnly: true, sameSite: 'lax', secure, path: '/' };
  res.cookie('dd_access_token', session.access_token, { ...common, maxAge: Math.max(60, session.expires_in || 3600) * 1000 });
  res.cookie('dd_refresh_token', session.refresh_token, { ...common, maxAge: 30 * 24 * 60 * 60 * 1000 });
}

function clearAuthCookies(res) {
  const secure = process.env.NODE_ENV === 'production';
  const options = { httpOnly: true, sameSite: 'lax', secure, path: '/' };
  res.clearCookie('dd_access_token', options);
  res.clearCookie('dd_refresh_token', options);
}

function googleOAuthContext(req) {
  const cookies = parseCookies(req);
  let context = {};
  try {
    context = JSON.parse(cookies[GOOGLE_OAUTH_CONTEXT_COOKIE] || '{}');
  } catch (error) {
    context = {};
  }
  return {
    returnTo: context.returnTo === '/testing123' ? '/testing123' : '/',
    marketPreferences: Array.isArray(context.marketPreferences) ? context.marketPreferences : undefined,
    sectorPreferences: Array.isArray(context.sectorPreferences) ? context.sectorPreferences : undefined,
    ageRange: normalize(context.ageRange),
    investorLevel: normalize(context.investorLevel)
  };
}

function clearGoogleOAuthCookies(res) {
  res.clearCookie(GOOGLE_OAUTH_VERIFIER_COOKIE, oauthCookieOptions());
  res.clearCookie(GOOGLE_OAUTH_CONTEXT_COOKIE, oauthCookieOptions());
}

async function authenticatedUser(req, res) {
  const client = authClient();
  if (!client) throw new Error('Supabase Auth is not configured.');
  const cookies = parseCookies(req);
  const bearer = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  let accessToken = bearer || cookies.dd_access_token || '';
  let result = accessToken ? await client.auth.getUser(accessToken) : { data: { user: null }, error: true };

  if ((!result.data || !result.data.user) && cookies.dd_refresh_token) {
    const refreshed = await client.auth.refreshSession({ refresh_token: cookies.dd_refresh_token });
    if (!refreshed.error && refreshed.data.session) {
      setAuthCookies(res, refreshed.data.session);
      accessToken = refreshed.data.session.access_token;
      result = await client.auth.getUser(accessToken);
    }
  }

  if (!result.data || !result.data.user) {
    clearAuthCookies(res);
    return null;
  }
  return result.data.user;
}

async function requireUser(req, res, next) {
  try {
    req.authUser = await authenticatedUser(req, res);
    if (!req.authUser) return res.status(401).json({ error: 'Please log in to continue.' });
    next();
  } catch (error) {
    if (/Supabase Auth is not configured/.test(error.message || '')) {
      return res.status(503).json({ error: error.message });
    }
    next(error);
  }
}

async function requireActiveSubscription(req, res, next) {
  try {
    const db = await readDb();
    const user = getUser(db, req.authUser.id);
    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(user.subscriptionStatus)) {
      return res.status(402).json({ error: 'An active Daily Dividend membership is required.', subscribeUrl: '/subscribe' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

async function requireSubscribedPage(req, res, next) {
  try {
    const authUser = await authenticatedUser(req, res);
    if (!authUser) return res.redirect(302, '/onboarding');
    const db = await readDb();
    const user = getUser(db, authUser.id);
    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(user.subscriptionStatus)) return res.redirect(302, '/subscribe');
    req.authUser = authUser;
    next();
  } catch (error) {
    next(error);
  }
}

async function requireAuthenticatedPage(req, res, next) {
  try {
    const authUser = await authenticatedUser(req, res);
    if (!authUser) return res.redirect(302, '/onboarding');
    req.authUser = authUser;
    next();
  } catch (error) {
    next(error);
  }
}

async function redirectAuthenticatedToApp(req, res, next) {
  try {
    const authUser = await authenticatedUser(req, res);
    if (authUser) return res.redirect(302, '/');
    next();
  } catch (error) {
    next(error);
  }
}

function stripeConfigured() {
  return Boolean(STRIPE_SECRET_KEY && STRIPE_PRICE_ID);
}

function stripeObjectId(value) {
  return typeof value === 'string' ? value : (value && value.id) || '';
}

function stripeForm(params = {}) {
  const form = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    form.append(key, String(value));
  });
  return form;
}

async function stripeRequest(endpoint, { method = 'GET', params = {} } = {}) {
  if (!STRIPE_SECRET_KEY) throw new Error('Stripe is not configured.');
  const form = stripeForm(params);
  const url = new URL(`https://api.stripe.com${endpoint}`);
  const headers = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Stripe-Version': STRIPE_API_VERSION
  };
  const options = { method, headers, signal: AbortSignal.timeout(15000) };
  if (method === 'GET') {
    form.forEach((value, key) => url.searchParams.append(key, value));
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    options.body = form;
  }
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error((data.error && data.error.message) || 'Stripe request failed.');
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

async function stripePlanDetails() {
  if (!stripeConfigured()) return { amount: 300, amountMinor: 30000, currency: 'INR', interval: 'month', intervalCount: 1, source: 'setup-default' };
  if (stripePlanCache && Date.now() < stripePlanCacheExpiresAt) return { ...stripePlanCache };
  const price = await stripeRequest(`/v1/prices/${encodeURIComponent(STRIPE_PRICE_ID)}`);
  if (!price.active || !price.recurring || !Number.isFinite(Number(price.unit_amount))) {
    throw new Error('The configured Stripe price must be an active recurring fixed price.');
  }
  stripePlanCache = {
    amount: Number(price.unit_amount) / 100,
    amountMinor: Number(price.unit_amount),
    currency: String(price.currency || '').toUpperCase(),
    interval: price.recurring.interval,
    intervalCount: Number(price.recurring.interval_count || 1),
    source: 'stripe'
  };
  stripePlanCacheExpiresAt = Date.now() + (5 * 60 * 1000);
  return { ...stripePlanCache };
}

function verifyStripeWebhook(payload, signatureHeader) {
  if (!Buffer.isBuffer(payload)) throw new Error('Stripe webhook body must be raw.');
  const parts = String(signatureHeader || '').split(',').map(part => part.trim());
  const timestamp = Number((parts.find(part => part.startsWith('t=')) || '').slice(2));
  const signatures = parts.filter(part => part.startsWith('v1=')).map(part => part.slice(3));
  if (!Number.isFinite(timestamp) || !signatures.length) throw new Error('Stripe signature is missing.');
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) throw new Error('Stripe signature is too old.');
  const expected = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.`)
    .update(payload)
    .digest();
  const valid = signatures.some(signature => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const candidate = Buffer.from(signature, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  });
  if (!valid) throw new Error('Stripe signature did not match.');
  return JSON.parse(payload.toString('utf8'));
}

function subscriptionPeriodEnd(subscription) {
  const item = subscription && subscription.items && Array.isArray(subscription.items.data)
    ? subscription.items.data[0]
    : null;
  const seconds = (item && item.current_period_end) || subscription.current_period_end;
  return Number.isFinite(Number(seconds)) ? new Date(Number(seconds) * 1000).toISOString() : null;
}

function findStripeUser(db, { userId, customerId, subscriptionId } = {}) {
  if (userId && db.users[userId]) return db.users[userId];
  return Object.values(db.users).find(user =>
    (customerId && user.stripeCustomerId === customerId) ||
    (subscriptionId && user.stripeSubscriptionId === subscriptionId)
  );
}

function applyStripeSubscription(db, subscription, fallbackUserId = '') {
  if (!subscription) return null;
  const customerId = stripeObjectId(subscription.customer);
  const metadataUserId = normalize(subscription.metadata && subscription.metadata.dd_user_id);
  const user = findStripeUser(db, {
    userId: metadataUserId || fallbackUserId,
    customerId,
    subscriptionId: subscription.id
  });
  if (!user) return null;
  user.stripeCustomerId = customerId || user.stripeCustomerId || '';
  user.stripeSubscriptionId = subscription.id || user.stripeSubscriptionId || '';
  user.subscriptionStatus = normalizeLookup(subscription.status) || 'inactive';
  user.subscriptionCancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  user.subscriptionCurrentPeriodEnd = subscriptionPeriodEnd(subscription);
  user.subscriptionUpdatedAt = new Date().toISOString();
  return user;
}

async function processStripeEvent(event) {
  if (!event || !event.id || !event.type) throw new Error('Stripe event is invalid.');
  const db = await readDb();
  const processed = Array.isArray(db.settings.stripeWebhookEvents) ? db.settings.stripeWebhookEvents : [];
  if (processed.includes(event.id)) return;

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const snapshot = event.data && event.data.object;
    const session = await stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(snapshot.id)}`);
    const subscriptionId = stripeObjectId(session.subscription);
    if (subscriptionId) {
      const subscription = await stripeRequest(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`);
      const user = applyStripeSubscription(db, subscription, session.client_reference_id || normalize(session.metadata && session.metadata.dd_user_id));
      if (user) user.stripeCustomerId = stripeObjectId(session.customer) || user.stripeCustomerId;
    }
  } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const snapshot = event.data && event.data.object;
    const subscription = await stripeRequest(`/v1/subscriptions/${encodeURIComponent(snapshot.id)}`);
    applyStripeSubscription(db, subscription);
  } else if (event.type === 'customer.subscription.deleted') {
    applyStripeSubscription(db, event.data && event.data.object);
  }

  db.settings.stripeWebhookEvents = [...processed, event.id].slice(-100);
  await writeDb(db);
}

function requestBaseUrl(req) {
  if (PUBLIC_APP_URL) return PUBLIC_APP_URL;
  const protocol = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  return `${protocol}://${req.get('host')}`;
}

function billingSnapshot(user) {
  return {
    active: ACTIVE_SUBSCRIPTION_STATUSES.has(user.subscriptionStatus),
    status: user.subscriptionStatus || 'inactive',
    cancelAtPeriodEnd: Boolean(user.subscriptionCancelAtPeriodEnd),
    currentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
    hasCustomer: Boolean(user.stripeCustomerId)
  };
}

function hasAnyPhoneDigits(value) {
  return /\d/.test(normalize(value));
}

function userDisplayName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.name || 'Anonymous';
}

function normalizeSignupPayload(payload) {
  const fullName = normalize(payload.name);
  const [firstFromName, ...restName] = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: normalize(payload.firstName || firstFromName),
    lastName: normalize(payload.lastName || restName.join(' ')),
    username: normalizeLookup(payload.username),
    email: normalizeLookup(payload.email),
    country: normalize(payload.countryName || payload.country),
    phoneCode: normalize(payload.phoneCode || payload.countryCode || payload.country).replace(/\D/g, ''),
    phoneNumber: normalizePhoneNumber(payload.phoneNumber || payload.phone, payload.phoneCode || payload.countryCode || payload.country),
    profession: normalize(payload.profession || payload.occupation),
    financeProficiency: Number(payload.financeProficiency || payload.proficiency || payload.profficiency),
    howHeard: normalize(payload.howHeard || payload.heard),
    marketPreferences: Array.isArray(payload.marketPreferences) ? payload.marketPreferences.map(normalize).filter(Boolean) : [],
    sectorPreferences: Array.isArray(payload.sectorPreferences) ? payload.sectorPreferences.map(normalize).filter(Boolean) : [],
    ageRange: normalize(payload.ageRange || payload.age),
    investorLevel: normalize(payload.investorLevel || payload.level),
    onboardingCompleted: Boolean(payload.onboardingCompleted)
  };
}

async function handleRegister(payload, res) {
  return handleOnboarding(payload, res);
}

async function handleLogin(payload, res) {
  const identifier = normalizeLookup(payload.email || payload.identifier || '');
  const password = String(payload.password || '');
  if (!identifier || !password) return res.status(400).json({ error: 'Email or username and password are required.' });

  const client = authClient();
  if (!client) return res.status(503).json({ error: 'Supabase Auth is not configured.' });

  let email = identifier;

  // If no @ present, treat as username — look up the associated email
  if (!identifier.includes('@')) {
    const db = await readDb();
    const found = Object.values(db.users).find(u => normalizeLookup(u.username) === identifier);
    if (!found || !found.email) {
      return res.status(401).json({ error: 'No account found for that username.' });
    }
    email = normalizeLookup(found.email);
  }

  const { data: authData, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !authData.user || !authData.session) return res.status(401).json({ error: 'Incorrect email/username or password.' });

  const db = await readDb();
  const user = getUser(db, authData.user.id);
  user.email = authData.user.email || email;
  recordUserSignIn(user, authData.user, 'email');
  await writeDb(db);
  analytics.capture({ distinctId: authData.user.id, event: 'user_logged_in', properties: { $set: { email: user.email, username: user.username || '' } } });
  setAuthCookies(res, authData.session);
  return res.json({ ok: true, status: 'login_success', user: profile(user) });
}

async function handleOnboarding(payload, res) {
  const phoneCode = normalize(payload.phoneCode || payload.countryCode).replace(/\D/g, '');
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber || payload.phone, phoneCode);
  const country = normalize(payload.countryName || payload.country);
  const required = [];
  const email = normalizeLookup(payload.email);
  const password = String(payload.password || '');
  const fullNameCheck = normalize(payload.name || `${payload.firstName || ''} ${payload.lastName || ''}`);
  if (!fullNameCheck) required.push('full name');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) required.push('valid email');
  if (password.length < 8) required.push('password with at least 8 characters');
  if (required.length) {
    return res.status(400).json({ error: `Missing: ${required.join(', ')}.` });
  }

  const data = normalizeSignupPayload({
    ...payload,
    firstName: normalize(payload.firstName),
    lastName: normalize(payload.lastName),
    countryName: country || normalize(payload.countryName) || normalize(payload.country) || '',
    profession: normalize(payload.profession),
    financeProficiency: payload.financeProficiency || levelToFinanceProficiency(payload.investorLevel),
    howHeard: normalize(payload.howHeard),
    onboardingCompleted: true
  });

  const client = authClient();
  if (!client || !supabase) return res.status(503).json({ error: 'Supabase Auth is not configured.' });
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: data.username, first_name: data.firstName, last_name: data.lastName }
  });
  if (createError || !created.user) {
    const message = createError && /already|registered|exists/i.test(createError.message || '')
      ? 'An account already exists for that email. Log in instead.'
      : (createError && createError.message) || 'Could not create the account.';
    return res.status(409).json({ error: message });
  }

  const authUser = created.user;
  const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !signedIn.session) {
    await supabase.auth.admin.deleteUser(authUser.id);
    return res.status(500).json({ error: 'Account creation could not be completed.' });
  }

  const db = await readDb();
  const existing = Object.values(db.users).find(user =>
    normalizeLookup(user.email) === email ||
    (data.phoneNumber && normalize(user.phoneCode) === data.phoneCode && normalize(user.phoneNumber) === data.phoneNumber)
  );

  const oldUserId = existing && existing.userId;
  const user = existing ? {
    ...existing,
    ...data,
    userId: authUser.id,
    email,
    onboardingCompleted: true,
    updatedAt: new Date().toISOString()
  } : {
    ...makeUser(authUser.id),
    ...data,
    email,
    onboardingCompleted: true,
    name: `${data.firstName} ${data.lastName}`.trim()
  };

  recordUserSignIn(user, authUser, 'email');

  if (oldUserId && oldUserId !== authUser.id) {
    delete db.users[oldUserId];
    Object.values(db.votes).forEach(companyVotes => {
      if (companyVotes && Object.prototype.hasOwnProperty.call(companyVotes, oldUserId)) {
        companyVotes[authUser.id] = companyVotes[oldUserId];
        delete companyVotes[oldUserId];
      }
    });
  }
  delete user.passwordHash;
  db.users[user.userId] = user;
  await writeDb(db);
  analytics.identify({ distinctId: user.userId, properties: { email, firstName: data.firstName, lastName: data.lastName, username: data.username, country: data.country, profession: data.profession } });
  if (!existing) analytics.capture({ distinctId: user.userId, event: 'user_signed_up', properties: { country: data.country, profession: data.profession, how_heard: data.howHeard } });
  setAuthCookies(res, signedIn.session);
  return res.status(existing ? 200 : 201).json({ ok: true, status: 'success', user: profile(user) });
}

function levelToFinanceProficiency(level) {
  const normalized = normalizeLookup(level);
  if (normalized === 'active') return 4;
  if (normalized === 'started') return 2;
  return 1;
}

function aggregateVotes(db, companyId) {
  const votes = db.votes[companyId] || {};
  const counts = { bull: 0, neutral: 0, bear: 0 };
  Object.values(votes).forEach(vote => {
    if (VALID_VOTES.has(vote)) counts[vote] += 1;
  });

  const total = counts.bull + counts.neutral + counts.bear;
  if (!total) return { bull: 0, neutral: 0, bear: 0, total: 0 };

  const bull = Math.round((counts.bull / total) * 100);
  const neutral = Math.round((counts.neutral / total) * 100);
  const bear = Math.max(0, 100 - bull - neutral);
  return { bull, neutral, bear, total };
}

function voteTotals(db) {
  return Object.keys(db.votes).sort().map(companyId => {
    const votes = db.votes[companyId] || {};
    const counts = { bull: 0, neutral: 0, bear: 0 };
    Object.values(votes).forEach(vote => {
      if (VALID_VOTES.has(vote)) counts[vote] += 1;
    });
    const voters = Object.entries(votes)
      .filter(([, vote]) => VALID_VOTES.has(vote))
      .map(([userId, vote]) => {
        const u = db.users[userId];
        return {
          userId,
          name: u ? userDisplayName(u) : '',
          username: (u && u.username) || '',
          vote
        };
      })
      .sort((a, b) => a.vote.localeCompare(b.vote));
    return {
      companyId,
      counts,
      percentages: aggregateVotes(db, companyId),
      voters
    };
  });
}

const COMPANY_SECTORS = {
  netflix: 'media', disney: 'media', spotify: 'media',
  reliance: 'energy', hdfc: 'banking',
  visa: 'finance', 'home-depot': 'consumer',
  google: 'tech', amazon: 'tech', ferrari: 'luxury', hermes: 'luxury',
  costco: 'consumer', tcs: 'tech', zomato: 'consumer', 'asian-paints': 'consumer'
};

function ensurePersonalityScores(user) {
  if (!user.personalityScores || typeof user.personalityScores !== 'object') {
    user.personalityScores = { contrarian: 0, operator: 0, patternSpotter: 0, momentumReader: 0 };
  }
  ['contrarian', 'operator', 'patternSpotter', 'momentumReader'].forEach(k => {
    if (typeof user.personalityScores[k] !== 'number') user.personalityScores[k] = 0;
  });
  return user.personalityScores;
}

function calculateReadingPersonality(user) {
  const streak = user.streak || 0;
  if (streak < 2) {
    return { unlocked: false, daysNeeded: 2 - streak, message: 'Build a 2-day streak to unlock your reading personality.' };
  }
  const sc = user.personalityScores || { contrarian: 0, operator: 0, patternSpotter: 0, momentumReader: 0 };
  const scores = {
    contrarian: sc.contrarian || 0,
    operator: sc.operator || 0,
    patternSpotter: sc.patternSpotter || 0,
    momentumReader: sc.momentumReader || 0
  };
  // Tie-break: contrarian > operator > patternSpotter > momentumReader
  const order = ['contrarian', 'operator', 'patternSpotter', 'momentumReader'];
  const winner = order.reduce((best, k) => scores[k] > scores[best] ? k : best, order[0]);
  const meta = {
    contrarian: { name: 'The Contrarian', tagline: 'The crowd is usually late.', description: 'You do not trust the obvious story. When everyone is hyped, you look for what they are missing.' },
    operator:   { name: 'The Operator',   tagline: 'Show me the business model.', description: 'You read like someone who wants to know how the machine actually works: revenue, margins, pricing power, and ownership.' },
    patternSpotter: { name: 'The Pattern Spotter', tagline: 'Everything is connected.', description: 'You connect dots across companies, sectors, and trends. You are not just reading one story — you are building a map.' },
    momentumReader: { name: 'The Momentum Reader', tagline: 'Price moves first. Explanations come later.', description: 'You follow what is moving now: earnings, market reactions, trending companies, and the stories everyone is talking about.' }
  };
  const p = meta[winner];
  const evidence = [];
  if (winner === 'contrarian') {
    const cv = user.contrarianVotes || 0;
    if (cv > 0) evidence.push(`You voted against the crowd ${cv} time${cv !== 1 ? 's' : ''}.`);
    const bearVotes = Object.values(user.previousVotes || {}).filter(v => v === 'bear').length;
    if (bearVotes > 0) evidence.push(`You placed ${bearVotes} bearish vote${bearVotes !== 1 ? 's' : ''}.`);
    const bullVotes = Object.values(user.previousVotes || {}).filter(v => v === 'bull').length;
    if (bullVotes > 0 && bearVotes === 0) evidence.push(`You backed ${bullVotes} companies when the crowd was cautious.`);
  } else if (winner === 'operator') {
    const dd = user.deepDiveOpens || 0;
    const comp = (user.completedStories || []).length;
    const saves = (user.savedCompanies || []).length;
    if (dd > 0) evidence.push(`You opened ${dd} deep dive${dd !== 1 ? 's' : ''}.`);
    if (comp > 0) evidence.push(`You completed ${comp} company ${comp !== 1 ? 'stories' : 'story'}.`);
    if (saves > 0) evidence.push(`You saved ${saves} ${saves !== 1 ? 'companies' : 'company'} after reading.`);
  } else if (winner === 'patternSpotter') {
    const sectors = (user.sectorsRead || []).length;
    const nc = user.nextCompanyClicks || 0;
    const su = user.searchUses || 0;
    if (sectors > 0) evidence.push(`You read across ${sectors} different sector${sectors !== 1 ? 's' : ''}.`);
    if (nc > 0) evidence.push(`You followed ${nc} next-company recommendation${nc !== 1 ? 's' : ''}.`);
    if (su > 0) evidence.push(`You used search ${su} time${su !== 1 ? 's' : ''} to find companies.`);
  } else {
    const tr = user.todayReads || 0;
    const reads = (user.readHistory || []).length;
    if (tr > 0) evidence.push(`You read ${tr} Today ${tr !== 1 ? 'stories' : 'story'}.`);
    if (reads > 0) evidence.push(`You have read ${reads} ${reads !== 1 ? 'companies' : 'company'} total.`);
    const voteCount = Object.keys(user.previousVotes || {}).length;
    if (voteCount > 0) evidence.push(`You cast ${voteCount} vote${voteCount !== 1 ? 's' : ''} on companies.`);
  }
  return { unlocked: true, personality: p.name, tagline: p.tagline, description: p.description, scores, evidence: evidence.slice(0, 3) };
}

function userStatus(user) {
  if (user.onboardingCompleted) return 'onboarded';
  const hasPartialData = user.firstName || user.lastName || user.email || user.profession;
  return hasPartialData ? 'partial' : 'empty';
}

function adminSummary(db) {
  const users = Object.values(db.users);
  users.forEach(user => syncUserStreak(user));
  const userRows = users.map(user => ({
    userId: user.userId,
    name: userDisplayName(user),
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    username: user.username || '',
    email: user.email || '',
    passwordSet: Boolean(user.email),
    authProvider: user.authProvider || '',
    authProviders: Array.isArray(user.authProviders) ? user.authProviders : [],
    lastSignInAt: user.lastSignInAt || null,
    signInCount: Number(user.signInCount) || 0,
    onboardingCompleted: Boolean(user.onboardingCompleted),
    status: userStatus(user),
    country: user.country || '',
    phoneCode: user.phoneCode || '',
    phoneNumber: user.phoneNumber || '',
    profession: user.profession || '',
    financeProficiency: user.financeProficiency || null,
    howHeard: user.howHeard || '',
    marketPreferences: Array.isArray(user.marketPreferences) ? user.marketPreferences : [],
    sectorPreferences: Array.isArray(user.sectorPreferences) ? user.sectorPreferences : [],
    ageRange: user.ageRange || '',
    investorLevel: user.investorLevel || '',
    createdAt: user.createdAt,
    streak: user.streak || 0,
    lastReadDate: user.lastReadDate || null,
    reads: Array.isArray(user.readHistory) ? user.readHistory.length : 0,
    saves: Array.isArray(user.savedCompanies) ? user.savedCompanies.length : 0,
    votes: user.previousVotes ? Object.keys(user.previousVotes).length : 0
  }));

  return {
    stats: {
      userCount: users.length,
      googleUserCount: users.filter(user => normalizeLookup(user.authProvider) === 'google').length,
      signupCompleteCount: users.filter(user => user.onboardingCompleted).length,
      activeStreakCount: users.filter(user => (user.streak || 0) > 0).length,
      totalReads: users.reduce((sum, user) => sum + (Array.isArray(user.readHistory) ? user.readHistory.length : 0), 0),
      savedCompaniesCount: users.reduce((sum, user) => sum + (Array.isArray(user.savedCompanies) ? user.savedCompanies.length : 0), 0),
      totalVotes: Object.values(db.votes).reduce((sum, companyVotes) => sum + Object.keys(companyVotes || {}).length, 0),
      personalityUnlocked: users.filter(u => (u.streak || 0) >= 2).length,
      personalityDistribution: users.reduce((dist, u) => {
        const p = calculateReadingPersonality(u);
        if (p.unlocked) dist[p.personality] = (dist[p.personality] || 0) + 1;
        return dist;
      }, {})
    },
    users: userRows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
    voteTotals: voteTotals(db),
    streakLeaderboard: userRows
      .filter(user => user.streak > 0)
      .sort((a, b) => b.streak - a.streak || b.reads - a.reads)
      .slice(0, 25),
    settings: db.settings,
    companies: db.companies,
    nudges: Object.entries(db.nudges || {}).map(([companyId, entry]) => ({
      companyId,
      count: Number(entry && entry.count) || 0,
      lastNudgedAt: (entry && entry.lastNudgedAt) || null
    })).sort((a, b) => b.count - a.count),
    prices: db.prices,
    priceLastUpdated: Object.values(db.prices || {})
      .map(item => item.lastUpdated)
      .filter(Boolean)
      .sort()
      .at(-1) || null
  };
}

function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const session = adminTokens.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) adminTokens.delete(token);
    return res.status(401).json({ error: 'Admin login required.' });
  }
  next();
}

function requireLocalDevice(req, res, next) {
  const address = String(req.socket.remoteAddress || '').toLowerCase();
  const isLoopback = address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
  if (!isLoopback) {
    return res.status(403).json({
      error: 'Instagram browser control is available only from the Daily Dividend server running on this device.'
    });
  }
  next();
}

app.post('/api/session', async (req, res, next) => {
  try {
    const db = await readDb();
    const user = makeUser();
    db.users[user.userId] = user;
    await writeDb(db);
    res.status(201).json({ userId: user.userId });
  } catch (error) {
    next(error);
  }
});

app.post('/api/register', async (req, res, next) => {
  try {
    return await handleRegister(req.body, res);
  } catch (error) {
    next(error);
  }
});

app.post('/api/onboarding', async (req, res, next) => {
  try {
    return await handleOnboarding(req.body, res);
  } catch (error) {
    next(error);
  }
});

app.post('/api/login', async (req, res, next) => {
  try {
    return await handleLogin(req.body, res);
  } catch (error) {
    next(error);
  }
});

async function completeGoogleLogin(authUser, session, payload, res) {
  const db = await readDb();
  const user = getUser(db, authUser.id);
  const metadata = authUser.user_metadata || {};
  const fullName = normalize(metadata.full_name || metadata.name);
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  user.email = authUser.email || user.email || '';
  if (!user.firstName && nameParts.length) user.firstName = nameParts.shift();
  if (!user.lastName && nameParts.length) user.lastName = nameParts.join(' ');
  if (Array.isArray(payload.marketPreferences)) {
    user.marketPreferences = payload.marketPreferences.map(normalize).filter(Boolean);
  }
  if (Array.isArray(payload.sectorPreferences)) {
    user.sectorPreferences = payload.sectorPreferences.map(normalize).filter(Boolean);
  }
  if (normalize(payload.ageRange)) user.ageRange = normalize(payload.ageRange);
  if (normalize(payload.investorLevel)) {
    user.investorLevel = normalize(payload.investorLevel);
    user.financeProficiency = levelToFinanceProficiency(user.investorLevel);
  }
  recordUserSignIn(user, authUser, 'google');
  user.onboardingCompleted = true;
  user.updatedAt = new Date().toISOString();
  await writeDb(db);
  setAuthCookies(res, session);
  analytics.identify({ distinctId: authUser.id, properties: { email: user.email, firstName: user.firstName, lastName: user.lastName } });
  return profile(user);
}

app.get('/api/auth/google', async (req, res, next) => {
  try {
    const client = googleAuthClient(req, res);
    if (!client) return res.status(503).json({ error: 'Supabase Auth is not configured.' });
    let onboarding = {};
    try {
      onboarding = JSON.parse(normalize(req.query.onboarding) || '{}');
    } catch (error) {
      onboarding = {};
    }
    const context = {
      returnTo: ['/testing123', '/subscribe'].includes(normalize(req.query.returnTo)) ? normalize(req.query.returnTo) : '/',
      marketPreferences: Array.isArray(onboarding.marketPreferences) ? onboarding.marketPreferences.map(normalize).filter(Boolean) : undefined,
      sectorPreferences: Array.isArray(onboarding.sectorPreferences) ? onboarding.sectorPreferences.map(normalize).filter(Boolean) : undefined,
      ageRange: normalize(onboarding.ageRange),
      investorLevel: normalize(onboarding.investorLevel)
    };
    res.cookie(GOOGLE_OAUTH_CONTEXT_COOKIE, JSON.stringify(context), oauthCookieOptions(10 * 60 * 1000));
    const forwardedProto = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    const redirectTo = `${forwardedProto}://${req.get('host')}/auth/google/callback`;
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true }
    });
    if (error || !data || !data.url) {
      return res.status(503).json({ error: (error && error.message) || 'Google login is not available yet.' });
    }
    return res.redirect(302, data.url);
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/google-session', async (req, res, next) => {
  try {
    const accessToken = normalize(req.body.accessToken);
    const refreshToken = normalize(req.body.refreshToken);
    if (!accessToken || !refreshToken) return res.status(400).json({ error: 'Google login could not be completed.' });
    const client = authClient();
    if (!client) return res.status(503).json({ error: 'Supabase Auth is not configured.' });
    const { data, error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    const authUser = data && data.user;
    if (error || !authUser || !data.session) return res.status(401).json({ error: 'Google login expired. Please try again.' });
    const user = await completeGoogleLogin(authUser, data.session, req.body, res);
    return res.json({ ok: true, user });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/session', requireUser, async (req, res, next) => {
  try {
    const db = await readDb();
    const existed = Boolean(db.users[req.authUser.id]);
    const user = getUser(db, req.authUser.id);
    const authEmail = req.authUser.email || user.email || '';
    const changed = !existed || user.email !== authEmail;
    user.email = authEmail;
    if (changed) await writeDb(db);
    res.json({ ok: true, user: profile(user) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/billing/status', requireUser, async (req, res, next) => {
  try {
    const db = await readDb();
    const user = getUser(db, req.authUser.id);
    const checkoutSessionId = normalize(req.query.session_id);

    if (checkoutSessionId && stripeConfigured()) {
      if (!/^cs_[A-Za-z0-9_]+$/.test(checkoutSessionId)) return res.status(400).json({ error: 'Invalid Checkout Session.' });
      const session = await stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(checkoutSessionId)}`);
      const sessionUserId = session.client_reference_id || normalize(session.metadata && session.metadata.dd_user_id);
      if (sessionUserId !== req.authUser.id) return res.status(403).json({ error: 'That Checkout Session belongs to another account.' });
      if (session.status === 'complete') {
        const subscriptionId = stripeObjectId(session.subscription);
        if (subscriptionId) {
          const subscription = await stripeRequest(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`);
          applyStripeSubscription(db, subscription, req.authUser.id);
          user.stripeCustomerId = stripeObjectId(session.customer) || user.stripeCustomerId;
        }
      }
      await writeDb(db);
    } else if (user.stripeSubscriptionId && STRIPE_SECRET_KEY) {
      try {
        const subscription = await stripeRequest(`/v1/subscriptions/${encodeURIComponent(user.stripeSubscriptionId)}`);
        applyStripeSubscription(db, subscription, req.authUser.id);
        await writeDb(db);
      } catch (error) {
        if (error.statusCode !== 404) throw error;
        user.subscriptionStatus = 'canceled';
        user.subscriptionUpdatedAt = new Date().toISOString();
        await writeDb(db);
      }
    }

    const plan = await stripePlanDetails();
    res.json({
      ok: true,
      configured: stripeConfigured(),
      plan,
      billing: billingSnapshot(user)
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/billing/checkout', requireUser, async (req, res, next) => {
  try {
    if (!stripeConfigured()) return res.status(503).json({ error: 'Payments are not configured yet.' });
    const db = await readDb();
    const user = getUser(db, req.authUser.id);
    if (ACTIVE_SUBSCRIPTION_STATUSES.has(user.subscriptionStatus)) {
      return res.status(409).json({ error: 'Your membership is already active.' });
    }

    if (!user.stripeCustomerId) {
      const customer = await stripeRequest('/v1/customers', {
        method: 'POST',
        params: {
          email: req.authUser.email || user.email,
          name: userDisplayName(user),
          'metadata[dd_user_id]': req.authUser.id
        }
      });
      user.stripeCustomerId = customer.id;
      await writeDb(db);
    }

    const baseUrl = requestBaseUrl(req);
    const session = await stripeRequest('/v1/checkout/sessions', {
      method: 'POST',
      params: {
        ui_mode: 'hosted_page',
        mode: 'subscription',
        billing_address_collection: 'auto',
        'phone_number_collection[enabled]': false,
        'automatic_tax[enabled]': false,
        allow_promotion_codes: true,
        payment_method_collection: 'always',
        submit_type: 'auto',
        'consent_collection[terms_of_service]': 'required',
        'custom_text[terms_of_service_acceptance][message]': 'By subscribing to Daily Dividend, you agree to our Terms of Service and acknowledge that your subscription renews automatically at ₹300 per month until cancelled. You may cancel at any time before your next renewal.\n\nDaily Dividend provides financial news, market analysis and educational content for informational purposes only, not personalised financial or investment advice. Investing involves risk.',
        integration_identifier: 'hosted_web_0001',
        origin_context: 'web',
        'line_items[0][price]': STRIPE_PRICE_ID,
        'line_items[0][quantity]': 1,
        success_url: `${baseUrl}/subscribe?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/subscribe?checkout=cancelled`
      }
    });
    res.json({ ok: true, url: session.url });
  } catch (error) {
    next(error);
  }
});

app.post('/api/billing/portal', requireUser, async (req, res, next) => {
  try {
    if (!STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Payments are not configured yet.' });
    const db = await readDb();
    const user = getUser(db, req.authUser.id);
    if (!user.stripeCustomerId) return res.status(400).json({ error: 'No billing profile exists for this account yet.' });
    const session = await stripeRequest('/v1/billing_portal/sessions', {
      method: 'POST',
      params: { customer: user.stripeCustomerId, return_url: `${requestBaseUrl(req)}/subscribe` }
    });
    res.json({ ok: true, url: session.url });
  } catch (error) {
    next(error);
  }
});

app.post('/api/logout', (req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

app.post('/api/dd', async (req, res, next) => {
  try {
    const mode = normalizeLookup(req.body.mode);
    if (mode === 'signup') return await handleRegister(req.body, res);
    if (mode === 'login') return await handleLogin(req.body, res);
    return res.status(400).json({ error: `Unsupported mode: ${mode || 'unknown'}.` });
  } catch (error) {
    next(error);
  }
});

app.get('/api/user/:userId', requireUser, requireActiveSubscription, async (req, res, next) => {
  try {
    const db = await readDb();
    const userId = requireString(req.params.userId, 'userId', res);
    if (!userId) return;
    if (userId !== req.authUser.id) return res.status(403).json({ error: 'You cannot access another user profile.' });
    const existed = Boolean(db.users[userId]);
    const user = getUser(db, userId);
    if (!existed) await writeDb(db);
    res.json(profile(user));
  } catch (error) {
    next(error);
  }
});

app.post('/api/preferences', requireUser, requireActiveSubscription, async (req, res, next) => {
  try {
    const db = await readDb();
    const user = getUser(db, req.authUser.id);
    if (Array.isArray(req.body.sectorPreferences)) {
      user.sectorPreferences = req.body.sectorPreferences.map(normalize).filter(Boolean);
    }
    if (Array.isArray(req.body.marketPreferences)) {
      user.marketPreferences = req.body.marketPreferences.map(normalize).filter(Boolean);
    }
    await writeDb(db);
    res.json(profile(user));
  } catch (error) {
    next(error);
  }
});

app.post('/api/read', requireUser, requireActiveSubscription, async (req, res, next) => {
  try {
    const db = await readDb();
    const userId = req.authUser.id;
    const companyId = requireString(req.body.companyId, 'companyId', res);
    if (!userId || !companyId) return;
    const source = String(req.body.source || 'today'); // today | library | search | nextCompany

    const user = getUser(db, userId);
    if (!Array.isArray(user.readHistory)) user.readHistory = [];
    const today = clientReadDate(req.body.readDate);
    const isNewRead = !user.readHistory.some(item => item.companyId === companyId && item.date === today);
    if (isNewRead) {
      user.readHistory.push({ companyId, date: today, source, readAt: new Date().toISOString() });
      syncUserStreak(user, today);

      // Personality scoring (only on first read of company per day)
      const sc = ensurePersonalityScores(user);
      if (source === 'today') {
        sc.momentumReader += 2;
        user.todayReads = (user.todayReads || 0) + 1;
      } else if (source === 'library') {
        sc.patternSpotter += 1;
        user.libraryReads = (user.libraryReads || 0) + 1;
      } else if (source === 'search') {
        sc.patternSpotter += 1;
        user.libraryReads = (user.libraryReads || 0) + 1;
      } else if (source === 'nextCompany') {
        sc.patternSpotter += 2;
        user.nextCompanyClicks = (user.nextCompanyClicks || 0) + 1;
      }

      // Track new sector
      const sector = COMPANY_SECTORS[companyId.toLowerCase()];
      if (sector) {
        if (!Array.isArray(user.sectorsRead)) user.sectorsRead = [];
        if (!user.sectorsRead.includes(sector)) {
          user.sectorsRead.push(sector);
          sc.patternSpotter += 2;
        }
      }

      // Update cached personality label
      const p = calculateReadingPersonality(user);
      user.readingPersonality = p.unlocked ? p.personality : null;
    } else {
      syncUserStreak(user, today);
    }

    await writeDb(db);
    if (isNewRead) analytics.capture({ distinctId: userId, event: 'company_read', properties: { company_id: companyId, source, date: today } });
    res.json(profile(user));
  } catch (error) {
    next(error);
  }
});

app.post('/api/save', requireUser, requireActiveSubscription, async (req, res, next) => {
  try {
    const db = await readDb();
    const userId = req.authUser.id;
    const companyId = requireString(req.body.companyId, 'companyId', res);
    if (!userId || !companyId) return;

    const user = getUser(db, userId);
    if (!Array.isArray(user.savedCompanies)) user.savedCompanies = [];
    const index = user.savedCompanies.indexOf(companyId);
    const saved = index === -1;
    if (saved) user.savedCompanies.push(companyId);
    else user.savedCompanies.splice(index, 1);

    await writeDb(db);
    analytics.capture({ distinctId: userId, event: saved ? 'company_saved' : 'company_unsaved', properties: { company_id: companyId } });
    res.json({ saved, savedCompanies: user.savedCompanies });
  } catch (error) {
    next(error);
  }
});

app.post('/api/vote', requireUser, requireActiveSubscription, async (req, res, next) => {
  try {
    const db = await readDb();
    const userId = req.authUser.id;
    const companyId = requireString(req.body.companyId, 'companyId', res);
    const vote = requireString(req.body.vote, 'vote', res);
    const price = (typeof req.body.price === 'string' && req.body.price.trim()) ? req.body.price.trim() : null;
    if (!userId || !companyId || !vote) return;
    if (!VALID_VOTES.has(vote)) return res.status(400).json({ error: 'Vote must be bull, neutral, or bear.' });

    const user = getUser(db, userId);

    // Get crowd percentages BEFORE this user's vote
    const crowdBefore = aggregateVotes(db, companyId);
    const isRevote = (user.previousVotes || {})[companyId] === vote;

    if (!db.votes[companyId]) db.votes[companyId] = {};
    db.votes[companyId][userId] = vote;
    user.previousVotes = user.previousVotes || {};
    user.previousVotes[companyId] = vote;

    // Record entry price and date when vote is new or changes direction
    if (!isRevote) {
      user.voteData = user.voteData || {};
      user.voteData[companyId] = { price, date: new Date().toISOString() };
    }

    // Personality scoring — only on first vote for this company
    if (!isRevote && crowdBefore.total >= 5) {
      const sc = ensurePersonalityScores(user);
      const crowdLeader = ['bull', 'neutral', 'bear'].reduce((a, b) => crowdBefore[b] > crowdBefore[a] ? b : a, 'bull');
      if (crowdLeader !== vote) {
        const gap = crowdBefore[crowdLeader] - (crowdBefore[vote] || 0);
        if (gap >= 20) {
          sc.contrarian += 2;
          user.contrarianVotes = (user.contrarianVotes || 0) + 1;
        } else {
          sc.contrarian += 1;
        }
        if ((crowdLeader === 'bull' && vote === 'bear') || (crowdLeader === 'bear' && vote === 'bull')) {
          sc.contrarian += 1;
        }
      } else {
        sc.momentumReader += 1;
      }
      const p = calculateReadingPersonality(user);
      user.readingPersonality = p.unlocked ? p.personality : null;
    }

    await writeDb(db);
    analytics.capture({ distinctId: userId, event: 'company_voted', properties: { company_id: companyId, vote, is_revote: isRevote } });
    res.json({
      vote,
      percentages: aggregateVotes(db, companyId),
      previousVotes: user.previousVotes,
      voteData: user.voteData || {}
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/votes', async (req, res, next) => {
  try {
    const db = await readDb();
    const companyIds = new Set([...BUILT_IN_LIVE_COMPANIES, ...Object.keys(db.votes || {})]);
    res.json({ votes: Object.fromEntries([...companyIds].map(companyId => [companyId, aggregateVotes(db, companyId)])) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/votes/:companyId', async (req, res, next) => {
  try {
    const db = await readDb();
    const companyId = requireString(req.params.companyId, 'companyId', res);
    if (!companyId) return;
    res.json(aggregateVotes(db, companyId));
  } catch (error) {
    next(error);
  }
});

app.get('/api/prices', async (req, res, next) => {
  try {
    let db = await readDb();
    const refresh = await refreshPricesIfStale(db);
    if (refresh.refreshed) db = await readDb();
    res.json({ prices: db.prices, priceRefresh: refresh });
  } catch (error) {
    next(error);
  }
});

app.get('/api/prices/:ticker', async (req, res, next) => {
  try {
    const ticker = String(req.params.ticker || '').trim().toUpperCase();
    if (!PRICE_COMPANIES[ticker]) return res.status(404).json({ error: 'Ticker not found.' });
    let db = await readDb();
    const refresh = await refreshPricesIfStale(db);
    if (refresh.refreshed) db = await readDb();
    res.json({ ...db.prices[ticker], priceRefresh: refresh });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/login', (req, res) => {
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }

  const token = crypto.randomUUID();
  adminTokens.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 8
  });
  res.json({ token });
});

app.get('/api/admin/summary', requireAdmin, async (req, res, next) => {
  try {
    const db = await readDb();
    res.json(adminSummary(db));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/refresh-prices', requireAdmin, async (req, res, next) => {
  try {
    const db = await readDb();
    if (!TWELVE_DATA_API_KEY) {
      return res.status(503).json({
        error: 'TWELVE_DATA_API_KEY is not configured.',
        prices: db.prices
      });
    }

    const results = await doRefreshPrices(db);
    const updated = results.filter(r => r.ok).length;
    let mirrorWarning = null;
    if (updated) {
      await writeDb(db);
      mirrorWarning = await safeMirrorPricesToLocalFile(db.prices);
    }
    const failed = results.filter(r => !r.ok);
    const body = {
      message: failed.length
        ? `Updated ${updated} of ${results.length} prices. Existing cached prices were kept for failures.`
        : `Updated all ${updated} stock prices.`,
      updated, failed, results,
      mirrorWarning,
      prices: db.prices
    };
    if (!updated) return res.status(502).json({ ...body, error: 'Twelve Data did not return any usable prices.' });
    res.json(body);
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/settings', requireAdmin, async (req, res, next) => {
  try {
    const db = await readDb();
    const featuredCompany = requireString(req.body.featuredCompany, 'featuredCompany', res);
    if (!featuredCompany) return;
    db.settings.featuredCompany = featuredCompany;
    await writeDb(db);
    res.json({ settings: db.settings });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/companies', requireAdmin, async (req, res, next) => {
  try {
    const db = await readDb();
    const companyId = requireString(req.body.companyId, 'companyId', res);
    if (!companyId) return;

    const rawYSP = req.body.yearStartPrice;
    db.companies[companyId] = {
      companyId,
      name: normalize(req.body.name || companyId),
      hook: String(req.body.hook || '').trim(),
      category: String(req.body.category || '').trim(),
      ticker: String(req.body.ticker || '').trim().toUpperCase() || null,
      yearStartPrice: rawYSP !== undefined && rawYSP !== '' ? parseFloat(rawYSP) || null : null,
      fileName: normalize(req.body.fileName),
      html: String(req.body.html || ''),
      size: Number(req.body.size || String(req.body.html || '').length || 0),
      updatedAt: new Date().toISOString()
    };
    await writeDb(db);
    res.json({ company: db.companies[companyId], companies: db.companies });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/companies/:companyId', requireAdmin, async (req, res, next) => {
  try {
    const db = await readDb();
    const companyId = requireString(req.params.companyId, 'companyId', res);
    if (!companyId) return;
    delete db.companies[companyId];
    await writeDb(db);
    res.json({ companies: db.companies });
  } catch (error) {
    next(error);
  }
});

app.get('/api/companies', async (req, res, next) => {
  try {
    const db = await readDb();
    const companies = Object.values(db.companies).map(({ html, ...rest }) => rest);
    res.json({ companies });
  } catch (error) {
    next(error);
  }
});

app.post('/api/nudge', async (req, res, next) => {
  try {
    const db = await readDb();
    const companyId = requireString(req.body.companyId, 'companyId', res);
    if (!companyId) return;
    const id = companyId.toLowerCase();
    const userId = String(req.body.userId || '').trim();
    const entry = db.nudges[id] && typeof db.nudges[id] === 'object'
      ? db.nudges[id]
      : { companyId: id, count: 0, users: {} };
    if (!entry.users || typeof entry.users !== 'object') entry.users = {};
    const alreadyNudged = Boolean(userId && entry.users[userId]);
    if (!alreadyNudged) {
      if (userId) entry.users[userId] = new Date().toISOString();
      entry.count = (Number(entry.count) || 0) + 1;
      entry.lastNudgedAt = new Date().toISOString();
      db.nudges[id] = entry;
      await writeDb(db);
    }
    res.json({ companyId: id, count: Number(entry.count) || 0, alreadyNudged });
  } catch (error) {
    next(error);
  }
});

app.get('/api/nudges', async (req, res, next) => {
  try {
    const db = await readDb();
    const userId = String(req.query.userId || '').trim();
    const counts = {};
    const userNudged = [];
    Object.entries(db.nudges || {}).forEach(([id, entry]) => {
      counts[id] = Number(entry && entry.count) || 0;
      if (userId && entry && entry.users && entry.users[userId]) userNudged.push(id);
    });
    res.json({ nudges: counts, userNudged });
  } catch (error) {
    next(error);
  }
});

app.get('/api/catalog-stats', async (req, res, next) => {
  try {
    const db = await readDb();
    const liveIds = new Set(BUILT_IN_LIVE_COMPANIES);
    Object.values(db.companies || {}).forEach(company => {
      if (company && company.companyId && company.html) liveIds.add(String(company.companyId).toLowerCase());
    });
    res.json({ liveCompanyCount: liveIds.size });
  } catch (error) {
    next(error);
  }
});

app.get('/api/company/:companyId', requireUser, async (req, res, next) => {
  try {
    const db = await readDb();
    const id = String(req.params.companyId || '').toLowerCase();
    const company = db.companies[id];
    if (!company || !company.html) return res.status(404).send('<h1>Company not found</h1>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(company.html);
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/user/:userId', requireAdmin, async (req, res, next) => {
  try {
    const db = await readDb();
    const userId = requireString(req.params.userId, 'userId', res);
    if (!userId) return;

    const user = db.users[userId];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Get user's votes across all companies
    const userVotes = {};
    Object.entries(db.votes).forEach(([companyId, votes]) => {
      if (votes[userId]) {
        userVotes[companyId] = votes[userId];
      }
    });

    // Get user's saves
    const userSaves = Array.isArray(user.savedCompanies) ? user.savedCompanies : [];

    // Get user's read history with company details
    const userReads = Array.isArray(user.readHistory) ? user.readHistory : [];

    res.json({
      user: profile(user),
      votes: userVotes,
      saves: userSaves,
      reads: userReads,
      totalVotes: Object.keys(userVotes).length,
      totalSaves: userSaves.length,
      totalReads: userReads.length
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/users/:userId', requireAdmin, async (req, res, next) => {
  try {
    const db = await readDb();
    const userId = requireString(req.params.userId, 'userId', res);
    if (!userId) return;

    if (!db.users[userId]) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Delete user
    delete db.users[userId];

    // Remove user's votes from all companies
    Object.values(db.votes).forEach(companyVotes => {
      delete companyVotes[userId];
    });

    await writeDb(db);
    res.json({ message: 'User deleted successfully.', stats: adminSummary(db).stats });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/user/:userId/reads/:readAt', requireAdmin, async (req, res, next) => {
  try {
    const db = await readDb();
    const userId = requireString(req.params.userId, 'userId', res);
    if (!userId) return;
    const user = db.users[userId];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const readAt = decodeURIComponent(req.params.readAt || '');
    if (Array.isArray(user.readHistory)) {
      user.readHistory = user.readHistory.filter(r => r.readAt !== readAt);
    }
    syncUserStreak(user);
    const p = calculateReadingPersonality(user);
    user.readingPersonality = p.unlocked ? p.personality : null;
    await writeDb(db);
    res.json({ ok: true, totalReads: Array.isArray(user.readHistory) ? user.readHistory.length : 0, streak: user.streak || 0 });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/user/:userId/saves/:companyId', requireAdmin, async (req, res, next) => {
  try {
    const db = await readDb();
    const userId = requireString(req.params.userId, 'userId', res);
    if (!userId) return;
    const user = db.users[userId];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const companyId = decodeURIComponent(req.params.companyId || '');
    if (Array.isArray(user.savedCompanies)) {
      user.savedCompanies = user.savedCompanies.filter(c => c !== companyId);
    }
    await writeDb(db);
    res.json({ ok: true, totalSaves: Array.isArray(user.savedCompanies) ? user.savedCompanies.length : 0 });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/user/:userId/votes/:companyId', requireAdmin, async (req, res, next) => {
  try {
    const db = await readDb();
    const userId = requireString(req.params.userId, 'userId', res);
    if (!userId) return;
    const user = db.users[userId];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const companyId = decodeURIComponent(req.params.companyId || '');
    if (user.previousVotes) delete user.previousVotes[companyId];
    if (db.votes[companyId]) delete db.votes[companyId][userId];
    await writeDb(db);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/deep-dive', requireUser, requireActiveSubscription, async (req, res, next) => {
  try {
    const db = await readDb();
    const userId = req.authUser.id;
    const companyId = requireString(req.body.companyId, 'companyId', res);
    if (!companyId) return;
    const user = getUser(db, userId);
    user.deepDiveOpens = (user.deepDiveOpens || 0) + 1;
    const sc = ensurePersonalityScores(user);
    sc.operator += 2;
    const p = calculateReadingPersonality(user);
    user.readingPersonality = p.unlocked ? p.personality : null;
    await writeDb(db);
    analytics.capture({ distinctId: userId, event: 'deep_dive_opened', properties: { company_id: companyId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.post('/api/story-complete', requireUser, requireActiveSubscription, async (req, res, next) => {
  try {
    const db = await readDb();
    const userId = req.authUser.id;
    const companyId = requireString(req.body.companyId, 'companyId', res);
    if (!companyId) return;
    const user = getUser(db, userId);
    if (!Array.isArray(user.completedStories)) user.completedStories = [];
    if (!user.completedStories.includes(companyId)) {
      user.completedStories.push(companyId);
      const sc = ensurePersonalityScores(user);
      sc.operator += 2;
      // Bonus if they also saved this company
      if ((user.savedCompanies || []).some(k => k === companyId || k.startsWith(companyId + ':'))) {
        sc.operator += 1;
      }
      const p = calculateReadingPersonality(user);
      user.readingPersonality = p.unlocked ? p.personality : null;
    }
    await writeDb(db);
    analytics.capture({ distinctId: userId, event: 'story_completed', properties: { company_id: companyId } });
    res.json({ ok: true, personality: calculateReadingPersonality(user) });
  } catch (err) { next(err); }
});

app.post('/api/search-used', requireUser, requireActiveSubscription, async (req, res, next) => {
  try {
    const db = await readDb();
    const userId = req.authUser.id;
    const user = getUser(db, userId);
    user.searchUses = (user.searchUses || 0) + 1;
    const sc = ensurePersonalityScores(user);
    sc.patternSpotter += 1;
    const p = calculateReadingPersonality(user);
    user.readingPersonality = p.unlocked ? p.personality : null;
    await writeDb(db);
    analytics.capture({ distinctId: userId, event: 'search_used' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.post('/api/next-company-click', requireUser, requireActiveSubscription, async (req, res, next) => {
  try {
    const db = await readDb();
    const userId = req.authUser.id;
    const user = getUser(db, userId);
    user.nextCompanyClicks = (user.nextCompanyClicks || 0) + 1;
    const sc = ensurePersonalityScores(user);
    sc.patternSpotter += 2;
    const p = calculateReadingPersonality(user);
    user.readingPersonality = p.unlocked ? p.personality : null;
    await writeDb(db);
    analytics.capture({ distinctId: userId, event: 'next_company_clicked' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get('/api/personality/:userId', requireUser, requireActiveSubscription, async (req, res, next) => {
  try {
    const db = await readDb();
    const targetId = String(req.params.userId || '').trim();
    if (!targetId) return res.status(400).json({ error: 'userId is required.' });
    if (targetId !== req.authUser.id) return res.status(403).json({ error: 'You cannot access another user profile.' });
    const user = getUser(db, targetId);
    res.json(calculateReadingPersonality(user));
  } catch (err) { next(err); }
});

app.get('/api/admin/export', requireAdmin, async (req, res, next) => {
  try {
    const db = await readDb();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="daily-dividend-export.json"');
    res.send(JSON.stringify(db, null, 2));
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/instagram-bot/status', requireAdmin, requireLocalDevice, async (req, res, next) => {
  try {
    res.json(await instagramBot.status());
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/instagram-bot/job', requireAdmin, requireLocalDevice, async (req, res, next) => {
  try {
    const job = await instagramBot.saveJob(req.body);
    res.json({ message: 'Instagram automation settings saved on this device.', job });
  } catch (error) {
    if (/^(Enter|Add|Public|Use|The post URL|The standardized|Polling|Hourly|Daily|Instagram bot settings)/.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

app.post('/api/admin/instagram-bot/start', requireAdmin, requireLocalDevice, async (req, res, next) => {
  try {
    const status = await instagramBot.start(String(req.body.mode || ''));
    res.json({ message: 'Instagram login browser started on this device.', status });
  } catch (error) {
    if (/^(Playwright|The Instagram browser|Live sending)/.test(error.message)) {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
});

app.post('/api/admin/instagram-bot/stop', requireAdmin, requireLocalDevice, async (req, res, next) => {
  try {
    res.json({ message: 'Stop requested.', status: await instagramBot.stop() });
  } catch (error) {
    next(error);
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get(['/terms', '/terms.html'], (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});
app.get(['/privacy', '/privacy.html'], (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});
app.get(['/cookies', '/cookies.html'], (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(__dirname, 'public', 'cookies.html'));
});

// Serve root-level HTML files explicitly so edits to root are always live
app.get('/', requireAuthenticatedPage, (req, res) => { res.setHeader('Cache-Control','private, no-cache'); res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/index.html', requireAuthenticatedPage, (req, res) => { res.setHeader('Cache-Control','private, no-cache'); res.sendFile(path.join(__dirname, 'index.html')); });
// Keep the Rabbit Holes redesign isolated under /testing123.
app.get([
  '/testing123',
  '/testing123/',
  '/testing123/index.html'
], requireAuthenticatedPage, (req, res) => {
  res.setHeader('Cache-Control', 'private, no-cache');
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/testing123/rabbit-holes/:reportId', requireSubscribedPage, (req, res) => {
  res.setHeader('Cache-Control', 'private, no-cache');
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/testing123/companies/:companyId', (req, res) => res.redirect(302, '/testing123'));
// The original full product remains the normal public site.
app.get('/companies/:companyId', requireAuthenticatedPage, (req, res) => {
  res.setHeader('Cache-Control', 'private, no-cache');
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/rabbit-holes/:reportId', requireSubscribedPage, (req, res) => {
  res.setHeader('Cache-Control', 'private, no-cache');
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/reports/:reportFile', requireSubscribedPage, (req, res) => {
  const reportFile = String(req.params.reportFile || '');
  if (!/^[a-z0-9-]+\.(?:html|css|js)$/i.test(reportFile)) return res.status(404).send('Not found.');
  res.setHeader('Cache-Control', 'private, no-cache');
  res.sendFile(path.join(__dirname, 'public', 'reports', reportFile));
});
app.get('/login', redirectAuthenticatedToApp, (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/login.html', redirectAuthenticatedToApp, (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/testing123/login', redirectAuthenticatedToApp, (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/testing123/login.html', redirectAuthenticatedToApp, (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/subscribe', (req, res) => { res.setHeader('Cache-Control','private, no-cache'); res.sendFile(path.join(__dirname, 'public', 'subscribe.html')); });
app.get('/subscribe.html', (req, res) => { res.setHeader('Cache-Control','private, no-cache'); res.sendFile(path.join(__dirname, 'public', 'subscribe.html')); });
app.get('/auth/google/callback', async (req, res, next) => {
  const code = normalize(req.query.code);
  if (!code) return res.sendFile(path.join(__dirname, 'public', 'google-callback.html'));
  try {
    const client = googleAuthClient(req, res);
    if (!client) return res.status(503).send('Google login is not configured.');
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    const authUser = data && data.user;
    if (error || !authUser || !data.session) {
      throw new Error((error && error.message) || 'Google login could not be completed.');
    }
    const context = googleOAuthContext(req);
    await completeGoogleLogin(authUser, data.session, context, res);
    clearGoogleOAuthCookies(res);
    return res.redirect(302, context.returnTo);
  } catch (error) {
    clearGoogleOAuthCookies(res);
    const message = encodeURIComponent(error.message || 'Google login could not be completed.');
    return res.redirect(302, `/login?oauthError=${message}`);
  }
});
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'signup.html')));
app.get('/signup.html', (req, res) => res.sendFile(path.join(__dirname, 'signup.html')));
app.get('/onboarding', redirectAuthenticatedToApp, (req, res) => { res.setHeader('Cache-Control','private, no-cache'); res.sendFile(path.join(__dirname, 'onboarding.html')); });
app.get('/onboarding.html', redirectAuthenticatedToApp, (req, res) => { res.setHeader('Cache-Control','private, no-cache'); res.sendFile(path.join(__dirname, 'onboarding.html')); });
app.get('/testing123/onboarding', redirectAuthenticatedToApp, (req, res) => { res.setHeader('Cache-Control','private, no-cache'); res.sendFile(path.join(__dirname, 'public', 'onboarding.html')); });
app.get('/testing123/onboarding.html', redirectAuthenticatedToApp, (req, res) => { res.setHeader('Cache-Control','private, no-cache'); res.sendFile(path.join(__dirname, 'public', 'onboarding.html')); });

app.get('/desktop.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dd_v6_desktop_revised (1).html'));
});

app.use('/assets/brand', express.static(path.join(__dirname, 'Site Pics'), {
  etag: true,
  maxAge: '7d'
}));

app.get('/api/brand-logo', async (req, res, next) => {
  try {
    if (await sendSupabaseLogo(res, 'brand/dd-logo.png')) return;
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.sendFile(path.join(__dirname, 'Site Pics', 'DD logo.png'));
  } catch (error) {
    next(error);
  }
});

app.get('/api/logo/:companyId', async (req, res, next) => {
  try {
    const companyId = String(req.params.companyId || '').toLowerCase();
    if (!/^[a-z0-9-]{1,80}$/.test(companyId)) {
      return res.status(404).json({ error: 'Invalid company logo ID.' });
    }
    const domain = COMPANY_LOGO_DOMAINS[companyId];
    const localLogo = LOCAL_LOGO_FILES[companyId];
    if (localLogo) {
      try {
        await fs.access(localLogo);
        res.setHeader('Cache-Control', 'public, max-age=604800');
        return res.sendFile(localLogo);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }

    const supabaseLogoPaths = companyId === 'cocacola'
      ? ['cocacola.png', 'cocacola.jpg', 'cocacola.', 'coca-cola.png', 'coca-cola.jpg', 'coca-cola.']
      : [`${companyId}.png`];
    if (await sendFirstSupabaseLogo(res, supabaseLogoPaths)) return;

    const cacheFiles = companyId === 'cocacola'
      ? [path.join(LOGO_CACHE_DIR, 'cocacola.png'), path.join(LOGO_CACHE_DIR, 'cocacola.jpg')]
      : [path.join(LOGO_CACHE_DIR, `${companyId}.png`)];
    for (const cacheFile of cacheFiles) {
      try {
        await fs.access(cacheFile);
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        return res.sendFile(cacheFile);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }

    if (!domain || !LOGO_DEV_TOKEN) return res.status(404).json({ error: 'Logo unavailable.' });

    const logoUrl = `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(LOGO_DEV_TOKEN)}&size=192&format=png&retina=true`;
    const response = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return res.status(404).json({ error: 'Logo unavailable.' });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) throw new Error('Logo provider returned a non-image response.');
    const logo = Buffer.from(await response.arrayBuffer());
    if (logo.length > 2 * 1024 * 1024) throw new Error('Logo response exceeded 2 MB.');

    await fs.mkdir(LOGO_CACHE_DIR, { recursive: true });
    const cacheFile = path.join(LOGO_CACHE_DIR, `${companyId}.png`);
    await fs.writeFile(cacheFile, logo);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.type('png').send(logo);
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  etag: true,
  maxAge: '5m'
}));

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

process.on('SIGTERM', async () => { instagramBot.shutdown(); await analytics.shutdown(); process.exit(0); });
process.on('SIGINT', async () => { instagramBot.shutdown(); await analytics.shutdown(); process.exit(0); });

app.listen(PORT, () => {
  console.log(`Daily Dividend running at http://localhost:${PORT}`);
  scheduleDailyPriceRefresh();
});
