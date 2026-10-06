'use strict';

const fs = require('fs/promises');
const path = require('path');
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
      locale: this.config.browserLocale,
      // Playwright includes --no-sandbox by default. Chrome's normal Windows
      // sandbox works here, so retain it and avoid the insecure-mode banner.
      ignoreDefaultArgs: ['--no-sandbox']
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

  async scanPostDryRun(job, dryRunOnly = true) {
    if (!this.page) throw new Error('Browser context has not been started.');
    this.logger('INFO', `Scanning post read-only: ${job.postUrl}`);
    await this.openPostComments(job.postUrl);
    const result = await this.extractComments(job);
    await this.writeInspection(result);

    this.logger('INFO', `Inspected ${result.candidates.length} semantic comment candidates.`);
    if (!result.matches.length) {
      this.logger('WARNING', `No comment matched "${job.triggerComment}". No actions were taken.`);
      this.logger('INFO', 'Saved a local DOM inspection report for selector troubleshooting.');
      return result;
    }

    result.matches.forEach(comment => {
      this.logger('INFO', `MATCH: @${comment.username} wrote "${comment.text}".`);
    });
    this.logger('INFO', dryRunOnly
      ? `Dry scan complete: ${result.matches.length} match(es), zero replies, zero DMs sent.`
      : `Live scan complete: ${result.matches.length} qualifying match(es) found.`);
    return result;
  }

  async openPostComments(postUrl) {
    if (!this.page) throw new Error('Browser context has not been started.');
    await this.page.goto(postUrl, {
      waitUntil: 'domcontentloaded',
      timeout: this.config.navigationTimeoutMs
    });
    await this.page.waitForTimeout(4000);
    await this.raiseIfSafetyScreen();
    if (await this.appearsLoggedOut()) {
      throw new InstagramSafetyStop('Instagram is logged out. Run the login test again before scanning.');
    }

    await this.openCommentPanel();
    await this.expandCommentControls();
  }

  async openCommentPanel() {
    if (!this.page) return;
    // Reel permalinks currently redirect to the reels viewer. Its accessible
    // Comment button opens the read-only comment drawer for the first/current
    // reel; it does not create or submit any content.
    const controls = this.page.getByRole('button', { name: /^comment(?:\s|$)/i });
    for (let index = 0; index < await controls.count(); index += 1) {
      const control = controls.nth(index);
      if (!await control.isVisible().catch(() => false)) continue;
      await control.click({ timeout: 5000 });
      await this.page.waitForTimeout(2500);
      await this.raiseIfSafetyScreen();
      this.logger('INFO', 'Opened the reel comment panel for read-only inspection.');
      return;
    }
    this.logger('WARNING', 'No accessible Comment button was found on the reel.');
  }

  async previewDirectMessage(comment) {
    const composer = await this.openDirectMessageComposer(comment, 'non-sending DM test');
    await this.writeDmInspection(comment, Boolean(composer), null);
    this.logger('INFO', `Verified @${comment.username}'s DM composer. No text was entered and Send was not clicked.`);
  }

  async findDmComposer() {
    const candidates = [
      this.page.getByRole('textbox', { name: /message/i }),
      this.page.locator('textarea[placeholder*="message" i]'),
      this.page.locator('[contenteditable="true"][role="textbox"]')
    ];
    for (const candidate of candidates) {
      if (await candidate.count() && await candidate.first().isVisible().catch(() => false)) return candidate.first();
    }
    return null;
  }

  async dismissInstagramPrompt() {
    const notNow = this.page.getByRole('button', { name: /^not now$/i });
    if (await notNow.count() && await notNow.first().isVisible().catch(() => false)) {
      await notNow.first().click({ timeout: 3000 });
      await this.page.waitForTimeout(1000);
    }
  }

  async openDirectMessageComposerViaSearch(comment) {
    this.logger('INFO', `Profile messaging is unavailable for @${comment.username}; trying Instagram's new-message search.`);
    await this.page.goto('https://www.instagram.com/direct/new/', {
      waitUntil: 'domcontentloaded',
      timeout: this.config.navigationTimeoutMs
    });
    await this.page.waitForTimeout(3000);
    await this.raiseIfSafetyScreen();
    if (await this.appearsLoggedOut()) throw new InstagramSafetyStop('Instagram logged out before the DM search.');
    await this.dismissInstagramPrompt();

    const searchCandidates = [
      this.page.getByRole('textbox', { name: /search/i }),
      this.page.locator('input[placeholder*="search" i]')
    ];
    let search = null;
    for (const candidate of searchCandidates) {
      for (let index = 0; index < await candidate.count(); index += 1) {
        const input = candidate.nth(index);
        if (await input.isVisible().catch(() => false)) {
          search = input;
          break;
        }
      }
      if (search) break;
    }

    if (!search) {
      const newMessage = this.page.getByRole('button', { name: /new message/i });
      if (await newMessage.count() && await newMessage.first().isVisible().catch(() => false)) {
        await newMessage.first().click({ timeout: 5000 });
        await this.page.waitForTimeout(1200);
        search = this.page.getByRole('textbox', { name: /search/i }).first();
        if (!await search.isVisible().catch(() => false)) search = null;
      }
    }

    if (!search) {
      await this.writeDmInspection(comment, false, 'New-message search field was not visible.');
      throw new Error(`Could not open Instagram's recipient search for @${comment.username}.`);
    }

    await search.fill(comment.username);
    await this.page.waitForTimeout(2200);
    await this.raiseIfSafetyScreen();

    const dialog = this.page.getByRole('dialog');
    const scope = await dialog.count() && await dialog.first().isVisible().catch(() => false)
      ? dialog.first()
      : this.page.locator('body');
    const usernameMatches = scope.getByText(comment.username, { exact: true });
    let selected = false;
    for (let index = 0; index < await usernameMatches.count(); index += 1) {
      const username = usernameMatches.nth(index);
      if (!await username.isVisible().catch(() => false)) continue;
      const resultRow = username.locator('xpath=ancestor::*[@role="button" or self::button][1]');
      if (await resultRow.count()) await resultRow.click({ timeout: 5000 });
      else await username.click({ timeout: 5000 });
      selected = true;
      break;
    }
    if (!selected) {
      await this.writeDmInspection(comment, false, 'Exact username was not present in new-message results.');
      throw new Error(`Instagram's recipient search did not return @${comment.username}.`);
    }

    await this.page.waitForTimeout(800);
    let composer = await this.findDmComposer();
    if (composer) return composer;

    const continueButtons = this.page.getByRole('button', { name: /^(chat|next)$/i });
    for (let index = 0; index < await continueButtons.count(); index += 1) {
      const button = continueButtons.nth(index);
      if (!await button.isVisible().catch(() => false) || !await button.isEnabled().catch(() => false)) continue;
      await button.click({ timeout: 5000 });
      break;
    }
    await this.page.waitForTimeout(3000);
    await this.raiseIfSafetyScreen();
    await this.dismissInstagramPrompt();
    composer = await this.findDmComposer();
    if (!composer) {
      await this.writeDmInspection(comment, false, 'Recipient was selected, but no message composer appeared.');
      throw new Error(`Instagram did not open a message composer for @${comment.username}.`);
    }
    return composer;
  }

  async openDirectMessageComposer(comment, purpose = 'DM delivery') {
    if (!this.page) throw new Error('Browser context has not been started.');
    this.logger('INFO', `Opening @${comment.username}'s profile for ${purpose}.`);
    await this.page.goto(comment.profileUrl, {
      waitUntil: 'domcontentloaded',
      timeout: this.config.navigationTimeoutMs
    });
    await this.page.waitForTimeout(3000);
    await this.raiseIfSafetyScreen();
    if (await this.appearsLoggedOut()) throw new InstagramSafetyStop('Instagram logged out before the DM preview.');

    const messageControls = [
      this.page.getByRole('button', { name: /^message$/i }),
      this.page.getByRole('link', { name: /^message$/i })
    ];
    let opened = false;
    for (const controls of messageControls) {
      for (let index = 0; index < await controls.count(); index += 1) {
        const control = controls.nth(index);
        if (!await control.isVisible().catch(() => false)) continue;
        await control.click({ timeout: 5000 });
        opened = true;
        break;
      }
      if (opened) break;
    }
    if (!opened) {
      return await this.openDirectMessageComposerViaSearch(comment);
    }

    await this.page.waitForTimeout(3500);
    await this.raiseIfSafetyScreen();
    await this.dismissInstagramPrompt();

    const composer = await this.findDmComposer();
    if (!composer) {
      await this.writeDmInspection(comment, false, 'Message composer was not visible.');
      throw new Error(`Opened @${comment.username}'s message view, but no composer was visible.`);
    }
    return composer;
  }

  async findCommentReplyButton(comment) {
    const replyButtons = this.page.getByRole('button', { name: /^reply$/i });
    for (let index = 0; index < await replyButtons.count(); index += 1) {
      const button = replyButtons.nth(index);
      const row = button.locator('xpath=ancestor::*[(self::li or self::div) and .//a[@href] and .//time][1]');
      if (!await row.count()) continue;
      const hrefs = await row.locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href') || ''));
      if (!hrefs.some(href => href.toLowerCase() === `/${comment.username.toLowerCase()}/`)) continue;
      const timestamp = await row.locator('time').first().getAttribute('datetime').catch(() => null);
      if (comment.timestamp && timestamp && timestamp !== comment.timestamp) continue;
      return button;
    }
    return null;
  }

  async findCommentComposer() {
    const candidates = [
      this.page.getByRole('textbox', { name: /add a comment/i }),
      this.page.locator('textarea[placeholder*="comment" i]'),
      this.page.locator('[contenteditable="true"][role="textbox"]')
    ];
    for (const candidate of candidates) {
      if (await candidate.count() && await candidate.first().isVisible().catch(() => false)) return candidate.first();
    }
    return null;
  }

  async previewPublicReply(comment) {
    const replyButton = await this.findCommentReplyButton(comment);
    if (!replyButton) throw new Error(`Could not relocate @${comment.username}'s Reply control.`);
    await replyButton.click({ timeout: 5000 });
    await this.page.waitForTimeout(1000);
    const composer = await this.findCommentComposer();
    if (!composer) throw new Error(`Clicked Reply for @${comment.username}, but no comment composer appeared.`);
    await this.writeReplyComposerInspection(comment, composer);
    this.logger('INFO', `Verified @${comment.username}'s public Reply composer. No custom text was entered and Post was not clicked.`);
  }

  async writeReplyComposerInspection(comment, composer) {
    const composerRegion = composer.locator('xpath=ancestor::div[.//*[@role="button" and normalize-space(.)="Post"]][1]');
    const postButtons = await composerRegion.count()
      ? composerRegion.getByRole('button', { name: /^post$/i })
      : this.page.getByRole('button', { name: /^post$/i });
    const buttons = [];
    for (let index = 0; index < await postButtons.count(); index += 1) {
      const button = postButtons.nth(index);
      buttons.push({
        index,
        visible: await button.isVisible().catch(() => false),
        enabled: await button.isEnabled().catch(() => false),
        box: await button.boundingBox().catch(() => null),
        html: (await button.evaluate(element => element.outerHTML).catch(() => '')).slice(0, 4000)
      });
    }
    const report = {
      inspectedAt: new Date().toISOString(),
      username: comment.username,
      composerBox: await composer.boundingBox().catch(() => null),
      composerHtml: (await composer.evaluate(element => element.outerHTML).catch(() => '')).slice(0, 5000),
      composerParentHtml: (await composer.evaluate(element => element.parentElement && element.parentElement.parentElement
        ? element.parentElement.parentElement.outerHTML
        : '').catch(() => '')).slice(0, 15000),
      postButtons: buttons
    };
    const logDir = path.join(__dirname, 'logs');
    await fs.mkdir(logDir, { recursive: true });
    await fs.writeFile(
      path.join(logDir, 'last-reply-composer.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8'
    );
  }

  async composerText(composer) {
    return await composer.inputValue().catch(async () => await composer.textContent().catch(() => '')) || '';
  }

  async sendPublicReply(comment, message) {
    const replyButton = await this.findCommentReplyButton(comment);
    if (!replyButton) throw new Error(`Could not relocate @${comment.username}'s Reply control.`);
    await replyButton.click({ timeout: 5000 });
    await this.page.waitForTimeout(800);
    const composer = await this.findCommentComposer();
    if (!composer) throw new Error(`Clicked Reply for @${comment.username}, but no comment composer appeared.`);

    const existing = await this.composerText(composer);
    const prefix = existing && !/\s$/.test(existing) ? ' ' : '';
    await composer.pressSequentially(`${prefix}${message}`, { delay: 25 });
    const composerRegion = composer.locator('xpath=ancestor::div[.//*[@role="button" and normalize-space(.)="Post"]][1]');
    const postButtons = await composerRegion.count()
      ? composerRegion.getByRole('button', { name: /^post$/i })
      : this.page.getByRole('button', { name: /^post$/i });
    let postButton = null;
    for (let index = 0; index < await postButtons.count(); index += 1) {
      const candidate = postButtons.nth(index);
      if (await candidate.isVisible().catch(() => false) && await candidate.isEnabled().catch(() => false)) {
        postButton = candidate;
        break;
      }
    }
    if (!postButton) throw new Error('The public reply was entered, but no enabled Post button was found.');
    await this.raiseIfSafetyScreen();
    // Instagram's reels overlay can intercept coordinate clicks even when this
    // exact semantic Post control is visible. Dispatch only to the Post control
    // scoped beside the active composer; never use a page-wide forced click.
    await postButton.dispatchEvent('click');
    await this.page.waitForTimeout(2500);
    await this.raiseIfSafetyScreen();
    const confirmation = this.page.getByText(message, { exact: true });
    const visibleConfirmation = await confirmation.count()
      ? await confirmation.first().isVisible().catch(() => false)
      : false;
    const remainingText = await this.composerText(composer);
    if (!visibleConfirmation && remainingText.includes(message)) {
      throw new Error('Post was clicked, but the reply text remained in the composer; posting is unconfirmed.');
    }
    this.logger('INFO', `Public reply posted successfully for @${comment.username}.`);
  }

  async sendDirectMessage(comment, message) {
    const composer = await this.openDirectMessageComposer(comment);
    await composer.fill(message);
    const sendButtons = this.page.getByRole('button', { name: /^send$/i });
    let sendButton = null;
    for (let index = 0; index < await sendButtons.count(); index += 1) {
      const candidate = sendButtons.nth(index);
      if (await candidate.isVisible().catch(() => false) && await candidate.isEnabled().catch(() => false)) {
        sendButton = candidate;
        break;
      }
    }
    if (!sendButton) throw new Error('The DM was entered, but no enabled Send button was found.');
    await this.raiseIfSafetyScreen();
    await sendButton.click({ timeout: 5000 });
    await this.page.waitForTimeout(2500);
    await this.raiseIfSafetyScreen();
    if ((await this.composerText(composer)).trim()) {
      throw new Error('Send was clicked, but the DM composer did not clear; delivery is unconfirmed.');
    }
    this.logger('INFO', `Standardized DM sent successfully to @${comment.username}.`);
  }

  async writeDmInspection(comment, composerFound, error) {
    const logDir = path.join(__dirname, 'logs');
    await fs.mkdir(logDir, { recursive: true });
    const scope = await this.page.locator('main').count() ? this.page.locator('main') : this.page.locator('body');
    const ariaSnapshot = await scope.ariaSnapshot({ timeout: 5000 }).catch(() => '');
    const report = {
      inspectedAt: new Date().toISOString(),
      username: comment.username,
      profileUrl: comment.profileUrl,
      finalUrl: this.page.url(),
      composerFound,
      error,
      ariaSnapshot: ariaSnapshot.slice(0, 30000)
    };
    await fs.writeFile(
      path.join(logDir, 'last-dm-preview.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8'
    );
  }

  async expandCommentControls() {
    if (!this.page) return;
    const names = /^(view all \d+ comments?|view more comments?|load more comments?)$/i;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const controls = this.page.getByRole('button', { name: names });
      const count = await controls.count();
      let clicked = false;
      for (let index = 0; index < count; index += 1) {
        const control = controls.nth(index);
        if (!await control.isVisible().catch(() => false)) continue;
        await control.click({ timeout: 5000 });
        await this.page.waitForTimeout(1200);
        await this.raiseIfSafetyScreen();
        clicked = true;
        break;
      }
      if (!clicked) return;
    }
  }

  matchesTrigger(value, job) {
    const clean = text => String(text || '').trim().replace(/\s+/g, ' ');
    let candidate = clean(value);
    let trigger = clean(job.triggerComment);
    if (job.caseInsensitive !== false) {
      candidate = candidate.toLocaleLowerCase('en-US');
      trigger = trigger.toLocaleLowerCase('en-US');
    }
    return job.exactMatch === false ? candidate.includes(trigger) : candidate === trigger;
  }

  async extractComments(job) {
    const candidates = [];
    const matches = [];
    const seen = new Set();
    const reservedPaths = new Set(['about', 'accounts', 'direct', 'explore', 'reel', 'reels', 'p']);
    const replyButtons = this.page.getByRole('button', { name: /^reply$/i });
    const replyCount = await replyButtons.count();

    for (let index = 0; index < replyCount; index += 1) {
      const replyButton = replyButtons.nth(index);
      const row = replyButton.locator('xpath=ancestor::*[(self::li or self::div) and .//a[@href] and .//time][1]');
      if (!await row.count()) continue;

      const rawText = await row.innerText({ timeout: 3000 }).catch(() => '');
      const lines = rawText.split(/\r?\n/).map(value => value.trim()).filter(Boolean).slice(0, 30);
      if (!lines.length) continue;

      const links = row.locator('a[href]');
      let username = '';
      let profileUrl = '';
      for (let linkIndex = 0; linkIndex < await links.count(); linkIndex += 1) {
        const href = await links.nth(linkIndex).getAttribute('href');
        const match = String(href || '').match(/^\/([A-Za-z0-9._]+)\/?$/);
        if (!match || reservedPaths.has(match[1].toLowerCase())) continue;
        username = match[1];
        profileUrl = new URL(href, INSTAGRAM_HOME).toString();
        break;
      }
      if (!username) continue;

      const possibleText = lines
        .filter(line => line.toLowerCase() !== username.toLowerCase())
        .filter(line => !/^reply$/i.test(line))
        .flatMap(line => {
          const prefix = `${username} `;
          return line.toLowerCase().startsWith(prefix.toLowerCase())
            ? [line, line.slice(prefix.length).trim()]
            : [line];
        });
      const matchedText = possibleText.find(line => this.matchesTrigger(line, job)) || '';
      const time = row.locator('time').first();
      const timestamp = await time.getAttribute('datetime').catch(() => null)
        || await time.innerText().catch(() => null);
      const key = `${username}|${timestamp || ''}|${lines.join('|')}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const candidate = { username, profileUrl, timestamp, lines, matchedText };
      candidates.push(candidate);
      if (matchedText) matches.push({ ...candidate, text: matchedText });
    }

    const scope = await this.page.locator('main').count() ? this.page.locator('main') : this.page.locator('body');
    const ariaSnapshot = await scope.ariaSnapshot({ timeout: 5000 }).catch(() => '');
    return {
      inspectedAt: new Date().toISOString(),
      postUrl: job.postUrl,
      finalUrl: this.page.url(),
      triggerComment: job.triggerComment,
      replyButtonCount: replyCount,
      candidates,
      matches,
      ariaSnapshot: ariaSnapshot.slice(0, 50000)
    };
  }

  async writeInspection(result) {
    const logDir = path.join(__dirname, 'logs');
    await fs.mkdir(logDir, { recursive: true });
    await fs.writeFile(
      path.join(logDir, 'last-dom-inspection.json'),
      `${JSON.stringify(result, null, 2)}\n`,
      'utf8'
    );
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
