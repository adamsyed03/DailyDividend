'use strict';

const fsSync = require('fs');
const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

const BOT_DIR = __dirname;
const JOB_FILE = path.join(BOT_DIR, 'data', 'current-job.json');
const MAX_LOG_LINES = 120;

function cleanLine(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function validatePostUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || '').trim());
  } catch (_) {
    throw new Error('Enter a valid Instagram post or reel URL.');
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(host)) {
    throw new Error('The post URL must be an HTTPS instagram.com link.');
  }
  if (!/^\/(p|reel|reels|tv)\/[^/]+\/?/i.test(parsed.pathname)) {
    throw new Error('Use a direct Instagram post or reel URL.');
  }
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString();
}

function integerInRange(value, name, min, max, fallback) {
  const number = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be a whole number from ${min} to ${max}.`);
  }
  return number;
}

function normalizeHttpsLink(value, fieldName) {
  const link = cleanLine(value, 2000);
  if (!link) return '';
  let parsed;
  try { parsed = new URL(link); } catch (_) {
    throw new Error(`${fieldName} is not a valid URL.`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`${fieldName} must use HTTPS.`);
  return parsed.toString();
}

function normalizeJob(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Instagram bot settings are required.');
  }

  const triggerComment = cleanLine(input.triggerComment, 100);
  if (!triggerComment) throw new Error('Enter the comment to look for.');

  if (!Array.isArray(input.commentReplies) || input.commentReplies.length < 1 || input.commentReplies.length > 10) {
    throw new Error('Add between 1 and 10 public comment replies.');
  }

  const commentReplies = input.commentReplies.map((reply, index) => {
    const text = cleanLine(reply, 500);
    if (!text) throw new Error(`Public reply ${index + 1} cannot be empty.`);
    return text;
  });

  const dmInput = input.directMessage && typeof input.directMessage === 'object'
    ? input.directMessage
    : {};
  const directMessage = {
    text: cleanLine(dmInput.text, 2000),
    link: normalizeHttpsLink(dmInput.link, 'The standardized DM link')
  };
  if (!directMessage.text) throw new Error('Enter the standardized DM text.');

  return {
    version: 2,
    postUrl: validatePostUrl(input.postUrl),
    triggerComment,
    exactMatch: input.exactMatch !== false,
    caseInsensitive: input.caseInsensitive !== false,
    commentReplies,
    directMessage,
    pollIntervalSeconds: integerInRange(input.pollIntervalSeconds, 'Polling interval', 60, 3600, 180),
    maxDmsPerHour: integerInRange(input.maxDmsPerHour, 'Hourly DM limit', 1, 50, 10),
    maxDmsPerDay: integerInRange(input.maxDmsPerDay, 'Daily DM limit', 1, 200, 30),
    updatedAt: new Date().toISOString()
  };
}

async function readJob() {
  try {
    const raw = await fs.readFile(JOB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function createInstagramBotController() {
  let child = null;
  const state = {
    running: false,
    mode: null,
    startedAt: null,
    stoppedAt: null,
    exitCode: null,
    lastError: null,
    logs: []
  };

  function addLog(source, chunk) {
    String(chunk || '').split(/\r?\n/).filter(Boolean).forEach(line => {
      state.logs.push({ at: new Date().toISOString(), source, message: line.slice(0, 2000) });
    });
    if (state.logs.length > MAX_LOG_LINES) state.logs.splice(0, state.logs.length - MAX_LOG_LINES);
  }

  async function status() {
    return {
      ...state,
      enginePhase: 1,
      capabilities: { login: true, dryRun: false, live: false },
      job: await readJob()
    };
  }

  async function saveJob(input) {
    const job = normalizeJob(input);
    await fs.mkdir(path.dirname(JOB_FILE), { recursive: true });
    await fs.writeFile(JOB_FILE, `${JSON.stringify(job, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    addLog('control', 'Instagram automation settings saved locally.');
    return job;
  }

  async function start(mode) {
    if (mode !== 'login') {
      throw new Error('Dry-run scanning and live sending stay locked until Phase 1 login testing is complete.');
    }
    if (state.running || child) throw new Error('The Instagram browser is already running.');

    const playwrightPackage = path.join(BOT_DIR, '..', 'node_modules', 'playwright', 'package.json');
    if (!fsSync.existsSync(playwrightPackage)) {
      throw new Error('Playwright is not installed. Run npm install once from the Daily Dividend folder.');
    }

    const args = [path.join(BOT_DIR, 'bot.js'), '--login-only'];
    state.running = true;
    state.mode = mode;
    state.startedAt = new Date().toISOString();
    state.stoppedAt = null;
    state.exitCode = null;
    state.lastError = null;
    addLog('control', 'Starting the local Instagram login browser.');

    child = spawn(process.execPath, args, {
      cwd: BOT_DIR,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', chunk => addLog('stdout', chunk));
    child.stderr.on('data', chunk => addLog('stderr', chunk));
    child.on('error', error => {
      state.lastError = error.message;
      addLog('error', error.message);
    });
    child.on('exit', code => {
      state.running = false;
      state.stoppedAt = new Date().toISOString();
      state.exitCode = code;
      addLog('control', `Instagram browser process exited with code ${code}.`);
      child = null;
    });
    return status();
  }

  async function stop() {
    if (!child) return status();
    addLog('control', 'Stopping the Instagram browser process.');
    child.kill('SIGTERM');
    return status();
  }

  function shutdown() {
    if (child) child.kill('SIGTERM');
  }

  return { status, saveJob, start, stop, shutdown };
}

module.exports = { createInstagramBotController, normalizeJob };
