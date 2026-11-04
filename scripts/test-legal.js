const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const port = 3197;
const baseUrl = `http://127.0.0.1:${port}`;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch (error) {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Legal test server did not start.');
}

async function run() {
  const policies = [
    ['public/terms.html', 'Terms of Service | Daily Dividend', 'https://dailydividend.info/terms'],
    ['public/privacy.html', 'Privacy Policy | Daily Dividend', 'https://dailydividend.info/privacy'],
    ['public/cookies.html', 'Cookie Policy | Daily Dividend', 'https://dailydividend.info/cookies']
  ];
  for (const [file, title, canonical] of policies) {
    const html = read(file);
    assert.match(html, new RegExp(`<title>${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</title>`));
    assert.ok(html.includes(`href="${canonical}"`), `${file} is missing its canonical URL`);
    assert.ok(html.includes('data-cookie-settings'), `${file} is missing cookie settings`);
  }

  assert.ok(!read('login.html').includes('<script async src="https://www.googletagmanager.com'), 'GA must not load directly');
  assert.ok(!read('index.html').includes("posthog.init('phc_"), 'PostHog must not initialise directly');
  assert.ok(read('login.html').includes('data-ga-id="G-V58HGP628B"'));
  assert.ok(read('index.html').includes('data-posthog-key='));
  assert.ok(read('onboarding.html').includes('By creating an account, you agree'));
  assert.ok(read('public/onboarding.html').includes('By creating an account, you agree'));

  const serverSource = read('server.js');
  assert.ok(serverSource.includes("'consent_collection[terms_of_service]': 'required'"));
  assert.ok(serverSource.includes("'custom_text[submit][message]'"));
  assert.ok(serverSource.includes('stripePlanDetails()'));

  const publicFiles = ['public/terms.html', 'public/privacy.html', 'public/cookies.html', 'public/subscribe.html', 'public/js/consent.js', 'login.html', 'index.html'];
  for (const file of publicFiles) assert.doesNotMatch(read(file), /sk_(?:live|test)_[A-Za-z0-9]+/, `${file} exposes a Stripe secret key`);

  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), PUBLIC_APP_URL: baseUrl },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverErrors = '';
  server.stderr.on('data', chunk => { serverErrors += chunk.toString(); });
  let browser;
  try {
    await waitForServer();
    for (const route of ['/terms', '/privacy', '/cookies']) {
      const response = await fetch(baseUrl + route, { redirect: 'manual' });
      assert.equal(response.status, 200, `${route} must be public`);
    }

    const installedBrowser = [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    ].find(candidate => fs.existsSync(candidate));
    browser = await chromium.launch({ headless: true, ...(installedBrowser ? { executablePath: installedBrowser } : {}) });
    const context = await browser.newContext();
    const page = await context.newPage();
    const consoleErrors = [];
    const analyticsRequests = [];
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('request', request => {
      if (/googletagmanager|google-analytics|posthog/i.test(request.url())) analyticsRequests.push(request.url());
    });
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    assert.equal(analyticsRequests.length, 0, 'Optional analytics fired before consent');
    await page.getByRole('button', { name: 'Accept all' }).click();
    await page.waitForTimeout(500);
    assert.ok(analyticsRequests.some(url => url.includes('googletagmanager.com')), 'GA did not load after analytics consent');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dd_cookie_consent_v1')));
    assert.equal(stored.analytics, true);
    await page.getByRole('button', { name: 'Cookie settings' }).first().click();
    assert.ok(await page.getByRole('dialog', { name: 'Cookie preferences' }).isVisible());
    assert.equal(consoleErrors.length, 0, `Browser console errors: ${consoleErrors.join('; ')}`);
    await context.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${baseUrl}/privacy`, { waitUntil: 'domcontentloaded' });
    const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert.equal(overflow, false, 'Privacy page has horizontal overflow on mobile');
    await mobile.close();
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
  assert.equal(serverErrors.trim(), '', `Server errors: ${serverErrors}`);
  console.log('Legal routes, consent gating, Stripe notices, metadata and mobile layout passed.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
