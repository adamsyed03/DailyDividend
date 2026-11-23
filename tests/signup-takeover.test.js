'use strict';

// Signup must never hand an existing member's data or subscription to a new account.
// Runs the real server.js against a small in-memory fake of Supabase Auth + the state table.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SUB_ID = crypto.randomUUID();      // existing subscriber with a login
const STALE_ID = crypto.randomUUID();    // login whose record still holds an old email (ghost@...)
const ANON_ID = crypto.randomUUID();     // anonymous record, no login, no billing
const ANON_PAID_ID = crypto.randomUUID(); // anonymous record that somehow carries billing

const authUsers = new Map(); // id -> { id, email, password }
const tokens = new Map();    // access token -> user id
let state = null;

function seed() {
  authUsers.clear();
  authUsers.set(SUB_ID, { id: SUB_ID, email: 'sub@test.local', password: 'subscriber-pass' });
  authUsers.set(STALE_ID, { id: STALE_ID, email: 'renamed@test.local', password: 'stale-pass' });
  const base = { firstName: '', lastName: '', username: '', previousVotes: {}, voteData: {}, readHistory: [], savedCompanies: [] };
  state = {
    users: {
      [SUB_ID]: {
        ...base, userId: SUB_ID, email: 'sub@test.local', firstName: 'Sam', lastName: 'Subscriber', username: 'subby',
        phoneCode: '44', phoneNumber: '7700900123', country: 'United Kingdom',
        stripeCustomerId: 'cus_SUBSCRIBER', stripeSubscriptionId: 'sub_SUBSCRIBER', subscriptionStatus: 'active',
        subscriptionUpdatedAt: '2026-10-01T00:00:00.000Z',
        readHistory: [{ companyId: 'netflix', date: '2026-11-01', source: 'today', readAt: '2026-11-01T08:00:00.000Z' }],
        previousVotes: { netflix: 'bull' }, savedCompanies: ['netflix'], streak: 4, authProvider: 'email', signInCount: 9
      },
      [STALE_ID]: {
        ...base, userId: STALE_ID, email: 'ghost@test.local', firstName: 'Ghost', stripeCustomerId: 'cus_GHOST',
        stripeSubscriptionId: 'sub_GHOST', subscriptionStatus: 'active', subscriptionUpdatedAt: '2026-10-02T00:00:00.000Z'
      },
      [ANON_ID]: {
        ...base, userId: ANON_ID, readHistory: [{ companyId: 'disney', date: '2026-11-02', source: 'today', readAt: '2026-11-02T08:00:00.000Z' }],
        previousVotes: { disney: 'bear' }, streak: 2
      },
      [ANON_PAID_ID]: { ...base, userId: ANON_PAID_ID, stripeCustomerId: 'cus_ANON', subscriptionStatus: 'active' }
    },
    votes: { netflix: { [SUB_ID]: 'bull' }, disney: { [ANON_ID]: 'bear' } },
    companies: {}, prices: {}, settings: {}
  };
}

const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
function session(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, exp, role: 'authenticated' })}.sig${crypto.randomBytes(6).toString('hex')}`;
  tokens.set(access, user.id);
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: crypto.randomBytes(12).toString('hex'), user: publicUser(user) };
}
const publicUser = u => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: new Date().toISOString() });

function fakeSupabase(req, res, body) {
  const url = new URL(req.url, 'http://fake');
  const send = (status, json) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(json === undefined ? '' : JSON.stringify(json)); };
  const p = url.pathname;
  if (p === '/rest/v1/daily_dividend_state' && req.method === 'GET') {
    const row = { data: state };
    if (String(req.headers.accept || '').includes('vnd.pgrst.object')) return send(200, row);
    return send(200, [row]);
  }
  if (p === '/rest/v1/daily_dividend_state' && req.method === 'POST') {
    const rows = Array.isArray(body) ? body : [body];
    state = rows[0].data;
    return send(201, rows);
  }
  if (p === '/auth/v1/admin/users' && req.method === 'POST') {
    const email = String(body.email || '').toLowerCase();
    if ([...authUsers.values()].some(u => u.email === email)) return send(422, { code: 'email_exists', msg: 'A user with this email address has already been registered' });
    const user = { id: crypto.randomUUID(), email, password: body.password };
    authUsers.set(user.id, user);
    return send(200, publicUser(user));
  }
  let m = p.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/);
  if (m && req.method === 'GET') return authUsers.has(m[1]) ? send(200, publicUser(authUsers.get(m[1]))) : send(404, { code: 'user_not_found', msg: 'User not found' });
  if (m && req.method === 'DELETE') { authUsers.delete(m[1]); return send(200, {}); }
  if (p === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
    const user = [...authUsers.values()].find(u => u.email === String(body.email || '').toLowerCase() && u.password === body.password);
    return user ? send(200, session(user)) : send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
  }
  if (p === '/auth/v1/user' && req.method === 'GET') {
    const id = tokens.get(String(req.headers.authorization || '').replace(/^Bearer /, ''));
    return id && authUsers.has(id) ? send(200, publicUser(authUsers.get(id))) : send(401, { msg: 'invalid token' });
  }
  return send(404, { msg: `fake supabase: no route ${req.method} ${p}` });
}

let fake, server, base;
const freePort = () => new Promise(resolve => { const s = http.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

test.before(async () => {
  seed();
  fake = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch (_) {} fakeSupabase(req, res, body); });
  });
  await new Promise(r => fake.listen(0, '127.0.0.1', r));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [process.env.SIGNUP_TEST_SERVER || 'server.js'], {
    cwd: ROOT,
    env: {
      ...process.env, PORT: String(port), SUPABASE_URL: `http://127.0.0.1:${fake.address().port}`,
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', SUPABASE_SECRET_KEY: '', SUPABASE_STATE_ID: 'default',
      STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', STRIPE_PRICE_ID: '', TWELVE_DATA_API_KEY: '', ADMIN_PASSWORD: 'test-admin',
      POSTHOG_API_KEY: '', LOGO_DEV_TOKEN: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stderr.on('data', d => { if (process.env.DEBUG_SERVER) process.stderr.write(d); });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`${base}/healthz`)).ok) return; } catch (_) {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('server.js did not start');
});

test.after(() => { if (server) server.kill(); if (fake) fake.close(); });

async function signup(fields) {
  const res = await fetch(`${base}/api/onboarding`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ firstName: 'New', lastName: 'Person', password: 'new-person-pass', onboardingCompleted: true, ...fields })
  });
  return { status: res.status, json: await res.json().catch(() => ({})), cookie: res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ') };
}
const subscriber = () => state.users[SUB_ID];
function assertSubscriberUntouched() {
  const s = subscriber();
  assert.ok(s, 'subscriber record still exists');
  assert.equal(s.stripeCustomerId, 'cus_SUBSCRIBER');
  assert.equal(s.stripeSubscriptionId, 'sub_SUBSCRIBER');
  assert.equal(s.subscriptionStatus, 'active');
  assert.equal(s.readHistory.length, 1);
  assert.deepEqual(s.previousVotes, { netflix: 'bull' });
  assert.equal(state.votes.netflix[SUB_ID], 'bull', 'subscriber vote still theirs');
}
function assertNoBilling(user) {
  assert.ok(!user.stripeCustomerId, 'no Stripe customer');
  assert.ok(!user.stripeSubscriptionId, 'no Stripe subscription');
  assert.ok(!user.subscriptionStatus || user.subscriptionStatus === 'inactive', 'not Pro');
  assert.ok(!user.subscriptionActive, 'not Pro');
}

test("signup with a subscriber's phone number gets none of their data or billing", async () => {
  for (const phone of [{ phoneCode: '44', phoneNumber: '7700900123' }, { phoneCode: '+44', phoneNumber: '07700 900123' }]) {
    const r = await signup({ email: `phone-${crypto.randomUUID()}@test.local`, ...phone });
    const created = state.users[r.json.user.userId];
    assertNoBilling(r.json.user);
    assertNoBilling(created);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(created.readHistory.length, 0, 'no reading history copied');
    assert.deepEqual(created.previousVotes, {}, 'no votes copied');
    assert.notEqual(created.username, 'subby', 'username not copied');
    assertSubscriberUntouched();
  }
});

test("signup with a subscriber's email is refused and changes nothing", async () => {
  const r = await signup({ email: 'sub@test.local', phoneCode: '44', phoneNumber: '7700900123' });
  assert.equal(r.status, 409);
  assertSubscriberUntouched();
});

test('signup with an email that only matches an old record (not a login) does not inherit it', async () => {
  const r = await signup({ email: 'ghost@test.local' });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assertNoBilling(state.users[r.json.user.userId]);
  const old = state.users[STALE_ID];
  assert.ok(old, 'old record kept');
  assert.equal(old.stripeCustomerId, 'cus_GHOST');
  assert.equal(old.subscriptionStatus, 'active');
});

test('a signed-in signup can claim an anonymous record by its id: activity moves, billing never does', async () => {
  const r = await signup({ email: `claim-${crypto.randomUUID()}@test.local`, anonymousId: ANON_ID });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const created = state.users[r.json.user.userId];
  assert.equal(created.readHistory.length, 1);
  assert.equal(created.readHistory[0].companyId, 'disney');
  assert.deepEqual(created.previousVotes, { disney: 'bear' });
  assert.equal(state.votes.disney[r.json.user.userId], 'bear');
  assert.equal(state.votes.disney[ANON_ID], undefined);
  assert.equal(state.users[ANON_ID], undefined, 'anonymous record absorbed');
  assertNoBilling(created);
});

test("presenting a real account's id, or an anonymous record with billing, merges nothing", async () => {
  let r = await signup({ email: `claim-sub-${crypto.randomUUID()}@test.local`, anonymousId: SUB_ID });
  assert.equal(r.status, 201);
  assertNoBilling(state.users[r.json.user.userId]);
  assert.equal(state.users[r.json.user.userId].readHistory.length, 0);
  assertSubscriberUntouched();

  r = await signup({ email: `claim-paid-${crypto.randomUUID()}@test.local`, anonymousId: ANON_PAID_ID });
  assert.equal(r.status, 201);
  assertNoBilling(state.users[r.json.user.userId]);
  assert.equal(state.users[ANON_PAID_ID].stripeCustomerId, 'cus_ANON', 'record with billing left alone');
});

test('the subscriber still logs in to their own Pro account afterwards', async () => {
  const login = await fetch(`${base}/api/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ email: 'sub@test.local', password: 'subscriber-pass' })
  });
  const body = await login.json();
  assert.equal(login.status, 200, JSON.stringify(body));
  assert.equal(body.user.userId, SUB_ID);
  assert.equal(body.user.subscriptionStatus, 'active');
  assert.equal(body.user.readHistory.length, 1);
});
