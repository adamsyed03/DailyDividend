'use strict';

const fs = require('fs/promises');
const { chromium } = require('playwright');

const INSTAGRAM_HOME = 'https://www.instagram.com/';
const SAFETY_TEXT = [
  'captcha',
  'challenge required',
  "confirm it's you",
  'confirm it’s you',
  'suspicious login attempt',
  'unusual activity',
  'try again later',
  'account restricted',
  'security check',
  'checkpoint'
];

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

class InstagramSafetyStop extends Error {}

class InstagramBrowser {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.context = null;
    this.page = null;
  }

  async start() {
    await fs.mkdir(this.config.browserProfileDir, { recursive: true });
    const options = {
      headless: false,
      viewport: { width: 1280, height: 900 },
      locale: this.config.browserLocale
    };
    if (this.config.browserChannel) options.channel = this.config.browserChannel;
    this.context = await chromium.launchPersistentContext(this.config.browserProfileDir, options);
    this.page = this.context.pages()[0] || await this.context.newPage();
  }

  async close() {
    if (this.context) await this.context.close().catch(() => {});
    this.context = null;
    this.page = null;
  }

  async openForManualLogin() {
    if (!this.page) throw new Error('Browser context has not been started.');
    this.logger('INFO', 'Opening Instagram in a visible Google Chrome window.');
    await this.page.goto(INSTAGRAM_HOME, {
      waitUntil: 'domcontentloaded',
      timeout: this.config.navigationTimeoutMs
    });
    await this.page.waitForTimeout(2000);
    await this.raiseIfSafetyScreen();

    if (await this.appearsLoggedOut()) {
      this.logger('WARNING', 'Instagram is logged out. Log in manually in Chrome; credentials are never read or stored by this program.');
      await this.waitForManualLogin();
    } else {
      this.logger('INFO', 'An existing Instagram session appears to be available.');
    }

    this.logger('INFO', 'Session ready. Close Chrome, use Stop in the dashboard, or press Ctrl+C in this terminal.');
    while (this.page && !this.page.isClosed()) {
      await delay(this.config.sessionCheckIntervalMs);
      await this.raiseIfSafetyScreen();
    }
  }

  async waitForManualLogin() {
    const deadline = Date.now() + this.config.manualLoginTimeoutMs;
    while (Date.now() < deadline) {
      if (!this.page || this.page.isClosed()) throw new InstagramSafetyStop('Chrome was closed before login completed.');
      await this.raiseIfSafetyScreen();
      if (!(await this.appearsLoggedOut())) {
        this.logger('INFO', 'Manual login completed; the dedicated browser session was persisted.');
        return;
      }
      await delay(this.config.sessionCheckIntervalMs);
    }
    throw new InstagramSafetyStop('Manual login timed out. Start it again when you are ready to log in.');
  }

  async appearsLoggedOut() {
    if (!this.page) return true;
    const url = this.page.url().toLowerCase();
    if (url.includes('/accounts/login') || url.includes('/accounts/emailsignup')) return true;
    const password = this.page.locator('input[type="password"]').first();
    return await password.count() > 0 && await password.isVisible();
  }

  async raiseIfSafetyScreen() {
    if (!this.page || this.page.isClosed()) return;
    const url = this.page.url().toLowerCase();
    if (url.includes('/challenge/') || url.includes('/checkpoint/')) {
      throw new InstagramSafetyStop(`Instagram opened a security/checkpoint page: ${this.page.url()}`);
    }
    let text = '';
    try {
      text = (await this.page.locator('body').innerText({ timeout: 2000 })).toLowerCase();
    } catch (_) {
      return;
    }
    const warning = SAFETY_TEXT.find(value => text.includes(value));
    if (warning) {
      throw new InstagramSafetyStop(`Instagram displayed a possible security or restriction state: "${warning}". No bypass was attempted.`);
    }
  }
}

module.exports = { InstagramBrowser, InstagramSafetyStop };
